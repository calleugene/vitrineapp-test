package platform

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

const testSecret = "a-long-secret-used-only-for-testing-12345"

func access(museum, user, role string) string {
	raw, _ := json.Marshal(Claims{MuseumID: museum, UserID: user, SessionID: "session", Role: role, Exp: time.Now().Add(time.Hour).Unix()})
	p := base64.RawURLEncoding.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(testSecret))
	mac.Write([]byte(p))
	return "Bearer " + p + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func fixture(t *testing.T, kind string) *Server {
	t.Helper()
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		JSON(w, 200, map[string]any{"user": map[string]any{"status": "active", "full_name": "Test user"}})
	}))
	t.Cleanup(auth.Close)
	artifacts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		museum := "museum-a"
		id := r.PathValue("id")
		if r.URL.Path == "/artifacts/foreign" {
			museum = "museum-b"
		}
		if id == "" {
			id = "art-1"
		}
		JSON(w, 200, map[string]any{"artifact": map[string]any{"id": id, "museum_id": museum, "public_code": "public-code"}})
	}))
	t.Cleanup(artifacts.Close)
	s, err := Open(Config{Kind: kind, DSN: "file:" + filepath.Join(t.TempDir(), kind+".db"), Secret: testSecret, AuthURL: auth.URL, ArtifactsURL: artifacts.URL})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}
