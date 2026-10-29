package artifacts

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestEmbedAggregateAndLifecycle(t *testing.T) {
	env := newTestEnv(t)
	svc := NewService(NewSQLiteRepository(env.db), Config{EmbedCountingEnabled: true, Now: func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC) }})
	handler := NewHandler(svc)
	create := performJSON(t, handler, "POST", "/artifacts", map[string]any{"title": "Embed", "category": "other"})
	var created artifactResponse
	decodeResponse(t, create, &created)
	path := "/artifacts/" + created.Artifact.ID
	url := "/api/v1/public/artifacts/" + created.Artifact.PublicCode
	post := func() *httptest.ResponseRecorder { return performNoBody(t, handler, "POST", url+"/embed-opens") }
	if got := post(); got.Code != 404 {
		t.Fatalf("draft count: %d %s", got.Code, got.Body.String())
	}
	screen := performJSON(t, handler, "POST", path+"/screens", map[string]any{"type": "text", "title": "Published text", "payload": `{"body":"Original content"}`})
	if screen.Code != 201 {
		t.Fatal(screen.Body.String())
	}
	if got := performJSON(t, handler, "POST", path+"/publish", map[string]any{}); got.Code != 200 {
		t.Fatal(got.Body.String())
	}
	for i := 0; i < 2; i++ {
		if got := post(); got.Code != 204 {
			t.Fatalf("count: %d %s", got.Code, got.Body.String())
		}
	}
	stats := performNoBody(t, handler, "GET", "/api/v1/artifacts/"+created.Artifact.ID+"/embed-opens")
	if stats.Code != 200 || !strings.Contains(stats.Body.String(), `"opens":2`) {
		t.Fatal(stats.Body.String())
	}
	performJSONMethod(t, handler, "PATCH", path, map[string]any{"title": "Secret draft"})
	public := performNoBody(t, handler, "GET", url)
	if public.Code != 200 || strings.Contains(public.Body.String(), "Secret draft") || public.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("snapshot: %d %s", public.Code, public.Body.String())
	}
	performJSON(t, handler, "POST", path+"/publish", map[string]any{})
	if got := performNoBody(t, handler, "GET", url); !strings.Contains(got.Body.String(), "Secret draft") {
		t.Fatal("latest publication missing")
	}
	performJSON(t, handler, "POST", path+"/archive", map[string]any{})
	if got := post(); got.Code != 404 {
		t.Fatalf("archive count %d", got.Code)
	}
	if got := performNoBody(t, handler, "GET", url); got.Code != 404 || got.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("archive resolve %d", got.Code)
	}
	performJSON(t, handler, "POST", path+"/restore", map[string]any{})
	if got := post(); got.Code != 204 {
		t.Fatalf("restore must follow existing public lifecycle: %d %s", got.Code, got.Body.String())
	}
	performNoBody(t, handler, "DELETE", path)
	if got := post(); got.Code != 404 {
		t.Fatalf("deleted count %d", got.Code)
	}
	var total int
	if err := env.db.QueryRow(`SELECT SUM(opens) FROM artifact_embed_opens WHERE artifact_id=?`, created.Artifact.ID).Scan(&total); err != nil || total != 3 {
		t.Fatalf("aggregate total %d: %v", total, err)
	}
}

func TestEmbedCountingDisabledAndNoExtraData(t *testing.T) {
	env := newTestEnv(t)
	url := "/api/v1/public/artifacts/00000/embed-opens"
	if got := performNoBody(t, env.handler, "POST", url); got.Code != 204 {
		t.Fatalf("disabled %d", got.Code)
	}
	if got := performJSON(t, env.handler, "POST", url, map[string]any{"visitor_id": "forbidden"}); got.Code != 400 {
		t.Fatalf("extra data accepted: %d", got.Code)
	}
	var rows int
	if err := env.db.QueryRow(`SELECT COUNT(*) FROM artifact_embed_opens`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("disabled counter wrote rows: %d %v", rows, err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/artifacts/art_001/embed-opens", nil)
	req.Header.Set("X-Museum-ID", "another-museum")
	out := httptest.NewRecorder()
	env.handler.ServeHTTP(out, req)
	if out.Code != 404 {
		t.Fatalf("tenant leak: %d %s", out.Code, out.Body.String())
	}
}

func TestEmbedStatsSignedTenancy(t *testing.T) {
	env := newTestEnv(t)
	secret := strings.Repeat("s", 32)
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{TokenSecret: secret}))
	path := "/api/v1/artifacts/art_001/embed-opens"
	if got := testMuseumRequest(t, handler, "GET", path, "", "mus_001", nil); got.Code != 401 {
		t.Fatalf("missing token: %d", got.Code)
	}
	if got := testMuseumRequest(t, handler, "GET", path, testMuseumToken(t, secret, "mus_002"), "mus_001", nil); got.Code != 404 {
		t.Fatalf("spoofed museum header: %d", got.Code)
	}
	if got := testMuseumRequest(t, handler, "GET", path, testMuseumToken(t, secret, "mus_001"), "mus_002", nil); got.Code != 200 {
		t.Fatalf("own signed museum: %d %s", got.Code, got.Body.String())
	}
}

func TestEmbedExistingLegacyPublicationDoesNotRequireRepublish(t *testing.T) {
	env := newTestEnv(t)
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{EmbedCountingEnabled: true}))
	create := performJSON(t, handler, "POST", "/artifacts", map[string]any{"title": "Old published exhibit", "category": "other"})
	var item artifactResponse
	decodeResponse(t, create, &item)
	path := "/artifacts/" + item.Artifact.ID
	performJSON(t, handler, "POST", path+"/screens", map[string]any{"type": "text", "title": "Old story", "payload": `{"body":"Published before iframe"}`})
	if got := performJSON(t, handler, "POST", path+"/publish", map[string]any{}); got.Code != 200 {
		t.Fatal(got.Body.String())
	}
	// Existing migration 0002 assigned ten-character hex codes to older objects.
	if _, err := env.db.Exec(`UPDATE artifacts SET public_code='ABCDEF1234' WHERE id=?`, item.Artifact.ID); err != nil {
		t.Fatal(err)
	}
	performJSONMethod(t, handler, "PATCH", path, map[string]any{"title": "Unpublished changes"})
	url := "/api/v1/public/artifacts/ABCDEF1234"
	got := performNoBody(t, handler, "GET", url)
	if got.Code != 200 || !strings.Contains(got.Body.String(), "Old published exhibit") || strings.Contains(got.Body.String(), "Unpublished changes") {
		t.Fatalf("old snapshot: %d %s", got.Code, got.Body.String())
	}
	if counted := performNoBody(t, handler, "POST", url+"/embed-opens"); counted.Code != 204 {
		t.Fatalf("old count: %d %s", counted.Code, counted.Body.String())
	}
	var versions int
	if err := env.db.QueryRow(`SELECT COUNT(*) FROM artifact_publications WHERE artifact_id=?`, item.Artifact.ID).Scan(&versions); err != nil || versions != 1 {
		t.Fatalf("unexpected republish: versions=%d err=%v", versions, err)
	}
}
