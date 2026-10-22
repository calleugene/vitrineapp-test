package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testServer(t *testing.T) (*server, http.Handler) {
	t.Helper()
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name()))
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	artifactsDB, err := sql.Open("sqlite", fmt.Sprintf("file:%s-artifacts?mode=memory&cache=shared", t.Name()))
	if err != nil {
		t.Fatal(err)
	}
	artifactsDB.SetMaxOpenConns(1)
	t.Cleanup(func() { artifactsDB.Close() })
	for _, statement := range []string{
		`CREATE TABLE artifacts (id TEXT PRIMARY KEY, museum_id TEXT NOT NULL)`,
		`CREATE TABLE artifact_visitor_status (visitor_id TEXT NOT NULL, artifact_id TEXT NOT NULL, found BOOLEAN NOT NULL, found_at TEXT, UNIQUE(visitor_id, artifact_id))`,
		`INSERT INTO artifacts (id, museum_id) VALUES ('art-1', 'museum-a')`,
	} {
		if _, err := artifactsDB.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	public := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		museum := "museum-a"
		if r.URL.Path == "/api/v1/public/artifacts/code-b" {
			museum = "museum-b"
		}
		jsonOut(w, 200, map[string]any{"artifact": map[string]any{"id": "art-1", "museum_id": museum, "title": "Fixture artifact"}, "screens": []map[string]string{{"id": "screen-1"}}})
	}))
	t.Cleanup(public.Close)
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	s := &server{db: db, driver: "sqlite", artifactsDB: artifactsDB, artifactsDriver: "sqlite", secret: "test-secret", artifactsURL: public.URL + "/api/v1", client: public.Client(), now: func() time.Time { return now }}
	if err := s.migrate(); err != nil {
		t.Fatal(err)
	}
	return s, s.routes()
}
func token(museum string) string {
	encoded := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"user_id":"u1","museum_id":%q,"role":"methodist","exp":1900000000}`, museum)))
	mac := hmac.New(sha256.New, []byte("test-secret"))
	mac.Write([]byte(encoded))
	return "Bearer " + encoded + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
func eventBody(id, code, key, kind string) map[string]any {
	return map[string]any{"schema_version": 1, "id": id, "public_code": code, "visitor_key": key, "session_id": "session-1", "artifact_id": "art-1", "type": kind, "occurred_at": "2026-10-17T10:00:00Z", "source": "unknown", "screen_id": "screen-1"}
}
func post(t *testing.T, h http.Handler, event map[string]any) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(event)
	req := httptest.NewRequest("POST", "/api/v1/analytics/events", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var body map[string]any
	json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}
func get(t *testing.T, h http.Handler, url, museum string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", token(museum))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	var body map[string]any
	json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func TestIngestIsolationAndIdempotency(t *testing.T) {
	_, h := testServer(t)
	e := eventBody("event-1", "code-a", "visitor-1", "scene_view")
	status, body := post(t, h, e)
	if status != 200 || body["duplicate"] != false {
		t.Fatalf("first event: %d %v", status, body)
	}
	status, body = post(t, h, e)
	if status != 200 || body["duplicate"] != true {
		t.Fatalf("repeat event: %d %v", status, body)
	}
	changed := eventBody("event-1", "code-a", "visitor-1", "scene_complete")
	status, _ = post(t, h, changed)
	if status != 409 {
		t.Fatalf("changed payload under same id: %d", status)
	}
	e["id"] = "event-2"
	status, body = post(t, h, e)
	if status != 200 || body["duplicate"] != true {
		t.Fatalf("replay with new id: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/visitors/summary?period=month", "museum-a")
	if status != 200 || body["total_visitors"] != float64(1) {
		t.Fatalf("summary: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/visitors/summary?period=month", "museum-b")
	if status != 200 || body["total_visitors"] != float64(0) {
		t.Fatalf("other museum: %d %v", status, body)
	}
	status, _ = get(t, h, "/api/v1/visitors/summary?museum_id=museum-b", "museum-a")
	if status != 403 {
		t.Fatalf("cross-museum query: %d", status)
	}
	status, body = get(t, h, "/api/v1/analytics/recent-activity?period=month", "museum-a")
	if status != 200 || len(body["activities"].([]any)) != 1 {
		t.Fatalf("recent activity: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/stats/artifacts/ranked?period=month", "museum-a")
	if status != 200 || body["items"].([]any)[0].(map[string]any)["title"] != "Fixture artifact" {
		t.Fatalf("ranked title: %d %v", status, body)
	}
	e["id"] = "event-3"
	e["public_code"] = "code-b"
	e["artifact_id"] = "wrong"
	status, _ = post(t, h, e)
	if status != 400 {
		t.Fatalf("wrong artifact: %d", status)
	}
}

func TestCollectionRequiresPersistedFactAndCountsOnce(t *testing.T) {
	s, h := testServer(t)
	e := eventBody("collection-1", "code-a", "visitor-1", "artifact_collected")
	delete(e, "screen_id")
	status, _ := post(t, h, e)
	if status != 409 {
		t.Fatalf("unconfirmed collection: %d", status)
	}
	if _, err := s.artifactsDB.Exec(`INSERT INTO artifact_visitor_status (visitor_id,artifact_id,found,found_at) VALUES ('visitor-1','art-1',true,'2026-10-17T10:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	status, body := post(t, h, e)
	if status != 200 || body["duplicate"] != false {
		t.Fatalf("confirmed collection: %d %v", status, body)
	}
	e["id"] = "collection-2"
	status, body = post(t, h, e)
	if status != 200 || body["duplicate"] != true {
		t.Fatalf("repeated collection: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/visitors/list?period=month&sort_by=collectedArtifacts", "museum-a")
	if status != 200 || body["items"].([]any)[0].(map[string]any)["collected_artifacts"] != float64(1) {
		t.Fatalf("visitor collection count: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/stats/artifacts/summary?period=month", "museum-a")
	if status != 200 {
		t.Fatalf("artifact summary: %d %v", status, body)
	}
	cards := body["summary"].([]any)
	if cards[len(cards)-1].(map[string]any)["value"] != float64(1) {
		t.Fatalf("collection summary: %v", cards)
	}
}

func TestCollectionSourceUnavailableIsExplicit(t *testing.T) {
	s, h := testServer(t)
	s.artifactsDB = nil
	status, body := get(t, h, "/api/v1/visitors/list?period=month", "museum-a")
	if status != 503 || body["error"].(map[string]any)["code"] != "collection_source_unavailable" {
		t.Fatalf("visitor list without source: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/visitors/summary?period=month", "museum-a")
	if status != 200 || body["meta"].(map[string]any)["capabilities"].(map[string]any)["collections"] != false {
		t.Fatalf("summary capability without source: %d %v", status, body)
	}
}

func TestFiltersAndBoundedEngagement(t *testing.T) {
	_, h := testServer(t)
	e := eventBody("event-1", "code-a", "visitor-1", "engagement")
	e["properties"] = map[string]any{"active_ms": 15001}
	status, _ := post(t, h, e)
	if status != 400 {
		t.Fatalf("unbounded heartbeat: %d", status)
	}
	e["properties"] = map[string]any{"active_ms": 15000}
	status, _ = post(t, h, e)
	if status != 200 {
		t.Fatalf("bounded heartbeat: %d", status)
	}
	for _, query := range []string{"period=garbage", "timezone=Bad/Zone", "from=2026-10-01T00:00:00Z", "period=month&from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z", "route_id=r1", "page=0", "sort_by=unsafe"} {
		status, _ = get(t, h, "/api/v1/visitors/list?"+query, "museum-a")
		if status != 400 {
			t.Errorf("invalid %s: %d", query, status)
		}
	}
	status, body := get(t, h, "/api/v1/visitors/summary?period=day&timezone=Europe/Berlin", "museum-a")
	if status != 200 {
		t.Fatalf("DST filter: %d %v", status, body)
	}
	status, body = get(t, h, "/api/v1/visitors/summary?period=month", "museum-a")
	if status != 200 || body["deltas"].(map[string]any)["total_visitors"] != nil {
		t.Fatalf("zero baseline delta: %d %v", status, body)
	}
	quiz := eventBody("quiz-1", "code-a", "visitor-1", "quiz_answer")
	quiz["properties"] = map[string]any{"correct": true}
	if status, _ := post(t, h, quiz); status != 200 {
		t.Fatalf("typed quiz: %d", status)
	}
	quiz["id"] = "quiz-2"
	quiz["properties"] = map[string]any{"answer": "personal text"}
	if status, _ := post(t, h, quiz); status != 400 {
		t.Fatalf("free text quiz rejected: %d", status)
	}
}

func TestPaginationSortAndDST(t *testing.T) {
	_, h := testServer(t)
	for i := 0; i < 55; i++ {
		e := eventBody(fmt.Sprintf("event-%d", i), "code-a", fmt.Sprintf("visitor-%02d", i), "scene_view")
		e["session_id"] = fmt.Sprintf("session-%d", i)
		if status, _ := post(t, h, e); status != 200 {
			t.Fatalf("event %d: %d", i, status)
		}
	}
	status, body := get(t, h, "/api/v1/visitors/list?limit=20&page=3&sort_by=name&sort_dir=asc", "museum-a")
	if status != 200 || body["total"] != float64(55) || len(body["items"].([]any)) != 15 {
		t.Fatalf("pagination: %d %v", status, body)
	}
	status, _ = get(t, h, "/api/v1/visitors/list?sort_by=routeCompleted", "museum-a")
	if status != 400 {
		t.Fatalf("unavailable sort: %d", status)
	}
	loc, _ := time.LoadLocation("Europe/Berlin")
	f := filters{From: time.Date(2026, 3, 28, 23, 0, 0, 0, time.UTC), To: time.Date(2026, 3, 29, 22, 0, 0, 0, time.UTC), Location: loc, Period: "day"}
	_, _, buckets := bucketCounts(nil, f, "visitors", nil)
	if len(buckets) != 1 {
		t.Fatalf("DST buckets: %v", buckets)
	}
	from, _ := time.Parse(time.RFC3339, buckets[0]["from"])
	to, _ := time.Parse(time.RFC3339, buckets[0]["to"])
	if to.Sub(from) != 23*time.Hour {
		t.Fatalf("spring DST day: %v", to.Sub(from))
	}
	f.From = time.Date(2026, 10, 24, 22, 0, 0, 0, time.UTC)
	f.To = time.Date(2026, 10, 25, 23, 0, 0, 0, time.UTC)
	_, _, buckets = bucketCounts(nil, f, "visitors", nil)
	from, _ = time.Parse(time.RFC3339, buckets[0]["from"])
	to, _ = time.Parse(time.RFC3339, buckets[0]["to"])
	if to.Sub(from) != 25*time.Hour {
		t.Fatalf("autumn DST day: %v", to.Sub(from))
	}
}

func TestEventsSurviveRestart(t *testing.T) {
	file := t.TempDir() + "/analytics.db"
	db, err := sql.Open("sqlite", "file:"+file)
	if err != nil {
		t.Fatal(err)
	}
	publication := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		museum := "museum-a"
		if r.URL.Path == "/api/v1/public/artifacts/code-b" {
			museum = "museum-b"
		}
		jsonOut(w, 200, map[string]any{"artifact": map[string]any{"id": "art-1", "museum_id": museum}, "screens": []map[string]string{{"id": "screen-1"}}})
	}))
	defer publication.Close()
	now := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	makeServer := func(db *sql.DB) *server {
		return &server{db: db, driver: "sqlite", secret: "test-secret", artifactsURL: publication.URL + "/api/v1", client: publication.Client(), now: func() time.Time { return now }}
	}
	s := makeServer(db)
	if err := s.migrate(); err != nil {
		t.Fatal(err)
	}
	for _, pair := range []struct{ id, code, key string }{{"a1", "code-a", "visitor-shared"}, {"b1", "code-b", "visitor-shared"}} {
		e := eventBody(pair.id, pair.code, pair.key, "scene_view")
		e["session_id"] = pair.id
		if status, _ := post(t, s.routes(), e); status != 200 {
			t.Fatalf("store %s: %d", pair.id, status)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = sql.Open("sqlite", "file:"+file)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s = makeServer(db)
	for _, museum := range []string{"museum-a", "museum-b"} {
		status, body := get(t, s.routes(), "/api/v1/visitors/summary?period=month", museum)
		if status != 200 || body["total_visitors"] != float64(1) {
			t.Fatalf("after restart %s: %d %v", museum, status, body)
		}
	}
	replay := eventBody("a1", "code-a", "visitor-shared", "scene_view")
	replay["session_id"] = "a1"
	status, body := post(t, s.routes(), replay)
	if status != 200 || body["duplicate"] != true {
		t.Fatalf("replay after restart: %d %v", status, body)
	}
}

func TestRevokedSessionAndMuseumHeader(t *testing.T) {
	s, h := testServer(t)
	revoked := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(401) }))
	defer revoked.Close()
	s.authURL = revoked.URL
	status, _ := get(t, h, "/api/v1/visitors/summary", "museum-a")
	if status != 401 {
		t.Fatalf("revoked session: %d", status)
	}
	s.authURL = ""
	req := httptest.NewRequest("GET", "/api/v1/visitors/summary", nil)
	req.Header.Set("Authorization", token("museum-a"))
	req.Header.Set("X-Museum-ID", "museum-b")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatalf("foreign museum header: %d", rec.Code)
	}
}

