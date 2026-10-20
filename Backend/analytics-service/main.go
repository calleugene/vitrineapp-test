package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

//go:embed migrations/001_events.sql
var migration embed.FS

type server struct {
	db              *sql.DB
	driver          string
	artifactsDB     *sql.DB
	artifactsDriver string
	secret          string
	artifactsURL    string
	authURL         string
	routeURL        string
	feedbackURL     string
	client          *http.Client
	now             func() time.Time
	rateMu          sync.Mutex
	rate            map[string]rateWindow
}

type rateWindow struct {
	Minute int64
	Count  int
}

func (s *server) allowed(key string, now time.Time) bool {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	if s.rate == nil {
		s.rate = map[string]rateWindow{}
	}
	minute := now.Unix() / 60
	entry := s.rate[key]
	if entry.Minute != minute {
		entry = rateWindow{Minute: minute}
	}
	entry.Count++
	s.rate[key] = entry
	if len(s.rate) > 10000 {
		for k, v := range s.rate {
			if v.Minute < minute {
				delete(s.rate, k)
			}
		}
	}
	return entry.Count <= 120
}

type event struct {
	SchemaVersion int       `json:"schema_version"`
	ID            string    `json:"id"`
	Type          string    `json:"type"`
	OccurredAt    time.Time `json:"occurred_at"`
	SessionID     string    `json:"session_id"`
	VisitorKey    string    `json:"visitor_key"`
	PublicCode    string    `json:"public_code"`
	ArtifactID    string    `json:"artifact_id"`
	ScreenID      string    `json:"screen_id"`
	Source        string    `json:"source"`
	Properties    struct {
		ActiveMS int   `json:"active_ms"`
		Correct  *bool `json:"correct,omitempty"`
	} `json:"properties"`
}

type storedEvent struct {
	ID, MuseumID, ArtifactID, ArtifactTitle, PublicCode, VisitorKey, SessionID, Type, ScreenID, Source string
	ActiveMS                                                                                           int
	QuizCorrect                                                                                        *bool
	OccurredAt, ReceivedAt                                                                             time.Time
}

