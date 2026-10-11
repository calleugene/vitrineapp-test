package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	goqr "github.com/piglig/go-qr"
	_ "modernc.org/sqlite"
)

func TestNineScreenFlowAPI(t *testing.T) {
	db, err := sql.Open("sqlite", "file:nine-screen-flow?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := initTestSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	a := &app{db: newDatabase(db, false), auth: authConfig{demo: true}}
	h := a.routes()

	created := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits", map[string]string{"title": "Крылатая фигура", "short_description": "Экспонат начала XX века"})
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	var createBody struct {
		Exhibit exhibit `json:"exhibit"`
	}
	decodeBody(t, created, &createBody)
	if len(createBody.Exhibit.PublicCode) != 5 || strings.ContainsAny(createBody.Exhibit.PublicCode, "abcdefghijklmnopqrstuvwxyz") {
		t.Fatalf("invalid public code: %q", createBody.Exhibit.PublicCode)
	}
	for _, symbol := range createBody.Exhibit.PublicCode {
		if !strings.ContainsRune("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", symbol) {
			t.Fatalf("invalid public code symbol: %q", symbol)
		}
	}

	screenResponse := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+createBody.Exhibit.ID+"/screens", map[string]string{"type": "TEXT", "title": "История находки", "text": "Текст экрана"})
	if screenResponse.Code != http.StatusCreated {
		t.Fatalf("screen: %d %s", screenResponse.Code, screenResponse.Body.String())
	}
	var screenBody struct {
		Screen screen `json:"screen"`
	}
	decodeBody(t, screenResponse, &screenBody)

	first := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+createBody.Exhibit.ID+"/publish", map[string]string{})
	if first.Code != http.StatusOK {
		t.Fatalf("first publish: %d %s", first.Code, first.Body.String())
	}
	var publishBody struct {
		Code    string `json:"code"`
		First   bool   `json:"is_first_publication"`
		Version int    `json:"version"`
	}
	decodeBody(t, first, &publishBody)
	if !publishBody.First || publishBody.Version != 1 || len(publishBody.Code) != 5 {
		t.Fatalf("unexpected first publish: %#v", publishBody)
	}

	before := request(t, h, http.MethodGet, "/api/v1/public/exhibits/"+publishBody.Code, nil)
	if before.Code != http.StatusOK {
		t.Fatalf("public before update: %d", before.Code)
	}
	beforePayload := before.Body.String()

	updated := requestJSON(t, h, http.MethodPatch, "/api/v1/exhibits/"+createBody.Exhibit.ID+"/screens/"+screenBody.Screen.ID, map[string]string{"text": "Новый черновик"})
	if updated.Code != http.StatusOK {
		t.Fatalf("update screen: %d", updated.Code)
	}
	afterUpdateBeforePublish := request(t, h, http.MethodGet, "/api/v1/public/exhibits/"+publishBody.Code, nil)
	if afterUpdateBeforePublish.Body.String() != beforePayload {
		t.Fatal("published snapshot changed after editing draft")
	}

	second := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+createBody.Exhibit.ID+"/publish", map[string]string{})
	var secondBody struct {
		First   bool `json:"is_first_publication"`
		Version int  `json:"version"`
	}
	decodeBody(t, second, &secondBody)
	if secondBody.First || secondBody.Version != 2 {
		t.Fatalf("unexpected repeat publish: %#v", secondBody)
	}
	publicAfter := request(t, h, http.MethodGet, "/api/v1/public/exhibits/"+publishBody.Code, nil)
	if !bytes.Contains(publicAfter.Body.Bytes(), []byte("Новый черновик")) {
		t.Fatal("new publication does not contain updated text")
	}
	preview := request(t, h, http.MethodGet, "/exhibits/"+publishBody.Code, nil)
	if preview.Code != http.StatusOK || !bytes.Contains(preview.Body.Bytes(), []byte("story-shell")) {
		t.Fatal("public link must open the mobile stories preview")
	}
	qrPNG := request(t, h, http.MethodGet, "/api/v1/exhibits/"+createBody.Exhibit.ID+"/qr.png", nil)
	if qrPNG.Code != http.StatusOK || qrPNG.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("QR PNG: %d %s", qrPNG.Code, qrPNG.Header().Get("Content-Type"))
	}
	qrImage, err := png.Decode(bytes.NewReader(qrPNG.Body.Bytes()))
	if err != nil {
		t.Fatalf("decode QR PNG: %v", err)
	}
	decodedURL, err := goqr.Decode(qrImage)
	if err != nil {
		t.Fatalf("decode QR content: %v", err)
	}
	if decodedURL != "http://example.com/exhibits/"+publishBody.Code {
		t.Fatalf("unexpected QR URL: %s", decodedURL)
	}
}

