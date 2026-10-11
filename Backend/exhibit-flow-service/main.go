package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	goqr "github.com/piglig/go-qr"
)

const (
	maxImageSize = 10 << 20
	maxJSONSize  = 1 << 20
)

//go:embed web/*
var webFS embed.FS

//go:embed migrations/001_init.postgres.sql
var postgresMigration001 string

//go:embed migrations/002_public_code.postgres.sql
var postgresMigration002 string

type app struct {
	db   *database
	auth authConfig
}
type authConfig struct {
	demo   bool
	tokens map[string]string
}
type museumContextKey struct{}

type exhibit struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	ShortDescription string `json:"short_description"`
	CoverURL         string `json:"cover_url,omitempty"`
	PublicToken      string `json:"-"`
	PublicCode       string `json:"public_code"`
	Status           string `json:"status"`
	Publications     int    `json:"publications"`
}

type screen struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Text     string `json:"text"`
	ImageURL string `json:"image_url,omitempty"`
	Order    int    `json:"order"`
}

func main() {
	dsn := envOr("EXHIBIT_FLOW_DB_DSN", "postgres://exhibit:exhibit@localhost:5432/exhibit_flow?sslmode=disable")
	driver := databaseDriver(dsn)
	db, err := sql.Open(driver, dsn)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := initSchema(context.Background(), db, driver); err != nil {
		log.Fatalf("create schema: %v", err)
	}
	a := &app{db: newDatabase(db, true), auth: authFromEnv()}
	addr := envOr("EXHIBIT_FLOW_HTTP_ADDR", ":8091")
	log.Printf("exhibit flow service is available at http://localhost%s", addr)
	server := &http.Server{Addr: addr, Handler: a.routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 20}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := a.db.raw.PingContext(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "database_unavailable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	private := func(pattern string, handler http.HandlerFunc) { mux.HandleFunc(pattern, a.cabinet(handler)) }
	private("GET /api/v1/exhibits", a.listExhibits)
	private("POST /api/v1/exhibits", a.createExhibit)
	private("GET /api/v1/exhibits/{id}", a.getExhibit)
	private("PATCH /api/v1/exhibits/{id}", a.updateExhibit)
	private("POST /api/v1/exhibits/{id}/duplicate", a.duplicateExhibit)
	private("DELETE /api/v1/exhibits/{id}", a.deleteExhibit)
	private("POST /api/v1/exhibits/{id}/cover", a.uploadCover)
	private("DELETE /api/v1/exhibits/{id}/cover", a.deleteCover)
	private("GET /api/v1/exhibits/{id}/screens", a.listScreens)
	private("POST /api/v1/exhibits/{id}/screens", a.createScreen)
	private("GET /api/v1/exhibits/{id}/screens/{screenId}", a.getScreen)
	private("PATCH /api/v1/exhibits/{id}/screens/{screenId}", a.updateScreen)
	private("POST /api/v1/exhibits/{id}/screens/{screenId}/image", a.uploadScreenImage)
	private("POST /api/v1/exhibits/{id}/screens/{screenId}/duplicate", a.duplicateScreen)
	private("DELETE /api/v1/exhibits/{id}/screens/{screenId}", a.deleteScreen)
	private("POST /api/v1/exhibits/{id}/screens/order", a.orderScreens)
	private("POST /api/v1/exhibits/{id}/publish", a.publish)
	private("GET /api/v1/exhibits/{id}/qr.png", a.exhibitQRCode)
	private("GET /api/v1/files/cover/{id}", a.serveCover)
	private("GET /api/v1/files/screen/{id}", a.serveScreenImage)
	mux.HandleFunc("GET /api/v1/public/exhibits/{code}", a.publicExhibitByCode)
	mux.HandleFunc("GET /api/v1/public/{token}", a.publicExhibitByToken)
	assets, _ := webFS.ReadFile("web/index.html")
	css, _ := webFS.ReadFile("web/app.css")
	js, _ := webFS.ReadFile("web/app.js")
	publicPage, _ := webFS.ReadFile("web/public.html")
	publicCSS, _ := webFS.ReadFile("web/public.css")
	publicJS, _ := webFS.ReadFile("web/public.js")
	mux.HandleFunc("GET /", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(assets)
	})
	mux.HandleFunc("GET /app.css", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		_, _ = w.Write(css)
	})
	mux.HandleFunc("GET /app.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		_, _ = w.Write(js)
	})
	mux.HandleFunc("GET /public.css", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		_, _ = w.Write(publicCSS)
	})
	mux.HandleFunc("GET /public.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		_, _ = w.Write(publicJS)
	})
	mux.HandleFunc("GET /exhibits/{code}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(publicPage)
	})
	mux.HandleFunc("GET /public/{token}", a.redirectLegacyPublicLink)
	return cors(mux)
}

