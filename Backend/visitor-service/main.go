package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

const guestTokenBytes = 32

type service struct {
	db             *sql.DB
	driver         string
	tokenSecret    string
	authServiceURL string
	httpClient     *http.Client
	now            func() time.Time
}

type visitor struct {
	ID       string     `json:"id"`
	IsGuest  bool       `json:"is_guest"`
	LinkedAt *time.Time `json:"linked_at,omitempty"`
}

type guestResponse struct {
	Visitor        visitor `json:"visitor"`
	GuestLinkToken string  `json:"guest_link_token"`
}

type linkRequest struct {
	GuestVisitorID string `json:"guest_visitor_id"`
	GuestLinkToken string `json:"guest_link_token"`
}

type accessClaims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
}

func main() {
	dsn := envOr("DB_DSN", "file:visitor.db?_pragma=foreign_keys(1)")
	driver := detectDriver(dsn)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := initSchema(context.Background(), db, driver); err != nil {
		log.Fatal(err)
	}
	secret := os.Getenv("AUTH_TOKEN_SECRET")
	if len(secret) < 32 {
		log.Fatal("AUTH_TOKEN_SECRET must be at least 32 bytes")
	}
	s := &service{db: db, driver: driver, tokenSecret: secret, authServiceURL: strings.TrimRight(envOr("AUTH_SERVICE_URL", "http://auth-service:8080/api/v1"), "/"), httpClient: &http.Client{Timeout: 5 * time.Second}, now: func() time.Time { return time.Now().UTC() }}
	addr := envOr("PORT", "8088")
	if !strings.Contains(addr, ":") {
		addr = ":" + addr
	}
	log.Printf("visitor service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(s.handler(), allowedOrigins(os.Getenv("VISITOR_CORS_ORIGINS")))))
}

func (s *service) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /visitors/guest", s.createGuest)
	mux.HandleFunc("POST /api/v1/visitors/guest", s.createGuest)
	mux.HandleFunc("POST /visitors/link", s.linkGuest)
	mux.HandleFunc("POST /api/v1/visitors/link", s.linkGuest)
	mux.HandleFunc("GET /visitors/{visitorId}/profile", s.getProfile)
	mux.HandleFunc("GET /api/v1/visitors/{visitorId}/profile", s.getProfile)
	mux.HandleFunc("GET /visitors/{visitorId}/collection", s.getCollection)
	mux.HandleFunc("GET /api/v1/visitors/{visitorId}/collection", s.getCollection)
	return http.MaxBytesHandler(mux, 1<<20)
}

func (s *service) createGuest(w http.ResponseWriter, r *http.Request) {
	id, err := randomID("gst")
	if err != nil {
		internalError(w, err)
		return
	}
	linkToken, err := randomToken()
	if err != nil {
		internalError(w, err)
		return
	}
	now := s.now()
	if _, err := s.db.ExecContext(r.Context(), bind(s.driver, `INSERT INTO visitors (id, user_id, is_guest, guest_link_token_hash, merged_into, created_at, linked_at) VALUES (?, NULL, ?, ?, NULL, ?, NULL)`), id, true, tokenHash(linkToken), now); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, guestResponse{Visitor: visitor{ID: id, IsGuest: true}, GuestLinkToken: linkToken})
}

func (s *service) linkGuest(w http.ResponseWriter, r *http.Request) {
	claims, err := s.authenticate(r.Header.Get("Authorization"))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if claims.Role != "visitor" {
		writeError(w, http.StatusForbidden, "visitor_role_required")
		return
	}
	var req linkRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	if req.GuestVisitorID == "" || req.GuestLinkToken == "" {
		writeError(w, http.StatusBadRequest, "guest_credentials_required")
		return
	}
	linked, err := s.link(r.Context(), claims.UserID, req.GuestVisitorID, req.GuestLinkToken)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			writeError(w, http.StatusNotFound, "guest_not_found")
		case errors.Is(err, errInvalidGuestToken):
			writeError(w, http.StatusUnauthorized, "invalid_guest_link_token")
		case errors.Is(err, errGuestAlreadyLinked):
			writeError(w, http.StatusConflict, "guest_already_linked")
		default:
			internalError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]visitor{"visitor": linked})
}

