package artifacts

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestArtifactsCRUDFlow(t *testing.T) {
	env := newTestEnv(t)

	createResp := performJSON(t, env.handler, http.MethodPost, "/artifacts", map[string]any{
		"title":       "War Diary",
		"description": "Daily notes",
		"category":    "letters",
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d body=%s", createResp.Code, createResp.Body.String())
	}
	var created artifactResponse
	decodeResponse(t, createResp, &created)

	getResp := performNoBody(t, env.handler, http.MethodGet, "/artifacts/"+created.Artifact.ID)
	if getResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getResp.Code)
	}

	updateResp := performJSONMethod(t, env.handler, http.MethodPatch, "/artifacts/"+created.Artifact.ID, map[string]any{
		"title": "Updated Diary",
	})
	if updateResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", updateResp.Code)
	}

	deleteResp := performNoBody(t, env.handler, http.MethodDelete, "/artifacts/"+created.Artifact.ID)
	if deleteResp.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", deleteResp.Code)
	}
}

func TestArchiveRestoreDuplicateArtifact(t *testing.T) {
	env := newTestEnv(t)

	archiveResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/archive", map[string]any{})
	if archiveResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", archiveResp.Code)
	}

	restoreResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_003/restore", map[string]any{})
	if restoreResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", restoreResp.Code)
	}

	duplicateResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/duplicate", map[string]any{})
	if duplicateResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", duplicateResp.Code)
	}
}

func TestScreensFlow(t *testing.T) {
	env := newTestEnv(t)

	listResp := performNoBody(t, env.handler, http.MethodGet, "/artifacts/art_001/screens")
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", listResp.Code)
	}

	createResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/screens", map[string]any{
		"type":    "text",
		"title":   "История экспоната",
		"payload": `{"audio":"x.mp3"}`,
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", createResp.Code)
	}
	var created screenResponse
	decodeResponse(t, createResp, &created)

	patchResp := performJSONMethod(t, env.handler, http.MethodPatch, "/artifacts/art_001/screens/"+created.Screen.ID, map[string]any{
		"title": "Обновлённая история",
	})
	if patchResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", patchResp.Code)
	}

	reorderResp := performJSONMethod(t, env.handler, http.MethodPut, "/artifacts/art_001/screens/reorder", map[string]any{
		"items": []map[string]any{
			{"screenId": "scr_art_001_start", "order": 1},
			{"screenId": created.Screen.ID, "order": 2},
			{"screenId": "scr_001", "order": 3},
			{"screenId": "scr_002", "order": 4},
			{"screenId": "scr_art_001_finish", "order": 5},
		},
	})
	if reorderResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", reorderResp.Code)
	}

	deleteResp := performNoBody(t, env.handler, http.MethodDelete, "/artifacts/art_001/screens/"+created.Screen.ID)
	if deleteResp.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", deleteResp.Code)
	}
}

func TestPublishCreatesImmutablePublicSnapshotAndQR(t *testing.T) {
	env := newTestEnv(t)

	created := performJSON(t, env.handler, http.MethodPost, "/artifacts", map[string]any{
		"title": "Новый экспонат",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("create artifact: %d %s", created.Code, created.Body.String())
	}
	var artifact artifactResponse
	decodeResponse(t, created, &artifact)

	screen := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+artifact.Artifact.ID+"/screens", map[string]any{
		"type": "text", "title": "Первый экран", "payload": `{"body":"Текст"}`,
	})
	if screen.Code != http.StatusCreated {
		t.Fatalf("create text screen: %d %s", screen.Code, screen.Body.String())
	}

	published := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+artifact.Artifact.ID+"/publish", map[string]any{
		"expected_draft_revision": 2,
	})
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	var publication publishResponse
	decodeResponse(t, published, &publication)
	if len(publication.PublicCode) != 5 {
		t.Fatalf("public code must contain five characters, got %q", publication.PublicCode)
	}

	public := httptest.NewRequest(http.MethodGet, "/api/v1/public/artifacts/"+publication.PublicCode, nil)
	publicResp := httptest.NewRecorder()
	env.handler.ServeHTTP(publicResp, public)
	if publicResp.Code != http.StatusOK || !strings.Contains(publicResp.Body.String(), "Первый экран") {
		t.Fatalf("public snapshot: %d %s", publicResp.Code, publicResp.Body.String())
	}

	publicMuseum := httptest.NewRequest(http.MethodGet, "/api/v1/public/museums/mus_001/artifacts", nil)
	publicMuseumResp := httptest.NewRecorder()
	env.handler.ServeHTTP(publicMuseumResp, publicMuseum)
	if publicMuseumResp.Code != http.StatusOK || !strings.Contains(publicMuseumResp.Body.String(), "Новый экспонат") {
		t.Fatalf("public museum catalogue: %d %s", publicMuseumResp.Code, publicMuseumResp.Body.String())
	}

	collect := performJSON(t, env.handler, http.MethodPost, "/api/v1/public/artifacts/"+publication.PublicCode+"/collect", map[string]any{
		"visitor_id": "visitor-public-1",
	})
	if collect.Code != http.StatusOK {
		t.Fatalf("collect public artifact: %d %s", collect.Code, collect.Body.String())
	}

	qr := performNoBody(t, env.handler, http.MethodGet, "/artifacts/"+artifact.Artifact.ID+"/qr.png")
	if qr.Code != http.StatusOK || qr.Header().Get("Content-Type") != "image/png" || qr.Body.Len() == 0 {
		t.Fatalf("qr: status=%d content-type=%q bytes=%d", qr.Code, qr.Header().Get("Content-Type"), qr.Body.Len())
	}

	unsupported := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+artifact.Artifact.ID+"/screens", map[string]any{
		"type": "video", "title": "Недоступно",
	})
	if unsupported.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected unsupported type rejection, got %d %s", unsupported.Code, unsupported.Body.String())
	}
}