func (a *app) listExhibits(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, title, short_description, public_token, public_code, status, cover_data IS NOT NULL, (SELECT COUNT(*) FROM publications WHERE exhibit_id = exhibits.id) FROM exhibits WHERE museum_id = ? ORDER BY updated_at DESC`, museumID(r))
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	items := []exhibit{}
	for rows.Next() {
		var item exhibit
		var hasCover bool
		if err := rows.Scan(&item.ID, &item.Title, &item.ShortDescription, &item.PublicToken, &item.PublicCode, &item.Status, &hasCover, &item.Publications); err != nil {
			internalError(w, err)
			return
		}
		if hasCover {
			item.CoverURL = "/api/v1/files/cover/" + item.ID
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"exhibits": items})
}

func (a *app) createExhibit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title            string `json:"title"`
		ShortDescription string `json:"short_description"`
	}
	if !decode(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title_required")
		return
	}
	id, token, code, now := newID(), newToken(), newPublicCode(), nowText()
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO exhibits (id, museum_id, title, short_description, public_token, public_code, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`, id, museumID(r), strings.TrimSpace(req.Title), strings.TrimSpace(req.ShortDescription), token, code, now, now)
	if err != nil {
		internalError(w, err)
		return
	}
	item, err := a.findExhibit(r.Context(), id, museumID(r))
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"exhibit": item})
}

func (a *app) getExhibit(w http.ResponseWriter, r *http.Request) {
	a.respondExhibit(w, r, r.PathValue("id"))
}

func (a *app) deleteExhibit(w http.ResponseWriter, r *http.Request) {
	item, err := a.findExhibit(r.Context(), r.PathValue("id"), museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	if item.Publications > 0 {
		writeError(w, http.StatusConflict, "published_exhibit_cannot_be_deleted")
		return
	}
	result, err := a.db.ExecContext(r.Context(), `DELETE FROM exhibits WHERE id = ? AND museum_id = ?`, r.PathValue("id"), museumID(r))
	if err != nil {
		internalError(w, err)
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *app) duplicateExhibit(w http.ResponseWriter, r *http.Request) {
	original, err := a.findExhibit(r.Context(), r.PathValue("id"), museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	var cover []byte
	var coverMIME string
	if err := a.db.QueryRowContext(r.Context(), `SELECT cover_data, cover_mime FROM exhibits WHERE id = ?`, original.ID).Scan(&cover, &coverMIME); err != nil {
		internalError(w, err)
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		internalError(w, err)
		return
	}
	defer tx.Rollback()
	copyID, token, code, now := newID(), newToken(), newPublicCode(), nowText()
	_, err = tx.ExecContext(r.Context(), `INSERT INTO exhibits (id, museum_id, title, short_description, cover_data, cover_mime, public_token, public_code, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`, copyID, museumID(r), original.Title+" — копия", original.ShortDescription, cover, coverMIME, token, code, now, now)
	if err != nil {
		internalError(w, err)
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT type, title, text, image_data, image_mime, position FROM screens WHERE exhibit_id = ? ORDER BY position`, original.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var screenType, title, text, imageMIME string
		var image []byte
		var position int
		if err := rows.Scan(&screenType, &title, &text, &image, &imageMIME, &position); err != nil {
			internalError(w, err)
			return
		}
		_, err := tx.ExecContext(r.Context(), `INSERT INTO screens (id, exhibit_id, type, title, text, image_data, image_mime, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, newID(), copyID, screenType, title, text, image, imageMIME, position, now, now)
		if err != nil {
			internalError(w, err)
			return
		}
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, err)
		return
	}
	item, err := a.findExhibit(r.Context(), copyID, museumID(r))
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"exhibit": item})
}

