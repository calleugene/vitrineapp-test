package artifacts

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDormantAccountCannotChangeMuseumWithExistingToken(t *testing.T) {
	env := newTestEnv(t)
	secret := strings.Repeat("s", 32)
	active := true
	auth := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/authorize-museum" {
			t.Errorf("wrong authorization endpoint: %s", r.URL.Path)
		}
		if active {
			w.WriteHeader(200)
		} else {
			w.WriteHeader(403)
		}
	}))
	defer auth.Close()
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{TokenSecret: secret, AuthServiceURL: auth.URL}))
	token := testMuseumToken(t, secret, "museum-lifecycle")
	created := testMuseumRequest(t, handler, "POST", "/museums/profile", token, "", map[string]string{"name": "Organization museum"})
	if created.Code != 201 {
		t.Fatal(created.Body)
	}
	active = false
	denied := testMuseumRequest(t, handler, "PATCH", "/museums/profile", token, "", map[string]string{"name": "Forbidden change"})
	if denied.Code != 403 {
		t.Fatalf("old token accepted: %d %s", denied.Code, denied.Body)
	}
	active = true
	preserved := testMuseumRequest(t, handler, "GET", "/museums/profile", token, "", nil)
	if preserved.Code != 200 || !strings.Contains(preserved.Body.String(), "Organization museum") {
		t.Fatal("organization data changed during deactivation")
	}
}
