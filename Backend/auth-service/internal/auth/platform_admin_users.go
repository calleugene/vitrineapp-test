package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var errAdminMailQuota = errors.New("admin_mail_quota")

func (s *Service) queueAdminPassword(ctx context.Context, user User) error {
	if s.config.SendPasswordReset == nil {
		return ErrServiceUnavailable
	}
	now := s.config.now()
	allowed, err := s.repo.AllowPasswordReset(ctx, "admin-invite:"+user.ID, now)
	if err != nil {
		return err
	}
	if !allowed {
		return errAdminMailQuota
	}
	return s.repo.QueuePasswordReset(ctx, newID("mail"), user.Email, now)
}

type adminUserRow struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Status   string `json:"status"`
}

func (r *profileRepository) ListAdminUsers(ctx context.Context, search string, offset int) ([]adminUserRow, error) {
	pattern := "%" + strings.ToLower(search) + "%"
	rows, err := r.db.QueryContext(ctx, r.query(`SELECT id,full_name,email,role,status FROM users
		WHERE role<>'platform_admin' AND LOWER(status)<>'deleted'
		AND (LOWER(email) LIKE ? OR LOWER(full_name) LIKE ? OR id LIKE ?)
		ORDER BY full_name,id LIMIT 51 OFFSET ?`), pattern, pattern, pattern, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []adminUserRow{}
	for rows.Next() {
		var item adminUserRow
		if err := rows.Scan(&item.ID, &item.FullName, &item.Email, &item.Role, &item.Status); err != nil {
			return nil, err
		}
		users = append(users, item)
	}
	return users, rows.Err()
}

func (r *profileRepository) RecordAdminAction(ctx context.Context, id, actor, action, detail string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, r.query(`INSERT INTO user_activities(id,user_id,action,details,created_at) VALUES(?,?,?,?,?)`),
		id, actor, action, detail, now)
	return err
}

func (s *Service) auditAdmin(ctx context.Context, actor, action, target, reason string) error {
	detail, err := json.Marshal(map[string]string{"target": target, "reason": reason})
	if err != nil {
		return err
	}
	return s.repo.RecordAdminAction(ctx, newID("act"), actor, action, string(detail), s.config.now())
}

func (s *Service) adminSession(w http.ResponseWriter, r *http.Request) (accessClaims, bool) {
	claims, _, _, err := s.platformAdminSession(r)
	if err != nil {
		writeServiceError(w, err)
	}
	return claims, err == nil
}

func (s *Service) adminTarget(w http.ResponseWriter, r *http.Request) (User, bool) {
	target, err := s.repo.FindUserByID(r.Context(), r.PathValue("userId"))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (target.Role == platformAdminRole || strings.EqualFold(target.Status, "deleted"))) {
		err = ErrNotFound
	}
	if err != nil {
		writeServiceError(w, err)
	}
	return target, err == nil
}