func (a *app) updateExhibit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title            *string `json:"title"`
		ShortDescription *string `json:"short_description"`
	}
	if !decode(w, r, &req) {
		return
	}
	id := r.PathValue("id")
	item, err := a.findExhibit(r.Context(), id, museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	if req.Title != nil {
		item.Title = strings.TrimSpace(*req.Title)
		if item.Title == "" {
			writeError(w, http.StatusBadRequest, "title_required")
			return
		}
	}
	if req.ShortDescription != nil {
		item.ShortDescription = strings.TrimSpace(*req.ShortDescription)
	}
	_, err = a.db.ExecContext(r.Context(), `UPDATE exhibits SET title = ?, short_description = ?, updated_at = ? WHERE id = ?`, item.Title, item.ShortDescription, nowText(), id)
	if err != nil {
		internalError(w, err)
		return
	}
	a.respondExhibit(w, r, id)
}

func (a *app) uploadCover(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize+1024)
	if err := r.ParseMultipartForm(maxImageSize + 1024); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file_required")
		return
	}
	defer file.Close()
	if header.Size > maxImageSize {
		writeError(w, http.StatusBadRequest, "file_too_large")
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		internalError(w, err)
		return
	}
	mime := http.DetectContentType(data)
	if mime != "image/jpeg" && mime != "image/png" && mime != "image/webp" {
		writeError(w, http.StatusBadRequest, "unsupported_image_type")
		return
	}
	_, err = a.db.ExecContext(r.Context(), `UPDATE exhibits SET cover_data = ?, cover_mime = ?, updated_at = ? WHERE id = ?`, data, mime, nowText(), id)
	if err != nil {
		internalError(w, err)
		return
	}
	a.respondExhibit(w, r, id)
}

func (a *app) deleteCover(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	_, err := a.db.ExecContext(r.Context(), `UPDATE exhibits SET cover_data = NULL, cover_mime = '', updated_at = ? WHERE id = ?`, nowText(), id)
	if err != nil {
		internalError(w, err)
		return
	}
	a.respondExhibit(w, r, id)
}