func request(t *testing.T, s *Server, method, path, token string, input any) (int, map[string]any) {
	t.Helper()
	var raw []byte
	if input != nil {
		raw, _ = json.Marshal(input)
	}
	r := httptest.NewRequest(method, path, bytes.NewReader(raw))
	if input != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		r.Header.Set("Authorization", token)
	}
	w := httptest.NewRecorder()
	s.Routes().ServeHTTP(w, r)
	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
	}
	return w.Code, payload
}
func requireStatus(t *testing.T, got, want int, p map[string]any) {
	t.Helper()
	if got != want {
		t.Fatalf("status=%d want=%d: %v", got, want, p)
	}
}
func TestRouteLifecycleAndMuseumIsolation(t *testing.T) {
	s := fixture(t, "route")
	owner := access("museum-a", "editor-a", "methodist")
	foreign := access("museum-b", "editor-b", "methodist")
	code, p := request(t, s, "POST", "/api/v1/routes", owner, map[string]any{"title": "Letters", "artifact_ids": []string{"art-1", "art-2"}, "status": "published"})
	requireStatus(t, code, 200, p)
	route := p["route"].(map[string]any)
	id := route["id"].(string)
	code, p = request(t, s, "GET", "/api/v1/routes/"+id, foreign, nil)
	requireStatus(t, code, 404, p)
	code, p = request(t, s, "GET", "/api/v1/routes?museum_id=museum-b", owner, nil)
	requireStatus(t, code, 403, p)
	code, p = request(t, s, "PUT", "/api/v1/routes/"+id+"/artifacts/reorder", owner, map[string]any{"artifact_ids": []string{"art-1", "art-1"}})
	requireStatus(t, code, 400, p)
	code, p = request(t, s, "PUT", "/api/v1/routes/"+id+"/artifacts/reorder", owner, map[string]any{"artifact_ids": []string{"art-2", "art-1"}})
	requireStatus(t, code, 200, p)
	code, p = request(t, s, "PATCH", "/api/v1/routes/"+id, owner, map[string]any{"title": "Changed", "version": 1})
	requireStatus(t, code, 409, p)
	code, p = request(t, s, "GET", "/api/v1/public/museums/museum-a/routes", "", nil)
	requireStatus(t, code, 200, p)
	if len(p["routes"].([]any)) != 1 {
		t.Fatal(p)
	}
	start := map[string]any{"visitor_key": "browser-1", "session_id": "session-1"}
	for i := 0; i < 2; i++ {
		code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/start", "", start)
		requireStatus(t, code, 200, p)
	}
	code, p = request(t, s, "GET", "/api/v1/routes/popular", owner, nil)
	requireStatus(t, code, 200, p)
	if p["routes"].([]any)[0].(map[string]any)["visits"] != float64(1) {
		t.Fatal(p)
	}
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/progress", "", map[string]any{"visitor_key": "browser-1", "session_id": "session-1", "artifact_id": "art-1"})
	requireStatus(t, code, 503, p)
	code, p = request(t, s, "DELETE", "/api/v1/routes/"+id, owner, nil)
	requireStatus(t, code, 200, p)
	code, p = request(t, s, "GET", "/api/v1/public/routes/"+id, "", nil)
	requireStatus(t, code, 404, p)
	code, p = request(t, s, "GET", "/api/v1/routes?page=9223372036854775807&limit=100", owner, nil)
	requireStatus(t, code, 200, p)
	if len(p["routes"].([]any)) != 0 {
		t.Fatal(p)
	}
}
func TestFeedbackModerationPrivacyAndNotificationDelivery(t *testing.T) {
	feedback := fixture(t, "feedback")
	routes := fixture(t, "route")
	notification := fixture(t, "notification")
	fs := httptest.NewServer(feedback.Routes())
	defer fs.Close()
	rs := httptest.NewServer(routes.Routes())
	defer rs.Close()
	notification.RouteURL = rs.URL + "/api/v1"
	notification.FeedbackURL = fs.URL + "/api/v1"
	owner := access("museum-a", "editor-a", "methodist")
	otherUser := access("museum-a", "editor-b", "methodist")
	visitor := access("", "visitor-a", "visitor")
	input := map[string]any{"id": "request-1", "public_code": "public-code", "type": "review", "title": "Good museum", "body": "A useful story", "rating": 5}
	code, p := request(t, feedback, "POST", "/api/v1/public/feedback", visitor, input)
	requireStatus(t, code, 201, p)
	id := p["feedback"].(map[string]any)["id"].(string)
	code, p = request(t, feedback, "POST", "/api/v1/public/feedback", visitor, input)
	requireStatus(t, code, 200, p)
	if p["duplicate"] != true {
		t.Fatal(p)
	}
	input["rating"] = 4
	code, p = request(t, feedback, "POST", "/api/v1/public/feedback", visitor, input)
	requireStatus(t, code, 409, p)
	code, p = request(t, feedback, "GET", "/api/v1/public/museums/museum-a/reviews", "", nil)
	requireStatus(t, code, 200, p)
	if len(p["items"].([]any)) != 0 {
		t.Fatal("pending review leaked")
	}
	code, p = request(t, feedback, "PUT", "/api/v1/feedback/"+id+"/reply", owner, map[string]any{"body": "Private draft", "status": "draft"})
	requireStatus(t, code, 200, p)
	code, p = request(t, feedback, "GET", "/api/v1/public/feedback/"+id, visitor, nil)
	requireStatus(t, code, 200, p)
	if p["feedback"].(map[string]any)["reply"] != "" {
		t.Fatal("draft leaked")
	}
	code, p = request(t, feedback, "PATCH", "/api/v1/feedback/"+id, owner, map[string]any{"status": "published"})
	requireStatus(t, code, 200, p)
	code, p = request(t, feedback, "GET", "/api/v1/feedback/summary", owner, nil)
	requireStatus(t, code, 200, p)
	if p["rating"] != float64(5) {
		t.Fatal(p)
	}
	code, p = request(t, feedback, "GET", "/api/v1/feedback/"+id, access("museum-b", "editor-c", "methodist"), nil)
	requireStatus(t, code, 404, p)
	code, p = request(t, notification, "GET", "/api/v1/notifications", owner, nil)
	requireStatus(t, code, 200, p)
	firstCount := p["total"].(float64)
	if firstCount != 3 {
		t.Fatal(p)
	}
	nid := p["items"].([]any)[0].(map[string]any)["id"].(string)
	code, p = request(t, notification, "GET", "/api/v1/notifications", owner, nil)
	requireStatus(t, code, 200, p)
	if p["total"] != firstCount {
		t.Fatal("duplicate notification")
	}
	code, p = request(t, notification, "POST", "/api/v1/notifications/"+nid+"/read", owner, nil)
	requireStatus(t, code, 200, p)
	code, p = request(t, notification, "GET", "/api/v1/notifications?unread=true", owner, nil)
	requireStatus(t, code, 200, p)
	if p["unread_count"] != firstCount-1 {
		t.Fatal(p)
	}
	code, p = request(t, notification, "GET", "/api/v1/notifications?unread=true", otherUser, nil)
	requireStatus(t, code, 200, p)
	if p["unread_count"] != firstCount {
		t.Fatal("another user's receipt leaked")
	}
	code, p = request(t, notification, "POST", "/api/v1/notifications/read-all", owner, nil)
	requireStatus(t, code, 200, p)
	code, p = request(t, notification, "GET", "/api/v1/notifications?unread=true", owner, nil)
	requireStatus(t, code, 200, p)
	if p["unread_count"] != float64(0) {
		t.Fatal(p)
	}
}
func TestAuthenticationAndDependencyFailure(t *testing.T) {
	s := fixture(t, "route")
	code, p := request(t, s, "GET", "/api/v1/routes", "", nil)
	requireStatus(t, code, 401, p)
	code, p = request(t, s, "GET", "/api/v1/routes", access("museum-a", "visitor", "visitor"), nil)
	requireStatus(t, code, 403, p)
	s.AuthURL = "http://127.0.0.1:1"
	code, p = request(t, s, "GET", "/api/v1/routes", access("museum-a", "editor", "methodist"), nil)
	requireStatus(t, code, 503, p)
}
func TestPersistenceAndOptimisticConcurrency(t *testing.T) {
	s := fixture(t, "route")
	ctx := t.Context()
	at := Now()
	x := Record{ID: "route-1", Museum: "museum-a", Kind: "route", Body: `{"title":"First"}`, Created: at, Updated: at}
	if err := s.Save(ctx, x, nil); err != nil {
		t.Fatal(err)
	}
	x.Version = 1
	x.Body = `{"title":"Second"}`
	if err := s.Save(ctx, x, nil); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(ctx, x, nil); err != ErrConflict {
		t.Fatalf("stale write: %v", err)
	}
	c := s.Config
	s.Close()
	reopened, err := Open(c)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	saved, err := reopened.Get(ctx, "route", x.ID, x.Museum)
	if err != nil || saved.Version != 2 || saved.Body != x.Body {
		t.Fatal(fmt.Sprint(saved, err))
	}
}

