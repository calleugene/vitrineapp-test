package artifacts

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testMuseumToken(t *testing.T, secret, museumID string) string {
	t.Helper()
	payload, err := json.Marshal(map[string]any{"user_id": "user", "session_id": "session", "museum_id": museumID, "role": "methodist", "exp": time.Now().Add(time.Hour).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(encoded))
	return encoded + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func testMuseumRequest(t *testing.T, handler http.Handler, method, path, token, museumHeader string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var data []byte
	if body != nil {
		var err error
		data, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(data))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if museumHeader != "" {
		req.Header.Set("X-Museum-ID", museumHeader)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestMuseumContextProtectsProfilesAndPublicSnapshot(t *testing.T) {
	env := newTestEnv(t)
	secret := strings.Repeat("s", 32)
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{TokenSecret: secret}))
	missing := testMuseumToken(t, secret, "")
	a := testMuseumToken(t, secret, "mus_new_a")
	b := testMuseumToken(t, secret, "mus_new_b")

	for _, method := range []string{http.MethodGet, http.MethodPost} {
		resp := testMuseumRequest(t, handler, method, "/museums/profile", missing, "mus_new_a", map[string]string{"name": "A"})
		if resp.Code != http.StatusUnauthorized {
			t.Fatalf("missing context %s: %d %s", method, resp.Code, resp.Body.String())
		}
	}
	noContextArtifact := testMuseumRequest(t, handler, http.MethodPost, "/artifacts", missing, "mus_new_a", map[string]string{"title": "Blocked"})
	if noContextArtifact.Code != http.StatusUnauthorized {
		t.Fatalf("artifact without context: %d %s", noContextArtifact.Code, noContextArtifact.Body.String())
	}
	for _, tc := range []struct{ token, name string }{{a, "Museum A"}, {b, "Museum B"}} {
		resp := testMuseumRequest(t, handler, http.MethodPost, "/museums/profile", tc.token, "mus_001", map[string]string{"name": tc.name})
		if resp.Code != http.StatusCreated {
			t.Fatalf("create %s: %d %s", tc.name, resp.Code, resp.Body.String())
		}
		resp = testMuseumRequest(t, handler, http.MethodGet, "/museums/profile", tc.token, "mus_001", nil)
		if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), tc.name) {
			t.Fatalf("read %s: %d %s", tc.name, resp.Code, resp.Body.String())
		}
	}
	foreignUpdate := testMuseumRequest(t, handler, http.MethodPatch, "/museums/profile", b, "mus_new_a", map[string]string{"name": "Hijacked"})
	if foreignUpdate.Code != http.StatusOK {
		t.Fatalf("update own profile: %d %s", foreignUpdate.Code, foreignUpdate.Body.String())
	}
	afterForeignUpdate := testMuseumRequest(t, handler, http.MethodGet, "/museums/profile", a, "", nil)
	if afterForeignUpdate.Code != http.StatusOK || !strings.Contains(afterForeignUpdate.Body.String(), "Museum A") || strings.Contains(afterForeignUpdate.Body.String(), "Hijacked") {
		t.Fatalf("foreign update touched A: %d %s", afterForeignUpdate.Code, afterForeignUpdate.Body.String())
	}
	artifactResp := testMuseumRequest(t, handler, http.MethodPost, "/artifacts", a, "mus_new_b", map[string]string{"title": "Private draft"})
	if artifactResp.Code != http.StatusCreated {
		t.Fatalf("create artifact: %d %s", artifactResp.Code, artifactResp.Body.String())
	}
	var created artifactResponse
	decodeResponse(t, artifactResp, &created)
	if created.Artifact.MuseumID == nil || *created.Artifact.MuseumID != "mus_new_a" {
		t.Fatalf("artifact museum: %+v", created.Artifact.MuseumID)
	}
	foreign := testMuseumRequest(t, handler, http.MethodGet, "/artifacts/"+created.Artifact.ID, b, "mus_new_a", nil)
	if foreign.Code != http.StatusNotFound {
		t.Fatalf("foreign artifact read: %d %s", foreign.Code, foreign.Body.String())
	}
	screen := testMuseumRequest(t, handler, http.MethodPost, "/artifacts/"+created.Artifact.ID+"/screens", a, "", map[string]string{"type": "text", "title": "Story", "payload": `{"body":"Public text"}`})
	if screen.Code != http.StatusCreated {
		t.Fatalf("screen: %d %s", screen.Code, screen.Body.String())
	}
	published := testMuseumRequest(t, handler, http.MethodPost, "/artifacts/"+created.Artifact.ID+"/publish", a, "", map[string]int{"expected_draft_revision": 2})
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	var publication publishResponse
	decodeResponse(t, published, &publication)
	public := testMuseumRequest(t, handler, http.MethodGet, "/api/v1/public/artifacts/"+publication.PublicCode, "", "", nil)
	if public.Code != http.StatusOK || !strings.Contains(public.Body.String(), "Public text") || !strings.Contains(public.Body.String(), "mus_new_a") {
		t.Fatalf("public snapshot: %d %s", public.Code, public.Body.String())
	}
}