func (a *app) listScreens(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, type, title, text, image_data IS NOT NULL, position FROM screens WHERE exhibit_id = ? ORDER BY position`, id)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()
	items := []screen{}
	for rows.Next() {
		var s screen
		var hasImage bool
		if err := rows.Scan(&s.ID, &s.Type, &s.Title, &s.Text, &hasImage, &s.Order); err != nil {
			internalError(w, err)
			return
		}
		if hasImage {
			s.ImageURL = "/api/v1/files/screen/" + s.ID
		}
		items = append(items, s)
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"screens": items})
}

func (a *app) createScreen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	var req struct {
		Type  string `json:"type"`
		Title string `json:"title"`
		Text  string `json:"text"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Type != "TEXT" || strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "only_text_screen_supported")
		return
	}
	var position int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM screens WHERE exhibit_id = ?`, id).Scan(&position); err != nil {
		internalError(w, err)
		return
	}
	s := screen{ID: newID(), Type: "TEXT", Title: strings.TrimSpace(req.Title), Text: strings.TrimSpace(req.Text), Order: position + 1}
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO screens (id, exhibit_id, type, title, text, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, s.ID, id, s.Type, s.Title, s.Text, s.Order, nowText(), nowText())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"screen": s})
}

func (a *app) getScreen(w http.ResponseWriter, r *http.Request) {
	a.respondScreen(w, r, r.PathValue("id"), r.PathValue("screenId"))
}

func (a *app) updateScreen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title *string `json:"title"`
		Text  *string `json:"text"`
	}
	if !decode(w, r, &req) {
		return
	}
	id, screenID := r.PathValue("id"), r.PathValue("screenId")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	s, err := a.findScreen(r.Context(), id, screenID)
	if err != nil {
		serviceError(w, err)
		return
	}
	if req.Title != nil {
		s.Title = strings.TrimSpace(*req.Title)
		if s.Title == "" {
			writeError(w, http.StatusBadRequest, "screen_title_required")
			return
		}
	}
	if req.Text != nil {
		s.Text = strings.TrimSpace(*req.Text)
	}
	_, err = a.db.ExecContext(r.Context(), `UPDATE screens SET title = ?, text = ?, updated_at = ? WHERE id = ?`, s.Title, s.Text, nowText(), screenID)
	if err != nil {
		internalError(w, err)
		return
	}
	a.respondScreen(w, r, id, screenID)
}

func (a *app) uploadScreenImage(w http.ResponseWriter, r *http.Request) {
	id, screenID := r.PathValue("id"), r.PathValue("screenId")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	if _, err := a.findScreen(r.Context(), id, screenID); err != nil {
		serviceError(w, err)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize+1024)
	if err := r.ParseMultipartForm(maxImageSize + 1024); err != nil {
		writeError(w, http.StatusBadRequest, "file_too_large")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file_required")
		return
	}
	defer file.Close()
	if header.Size > maxImageSize {
		writeError(w, http.StatusBadRequest, "file_too_large")
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		internalError(w, err)
		return
	}
	mime := http.DetectContentType(data)
	if mime != "image/jpeg" && mime != "image/png" && mime != "image/webp" {
		writeError(w, http.StatusBadRequest, "unsupported_image_type")
		return
	}
	_, err = a.db.ExecContext(r.Context(), `UPDATE screens SET image_data = ?, image_mime = ?, updated_at = ? WHERE id = ?`, data, mime, nowText(), screenID)
	if err != nil {
		internalError(w, err)
		return
	}
	a.respondScreen(w, r, id, screenID)
}

func (a *app) duplicateScreen(w http.ResponseWriter, r *http.Request) {
	exhibitID, screenID := r.PathValue("id"), r.PathValue("screenId")
	if _, err := a.findExhibit(r.Context(), exhibitID, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	original, err := a.findScreen(r.Context(), exhibitID, screenID)
	if err != nil {
		serviceError(w, err)
		return
	}
	var image []byte
	var imageMIME string
	if err := a.db.QueryRowContext(r.Context(), `SELECT image_data, image_mime FROM screens WHERE id = ?`, screenID).Scan(&image, &imageMIME); err != nil {
		internalError(w, err)
		return
	}
	var position int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM screens WHERE exhibit_id = ?`, exhibitID).Scan(&position); err != nil {
		internalError(w, err)
		return
	}
	copy := screen{ID: newID(), Type: original.Type, Title: original.Title + " — копия", Text: original.Text, Order: position + 1}
	_, err = a.db.ExecContext(r.Context(), `INSERT INTO screens (id, exhibit_id, type, title, text, image_data, image_mime, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, copy.ID, exhibitID, copy.Type, copy.Title, copy.Text, image, imageMIME, copy.Order, nowText(), nowText())
	if err != nil {
		internalError(w, err)
		return
	}
	if len(image) > 0 {
		copy.ImageURL = "/api/v1/files/screen/" + copy.ID
	}
	writeJSON(w, http.StatusCreated, map[string]any{"screen": copy})
}

func (a *app) deleteScreen(w http.ResponseWriter, r *http.Request) {
	id, screenID := r.PathValue("id"), r.PathValue("screenId")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	var position int
	if err := a.db.QueryRowContext(r.Context(), `SELECT position FROM screens WHERE id = ? AND exhibit_id = ?`, screenID, id).Scan(&position); err != nil {
		serviceError(w, err)
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		internalError(w, err)
		return
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(r.Context(), `DELETE FROM screens WHERE id = ? AND exhibit_id = ?`, screenID, id)
	if err != nil {
		internalError(w, err)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE screens SET position = position - 1, updated_at = ? WHERE exhibit_id = ? AND position > ?`, nowText(), id, position); err != nil {
		internalError(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *app) orderScreens(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"screen_ids"`
	}
	if !decode(w, r, &req) {
		return
	}
	id := r.PathValue("id")
	if _, err := a.findExhibit(r.Context(), id, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	if len(req.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "screen_ids_required")
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		internalError(w, err)
		return
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(r.Context(), `SELECT id FROM screens WHERE exhibit_id = ? ORDER BY position`, id)
	if err != nil {
		internalError(w, err)
		return
	}
	actual := map[string]bool{}
	for rows.Next() {
		var screenID string
		if err := rows.Scan(&screenID); err != nil {
			rows.Close()
			internalError(w, err)
			return
		}
		actual[screenID] = true
	}
	if err := rows.Close(); err != nil {
		internalError(w, err)
		return
	}
	if len(actual) != len(req.IDs) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_screen_order")
		return
	}
	seen := map[string]bool{}
	for _, screenID := range req.IDs {
		if seen[screenID] || !actual[screenID] {
			writeError(w, http.StatusUnprocessableEntity, "invalid_screen_order")
			return
		}
		seen[screenID] = true
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE screens SET position = position + 100000 WHERE exhibit_id = ?`, id); err != nil {
		internalError(w, err)
		return
	}
	for pos, screenID := range req.IDs {
		res, err := tx.ExecContext(r.Context(), `UPDATE screens SET position = ?, updated_at = ? WHERE id = ? AND exhibit_id = ?`, pos+1, nowText(), screenID, id)
		if err != nil {
			internalError(w, err)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeError(w, http.StatusBadRequest, "invalid_screen_order")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "screens_reordered"})
}