func TestRouteProgressUsesConfirmedCollectionAndStartSnapshot(t *testing.T) {
	s := fixture(t, "route")
	owner := access("museum-a", "editor-a", "methodist")
	code, p := request(t, s, "POST", "/api/v1/routes", owner, map[string]any{"title": "Snapshot route", "artifact_ids": []string{"art-1"}, "status": "published"})
	requireStatus(t, code, 200, p)
	id := p["route"].(map[string]any)["id"].(string)
	s.artifactsDB = s.DB
	s.artifactsDriver = "sqlite"
	if _, err := s.DB.Exec(`CREATE TABLE artifact_visitor_status(visitor_id TEXT,artifact_id TEXT,found BOOLEAN)`); err != nil {
		t.Fatal(err)
	}
	identity := map[string]any{"visitor_key": "browser-1", "session_id": "visit-1"}
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/start", "", identity)
	requireStatus(t, code, 200, p)
	code, p = request(t, s, "PATCH", "/api/v1/routes/"+id, owner, map[string]any{"artifact_ids": []string{"art-2"}})
	requireStatus(t, code, 200, p)
	identity["artifact_id"] = "art-1"
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/progress", "", identity)
	requireStatus(t, code, 409, p)
	if _, err := s.DB.Exec(`INSERT INTO artifact_visitor_status VALUES('browser-1','art-1',true)`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/progress", "", identity)
		requireStatus(t, code, 200, p)
		if p["visit"].(map[string]any)["completed"] != true {
			t.Fatal(p)
		}
	}
	code, p = request(t, s, "GET", "/api/v1/routes/metrics", owner, nil)
	requireStatus(t, code, 200, p)
	if p["sessions"] != float64(1) || p["completed_sessions"] != float64(1) || p["avg_progress_percent"] != float64(100) {
		t.Fatal(p)
	}
	for _, view := range []string{"summary", "chart", "breakdown", "ranked", "bars"} {
		code, p = request(t, s, "GET", "/api/v1/stats/"+view+"?period=month", owner, nil)
		requireStatus(t, code, 200, p)
		if p["meta"] == nil {
			t.Fatal(p)
		}
	}
	code, p = request(t, s, "GET", "/api/v1/stats/chart?from=2026-10-25T00:00:00%2B02:00&to=2026-10-26T00:00:00%2B01:00&timezone=Europe%2FBerlin", owner, nil)
	requireStatus(t, code, 200, p)
	buckets := p["buckets"].([]any)
	if len(buckets) != 1 {
		t.Fatal(p)
	}
	bucket := buckets[0].(map[string]any)
	from, _ := time.Parse(time.RFC3339, bucket["from"].(string))
	to, _ := time.Parse(time.RFC3339, bucket["to"].(string))
	if to.Sub(from) != 25*time.Hour {
		t.Fatal(p)
	}
}

func TestQRStartHintIsRequiredOnlyForNewSessions(t *testing.T) {
	s := fixture(t, "route")
	owner := access("museum-a", "editor-a", "methodist")
	code, p := request(t, s, "POST", "/api/v1/routes", owner, map[string]any{"title": "QR route", "artifact_ids": []string{"art-1"}, "status": "published", "require_qr": true})
	requireStatus(t, code, 200, p)
	id := p["route"].(map[string]any)["id"].(string)
	in := map[string]any{"visitor_key": "browser-1", "session_id": "session-1"}
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/start", "", in)
	requireStatus(t, code, 409, p)
	in["source"] = "qr"
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/start", "", in)
	requireStatus(t, code, 200, p)
	delete(in, "source")
	code, p = request(t, s, "POST", "/api/v1/public/routes/"+id+"/start", "", in)
	requireStatus(t, code, 200, p)
}