func TestVisitorPaginationHugePage(t *testing.T) {
	_, h := testServer(t)
	if status, _ := post(t, h, eventBody("page-event", "code-a", "visitor-1", "scene_view")); status != 200 {
		t.Fatalf("ingest: %d", status)
	}
	status, body := get(t, h, "/api/v1/visitors/list?period=month&page=9223372036854775807&limit=100", "museum-a")
	if status != 200 || body["total"] != float64(1) || len(body["items"].([]any)) != 0 {
		t.Fatalf("huge page: %d %v", status, body)
	}
}

func TestRouteAndFeedbackStatsUseDedicatedSources(t *testing.T) {
	s, h := testServer(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != token("museum-a") {
			t.Error("authorization not forwarded")
		}
		if r.URL.Query().Get("period") != "" || r.URL.Query().Get("from") == "" || r.URL.Query().Get("to") == "" {
			t.Errorf("unresolved range: %s", r.URL.RawQuery)
		}
		jsonOut(w, 200, map[string]any{"summary": []map[string]any{{"code": "source", "value": 2}}, "meta": map[string]string{"timezone": "UTC"}})
	}))
	defer upstream.Close()
	s.routeURL = upstream.URL
	s.feedbackURL = upstream.URL
	for _, tab := range []string{"routes", "feedback"} {
		status, body := get(t, h, "/api/v1/stats/"+tab+"/summary?period=month", "museum-a")
		if status != 200 || body["summary"].([]any)[0].(map[string]any)["value"] != float64(2) {
			t.Fatalf("%s: %d %v", tab, status, body)
		}
	}
}