func (s *Service) adminUsers(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.adminSession(w, r); !ok {
		return
	}
	search := strings.TrimSpace(r.URL.Query().Get("q"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if len(search) > 254 || page < 0 || page > 100000 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	users, err := s.repo.ListAdminUsers(r.Context(), search, page*50)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	more := len(users) > 50
	if more {
		users = users[:50]
	}
	writeJSON(w, 200, map[string]any{"users": users, "more": more})
}

func (s *Service) adminInviteUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	var req struct {
		Email string `json:"email"`
		Name  string `json:"full_name"`
		Role  string `json:"role"`
	}
	if decodeJSON(r.Body, &req) != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	req.Email, req.Name = normalizeEmail(req.Email), strings.TrimSpace(req.Name)
	if !validEmail(req.Email) || req.Email == s.config.PlatformAdminEmail || len(req.Name) == 0 || len(req.Name) > 200 ||
		(req.Role != "visitor" && req.Role != "methodist") {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if s.config.SendPasswordReset == nil {
		writeServiceError(w, ErrServiceUnavailable)
		return
	}
	ctx := r.Context()
	if _, err := s.repo.FindUserByEmail(ctx, req.Email); !errors.Is(err, sql.ErrNoRows) {
		if err == nil {
			err = ErrEmailAlreadyExists
		}
		writeServiceError(w, err)
		return
	}
	password, _, err := generateOpaqueToken()
	if err != nil {
		writeServiceError(w, err)
		return
	}
	hash, err := hashPassword(password)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	now := s.config.now()
	user := User{ID: newID("usr"), Email: req.Email, FullName: req.Name, Role: req.Role, Status: "INVITED",
		RegistrationSource: "admin_invite", CreatedAt: now, UpdatedAt: now, RegisteredAt: now}
	if err = s.auditAdmin(ctx, actor.UserID, "platform_user_invite", user.ID, ""); err == nil {
		err = s.repo.CreateUser(ctx, user, hash)
	}
	if err == nil {
		err = s.queueAdminPassword(ctx, user)
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 201, userResponse{User: user})
}

func (s *Service) adminUser(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	target, ok := s.adminTarget(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	if r.Method == http.MethodPatch {
		var req updateUserRequest
		if decodeJSON(r.Body, &req) != nil {
			writeServiceError(w, ErrBadRequest)
			return
		}
		if err := s.auditAdmin(ctx, actor.UserID, "platform_user_edit", target.ID, ""); err != nil {
			writeServiceError(w, err)
			return
		}
		var err error
		target, err = s.updateUserProfile(ctx, target, req, true)
		if err != nil {
			writeServiceError(w, err)
			return
		}
	}
	memberships, err := s.repo.MuseumMemberships(ctx, target.ID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"user": target, "museums": memberships})
}

func (s *Service) adminUserAction(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	target, ok := s.adminTarget(w, r)
	if !ok {
		return
	}
	if r.PathValue("action") == "avatar" {
		if !strings.EqualFold(target.Status, "active") {
			writeServiceError(w, ErrForbidden)
			return
		}
		if err := s.auditAdmin(r.Context(), actor.UserID, "platform_user_avatar", target.ID, ""); err != nil {
			writeServiceError(w, err)
			return
		}
		s.uploadProfileAvatar(w, r)
		return
	}
	var req struct {
		Reason   string `json:"reason"`
		Email    string `json:"email"`
		MuseumID string `json:"museum_id"`
		Role     string `json:"role"`
	}
	action := r.PathValue("action")
	if decodeJSON(r.Body, &req) != nil || len(req.Reason) > 600 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	switch action {
	case "block", "delete", "revoke-sessions":
		if strings.TrimSpace(req.Reason) == "" {
			writeServiceError(w, ErrBadRequest)
			return
		}
	case "membership":
		if req.MuseumID == "" || len(req.MuseumID) > 128 || strings.ContainsAny(req.MuseumID, "/\\?#%") ||
			((req.Role == "owner" || req.Role == "") && strings.TrimSpace(req.Reason) == "") {
			writeServiceError(w, ErrBadRequest)
			return
		}
	case "unblock", "restore", "methodist", "reset-password", "email":
	default:
		writeServiceError(w, ErrNotFound)
		return
	}
	ctx := r.Context()
	auditTarget := target.ID
	if action == "membership" {
		auditTarget += "/" + req.MuseumID
	}
	if err := s.auditAdmin(ctx, actor.UserID, "platform_user_"+action, auditTarget, strings.TrimSpace(req.Reason)); err != nil {
		writeServiceError(w, err)
		return
	}
	var err error
	switch action {
	case "email":
		if !strings.EqualFold(target.Status, "active") {
			writeServiceError(w, ErrForbidden)
			return
		}
		s.sendEmailChange(w, r, target, req.Email, false)
		return
	case "reset-password":
		err = s.queueAdminPassword(ctx, target)
	case "block":
		err = s.repo.AdminUserState(ctx, target.ID, "disabled", s.config.now())
	case "unblock":
		err = s.repo.AdminUserState(ctx, target.ID, "ACTIVE", s.config.now())
	case "delete":
		err = s.repo.AdminUserState(ctx, target.ID, "DORMANT", s.config.now())
	case "restore":
		err = s.repo.TransitionAccount(ctx, target.ID, true, s.config.now())
	case "methodist":
		err = s.repo.AdminUserState(ctx, target.ID, "methodist", s.config.now())
	case "revoke-sessions":
		err = s.repo.RevokeSessionsByUserID(ctx, target.ID, s.config.now())
	case "membership":
		if _, err = s.loadMuseum(ctx, req.MuseumID); err == nil {
			err = s.repo.AdminMuseumMembership(ctx, req.MuseumID, target.ID, req.Role, s.config.now())
		}
	}
	if errors.Is(err, errAdminMailQuota) {
		w.Header().Set("Retry-After", "1800")
		writeError(w, 429, "too_many_requests")
		return
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *profileRepository) AdminUserState(ctx context.Context, id, state string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var result sql.Result
	stamp := now.UTC().Format(time.RFC3339)
	switch state {
	case "methodist":
		result, err = tx.ExecContext(ctx, r.query(`UPDATE users SET role='methodist',updated_at=? WHERE id=? AND role IN ('visitor','methodist') AND status<>'DELETED'`), stamp, id)
	case "DORMANT":
		result, err = tx.ExecContext(ctx, r.query(`UPDATE users SET status='DORMANT',deactivated_at=?,scheduled_deletion_at=?,updated_at=?
			WHERE id=? AND role<>'platform_admin' AND LOWER(status) IN ('active','disabled','invited')
			AND NOT EXISTS(SELECT 1 FROM museum_memberships WHERE user_id=? AND role='owner')`), stamp, now.Add(30*24*time.Hour).UTC().Format(time.RFC3339), stamp, id, id)
	case "disabled":
		result, err = tx.ExecContext(ctx, r.query(`UPDATE users SET status='disabled',updated_at=? WHERE id=? AND role<>'platform_admin' AND LOWER(status)='active'`), stamp, id)
	case "ACTIVE":
		result, err = tx.ExecContext(ctx, r.query(`UPDATE users SET status='ACTIVE',updated_at=? WHERE id=? AND role<>'platform_admin' AND LOWER(status)='disabled'`), stamp, id)
	default:
		return ErrBadRequest
	}
	if err != nil {
		return err
	}
	if err = ensureRows(result); err != nil {
		return ErrForbidden
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`), stamp, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) adminTeam(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	if actor.MuseumID == "" || r.URL.Query().Get("museum_id") != actor.MuseumID {
		writeServiceError(w, ErrForbidden)
		return
	}
	ctx := r.Context()
	if r.Method == http.MethodPut {
		if _, err := s.loadMuseum(ctx, actor.MuseumID); err != nil {
			writeServiceError(w, err)
			return
		}
		var req struct {
			UserID string `json:"user_id"`
			Role   string `json:"role"`
			Reason string `json:"reason"`
		}
		if decodeJSON(r.Body, &req) != nil || len(req.UserID) > 128 || len(req.Reason) > 600 ||
			req.UserID == "" || ((req.Role == "owner" || req.Role == "") && strings.TrimSpace(req.Reason) == "") {
			writeServiceError(w, ErrBadRequest)
			return
		}
		if err := s.auditAdmin(ctx, actor.UserID, "platform_team_"+req.Role, actor.MuseumID+"/"+req.UserID, req.Reason); err != nil {
			writeServiceError(w, err)
			return
		}
		if err := s.repo.AdminMuseumMembership(ctx, actor.MuseumID, req.UserID, req.Role, s.config.now()); err != nil {
			writeServiceError(w, err)
			return
		}
	}
	members, err := s.repo.MuseumMembers(ctx, actor.MuseumID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"members": members})
}

func (r *profileRepository) AdminMuseumMembership(ctx context.Context, museum, user, role string, now time.Time) error {
	if role != "" && role != "methodist" && role != "museum_admin" && role != "owner" {
		return ErrBadRequest
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if r.postgres {
		if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "admin-museum:"+museum); err != nil {
			return err
		}
	}
	stamp := now.UTC().Format(time.RFC3339)
	if role == "" {
		result, err := tx.ExecContext(ctx, r.query(`DELETE FROM museum_memberships WHERE museum_id=? AND user_id=? AND role<>'owner'`), museum, user)
		if err != nil {
			return err
		}
		if err = ensureRows(result); err != nil {
			return ErrForbidden
		}
		if _, err = tx.ExecContext(ctx, r.query(`UPDATE users SET museum_id=(SELECT museum_id FROM museum_memberships WHERE user_id=? ORDER BY museum_id LIMIT 1),
			updated_at=? WHERE id=? AND museum_id=?`), user, stamp, user, museum); err != nil {
			return err
		}
		return tx.Commit()
	}
	result, err := tx.ExecContext(ctx, r.query(`UPDATE users SET role=CASE WHEN role='visitor' THEN 'methodist' ELSE role END,updated_at=?
		WHERE id=? AND role<>'platform_admin' AND (LOWER(status)='active' OR (LOWER(status)='invited' AND ?<>'owner'))`), stamp, user, role)
	if err != nil {
		return err
	}
	if err = ensureRows(result); err != nil {
		return ErrForbidden
	}
	if role == "owner" {
		if _, err = tx.ExecContext(ctx, r.query(`UPDATE museum_memberships SET role='museum_admin' WHERE museum_id=? AND role='owner' AND user_id<>?`), museum, user); err != nil {
			return err
		}
	}
	result, err = tx.ExecContext(ctx, r.query(`INSERT INTO museum_memberships(user_id,museum_id,role) VALUES(?,?,?)
		ON CONFLICT(user_id,museum_id) DO UPDATE SET role=excluded.role
		WHERE museum_memberships.role<>'owner' OR excluded.role='owner'`), user, museum, role)
	if err != nil {
		return err
	}
	if err = ensureRows(result); err != nil {
		return ErrForbidden
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE users SET museum_id=COALESCE(museum_id,?) WHERE id=?`), museum, user); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`), stamp, user); err != nil {
		return err
	}
	return tx.Commit()
}