func TestDuplicateAndOrderScreens(t *testing.T) {
	db, err := sql.Open("sqlite", "file:duplicate-flow?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := initTestSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	a := &app{db: newDatabase(db, false), auth: authConfig{demo: true}}
	h := a.routes()
	created := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits", map[string]string{"title": "Экспонат"})
	var body struct {
		Exhibit exhibit `json:"exhibit"`
	}
	decodeBody(t, created, &body)
	first := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens", map[string]string{"type": "TEXT", "title": "Первый"})
	var firstBody struct {
		Screen screen `json:"screen"`
	}
	decodeBody(t, first, &firstBody)
	duplicate := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens/"+firstBody.Screen.ID+"/duplicate", map[string]string{})
	if duplicate.Code != http.StatusCreated {
		t.Fatalf("duplicate: %d %s", duplicate.Code, duplicate.Body.String())
	}
	var copyBody struct {
		Screen screen `json:"screen"`
	}
	decodeBody(t, duplicate, &copyBody)
	order := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens/order", map[string][]string{"screen_ids": []string{copyBody.Screen.ID, firstBody.Screen.ID}})
	if order.Code != http.StatusOK {
		t.Fatalf("order: %d %s", order.Code, order.Body.String())
	}
	list := request(t, h, http.MethodGet, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens", nil)
	if !bytes.Contains(list.Body.Bytes(), []byte(copyBody.Screen.ID)) {
		t.Fatal("duplicated screen is not listed")
	}
	deleted := request(t, h, http.MethodDelete, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens/"+copyBody.Screen.ID, nil)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete: %d %s", deleted.Code, deleted.Body.String())
	}
	newScreen := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens", map[string]string{"type": "TEXT", "title": "После удаления"})
	if newScreen.Code != http.StatusCreated {
		t.Fatalf("create after delete: %d %s", newScreen.Code, newScreen.Body.String())
	}
}

func TestDuplicateAndDeleteExhibit(t *testing.T) {
	db, err := sql.Open("sqlite", "file:duplicate-exhibit-flow?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := initTestSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	a := &app{db: newDatabase(db, false), auth: authConfig{demo: true}}
	h := a.routes()
	created := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits", map[string]string{"title": "Оригинал", "short_description": "Описание"})
	var original struct {
		Exhibit exhibit `json:"exhibit"`
	}
	decodeBody(t, created, &original)
	requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+original.Exhibit.ID+"/screens", map[string]string{"type": "TEXT", "title": "Экран оригинала"})
	duplicated := requestJSON(t, h, http.MethodPost, "/api/v1/exhibits/"+original.Exhibit.ID+"/duplicate", map[string]string{})
	if duplicated.Code != http.StatusCreated {
		t.Fatalf("duplicate exhibit: %d %s", duplicated.Code, duplicated.Body.String())
	}
	var copyBody struct {
		Exhibit exhibit `json:"exhibit"`
	}
	decodeBody(t, duplicated, &copyBody)
	if copyBody.Exhibit.Status != "draft" || copyBody.Exhibit.ID == original.Exhibit.ID {
		t.Fatalf("invalid exhibit copy: %#v", copyBody.Exhibit)
	}
	screens := request(t, h, http.MethodGet, "/api/v1/exhibits/"+copyBody.Exhibit.ID+"/screens", nil)
	if !bytes.Contains(screens.Body.Bytes(), []byte("Экран оригинала")) {
		t.Fatal("screens were not copied")
	}
	deleted := request(t, h, http.MethodDelete, "/api/v1/exhibits/"+copyBody.Exhibit.ID, nil)
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete exhibit: %d %s", deleted.Code, deleted.Body.String())
	}
	missing := request(t, h, http.MethodGet, "/api/v1/exhibits/"+copyBody.Exhibit.ID, nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("deleted exhibit still exists: %d", missing.Code)
	}
}