var errInvalidGuestToken = errors.New("invalid guest link token")
var errGuestAlreadyLinked = errors.New("guest already linked")

func (s *service) link(ctx context.Context, userID, guestID, rawGuestToken string) (visitor, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return visitor{}, err
	}
	defer tx.Rollback()
	var guestHash sql.NullString
	var mergedInto sql.NullString
	var isGuest bool
	if err := tx.QueryRowContext(ctx, bind(s.driver, `SELECT guest_link_token_hash, merged_into, is_guest FROM visitors WHERE id = ?`), guestID).Scan(&guestHash, &mergedInto, &isGuest); err != nil {
		return visitor{}, err
	}
	if !isGuest || mergedInto.Valid {
		return visitor{}, errGuestAlreadyLinked
	}
	if !guestHash.Valid || !hmac.Equal([]byte(guestHash.String), []byte(tokenHash(rawGuestToken))) {
		return visitor{}, errInvalidGuestToken
	}
	var accountID string
	err = tx.QueryRowContext(ctx, bind(s.driver, `SELECT id FROM visitors WHERE user_id = ?`), userID).Scan(&accountID)
	if errors.Is(err, sql.ErrNoRows) {
		accountID, err = accountVisitorID(userID)
		if err != nil {
			return visitor{}, err
		}
		now := s.now()
		if _, err := tx.ExecContext(ctx, bind(s.driver, `INSERT INTO visitors (id, user_id, is_guest, guest_link_token_hash, merged_into, created_at, linked_at) VALUES (?, ?, ?, NULL, NULL, ?, ?)`), accountID, userID, false, now, now); err != nil {
			return visitor{}, err
		}
	} else if err != nil {
		return visitor{}, err
	}
	if _, err := tx.ExecContext(ctx, bind(s.driver, `INSERT INTO visitor_artifact_status (visitor_id, artifact_id, found, is_favorite, updated_at) SELECT ?, artifact_id, found, is_favorite, ? FROM visitor_artifact_status WHERE visitor_id = ? ON CONFLICT(visitor_id, artifact_id) DO UPDATE SET found = visitor_artifact_status.found OR excluded.found, is_favorite = visitor_artifact_status.is_favorite OR excluded.is_favorite, updated_at = excluded.updated_at`), accountID, s.now(), guestID); err != nil {
		return visitor{}, err
	}
	if _, err := tx.ExecContext(ctx, bind(s.driver, `UPDATE visitors SET merged_into = ?, guest_link_token_hash = NULL WHERE id = ? AND merged_into IS NULL`), accountID, guestID); err != nil {
		return visitor{}, err
	}
	if err := tx.Commit(); err != nil {
		return visitor{}, err
	}
	now := s.now()
	return visitor{ID: accountID, IsGuest: false, LinkedAt: &now}, nil
}

func (s *service) getProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("visitorId")
	if !s.canReadVisitor(r, id) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var found, favorites int
	err := s.db.QueryRowContext(r.Context(), bind(s.driver, `SELECT COALESCE(SUM(CASE WHEN found THEN 1 ELSE 0 END), 0), COALESCE(SUM(CASE WHEN is_favorite THEN 1 ELSE 0 END), 0) FROM visitor_artifact_status WHERE visitor_id = ?`), id).Scan(&found, &favorites)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"visitor_id": id, "artifacts_found": found, "favorites": favorites})
}

func (s *service) getCollection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("visitorId")
	if !s.canReadVisitor(r, id) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	rows, err := s.db.QueryContext(r.Context(), bind(s.driver, `SELECT artifact_id, found, is_favorite FROM visitor_artifact_status WHERE visitor_id = ? AND (found = ? OR is_favorite = ?)`), id, true, true)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var artifactID string
		var found, favorite bool
		if err := rows.Scan(&artifactID, &found, &favorite); err != nil {
			internalError(w, err)
			return
		}
		items = append(items, map[string]any{"artifact_id": artifactID, "found": found, "is_favorite": favorite})
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *service) canReadVisitor(r *http.Request, visitorID string) bool {
	claims, err := s.authenticate(r.Header.Get("Authorization"))
	if err != nil {
		return false
	}
	var accountID string
	if err := s.db.QueryRowContext(r.Context(), bind(s.driver, `SELECT id FROM visitors WHERE user_id = ?`), claims.UserID).Scan(&accountID); err != nil {
		return false
	}
	return claims.Role == "visitor" && accountID == visitorID
}