func TestDraftsFlow(t *testing.T) {
	env := newTestEnv(t)

	createResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/drafts", map[string]any{
		"name":    "Second draft",
		"content": `{"screens":3}`,
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", createResp.Code)
	}
	var created draftResponse
	decodeResponse(t, createResp, &created)

	patchResp := performJSONMethod(t, env.handler, http.MethodPatch, "/artifacts/art_001/drafts/"+created.Draft.ID, map[string]any{
		"name": "Edited draft",
	})
	if patchResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", patchResp.Code)
	}

	readyResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/drafts/"+created.Draft.ID+"/publish-ready", map[string]any{})
	if readyResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", readyResp.Code)
	}

	discardResp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/drafts/"+created.Draft.ID+"/discard", map[string]any{})
	if discardResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", discardResp.Code)
	}
}

func TestMediaAndModelsFlow(t *testing.T) {
	env := newTestEnv(t)

	mediaResp := performJSON(t, env.handler, http.MethodPost, "/media/upload", map[string]any{
		"artifact_id": "art_001",
		"file_name":   "scan.png",
		"mime_type":   "image/png",
		"url":         "https://cdn.local/scan.png",
		"size_bytes":  8192,
	})
	if mediaResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", mediaResp.Code)
	}
	var mediaCreated mediaResponse
	decodeResponse(t, mediaResp, &mediaCreated)

	getMediaResp := performNoBody(t, env.handler, http.MethodGet, "/media/"+mediaCreated.Media.ID)
	if getMediaResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getMediaResp.Code)
	}

	modelResp := performJSON(t, env.handler, http.MethodPost, "/models/upload", map[string]any{
		"artifact_id": "art_001",
		"file_name":   "object.glb",
		"format":      "glb",
		"storage_url": "https://cdn.local/object.glb",
	})
	if modelResp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", modelResp.Code)
	}
	var modelCreated modelResponse
	decodeResponse(t, modelResp, &modelCreated)

	processResp := performJSON(t, env.handler, http.MethodPost, "/models/"+modelCreated.Model.ID+"/process", map[string]any{})
	if processResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", processResp.Code)
	}

	statusResp := performNoBody(t, env.handler, http.MethodGet, "/models/"+modelCreated.Model.ID+"/status")
	if statusResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", statusResp.Code)
	}

	deleteResp := performNoBody(t, env.handler, http.MethodDelete, "/media/"+mediaCreated.Media.ID)
	if deleteResp.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", deleteResp.Code)
	}
}

type testEnv struct {
	db      *sql.DB
	handler http.Handler
}

func newTestEnv(t *testing.T) testEnv {
	t.Helper()

	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mustExecFile(t, db, filepath.Join("testdata", "schema.sql"))
	mustExecFile(t, db, filepath.Join("testdata", "seed.sql"))

	svc := NewService(NewSQLiteRepository(db), Config{
		Now: func() time.Time { return time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC) },
	})
	return testEnv{db: db, handler: NewHandler(svc)}
}

func mustExecFile(t *testing.T, db *sql.DB, path string) {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read file %s: %v", path, err)
	}
	if _, err := db.ExecContext(context.Background(), string(content)); err != nil {
		t.Fatalf("exec file %s: %v", path, err)
	}
}

func performJSON(t *testing.T, handler http.Handler, method, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	return performJSONMethod(t, handler, method, path, body)
}

func performJSONMethod(t *testing.T, handler http.Handler, method, path string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Museum-ID", "mus_001")
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	return resp
}

func performNoBody(t *testing.T, handler http.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("X-Museum-ID", "mus_001")
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	return resp
}

func decodeResponse(t *testing.T, resp *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.NewDecoder(strings.NewReader(resp.Body.String())).Decode(dst); err != nil {
		t.Fatalf("decode response: %v body=%s", err, resp.Body.String())
	}
}