func (a *app) publish(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	item, err := a.findExhibit(r.Context(), id, museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	screens, err := a.snapshotScreens(r.Context(), id)
	if err != nil {
		internalError(w, err)
		return
	}
	item.Publications++
	snapshot := map[string]any{"title": item.Title, "short_description": item.ShortDescription, "cover": a.coverSnapshot(r.Context(), id), "screens": screens}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		internalError(w, err)
		return
	}
	now := nowText()
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		internalError(w, err)
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(r.Context(), `INSERT INTO publications (id, exhibit_id, version, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)`, newID(), id, item.Publications, string(payload), now)
	if err != nil {
		internalError(w, err)
		return
	}
	_, err = tx.ExecContext(r.Context(), `UPDATE exhibits SET status = 'published', updated_at = ? WHERE id = ?`, now, id)
	if err != nil {
		internalError(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"public_url": "/exhibits/" + item.PublicCode, "code": item.PublicCode, "is_first_publication": item.Publications == 1, "version": item.Publications})
}

func (a *app) exhibitQRCode(w http.ResponseWriter, r *http.Request) {
	item, err := a.findExhibit(r.Context(), r.PathValue("id"), museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	if item.Publications == 0 {
		writeError(w, http.StatusConflict, "exhibit_not_published")
		return
	}
	code, err := goqr.EncodeText(a.publicURL(r, item.PublicCode), goqr.Medium)
	if err != nil {
		internalError(w, err)
		return
	}
	png, err := code.ToPNGBytes(goqr.NewQrCodeImgConfig(8, 4))
	if err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(png)))
	_, _ = w.Write(png)
}

func (a *app) publicURL(r *http.Request, code string) string {
	if configured := strings.TrimRight(os.Getenv("EXHIBIT_FLOW_PUBLIC_BASE_URL"), "/"); configured != "" {
		return configured + "/exhibits/" + code
	}
	scheme := "http"
	if r.TLS != nil || strings.EqualFold(strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]), "https") {
		scheme = "https"
	}
	return scheme + "://" + r.Host + "/exhibits/" + code
}

func (a *app) publicExhibitByCode(w http.ResponseWriter, r *http.Request) {
	var payload string
	err := a.db.QueryRowContext(r.Context(), `SELECT p.snapshot_json FROM publications p JOIN exhibits e ON e.id = p.exhibit_id WHERE e.public_code = ? ORDER BY p.version DESC LIMIT 1`, r.PathValue("code")).Scan(&payload)
	if err != nil {
		serviceError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(payload))
}

func (a *app) publicExhibitByToken(w http.ResponseWriter, r *http.Request) {
	var payload string
	err := a.db.QueryRowContext(r.Context(), `SELECT p.snapshot_json FROM publications p JOIN exhibits e ON e.id = p.exhibit_id WHERE e.public_token = ? ORDER BY p.version DESC LIMIT 1`, r.PathValue("token")).Scan(&payload)
	if err != nil {
		serviceError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(payload))
}

