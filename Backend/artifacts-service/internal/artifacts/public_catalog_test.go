package artifacts

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPublicCatalogListsAllCreatedMuseums(t *testing.T) {
	env := newTestEnv(t)
	repo := NewSQLiteRepository(env.db)
	for _, id := range []string{"catalog-one", "catalog-two"} {
		_, err := repo.CreateMuseumProfile(context.Background(), MuseumProfile{MuseumID: id, Name: id, CreatedAt: time.Now(), UpdatedAt: time.Now()})
		if err != nil {
			t.Fatal(err)
		}
	}
	response := httptest.NewRecorder()
	env.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/museums", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Museums []MuseumProfile `json:"museums"`
	}
	decodeResponse(t, response, &payload)
	found := map[string]bool{}
	for _, museum := range payload.Museums {
		found[museum.MuseumID] = true
	}
	if !found["catalog-one"] || !found["catalog-two"] {
		t.Fatalf("missing museums: %s", response.Body.String())
	}
}

func TestPublicCatalogHidesUnlistedMuseumWithoutRemovingProfile(t *testing.T) {
	env := newTestEnv(t)
	repo := NewSQLiteRepository(env.db)
	_, err := repo.CreateMuseumProfile(context.Background(), MuseumProfile{MuseumID: "private-test", Name: "Private test", CreatedAt: time.Now(), UpdatedAt: time.Now()})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := env.db.Exec(`UPDATE museum_profiles SET is_public = FALSE WHERE museum_id = ?`, "private-test"); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	env.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/museums", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Museums []MuseumProfile `json:"museums"`
	}
	decodeResponse(t, response, &payload)
	for _, museum := range payload.Museums {
		if museum.MuseumID == "private-test" {
			t.Fatal("unlisted museum is public")
		}
	}
	if _, err := repo.GetMuseumProfile(context.Background(), "private-test"); err != nil {
		t.Fatal("private profile was removed:", err)
	}
}