func TestPostgresPlaceholderBinding(t *testing.T) {
	got := rebind(`SELECT * FROM exhibits WHERE id = ? AND museum_id = ?`, true)
	want := `SELECT * FROM exhibits WHERE id = $1 AND museum_id = $2`
	if got != want {
		t.Fatalf("postgres binding: got %q want %q", got, want)
	}
	if got := databaseDriver("postgres://exhibit:exhibit@localhost:5432/exhibit_flow?sslmode=disable"); got != "pgx" {
		t.Fatalf("postgres driver: %s", got)
	}
}

func TestTextOnlyScreenAndMuseumBoundary(t *testing.T) {
	db, err := sql.Open("sqlite", "file:boundary-flow?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := initTestSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	a := &app{db: newDatabase(db, false), auth: authConfig{tokens: map[string]string{"museum-a-token": "museum-a", "museum-b-token": "museum-b"}}}
	h := a.routes()
	created := requestJSONWithToken(t, h, "museum-a-token", http.MethodPost, "/api/v1/exhibits", map[string]string{"title": "Экспонат"})
	var body struct {
		Exhibit exhibit `json:"exhibit"`
	}
	decodeBody(t, created, &body)
	bad := requestJSONWithToken(t, h, "museum-a-token", http.MethodPost, "/api/v1/exhibits/"+body.Exhibit.ID+"/screens", map[string]string{"type": "TEST", "title": "Вопрос"})
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("expected text only validation, got %d", bad.Code)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/exhibits/"+body.Exhibit.ID, nil)
	req.Header.Set("Authorization", "Bearer museum-b-token")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected tenant boundary, got %d", res.Code)
	}
	list := requestWithToken(t, h, "museum-a-token", http.MethodGet, "/api/v1/exhibits", nil)
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte(body.Exhibit.ID)) {
		t.Fatalf("selection list: %d %s", list.Code, list.Body.String())
	}
}

func requestJSON(t *testing.T, h http.Handler, method, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return request(t, h, method, path, bytes.NewReader(body))
}
func requestJSONWithToken(t *testing.T, h http.Handler, token, method, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return requestWithToken(t, h, token, method, path, bytes.NewReader(body))
}
func requestWithToken(t *testing.T, h http.Handler, token, method, path string, body io.Reader) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}
func request(t *testing.T, h http.Handler, method, path string, body io.Reader) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, body)
	// Test app runs in explicit demo mode; production never accepts a client museum header.
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	return res
}
func decodeBody(t *testing.T, res *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.NewDecoder(res.Body).Decode(dst); err != nil {
		t.Fatalf("decode: %v; body=%s", err, res.Body.String())
	}
}

func initTestSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, testSQLiteSchema)
	return err
}

const testSQLiteSchema = `CREATE TABLE IF NOT EXISTS exhibits (id TEXT PRIMARY KEY, museum_id TEXT NOT NULL, title TEXT NOT NULL, short_description TEXT NOT NULL DEFAULT '', cover_data BLOB, cover_mime TEXT NOT NULL DEFAULT '', public_token TEXT NOT NULL UNIQUE, public_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS screens (id TEXT PRIMARY KEY, exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE, type TEXT NOT NULL CHECK(type = 'TEXT'), title TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', image_data BLOB, image_mime TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(exhibit_id, position)); CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE, version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(exhibit_id, version)); CREATE INDEX IF NOT EXISTS screens_exhibit_position_idx ON screens(exhibit_id, position);`
