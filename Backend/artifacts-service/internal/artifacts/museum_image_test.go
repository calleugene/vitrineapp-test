package artifacts

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func TestMuseumImageUploadIsDraftUntilProfileSave(t *testing.T) {
	env := newTestEnv(t)
	repo := NewSQLiteRepository(env.db)
	_, err := repo.CreateMuseumProfile(context.Background(), MuseumProfile{MuseumID: "mus_001", Name: "Museum"})
	if err != nil {
		t.Fatal(err)
	}
	store, err := NewLocalAssetStore(t.TempDir(), "/assets")
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(NewService(repo, Config{AssetStore: store}))
	var picture bytes.Buffer
	if err := png.Encode(&picture, image.NewRGBA(image.Rect(0, 0, 16, 9))); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		data   []byte
		status int
	}{{picture.Bytes(), 200}, {[]byte("not an image"), 400}} {
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		part, err := form.CreateFormFile("file", "museum.png")
		if err != nil {
			t.Fatal(err)
		}
		part.Write(tc.data)
		form.Close()
		req := httptest.NewRequest("POST", "/museums/profile/image", &body)
		req.Header.Set("Content-Type", form.FormDataContentType())
		req.Header.Set("X-Museum-ID", "mus_001")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != tc.status {
			t.Fatalf("upload: %d %s", rec.Code, rec.Body)
		}
		if tc.status == 200 {
			var payload struct {
				ImageURL string `json:"image_url"`
			}
			decodeResponse(t, rec, &payload)
			if payload.ImageURL == "" {
				t.Fatal("missing stable image URL")
			}
			profile, err := repo.GetMuseumProfile(context.Background(), "mus_001")
			if err != nil {
				t.Fatal(err)
			}
			if profile.LogoURL != "" {
				t.Fatal("draft published before save")
			}
			saved := performJSON(t, handler, "PATCH", "/museums/profile", map[string]any{"name": "Museum", "logo_url": payload.ImageURL})
			if saved.Code != 200 {
				t.Fatalf("save: %d %s", saved.Code, saved.Body)
			}
			public := httptest.NewRecorder()
			handler.ServeHTTP(public, httptest.NewRequest("GET", "/api/v1/public/museums", nil))
			if public.Code != 200 || !bytes.Contains(public.Body.Bytes(), []byte(payload.ImageURL)) {
				t.Fatalf("public photo missing: %d %s", public.Code, public.Body)
			}
		}
	}
}