type filters struct {
	From, To                time.Time
	Location                *time.Location
	Period, RouteID, TeamID string
	Explicit                bool
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func main() {
	dsn := env("ANALYTICS_DB_DSN", "file:analytics.db")
	driver := "sqlite"
	if strings.HasPrefix(dsn, "postgres") {
		driver = "pgx"
	}
	db, err := sql.Open(driver, dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(8)
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}
	var artifactsDB *sql.DB
	artifactsDriver := "pgx"
	if source := os.Getenv("ANALYTICS_ARTIFACTS_DB_DSN"); source != "" {
		if !strings.HasPrefix(source, "postgres") {
			artifactsDriver = "sqlite"
		}
		artifactsDB, err = sql.Open(artifactsDriver, source)
		if err != nil {
			log.Fatal(err)
		}
		defer artifactsDB.Close()
	}
	s := &server{db: db, driver: driver, artifactsDB: artifactsDB, artifactsDriver: artifactsDriver, secret: os.Getenv("ANALYTICS_TOKEN_SECRET"), artifactsURL: strings.TrimRight(env("ANALYTICS_ARTIFACTS_URL", "http://artifacts-service:8081/api/v1"), "/"), authURL: strings.TrimRight(env("ANALYTICS_AUTH_URL", "http://auth-service:8080/api/v1"), "/"), client: &http.Client{Timeout: 4 * time.Second}, now: func() time.Time { return time.Now().UTC() }}
	if s.secret == "" {
		log.Fatal("ANALYTICS_TOKEN_SECRET is required")
	}
	s.routeURL = strings.TrimRight(env("ANALYTICS_ROUTE_URL", "http://route-service:8083/api/v1"), "/")
	s.feedbackURL = strings.TrimRight(env("ANALYTICS_FEEDBACK_URL", "http://feedback-service:8086/api/v1"), "/")
	if err := s.migrate(); err != nil {
		log.Fatal(err)
	}
	httpServer := &http.Server{
		Addr: env("ANALYTICS_HTTP_ADDR", ":8085"), Handler: s.routes(),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Fatal(httpServer.ListenAndServe())
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func (s *server) migrate() error {
	script, err := migration.ReadFile("migrations/001_events.sql")
	if err != nil {
		return err
	}
	_, err = s.db.Exec(string(script))
	return err
}
func (s *server) bind(query string) string {
	if s.driver != "pgx" {
		return query
	}
	var b strings.Builder
	n := 1
	for _, c := range query {
		if c == '?' {
			fmt.Fprintf(&b, "$%d", n)
			n++
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}
func (s *server) bindArtifacts(query string) string {
	if s.artifactsDriver != "pgx" {
		return query
	}
	var b strings.Builder
	n := 1
	for _, c := range query {
		if c == '?' {
			fmt.Fprintf(&b, "$%d", n)
			n++
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { jsonOut(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if s.db.PingContext(r.Context()) != nil {
			fail(w, 503, "database_unavailable")
			return
		}
		if s.artifactsDB != nil && s.artifactsDB.PingContext(r.Context()) != nil {
			fail(w, 503, "collection_source_unavailable")
			return
		}
		jsonOut(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("POST /api/v1/analytics/events", s.ingest)
	mux.HandleFunc("GET /api/v1/analytics/filter-options", s.read)
	mux.HandleFunc("GET /api/v1/analytics/recent-activity", s.read)
	mux.HandleFunc("GET /api/v1/visitors/{view}", s.read)
	mux.HandleFunc("GET /api/v1/stats/{tab}/{view}", s.read)
	return mux
}

func jsonOut(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func fail(w http.ResponseWriter, status int, code string) {
	jsonOut(w, status, map[string]any{"error": apiError{Code: code, Message: code}})
}

type claims struct {
	UserID    string `json:"user_id"`
	MuseumID  string `json:"museum_id"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
}

func (s *server) authorize(r *http.Request) (string, int) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return "", 401
	}
	parts := strings.Split(strings.TrimPrefix(header, "Bearer "), ".")
	if len(parts) != 2 {
		return "", 401
	}
	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write([]byte(parts[0]))
	if !hmac.Equal([]byte(parts[1]), []byte(base64.RawURLEncoding.EncodeToString(mac.Sum(nil)))) {
		return "", 401
	}
	bytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", 401
	}
	var c claims
	if json.Unmarshal(bytes, &c) != nil || c.UserID == "" || c.ExpiresAt <= s.now().Unix() {
		return "", 401
	}
	if c.MuseumID == "" || (c.Role != "methodist" && c.Role != "museum_admin" && c.Role != "ORG_ADMIN" && c.Role != "EDITOR" && c.Role != "moderator") {
		return "", 403
	}
	if requested := r.URL.Query().Get("museum_id"); requested != "" && requested != c.MuseumID {
		return "", 403
	}
	if requested := r.Header.Get("X-Museum-ID"); requested != "" && requested != c.MuseumID {
		return "", 403
	}
	if s.authURL != "" {
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, s.authURL+"/auth/authorize-museum", nil)
		if err != nil {
			return "", 503
		}
		req.Header.Set("Authorization", header)
		response, err := s.client.Do(req)
		if err != nil {
			return "", 503
		}
		response.Body.Close()
		if response.StatusCode == 401 || response.StatusCode == 403 {
			return "", 401
		}
		if response.StatusCode != 200 {
			return "", 503
		}
	}
	return c.MuseumID, 0
}

func validID(value string) bool {
	if value == "" || len(value) > 128 {
		return false
	}
	for _, c := range value {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

func validateEvent(e event, now time.Time) string {
	if e.SchemaVersion != 1 {
		return "unsupported_schema"
	}
	if !validID(e.ID) || !validID(e.SessionID) || !validID(e.VisitorKey) || !validID(e.PublicCode) {
		return "invalid_event_id"
	}
	if e.ArtifactID != "" && !validID(e.ArtifactID) {
		return "invalid_artifact_id"
	}
	if e.ScreenID != "" && !validID(e.ScreenID) {
		return "invalid_screen_id"
	}
	if e.OccurredAt.IsZero() || e.OccurredAt.After(now.Add(5*time.Minute)) || e.OccurredAt.Before(now.Add(-7*24*time.Hour)) {
		return "invalid_occurred_at"
	}
	switch e.Type {
	case "visit_start", "scan", "scene_view", "engagement", "scene_complete", "quiz_answer", "artifact_collected":
	default:
		return "unsupported_event_type"
	}
	if e.Type == "scene_view" && e.ScreenID == "" {
		return "screen_id_required"
	}
	if e.Type == "engagement" && (e.ScreenID == "" || e.Properties.ActiveMS < 1 || e.Properties.ActiveMS > 15000) {
		return "invalid_active_ms"
	}
	if e.Type != "engagement" && e.Properties.ActiveMS != 0 {
		return "invalid_properties"
	}
	if e.Type == "quiz_answer" && e.Properties.Correct == nil {
		return "correct_required"
	}
	if e.Type != "quiz_answer" && e.Properties.Correct != nil {
		return "invalid_properties"
	}
	switch e.Source {
	case "", "qr", "direct", "route", "unknown":
	default:
		return "invalid_source"
	}
	return ""
}

type publication struct {
	Artifact struct {
		ID       string `json:"id"`
		MuseumID string `json:"museum_id"`
		Title    string `json:"title"`
	} `json:"artifact"`
	Screens []struct {
		ID string `json:"id"`
	} `json:"screens"`
}

func (s *server) resolve(ctx context.Context, code string) (publication, int) {
	var p publication
	u := s.artifactsURL + "/public/artifacts/" + url.PathEscape(code)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return p, 503
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return p, 503
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 || resp.StatusCode == 410 {
		return p, 400
	}
	if resp.StatusCode != 200 {
		return p, 503
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 128<<10)).Decode(&p) != nil || !validID(p.Artifact.ID) || !validID(p.Artifact.MuseumID) {
		return p, 503
	}
	return p, 0
}

func (s *server) confirmedCollection(ctx context.Context, visitorKey, artifactID string) (bool, error) {
	if s.artifactsDB == nil {
		return false, fmt.Errorf("collection source unavailable")
	}
	var found bool
	err := s.artifactsDB.QueryRowContext(ctx, s.bindArtifacts(`SELECT found FROM artifact_visitor_status WHERE visitor_id=? AND artifact_id=?`), visitorKey, artifactID).Scan(&found)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return found, err
}

func (s *server) collectionCounts(ctx context.Context, museum string, f filters) (map[string]int, error) {
	if s.artifactsDB == nil {
		return nil, fmt.Errorf("collection source unavailable")
	}
	var from, to any = f.From, f.To
	if s.artifactsDriver != "pgx" {
		from = f.From.Format(time.RFC3339)
		to = f.To.Format(time.RFC3339)
	}
	rows, err := s.artifactsDB.QueryContext(ctx, s.bindArtifacts(`SELECT st.visitor_id, COUNT(*) FROM artifact_visitor_status st JOIN artifacts a ON a.id=st.artifact_id WHERE a.museum_id=? AND st.found=true AND st.found_at>=? AND st.found_at<? GROUP BY st.visitor_id`), museum, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := map[string]int{}
	for rows.Next() {
		var key string
		var count int
		if err := rows.Scan(&key, &count); err != nil {
			return nil, err
		}
		counts[key] = count
	}
	return counts, rows.Err()
}

func (s *server) ingest(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]) != "application/json" {
		fail(w, 415, "json_required")
		return
	}
	var e event
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&e); err != nil {
		var sizeErr *http.MaxBytesError
		if errors.As(err, &sizeErr) {
			fail(w, 413, "event_too_large")
		} else {
			fail(w, 400, "invalid_event")
		}
		return
	}
	if decoder.Decode(new(any)) != io.EOF {
		fail(w, 400, "invalid_event")
		return
	}
	now := s.now().UTC()
	if code := validateEvent(e, now); code != "" {
		fail(w, 400, code)
		return
	}
	if !s.allowed(e.VisitorKey, now) {
		fail(w, 429, "rate_limited")
		return
	}
	p, status := s.resolve(r.Context(), e.PublicCode)
	if status != 0 {
		if status == 400 {
			fail(w, 400, "unknown_public_code")
		} else {
			fail(w, 503, "publication_unavailable")
		}
		return
	}
	if e.ArtifactID != "" && e.ArtifactID != p.Artifact.ID {
		fail(w, 400, "artifact_mismatch")
		return
	}
	if e.Type == "artifact_collected" {
		confirmed, err := s.confirmedCollection(r.Context(), e.VisitorKey, p.Artifact.ID)
		if err != nil {
			fail(w, 503, "collection_source_unavailable")
			return
		}
		if !confirmed {
			fail(w, 409, "collection_not_confirmed")
			return
		}
	}
	if e.ScreenID != "" {
		found := e.ScreenID == "cover" || e.ScreenID == "system-final"
		for _, screen := range p.Screens {
			if screen.ID == e.ScreenID {
				found = true
				break
			}
		}
		if !found {
			fail(w, 400, "screen_mismatch")
			return
		}
	}
	if e.Source == "" {
		e.Source = "unknown"
	}
	canonical, _ := json.Marshal(e)
	hashBytes := sha256.Sum256(canonical)
	contentHash := hex.EncodeToString(hashBytes[:])
	result, err := s.db.ExecContext(r.Context(), s.bind(`INSERT INTO analytics_events (id,payload_hash,museum_id,artifact_id,artifact_title,public_code,visitor_key,session_id,type,screen_id,source,active_ms,quiz_correct,occurred_at,received_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`), e.ID, contentHash, p.Artifact.MuseumID, p.Artifact.ID, p.Artifact.Title, e.PublicCode, e.VisitorKey, e.SessionID, e.Type, e.ScreenID, e.Source, e.Properties.ActiveMS, e.Properties.Correct, e.OccurredAt.UTC().UnixMilli(), now.UnixMilli())
	if err != nil {
		log.Printf("insert event: %v", err)
		fail(w, 503, "storage_unavailable")
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		var storedHash string
		err := s.db.QueryRowContext(r.Context(), s.bind(`SELECT payload_hash FROM analytics_events WHERE id=?`), e.ID).Scan(&storedHash)
		if err == nil && storedHash != contentHash {
			fail(w, 409, "event_id_conflict")
			return
		}
		if err != nil && err != sql.ErrNoRows {
			fail(w, 503, "storage_unavailable")
			return
		}
	}
	jsonOut(w, 200, map[string]any{"accepted_event_id": e.ID, "duplicate": rows == 0})
}

func parseFilters(q url.Values, now time.Time) (filters, string) {
	f := filters{Period: q.Get("period"), RouteID: q.Get("route_id"), TeamID: q.Get("team_id")}
	if f.Period == "" {
		f.Period = "month"
	}
	if f.RouteID != "" || f.TeamID != "" {
		return f, "filter_unavailable"
	}
	if q.Has("museum_id") && !validID(q.Get("museum_id")) {
		return f, "invalid_museum_id"
	}
	zone := q.Get("timezone")
	if zone == "" {
		zone = "UTC"
	}
	loc, err := time.LoadLocation(zone)
	if err != nil {
		return f, "invalid_timezone"
	}
	f.Location = loc
	if q.Has("from") != q.Has("to") || (q.Has("from") && q.Has("period")) {
		return f, "invalid_range"
	}
	if q.Has("from") {
		f.Explicit = true
		f.Period = ""
		f.From, err = time.Parse(time.RFC3339, q.Get("from"))
		if err != nil {
			return f, "invalid_range"
		}
		f.To, err = time.Parse(time.RFC3339, q.Get("to"))
		if err != nil {
			return f, "invalid_range"
		}
	} else {
		local := now.In(loc)
		y, m, d := local.Date()
		switch f.Period {
		case "day":
			f.From = time.Date(y, m, d, 0, 0, 0, 0, loc)
			f.To = f.From.AddDate(0, 0, 1)
		case "week":
			f.From = time.Date(y, m, d, 0, 0, 0, 0, loc).AddDate(0, 0, -(int(local.Weekday())+6)%7)
			f.To = f.From.AddDate(0, 0, 7)
		case "month":
			f.From = time.Date(y, m, 1, 0, 0, 0, 0, loc)
			f.To = f.From.AddDate(0, 1, 0)
		case "year":
			f.From = time.Date(y, 1, 1, 0, 0, 0, 0, loc)
			f.To = f.From.AddDate(1, 0, 0)
		default:
			return f, "invalid_period"
		}
	}
	if !f.To.After(f.From) || f.To.Sub(f.From) > 366*24*time.Hour {
		return f, "invalid_range"
	}
	f.From = f.From.UTC()
	f.To = f.To.UTC()
	return f, ""
}

func (s *server) loadEvents(ctx context.Context, museum string, f filters) ([]storedEvent, error) {
	rows, err := s.db.QueryContext(ctx, s.bind(`SELECT id,museum_id,artifact_id,artifact_title,public_code,visitor_key,session_id,type,screen_id,source,active_ms,occurred_at,received_at FROM analytics_events WHERE museum_id=? AND occurred_at>=? AND occurred_at<? ORDER BY occurred_at,id`), museum, f.From.UnixMilli(), f.To.UnixMilli())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []storedEvent{}
	for rows.Next() {
		var e storedEvent
		var occurred, received int64
		if err := rows.Scan(&e.ID, &e.MuseumID, &e.ArtifactID, &e.ArtifactTitle, &e.PublicCode, &e.VisitorKey, &e.SessionID, &e.Type, &e.ScreenID, &e.Source, &e.ActiveMS, &occurred, &received); err != nil {
			return nil, err
		}
		e.OccurredAt = time.UnixMilli(occurred).UTC()
		e.ReceivedAt = time.UnixMilli(received).UTC()
		result = append(result, e)
	}
	return result, rows.Err()
}

func (s *server) meta(f filters) map[string]any {
	return map[string]any{"from": f.From.Format(time.RFC3339), "to": f.To.Format(time.RFC3339), "timezone": f.Location.String(), "filters": map[string]any{"period": f.Period, "route_id": f.RouteID, "team_id": f.TeamID}, "generated_at": s.now().UTC().Format(time.RFC3339), "data_through": s.now().UTC().Format(time.RFC3339), "capabilities": map[string]bool{"route_filter": false, "team_filter": false, "feedback": s.feedbackURL != "", "rating": s.feedbackURL != "", "collections": s.artifactsDB != nil}}
}

func (s *server) read(w http.ResponseWriter, r *http.Request) {
	museum, status := s.authorize(r)
	if status != 0 {
		switch status {
		case 401:
			fail(w, 401, "unauthorized")
		case 403:
			fail(w, 403, "forbidden")
		default:
			fail(w, 503, "auth_unavailable")
		}
		return
	}
	f, code := parseFilters(r.URL.Query(), s.now())
	if code != "" {
		fail(w, 400, code)
		return
	}
	view := r.PathValue("view")
	tab := r.PathValue("tab")
	if strings.HasSuffix(r.URL.Path, "/filter-options") {
		jsonOut(w, 200, map[string]any{"periods": []string{"day", "week", "month", "year"}, "routes": []any{}, "teams": []any{}, "capabilities": map[string]bool{"route_filter": false, "team_filter": false}, "meta": s.meta(f)})
		return
	}
	if strings.HasSuffix(r.URL.Path, "/recent-activity") {
		events, err := s.loadEvents(r.Context(), museum, f)
		if err != nil {
			fail(w, 503, "storage_unavailable")
			return
		}
		activities := []map[string]any{}
		titles := map[string]string{"visit_start": "Посещение музея", "scan": "Открытие по QR", "scene_view": "Просмотр экрана", "scene_complete": "История завершена", "artifact_collected": "Экспонат добавлен в коллекцию"}
		for i := len(events) - 1; i >= 0 && len(activities) < 10; i-- {
			e := events[i]
			title := titles[e.Type]
			if title == "" {
				continue
			}
			activities = append(activities, map[string]any{"id": e.ID, "type": e.Type, "created_at": e.OccurredAt.Format(time.RFC3339), "title": title, "artifact_id": e.ArtifactID, "screen_id": e.ScreenID, "artifact_url": "/exhibits/" + url.PathEscape(e.PublicCode)})
		}
		jsonOut(w, 200, map[string]any{"activities": activities, "meta": s.meta(f)})
		return
	}
	if tab != "" && !slicesContains([]string{"overview", "visitors", "content", "routes", "stories", "artifacts", "feedback"}, tab) {
		fail(w, 400, "invalid_tab")
		return
	}
	if tab == "" && !slicesContains([]string{"summary", "dynamics", "sources", "list"}, view) {
		fail(w, 404, "not_found")
		return
	}
	if tab != "" && !slicesContains([]string{"summary", "chart", "breakdown", "ranked", "bars"}, view) {
		fail(w, 404, "not_found")
		return
	}
	if (tab == "routes" && s.routeURL != "") || (tab == "feedback" && s.feedbackURL != "") {
		base := s.routeURL
		if tab == "feedback" {
			base = s.feedbackURL
		}
		query := url.Values{"from": {f.From.Format(time.RFC3339)}, "to": {f.To.Format(time.RFC3339)}, "timezone": {f.Location.String()}}
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, base+"/stats/"+url.PathEscape(view)+"?"+query.Encode(), nil)
		if err != nil {
			fail(w, 503, "source_unavailable")
			return
		}
		req.Header.Set("Authorization", r.Header.Get("Authorization"))
		response, err := s.client.Do(req)
		if err != nil {
			fail(w, 503, "source_unavailable")
			return
		}
		defer response.Body.Close()
		var payload map[string]any
		if json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&payload) != nil {
			fail(w, 503, "source_unavailable")
			return
		}
		jsonOut(w, response.StatusCode, payload)
		return
	}
	events, err := s.loadEvents(r.Context(), museum, f)
	if err != nil {
		log.Printf("load events: %v", err)
		fail(w, 503, "storage_unavailable")
		return
	}
	if tab == "" {
		s.visitors(w, r, museum, view, events, f)
		return
	}
	s.stats(w, r, museum, tab, view, events, f)
}
func slicesContains(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}

type visitorRow struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	RouteID              *string   `json:"route_id"`
	RouteTitle           *string   `json:"route_title"`
	FirstVisitAt         time.Time `json:"first_visit_at"`
	DurationMinutes      float64   `json:"duration_minutes"`
	CollectedArtifacts   *int      `json:"collected_artifacts"`
	RouteProgressScreens *int      `json:"route_progress_screens"`
	ViewedScreens        int       `json:"viewed_screens"`
}

func uniqueVisitorEvents(events []storedEvent) map[string][]storedEvent {
	grouped := map[string][]storedEvent{}
	for _, e := range events {
		grouped[e.VisitorKey] = append(grouped[e.VisitorKey], e)
	}
	return grouped
}

func (s *server) firstVisits(ctx context.Context, museum string) (map[string]time.Time, error) {
	rows, err := s.db.QueryContext(ctx, s.bind(`SELECT visitor_key, MIN(occurred_at) FROM analytics_events WHERE museum_id=? GROUP BY visitor_key`), museum)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	first := map[string]time.Time{}
	for rows.Next() {
		var key string
		var millis int64
		if err := rows.Scan(&key, &millis); err != nil {
			return nil, err
		}
		first[key] = time.UnixMilli(millis).UTC()
	}
	return first, rows.Err()
}

func previousRange(f filters) filters {
	previous := f
	if f.Explicit {
		length := f.To.Sub(f.From)
		previous.From = f.From.Add(-length)
		previous.To = f.From
		return previous
	}
	from := f.From.In(f.Location)
	switch f.Period {
	case "day":
		previous.From = from.AddDate(0, 0, -1)
	case "week":
		previous.From = from.AddDate(0, 0, -7)
	case "month":
		previous.From = from.AddDate(0, -1, 0)
	case "year":
		previous.From = from.AddDate(-1, 0, 0)
	}
	previous.From = previous.From.UTC()
	previous.To = f.From
	return previous
}

func visitorNumbers(events []storedEvent, first map[string]time.Time, f filters) (int, int, float64) {
	grouped := uniqueVisitorEvents(events)
	newCount := 0
	for key := range grouped {
		if !first[key].Before(f.From) && first[key].Before(f.To) {
			newCount++
		}
	}
	totalMS := 0
	sessions := map[string]bool{}
	for _, e := range events {
		if e.Type == "engagement" {
			totalMS += e.ActiveMS
		}
		sessions[e.SessionID] = true
	}
	avg := 0.0
	if len(sessions) > 0 {
		avg = float64(totalMS) / 60000 / float64(len(sessions))
	}
	return len(grouped), newCount, avg
}

func delta(current, previous float64) any {
	if previous == 0 {
		return nil
	}
	return 100 * (current - previous) / previous
}

func (s *server) visitors(w http.ResponseWriter, r *http.Request, museum, view string, events []storedEvent, f filters) {
	meta := s.meta(f)
	grouped := uniqueVisitorEvents(events)
	first, err := s.firstVisits(r.Context(), museum)
	if err != nil {
		fail(w, 503, "storage_unavailable")
		return
	}
	switch view {
	case "summary":
		previousEvents, err := s.loadEvents(r.Context(), museum, previousRange(f))
		if err != nil {
			fail(w, 503, "storage_unavailable")
			return
		}
		total, newCount, avg := visitorNumbers(events, first, f)
		previousTotal, previousNew, previousAvg := visitorNumbers(previousEvents, first, previousRange(f))
		jsonOut(w, 200, map[string]any{"total_visitors": total, "new_visitors": newCount, "avg_session_minutes": avg, "deltas": map[string]any{"total_visitors": delta(float64(total), float64(previousTotal)), "new_visitors": delta(float64(newCount), float64(previousNew)), "avg_session_minutes": delta(avg, previousAvg)}, "meta": meta})
	case "dynamics":
		series := r.URL.Query().Get("series")
		if series == "" {
			series = "visitors"
		}
		if series != "visitors" && series != "newVisitors" {
			fail(w, 400, "invalid_series")
			return
		}
		labels, values, buckets := bucketCounts(events, f, series, first)
		jsonOut(w, 200, map[string]any{"series": series, "labels": labels, "values": values, "buckets": buckets, "meta": meta})
	case "sources":
		counts := map[string]int{"qr": 0, "direct": 0, "route": 0, "unknown": 0}
		for _, evs := range grouped {
			source := "unknown"
			for _, e := range evs {
				if e.Type == "visit_start" {
					source = e.Source
					break
				}
			}
			counts[source]++
		}
		items := []any{}
		labels := map[string]string{"qr": "QR", "direct": "Прямая ссылка", "route": "Маршрут", "unknown": "Неизвестно"}
		for _, code := range []string{"qr", "direct", "route", "unknown"} {
			value := 0.0
			if len(grouped) > 0 {
				value = 100 * float64(counts[code]) / float64(len(grouped))
			}
			items = append(items, map[string]any{"code": code, "label": labels[code], "value": value, "count": counts[code]})
		}
		jsonOut(w, 200, map[string]any{"sources": items, "meta": meta})
	case "list":
		page, err1 := strconv.Atoi(r.URL.Query().Get("page"))
		if r.URL.Query().Get("page") == "" {
			page = 1
			err1 = nil
		}
		limit, err2 := strconv.Atoi(r.URL.Query().Get("limit"))
		if r.URL.Query().Get("limit") == "" {
			limit = 20
			err2 = nil
		}
		if err1 != nil || err2 != nil || page < 1 || limit < 1 || limit > 100 {
			fail(w, 400, "invalid_pagination")
			return
		}
		sortBy := r.URL.Query().Get("sort_by")
		if sortBy == "" {
			sortBy = "firstVisit"
		}
		sortDir := r.URL.Query().Get("sort_dir")
		if sortDir == "" {
			sortDir = "desc"
		}
		if !slicesContains([]string{"name", "route", "firstVisit", "duration", "collectedArtifacts", "routeCompleted"}, sortBy) || !slicesContains([]string{"asc", "desc"}, sortDir) {
			fail(w, 400, "invalid_sort")
			return
		}
		if sortBy == "route" || sortBy == "routeCompleted" {
			fail(w, 400, "sort_unavailable")
			return
		}
		counts, err := s.collectionCounts(r.Context(), museum, f)
		if err != nil {
			fail(w, 503, "collection_source_unavailable")
			return
		}
		rows := []visitorRow{}
		for id, evs := range grouped {
			firstVisit := first[id]
			ms := 0
			screens := map[string]bool{}
			for _, e := range evs {
				if e.Type == "engagement" {
					ms += e.ActiveMS
				}
				if e.Type == "scene_view" {
					screens[e.ArtifactID+":"+e.ScreenID] = true
				}
			}
			collected := counts[id]
			rows = append(rows, visitorRow{ID: id, Name: "Анонимный посетитель", FirstVisitAt: firstVisit, DurationMinutes: float64(ms) / 60000, ViewedScreens: len(screens), CollectedArtifacts: &collected})
		}
		sort.Slice(rows, func(i, j int) bool {
			a, b := rows[i], rows[j]
			less := false
			switch sortBy {
			case "name":
				less = a.ID < b.ID
			case "duration":
				if a.DurationMinutes == b.DurationMinutes {
					less = a.ID < b.ID
				} else {
					less = a.DurationMinutes < b.DurationMinutes
				}
			case "collectedArtifacts":
				if *a.CollectedArtifacts == *b.CollectedArtifacts {
					less = a.ID < b.ID
				} else {
					less = *a.CollectedArtifacts < *b.CollectedArtifacts
				}
			default:
				if a.FirstVisitAt.Equal(b.FirstVisitAt) {
					less = a.ID < b.ID
				} else {
					less = a.FirstVisitAt.Before(b.FirstVisitAt)
				}
			}
			if sortDir == "desc" {
				return !less
			}
			return less
		})
		total := len(rows)
		// Compare before multiplying: a valid but huge page must return an empty
		// result rather than overflowing an int and panicking on the slice.
		start := total
		if page-1 <= total/limit {
			start = (page - 1) * limit
			if start > total {
				start = total
			}
		}
		end := start + limit
		if end > total {
			end = total
		}
		jsonOut(w, 200, map[string]any{"items": rows[start:end], "total": total, "page": page, "limit": limit, "meta": meta})
	}
}

func bucketCounts(events []storedEvent, f filters, series string, first map[string]time.Time) ([]string, []int, []map[string]string) {
	labels := []string{}
	values := []int{}
	buckets := []map[string]string{}
	seen := map[int]map[string]bool{}
	for start := f.From.In(f.Location); start.Before(f.To.In(f.Location)); {
		next := start.AddDate(0, 0, 1)
		if f.Period == "year" {
			next = start.AddDate(0, 1, 0)
		}
		if next.UTC().After(f.To) {
			next = f.To.In(f.Location)
		}
		index := len(values)
		labels = append(labels, start.Format("2006-01-02"))
		values = append(values, 0)
		buckets = append(buckets, map[string]string{"from": start.UTC().Format(time.RFC3339), "to": next.UTC().Format(time.RFC3339)})
		seen[index] = map[string]bool{}
		start = next
	}
	if series == "newVisitors" {
		events = []storedEvent{}
		for key, at := range first {
			events = append(events, storedEvent{VisitorKey: key, OccurredAt: at})
		}
	}
	for _, e := range events {
		if series == "views" && e.Type != "scene_view" {
			continue
		}
		for i, b := range buckets {
			from, _ := time.Parse(time.RFC3339, b["from"])
			to, _ := time.Parse(time.RFC3339, b["to"])
			if !e.OccurredAt.Before(from) && e.OccurredAt.Before(to) && (series == "views" || !seen[i][e.VisitorKey]) {
				seen[i][e.VisitorKey] = true
				values[i]++
				break
			}
		}
	}
	return labels, values, buckets
}

func (s *server) stats(w http.ResponseWriter, r *http.Request, museum, tab, view string, events []storedEvent, f filters) {
	meta := s.meta(f)
	if tab == "feedback" || tab == "routes" {
		fail(w, 503, "source_unavailable")
		return
	}
	count := 0
	title := "Просмотры экранов"
	unit := "views"
	code := "scene_views"
	switch tab {
	case "overview", "visitors":
		count = len(uniqueVisitorEvents(events))
		title = "Посетители"
		unit = "visitors"
		code = "visitors"
	default:
		for _, e := range events {
			if e.Type == "scene_view" {
				count++
			}
		}
	}
	switch view {
	case "summary":
		cards := []map[string]any{{"code": code, "title": title, "value": count, "unit": unit, "delta": nil, "note": nil}}
		if tab == "content" || tab == "stories" || tab == "artifacts" {
			completions, active := 0, 0
			for _, e := range events {
				if e.Type == "scene_complete" {
					completions++
				}
				if e.Type == "engagement" {
					active += e.ActiveMS
				}
			}
			cards = append(cards, map[string]any{"code": "story_completions", "title": "Завершённые истории", "value": completions, "unit": "completions", "delta": nil, "note": nil})
			cards = append(cards, map[string]any{"code": "active_minutes", "title": "Активное время", "value": float64(active) / 60000, "unit": "minutes", "delta": nil, "note": nil})
			if tab == "artifacts" {
				collections, err := s.collectionCounts(r.Context(), museum, f)
				if err != nil {
					fail(w, 503, "collection_source_unavailable")
					return
				}
				total := 0
				for _, n := range collections {
					total += n
				}
				cards = append(cards, map[string]any{"code": "collections", "title": "Собрано экспонатов", "value": total, "unit": "collections", "delta": nil, "note": nil})
			}
		}
		jsonOut(w, 200, map[string]any{"summary": cards, "meta": meta})
	case "chart":
		series := "views"
		if tab == "overview" || tab == "visitors" {
			series = "visitors"
		}
		labels, values, buckets := bucketCounts(events, f, series, nil)
		jsonOut(w, 200, map[string]any{"labels": labels, "values": values, "buckets": buckets, "chart_label": title, "meta": meta})
	case "breakdown":
		counts := map[string]int{"scene_view": 0, "scene_complete": 0, "engagement": 0}
		for _, e := range events {
			if _, ok := counts[e.Type]; ok {
				counts[e.Type]++
			}
		}
		labels := map[string]string{"scene_view": "Просмотры экранов", "scene_complete": "Завершения историй", "engagement": "Отрезки активности"}
		items := []map[string]any{}
		total := counts["scene_view"] + counts["scene_complete"] + counts["engagement"]
		for _, key := range []string{"scene_view", "scene_complete", "engagement"} {
			value := 0.0
			if total > 0 {
				value = 100 * float64(counts[key]) / float64(total)
			}
			items = append(items, map[string]any{"code": key, "label": labels[key], "value": value, "count": counts[key]})
		}
		jsonOut(w, 200, map[string]any{"title": "Типы событий", "items": items, "meta": meta})
	case "bars":
		counts := map[string]int{}
		titles := map[string]string{}
		total := 0
		for _, e := range events {
			if e.Type == "scene_view" {
				counts[e.ArtifactID]++
				titles[e.ArtifactID] = e.ArtifactTitle
				total++
			}
		}
		ids := []string{}
		for id := range counts {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		items := []map[string]any{}
		for _, id := range ids {
			share := 0.0
			if total > 0 {
				share = 100 * float64(counts[id]) / float64(total)
			}
			items = append(items, map[string]any{"code": id, "label": titles[id], "share": share, "count": counts[id], "note": nil})
		}
		jsonOut(w, 200, map[string]any{"title": "Экспонаты по просмотрам", "items": items, "meta": meta})
	case "ranked":
		counts := map[string]int{}
		titles := map[string]string{}
		for _, e := range events {
			if e.Type == "scene_view" {
				counts[e.ArtifactID]++
				if e.ArtifactTitle != "" {
					titles[e.ArtifactID] = e.ArtifactTitle
				}
			}
		}
		items := []map[string]any{}
		for id, n := range counts {
			items = append(items, map[string]any{"id": id, "title": titles[id], "views": n, "count": n, "delta": nil, "delta_positive": nil})
		}
		sort.Slice(items, func(i, j int) bool {
			if items[i]["count"].(int) == items[j]["count"].(int) {
				return items[i]["id"].(string) < items[j]["id"].(string)
			}
			return items[i]["count"].(int) > items[j]["count"].(int)
		})
		for i := range items {
			items[i]["rank"] = i + 1
		}
		jsonOut(w, 200, map[string]any{"title": "Экспонаты", "items": items, "meta": meta})
	}
}
