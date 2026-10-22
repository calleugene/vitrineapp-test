package platform

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
	_ "github.com/jackc/pgx/v5/stdlib"
	"io"
	"log"
	_ "modernc.org/sqlite"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"
)

type Config struct{ Kind, DSN, Addr, Secret, AuthURL, ArtifactsURL, RouteURL, FeedbackURL, ArtifactsDSN string }
type Server struct {
	Config
	DB              *sql.DB
	Driver          string
	Client          *http.Client
	artifactsDB     *sql.DB
	artifactsDriver string
}
type Claims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	MuseumID  string `json:"museum_id"`
	Role      string `json:"role"`
	Exp       int64  `json:"exp"`
	Name      string `json:"-"`
}
type Document struct {
	ID        string `json:"id"`
	MuseumID  string `json:"museum_id"`
	Version   int    `json:"version"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
type Event struct {
	ID        string `json:"id"`
	MuseumID  string `json:"museum_id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	CreatedAt int64  `json:"timestamp"`
	ActorID   string `json:"actor_id"`
}
type Record struct {
	ID, Museum, Kind, Body string
	Version                int
	Created, Updated       int64
}

var ErrConflict = errors.New("version_conflict")

func Env(k, v string) string {
	if x := os.Getenv(k); x != "" {
		return x
	}
	return v
}
func ID(prefix string) string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(b)
}
func Now() int64            { return time.Now().UTC().UnixMilli() }
func Stamp(ms int64) string { return time.UnixMilli(ms).UTC().Format(time.RFC3339Nano) }
func JSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func Fail(w http.ResponseWriter, code int, key string) {
	JSON(w, code, map[string]any{"error": map[string]string{"code": key, "message": key}})
}
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]) != "application/json" {
		Fail(w, 415, "json_required")
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 65536))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		Fail(w, 400, "invalid_json")
		return false
	}
	if d.Decode(new(any)) != io.EOF {
		Fail(w, 400, "invalid_json")
		return false
	}
	return true
}
func Valid(v string) bool {
	if len(v) < 1 || len(v) > 128 {
		return false
	}
	for _, c := range v {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
func driver(dsn string) string {
	if strings.HasPrefix(dsn, "postgres") {
		return "pgx"
	}
	return "sqlite"
}
func Bind(d string, q string) string {
	if d != "pgx" {
		return q
	}
	var b strings.Builder
	n := 1
	for _, c := range q {
		if c == '?' {
			fmt.Fprintf(&b, "$%d", n)
			n++
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}
func (s *Server) Q(q string) string { return Bind(s.Driver, q) }
func Open(c Config) (*Server, error) {
	if len(c.Secret) < 32 {
		return nil, errors.New("token secret must have at least 32 bytes")
	}
	db, err := sql.Open(driver(c.DSN), c.DSN)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	if driver(c.DSN) == "sqlite" {
		db.SetMaxOpenConns(1)
	}
	s := &Server{Config: c, DB: db, Driver: driver(c.DSN), Client: &http.Client{Timeout: 5 * time.Second}}
	if err = s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	if c.ArtifactsDSN != "" {
		s.artifactsDriver = driver(c.ArtifactsDSN)
		s.artifactsDB, err = sql.Open(s.artifactsDriver, c.ArtifactsDSN)
		if err != nil {
			db.Close()
			return nil, err
		}
	}
	return s, nil
}
func (s *Server) Close() {
	s.DB.Close()
	if s.artifactsDB != nil {
		s.artifactsDB.Close()
	}
}
func (s *Server) migrate() error {
	_, err := s.DB.Exec(`CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY,museum_id TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,version INTEGER NOT NULL,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS records_scope ON records(museum_id,kind,created_at,id);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,museum_id TEXT NOT NULL,type TEXT NOT NULL,title TEXT NOT NULL,actor_id TEXT NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS events_scope ON events(museum_id,created_at,id);
CREATE TABLE IF NOT EXISTS notification_reads (notification_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(notification_id,user_id));
CREATE TABLE IF NOT EXISTS source_cursors (museum_id TEXT NOT NULL,source TEXT NOT NULL,at_time BIGINT NOT NULL,event_id TEXT NOT NULL,PRIMARY KEY(museum_id,source));`)
	return err
}
func scan(row interface{ Scan(...any) error }) (Record, error) {
	var x Record
	err := row.Scan(&x.ID, &x.Museum, &x.Kind, &x.Body, &x.Version, &x.Created, &x.Updated)
	return x, err
}
func (s *Server) Get(ctx context.Context, kind, id, museum string) (Record, error) {
	return scan(s.DB.QueryRowContext(ctx, s.Q(`SELECT id,museum_id,kind,body,version,created_at,updated_at FROM records WHERE id=? AND kind=? AND museum_id=?`), id, kind, museum))
}
func (s *Server) Find(ctx context.Context, kind, id string) (Record, error) {
	return scan(s.DB.QueryRowContext(ctx, s.Q(`SELECT id,museum_id,kind,body,version,created_at,updated_at FROM records WHERE id=? AND kind=?`), id, kind))
}
func (s *Server) List(ctx context.Context, kind, museum string) ([]Record, error) {
	rows, err := s.DB.QueryContext(ctx, s.Q(`SELECT id,museum_id,kind,body,version,created_at,updated_at FROM records WHERE kind=? AND museum_id=? ORDER BY created_at DESC,id`), kind, museum)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Record{}
	for rows.Next() {
		x, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
func (x Record) Meta() Document {
	return Document{x.ID, x.Museum, x.Version, Stamp(x.Created), Stamp(x.Updated)}
}
func (s *Server) Save(ctx context.Context, x Record, event *Event) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if x.Version == 0 {
		_, err = tx.ExecContext(ctx, s.Q(`INSERT INTO records(id,museum_id,kind,body,version,created_at,updated_at) VALUES(?,?,?,?,1,?,?)`), x.ID, x.Museum, x.Kind, x.Body, x.Created, x.Updated)
	} else {
		var result sql.Result
		result, err = tx.ExecContext(ctx, s.Q(`UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND museum_id=? AND kind=? AND version=?`), x.Body, x.Updated, x.ID, x.Museum, x.Kind, x.Version)
		if err == nil {
			n, _ := result.RowsAffected()
			if n != 1 {
				return ErrConflict
			}
		}
	}
	if err != nil {
		return err
	}
	if event != nil {
		_, err = tx.ExecContext(ctx, s.Q(`INSERT INTO events(id,museum_id,type,title,actor_id,created_at) VALUES(?,?,?,?,?,?)`), event.ID, event.MuseumID, event.Type, event.Title, event.ActorID, event.CreatedAt)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (s *Server) Auth(w http.ResponseWriter, r *http.Request, museum bool) (Claims, bool) {
	var c Claims
	h := r.Header.Get("Authorization")
	parts := strings.Split(strings.TrimPrefix(h, "Bearer "), ".")
	if !strings.HasPrefix(h, "Bearer ") || len(parts) != 2 {
		Fail(w, 401, "unauthorized")
		return c, false
	}
	mac := hmac.New(sha256.New, []byte(s.Secret))
	mac.Write([]byte(parts[0]))
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(mac.Sum(nil), sig) {
		Fail(w, 401, "unauthorized")
		return c, false
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(raw, &c) != nil || c.UserID == "" || c.Exp <= time.Now().Unix() {
		Fail(w, 401, "unauthorized")
		return c, false
	}
	if museum {
		if !Valid(c.MuseumID) || !contains([]string{"methodist", "museum_admin", "ORG_ADMIN", "EDITOR", "moderator"}, c.Role) {
			Fail(w, 403, "forbidden")
			return c, false
		}
		for _, m := range []string{r.Header.Get("X-Museum-ID"), r.URL.Query().Get("museum_id")} {
			if m != "" && m != c.MuseumID {
				Fail(w, 403, "museum_mismatch")
				return c, false
			}
		}
	}
	path := "/auth/me"
	if museum {
		path = "/auth/authorize-museum"
	}
	if s.AuthURL == "" {
		Fail(w, 503, "auth_unavailable")
		return c, false
	}
	var account struct {
		User struct {
			FullName string `json:"full_name"`
			Status   string `json:"status"`
		} `json:"user"`
	}
	code := s.Fetch(r, s.AuthURL+path, &account)
	if code != 200 {
		if code == 401 || code == 403 {
			Fail(w, code, "unauthorized")
		} else {
			Fail(w, 503, "auth_unavailable")
		}
		return c, false
	}
	if !strings.EqualFold(account.User.Status, "active") {
		Fail(w, 403, "account_inactive")
		return c, false
	}
	c.Name = account.User.FullName
	return c, true
}
func (s *Server) Fetch(r *http.Request, u string, v any) int {
	req, err := http.NewRequestWithContext(r.Context(), "GET", u, nil)
	if err != nil {
		return 503
	}
	req.Header.Set("Authorization", r.Header.Get("Authorization"))
	resp, err := s.Client.Do(req)
	if err != nil {
		return 503
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return resp.StatusCode
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(v) != nil {
		return 503
	}
	return 200
}
func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
func Page(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	page, limit := 1, 20
	var err error
	if v := r.URL.Query().Get("page"); v != "" {
		page, err = strconv.Atoi(v)
		if err != nil {
			page = 0
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		limit, err = strconv.Atoi(v)
		if err != nil {
			limit = 0
		}
	}
	if page < 1 || limit < 1 || limit > 100 {
		Fail(w, 400, "invalid_pagination")
		return 0, 0, false
	}
	return page, limit, true
}
func Window(n, page, limit int) (int, int) {
	start := n
	if page-1 <= n/limit {
		start = (page - 1) * limit
		if start > n {
			start = n
		}
	}
	end := start + limit
	if end > n {
		end = n
	}
	return start, end
}
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { JSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { JSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if s.DB.PingContext(r.Context()) != nil {
			Fail(w, 503, "database_unavailable")
			return
		}
		JSON(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("GET /api/v1/events", s.eventFeed)
	switch s.Kind {
	case "route":
		s.routeHandlers(mux)
		mux.HandleFunc("GET /api/v1/stats/{view}", s.sourceStats)
	case "feedback":
		s.feedbackHandlers(mux)
		mux.HandleFunc("GET /api/v1/stats/{view}", s.sourceStats)
	case "notification":
		s.notificationHandlers(mux)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if e := recover(); e != nil {
				log.Printf("request panic: %v", e)
				Fail(w, 500, "internal_error")
			}
		}()
		mux.ServeHTTP(w, r)
	})
}
func (s *Server) eventFeed(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	at := int64(0)
	if v := r.URL.Query().Get("after"); v != "" {
		var err error
		at, err = strconv.ParseInt(v, 10, 64)
		if err != nil || at < 0 {
			Fail(w, 400, "invalid_cursor")
			return
		}
	}
	afterID := r.URL.Query().Get("after_id")
	rows, err := s.DB.QueryContext(r.Context(), s.Q(`SELECT id,museum_id,type,title,actor_id,created_at FROM events WHERE museum_id=? AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at,id LIMIT 100`), c.MuseumID, at, at, afterID)
	if err != nil {
		Fail(w, 503, "storage_unavailable")
		return
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		if rows.Scan(&e.ID, &e.MuseumID, &e.Type, &e.Title, &e.ActorID, &e.CreatedAt) != nil {
			Fail(w, 503, "storage_unavailable")
			return
		}
		out = append(out, e)
	}
	if rows.Err() != nil {
		Fail(w, 503, "storage_unavailable")
		return
	}
	JSON(w, 200, map[string]any{"events": out})
}
func activity(c Claims, kind, title string) *Event {
	return &Event{ID: ID("evt"), MuseumID: c.MuseumID, Type: kind, Title: title, ActorID: c.UserID, CreatedAt: Now()}
}
func Run(kind string, port string) {
	prefix := strings.ToUpper(kind)
	c := Config{Kind: kind, DSN: Env(prefix+"_DB_DSN", "file:"+kind+".db"), Addr: Env(prefix+"_HTTP_ADDR", ":"+port), Secret: os.Getenv("AUTH_TOKEN_SECRET"), AuthURL: Env("AUTH_SERVICE_URL", "http://auth-service:8080/api/v1"), ArtifactsURL: Env("ARTIFACTS_SERVICE_URL", "http://artifacts-service:8081/api/v1"), RouteURL: Env("ROUTE_SERVICE_URL", "http://route-service:8083/api/v1"), FeedbackURL: Env("FEEDBACK_SERVICE_URL", "http://feedback-service:8086/api/v1"), ArtifactsDSN: os.Getenv("ROUTE_ARTIFACTS_DB_DSN")}
	s, err := Open(c)
	if err != nil {
		log.Fatal(err)
	}
	defer s.Close()
	h := &http.Server{Addr: c.Addr, Handler: s.Routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = h.Shutdown(shutdown)
	}()
	log.Printf("%s listening on %s", kind, c.Addr)
	if err = h.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