func (a *app) redirectLegacyPublicLink(w http.ResponseWriter, r *http.Request) {
	var code string
	err := a.db.QueryRowContext(r.Context(), `SELECT public_code FROM exhibits WHERE public_token = ?`, r.PathValue("token")).Scan(&code)
	if err != nil {
		serviceError(w, err)
		return
	}
	http.Redirect(w, r, "/exhibits/"+code, http.StatusMovedPermanently)
}

func (a *app) serveCover(w http.ResponseWriter, r *http.Request) {
	a.serveImage(w, r, `SELECT cover_data, cover_mime FROM exhibits WHERE id = ?`, r.PathValue("id"))
}
func (a *app) serveScreenImage(w http.ResponseWriter, r *http.Request) {
	a.serveImage(w, r, `SELECT image_data, image_mime FROM screens WHERE id = ?`, r.PathValue("id"))
}
func (a *app) serveImage(w http.ResponseWriter, r *http.Request, q, id string) {
	var data []byte
	var mime string
	err := a.db.QueryRowContext(r.Context(), q, id).Scan(&data, &mime)
	if err != nil || len(data) == 0 {
		writeError(w, http.StatusNotFound, "file_not_found")
		return
	}
	w.Header().Set("Content-Type", mime)
	_, _ = w.Write(data)
}

func (a *app) respondExhibit(w http.ResponseWriter, r *http.Request, id string) {
	item, err := a.findExhibit(r.Context(), id, museumID(r))
	if err != nil {
		serviceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"exhibit": item})
}
func (a *app) respondScreen(w http.ResponseWriter, r *http.Request, exhibitID, screenID string) {
	if _, err := a.findExhibit(r.Context(), exhibitID, museumID(r)); err != nil {
		serviceError(w, err)
		return
	}
	s, err := a.findScreen(r.Context(), exhibitID, screenID)
	if err != nil {
		serviceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"screen": s})
}