func (s *service) authenticate(header string) (accessClaims, error) {
	var claims accessClaims
	if !strings.HasPrefix(header, "Bearer ") {
		return claims, errors.New("missing bearer")
	}
	parts := strings.Split(strings.TrimPrefix(header, "Bearer "), ".")
	if len(parts) != 2 {
		return claims, errors.New("malformed token")
	}
	mac := hmac.New(sha256.New, []byte(s.tokenSecret))
	mac.Write([]byte(parts[0]))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expected)) {
		return claims, errors.New("invalid signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return claims, err
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, err
	}
	if claims.UserID == "" || claims.ExpiresAt <= s.now().Unix() {
		return claims, errors.New("expired token")
	}
	if s.authServiceURL != "" {
		req, err := http.NewRequest(http.MethodGet, s.authServiceURL+"/auth/me", nil)
		if err != nil {
			return claims, err
		}
		req.Header.Set("Authorization", header)
		client := s.httpClient
		if client == nil {
			client = http.DefaultClient
		}
		response, err := client.Do(req)
		if err != nil {
			return claims, err
		}
		defer response.Body.Close()
		var account struct {
			User struct {
				Status string `json:"status"`
			} `json:"user"`
		}
		if response.StatusCode != http.StatusOK || json.NewDecoder(response.Body).Decode(&account) != nil || !strings.EqualFold(account.User.Status, "active") {
			return claims, errors.New("session is not active")
		}
	}
	return claims, nil
}

func initSchema(ctx context.Context, db *sql.DB, driver string) error {
	boolType := "BOOLEAN"
	nowType := "TIMESTAMPTZ"
	if driver == "sqlite" {
		boolType = "INTEGER"
		nowType = "TEXT"
	}
	schema := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, user_id TEXT UNIQUE, is_guest %s NOT NULL, guest_link_token_hash TEXT, merged_into TEXT, created_at %s NOT NULL, linked_at %s); CREATE TABLE IF NOT EXISTS visitor_artifact_status (visitor_id TEXT NOT NULL, artifact_id TEXT NOT NULL, found %s NOT NULL DEFAULT FALSE, is_favorite %s NOT NULL DEFAULT FALSE, updated_at %s NOT NULL, PRIMARY KEY(visitor_id, artifact_id)); CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON visitors(user_id);`, boolType, nowType, nowType, boolType, boolType, nowType)
	_, err := db.ExecContext(ctx, schema)
	return err
}

func bind(driver, query string) string {
	if driver != "pgx" {
		return query
	}
	for i := 1; strings.Contains(query, "?"); i++ {
		query = strings.Replace(query, "?", fmt.Sprintf("$%d", i), 1)
	}
	return query
}
func detectDriver(dsn string) string {
	lower := strings.ToLower(dsn)
	if strings.HasPrefix(lower, "postgres://") || strings.HasPrefix(lower, "postgresql://") || strings.Contains(lower, "host=") {
		return "pgx"
	}
	return "sqlite"
}
func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func randomID(prefix string) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + "_" + hex.EncodeToString(b), nil
}
func randomToken() (string, error) {
	b := make([]byte, guestTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func accountVisitorID(userID string) (string, error) {
	if userID == "" {
		return "", errors.New("empty user id")
	}
	sum := sha256.Sum256([]byte(userID))
	return "acc_" + hex.EncodeToString(sum[:16]), nil
}
func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("one JSON value required")
	}
	return nil
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
func internalError(w http.ResponseWriter, err error) {
	log.Printf("visitor internal error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal_error")
}

func allowedOrigins(raw string) map[string]struct{} {
	origins := map[string]struct{}{}
	for _, origin := range strings.Split(raw, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins[origin] = struct{}{}
		}
	}
	return origins
}

func withCORS(next http.Handler, origins map[string]struct{}) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, allowed := origins[origin]; origin != "" && allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
