package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const platformAdminRole = "platform_admin"
const platformAdminCookie = "__Secure-vitrina-admin"
const platformAdminPath = "/api/auth/api/v1/auth/admin/"

func (r *profileRepository) RecordPlatformContext(ctx context.Context, id, userID, previousMuseum, museumID, reason string, now time.Time) error {
	details, err := json.Marshal(map[string]string{"previous_museum_id": previousMuseum, "museum_id": museumID, "reason": reason})
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, r.query(`INSERT INTO user_activities(id,user_id,action,details,created_at) VALUES(?,?,?,?,?)`),
		id, userID, "platform_museum_context", string(details), now)
	return err
}

func (r *profileRepository) MovePlatformAdminEmail(ctx context.Context, userID, previousEmail, email string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var stamp any = now
	if !r.postgres {
		stamp = now.Format(time.RFC3339)
	}
	result, err := tx.ExecContext(ctx, r.query(`UPDATE users SET email=?, email_verified_at=NULL, updated_at=?,
		status=CASE WHEN status='ACTIVE' THEN 'ADMIN_PENDING' ELSE status END
		WHERE id=? AND email=? AND role='platform_admin'`), email, stamp, userID, previousEmail)
	if err != nil {
		return err
	}
	if err = ensureRows(result); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`), stamp, userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`DELETE FROM password_reset_tokens WHERE user_id=?`), userID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`DELETE FROM password_reset_mail WHERE email IN (?,?)`), previousEmail, email); err != nil {
		return err
	}
	return tx.Commit()
}

// BootstrapPlatformAdmin provisions the reserved identity or migrates an explicitly
// configured previous administrator. It never promotes an ordinary account.
func (s *Service) BootstrapPlatformAdmin(ctx context.Context) error {
	email := s.config.PlatformAdminEmail
	if email == "" {
		return nil
	}
	if !validEmail(email) {
		return ErrBadRequest
	}
	if previous := s.config.PlatformAdminPreviousEmail; previous != "" && previous != email {
		old, err := s.repo.FindUserByEmail(ctx, previous)
		if err == nil && old.Role == platformAdminRole {
			return s.repo.MovePlatformAdminEmail(ctx, old.ID, previous, email, s.config.now())
		}
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	current, err := s.repo.FindUserByEmail(ctx, email)
	if err == nil {
		if current.Role != platformAdminRole {
			return errors.New("reserved platform admin email belongs to an existing account")
		}
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	password, _, err := generateOpaqueToken()
	if err != nil {
		return err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	now := s.config.now()
	return s.repo.CreateUser(ctx, User{
		ID: newID("usr"), Email: email, FullName: "Администратор Витрины",
		Role: platformAdminRole, Status: "ADMIN_PENDING", RegistrationSource: "platform_provisioning",
		CreatedAt: now, UpdatedAt: now, RegisteredAt: now,
	}, hash)
}

func (s *Service) platformAdminRoutes(mux *http.ServeMux) {
	if s.config.PlatformAdminEmail == "" || s.config.PlatformAdminOrigin == "" {
		return
	}
	handle := func(pattern string, handler http.HandlerFunc) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != http.MethodGet && r.Header.Get("Origin") != s.config.PlatformAdminOrigin {
				writeServiceError(w, ErrForbidden)
				return
			}
			if strings.HasSuffix(r.URL.Path, "/avatar") {
				r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
			} else if !strings.HasPrefix(r.URL.Path, "/api/v1/auth/admin/content/") {
				r.Body = http.MaxBytesReader(w, r.Body, 32768)
			}
			handler(w, r)
		})
	}
	handle("POST /api/v1/auth/admin/login", s.platformAdminLogin)
	handle("POST /api/v1/auth/admin/logout", s.platformAdminLogout)
	handle("GET /api/v1/auth/admin/museums", s.platformAdminMuseums)
	handle("POST /api/v1/auth/admin/context", s.platformAdminContext)
	handle("GET /api/v1/auth/admin/workspace", s.platformAdminWorkspace)
	handle("GET /api/v1/auth/admin/users", s.adminUsers)
	handle("GET /api/v1/auth/admin/exhibits", s.adminExhibits)
	handle("POST /api/v1/auth/admin/users", s.adminInviteUser)
	handle("GET /api/v1/auth/admin/users/{userId}", s.adminUser)
	handle("PATCH /api/v1/auth/admin/users/{userId}", s.adminUser)
	handle("POST /api/v1/auth/admin/users/{userId}/{action}", s.adminUserAction)
	handle("GET /api/v1/auth/admin/team", s.adminTeam)
	handle("PUT /api/v1/auth/admin/team", s.adminTeam)
	handle("POST /api/v1/auth/admin/museums", s.adminCreateMuseum)
	handle("/api/v1/auth/admin/content/{path...}", s.adminContent)
}

func (s *Service) platformAdminLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if decodeJSON(r.Body, &req) != nil || len(req.Password) > 1024 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	ctx := r.Context()
	source := tokenHashString(s.clientIP(r))
	allowed, err := s.repo.AllowPlatformAdminLogin(ctx, source, s.config.now())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if !allowed {
		w.Header().Set("Retry-After", "900")
		writeError(w, 429, "too_many_requests")
		return
	}
	if normalizeEmail(req.Email) != s.config.PlatformAdminEmail {
		writeServiceError(w, ErrInvalidCredentials)
		return
	}
	pair, err := s.login(ctx, req, platformAdminRole)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if err = s.repo.ClearPlatformAdminLogin(ctx, source); err != nil {
		_ = s.Logout(ctx, pair.AccessToken, pair.RefreshToken)
		writeServiceError(w, err)
		return
	}
	setPlatformAdminCookie(w, pair, int(s.config.AccessTokenTTL.Seconds()))
	w.WriteHeader(http.StatusNoContent)
}

func setPlatformAdminCookie(w http.ResponseWriter, pair tokenPairResponse, maxAge int) {
	value := ""
	if maxAge > 0 {
		value = pair.AccessToken + "~" + pair.RefreshToken
	}
	http.SetCookie(w, &http.Cookie{
		Name: platformAdminCookie, Value: value, Path: platformAdminPath,
		Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: maxAge,
	})
}

func (s *Service) platformAdminSession(r *http.Request) (accessClaims, User, string, error) {
	cookie, err := r.Cookie(platformAdminCookie)
	if err != nil {
		return accessClaims{}, User{}, "", ErrUnauthorized
	}
	access, refresh, ok := strings.Cut(cookie.Value, "~")
	if !ok {
		return accessClaims{}, User{}, "", ErrUnauthorized
	}
	claims, user, err := s.Authenticate(r.Context(), access)
	if err != nil {
		return accessClaims{}, User{}, "", err
	}
	if claims.Role != platformAdminRole || user.Role != platformAdminRole || user.Email != s.config.PlatformAdminEmail || !strings.EqualFold(user.Status, "active") {
		return accessClaims{}, User{}, "", ErrForbidden
	}
	return claims, user, refresh, nil
}

func (s *Service) platformAdminLogout(w http.ResponseWriter, r *http.Request) {
	claims, _, _, err := s.platformAdminSession(r)
	if err == nil {
		err = s.repo.RevokeSession(r.Context(), claims.SessionID, s.config.now())
	}
	if err != nil && !errors.Is(err, ErrUnauthorized) {
		writeServiceError(w, err)
		return
	}
	setPlatformAdminCookie(w, tokenPairResponse{}, -1)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) platformAdminMuseums(w http.ResponseWriter, r *http.Request) {
	claims, _, _, err := s.platformAdminSession(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	var response struct {
		Museums []json.RawMessage `json:"museums"`
		Current string            `json:"current_museum_id"`
	}
	if err := s.loadPlatformAdminData(r.Context(), "/internal/admin/museums", &response); err != nil {
		writeServiceError(w, err)
		return
	}
	response.Current = claims.MuseumID
	writeJSON(w, http.StatusOK, response)
}

func (s *Service) platformAdminContext(w http.ResponseWriter, r *http.Request) {
	claims, user, refresh, err := s.platformAdminSession(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	var req struct {
		MuseumID string `json:"museum_id"`
		Reason   string `json:"reason"`
	}
	if decodeJSON(r.Body, &req) != nil || len(req.MuseumID) > 128 || len(req.Reason) > 600 || (req.MuseumID != "" && strings.TrimSpace(req.Reason) == "") {
		writeServiceError(w, ErrBadRequest)
		return
	}
	user.MuseumID = nil
	if req.MuseumID != "" {
		var museum json.RawMessage
		if err = s.loadPlatformAdminData(r.Context(), "/internal/admin/museums/"+url.PathEscape(req.MuseumID), &museum); err != nil {
			writeServiceError(w, err)
			return
		}
		user.MuseumID = &req.MuseumID
	}
	ctx := r.Context()
	session, err := s.repo.FindSessionByRefreshHash(ctx, tokenHashString(refresh))
	if err != nil || session.ID != claims.SessionID {
		writeServiceError(w, ErrUnauthorized)
		return
	}
	pair, err := s.rotateSession(ctx, user, tokenHashString(refresh), session.RefreshExpiresAt)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if err = s.repo.RecordPlatformContext(ctx, newID("act"), user.ID, claims.MuseumID, req.MuseumID, strings.TrimSpace(req.Reason), s.config.now()); err != nil {
		_ = s.Logout(ctx, pair.AccessToken, pair.RefreshToken)
		writeServiceError(w, err)
		return
	}
	setPlatformAdminCookie(w, pair, int(s.config.AccessTokenTTL.Seconds()))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) platformAdminWorkspace(w http.ResponseWriter, r *http.Request) {
	claims, _, _, err := s.platformAdminSession(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if claims.MuseumID == "" || r.URL.Query().Get("museum_id") != claims.MuseumID {
		writeServiceError(w, ErrForbidden)
		return
	}
	var result json.RawMessage
	path := "/internal/admin/museums/" + url.PathEscape(claims.MuseumID)
	if page, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && page > 0 {
		path += "?page=" + strconv.Itoa(page)
	}
	if err := s.loadPlatformAdminData(r.Context(), path, &result); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) loadPlatformAdminData(ctx context.Context, path string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(s.config.MuseumServiceURL, "/")+path, nil)
	if err != nil {
		return ErrServiceUnavailable
	}
	req.Header.Set("X-Service-Secret", s.config.TokenSecret)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return ErrServiceUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(target) != nil {
		return ErrServiceUnavailable
	}
	return nil
}