func (a *app) findExhibit(ctx context.Context, id, museum string) (exhibit, error) {
	var x exhibit
	var hasCover bool
	err := a.db.QueryRowContext(ctx, `SELECT id, title, short_description, public_token, public_code, status, cover_data IS NOT NULL, (SELECT COUNT(*) FROM publications WHERE exhibit_id = exhibits.id) FROM exhibits WHERE id = ? AND museum_id = ?`, id, museum).Scan(&x.ID, &x.Title, &x.ShortDescription, &x.PublicToken, &x.PublicCode, &x.Status, &hasCover, &x.Publications)
	if err != nil {
		return exhibit{}, err
	}
	if hasCover {
		x.CoverURL = "/api/v1/files/cover/" + x.ID
	}
	return x, nil
}
func (a *app) findScreen(ctx context.Context, exhibitID, screenID string) (screen, error) {
	var s screen
	var hasImage bool
	err := a.db.QueryRowContext(ctx, `SELECT id, type, title, text, image_data IS NOT NULL, position FROM screens WHERE id = ? AND exhibit_id = ?`, screenID, exhibitID).Scan(&s.ID, &s.Type, &s.Title, &s.Text, &hasImage, &s.Order)
	if err != nil {
		return screen{}, err
	}
	if hasImage {
		s.ImageURL = "/api/v1/files/screen/" + s.ID
	}
	return s, nil
}
func (a *app) readScreens(ctx context.Context, exhibitID string) ([]screen, error) {
	rows, err := a.db.QueryContext(ctx, `SELECT id, type, title, text, image_data IS NOT NULL, position FROM screens WHERE exhibit_id = ? ORDER BY position`, exhibitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []screen{}
	for rows.Next() {
		var s screen
		var hasImage bool
		if err := rows.Scan(&s.ID, &s.Type, &s.Title, &s.Text, &hasImage, &s.Order); err != nil {
			return nil, err
		}
		if hasImage {
			s.ImageURL = "/api/v1/files/screen/" + s.ID
		}
		items = append(items, s)
	}
	return items, rows.Err()
}
func (a *app) coverSnapshot(ctx context.Context, exhibitID string) map[string]string {
	var data []byte
	var mime string
	if a.db.QueryRowContext(ctx, `SELECT cover_data, cover_mime FROM exhibits WHERE id = ?`, exhibitID).Scan(&data, &mime) != nil || len(data) == 0 {
		return nil
	}
	return map[string]string{"mime": mime, "base64": base64.StdEncoding.EncodeToString(data)}
}

func (a *app) snapshotScreens(ctx context.Context, exhibitID string) ([]map[string]any, error) {
	rows, err := a.db.QueryContext(ctx, `SELECT id, type, title, text, image_data, image_mime, position FROM screens WHERE exhibit_id = ? ORDER BY position`, exhibitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var id, screenType, title, text, mime string
		var image []byte
		var position int
		if err := rows.Scan(&id, &screenType, &title, &text, &image, &mime, &position); err != nil {
			return nil, err
		}
		item := map[string]any{"id": id, "type": screenType, "title": title, "text": text, "order": position}
		if len(image) > 0 {
			item["image"] = map[string]string{"mime": mime, "base64": base64.StdEncoding.EncodeToString(image)}
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func initSchema(ctx context.Context, db *sql.DB, driver string) error {
	if driver != "pgx" {
		return errors.New("unsupported database driver")
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(904209001)`); err != nil {
		return err
	}
	for _, migration := range []struct {
		version string
		sql     string
	}{{"001", postgresMigration001}, {"002", postgresMigration002}} {
		var applied bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, migration.version).Scan(&applied); err != nil {
			return err
		}
		if !applied {
			if _, err := tx.ExecContext(ctx, migration.sql); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version) VALUES ($1)`, migration.version); err != nil {
				return err
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	return backfillPublicCodes(ctx, db)
}

func backfillPublicCodes(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `SELECT id FROM exhibits WHERE public_code IS NULL OR public_code = ''`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		for attempts := 0; attempts < 10; attempts++ {
			_, err := db.ExecContext(ctx, `UPDATE exhibits SET public_code = $1 WHERE id = $2 AND (public_code IS NULL OR public_code = '')`, newPublicCode(), id)
			if err == nil {
				break
			}
			if attempts == 9 {
				return err
			}
		}
	}
	return rows.Err()
}

func databaseDriver(dsn string) string {
	value := strings.ToLower(dsn)
	if !strings.HasPrefix(value, "postgres://") && !strings.HasPrefix(value, "postgresql://") && !strings.Contains(value, "host=") {
		log.Fatal("EXHIBIT_FLOW_DB_DSN must be a PostgreSQL DSN")
	}
	return "pgx"
}

func (a *app) cabinet(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		museum, ok := a.authenticate(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), museumContextKey{}, museum)))
	}
}
func (a *app) authenticate(r *http.Request) (string, bool) {
	if a.auth.demo {
		return "demo-museum", true
	}
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	museum, ok := a.auth.tokens[token]
	return museum, ok
}
func authFromEnv() authConfig {
	if os.Getenv("EXHIBIT_FLOW_DEMO_MODE") == "true" {
		return authConfig{demo: true}
	}
	tokens := map[string]string{}
	for _, pair := range strings.Split(os.Getenv("EXHIBIT_FLOW_MUSEUM_TOKENS"), ",") {
		parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
		if len(parts) == 2 && parts[0] != "" && parts[1] != "" {
			tokens[parts[1]] = parts[0]
		}
	}
	return authConfig{tokens: tokens}
}
func museumID(r *http.Request) string {
	museum, _ := r.Context().Value(museumContextKey{}).(string)
	return museum
}
func newID() string { return uuid.NewString() }
func newToken() string {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}
func newPublicCode() string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, 5)
	for i := range code {
		for {
			var value [1]byte
			if _, err := rand.Read(value[:]); err != nil {
				panic(err)
			}
			if value[0] < 252 { // 252 is divisible by the 36-character alphabet.
				code[i] = alphabet[int(value[0])%len(alphabet)]
				break
			}
		}
	}
	return string(code)
}
func nowText() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	defer r.Body.Close()
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONSize)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return false
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
func serviceError(w http.ResponseWriter, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	internalError(w, err)
}
func internalError(w http.ResponseWriter, err error) {
	log.Printf("request failed: %v", err)
	writeError(w, http.StatusInternalServerError, "internal_error")
}
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'")
		origin := r.Header.Get("Origin")
		if origin != "" && origin == envOr("EXHIBIT_FLOW_CORS_ORIGIN", "") {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
