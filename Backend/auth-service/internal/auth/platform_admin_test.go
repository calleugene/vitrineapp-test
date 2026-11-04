package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPlatformAdminActivationAndContextIsolation(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	s.config.PlatformAdminEmail = "admin@example.test"
	s.config.PlatformAdminOrigin = "https://example.test"
	ordinary := createTestUser(t, repo, "ordinary", "methodist")
	s.config.PlatformAdminEmail = ordinary.Email
	if err := s.BootstrapPlatformAdmin(ctx); err == nil {
		t.Fatal("bootstrap promoted an existing ordinary account")
	}
	s.config.PlatformAdminEmail = "admin@example.test"
	if err := s.BootstrapPlatformAdmin(ctx); err != nil {
		t.Fatal(err)
	}
	var delivered string
	s.config.SendPasswordReset = func(context.Context, string, string) error {
		t.Fatal("used ordinary recovery URL")
		return nil
	}
	s.config.SendPlatformAdminPasswordReset = func(_ context.Context, to, token string) error {
		if to != s.config.PlatformAdminEmail {
			t.Fatalf("unexpected recipient %q", to)
		}
		delivered = token
		return nil
	}
	activate := func(password string) {
		t.Helper()
		if _, err := s.ForgotPassword(ctx, s.config.PlatformAdminEmail); err != nil {
			t.Fatal(err)
		}
		if err := s.deliverPasswordReset(ctx); err != nil {
			t.Fatal(err)
		}
		if err := s.ResetPassword(ctx, delivered, password); err != nil {
			t.Fatal(err)
		}
	}
	password := "admin example password 1"
	activate(password)
	if _, err := s.Login(ctx, loginRequest{Email: s.config.PlatformAdminEmail, Password: password}); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("ordinary login accepted admin: %v", err)
	}
	if err := s.BootstrapPlatformAdmin(ctx); err != nil {
		t.Fatal(err)
	}
	museums := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Service-Secret") != s.config.TokenSecret {
			t.Error("missing service authentication")
		}
		switch r.URL.Path {
		case "/internal/admin/museums":
			w.Write([]byte(`{"museums":[{"museum_id":"hidden","name":"Hidden museum"}]}`))
		case "/internal/museums/hidden", "/internal/admin/museums/hidden":
			w.Write([]byte(`{"museum":{"museum_id":"hidden","name":"Hidden museum"},"artifacts":[]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer museums.Close()
	s.config.MuseumServiceURL = museums.URL
	handler := NewHandler(s)
	request := func(method, path, body, origin string, cookie *http.Cookie, want int) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, "/api/v1/auth/admin"+path, strings.NewReader(body))
		req.Header.Set("Origin", origin)
		if cookie != nil {
			req.AddCookie(cookie)
		}
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != want {
			t.Fatalf("%s %s: got %d, want %d (%s)", method, path, res.Code, want, res.Body)
		}
		return res
	}
	login := `{"email":"admin@example.test","password":"admin example password 1"}`
	request("POST", "/login", login, "https://elsewhere.test", nil, 403)
	cookie := request("POST", "/login", login, s.config.PlatformAdminOrigin, nil, 204).Result().Cookies()[0]
	for i := 0; i < 4; i++ {
		request("POST", "/login", login, s.config.PlatformAdminOrigin, nil, 204)
	}
	if !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("unsafe admin session cookie")
	}
	request("GET", "/museums", "", "", nil, 401)
	if res := request("GET", "/museums", "", "", cookie, 200); !strings.Contains(res.Body.String(), "Hidden museum") {
		t.Fatal("missing unpublished museum")
	}
	request("GET", "/workspace?museum_id=hidden", "", "", cookie, 403)
	selected := request("POST", "/context", `{"museum_id":"hidden","reason":"Support ticket 42"}`, s.config.PlatformAdminOrigin, cookie, 204).Result().Cookies()[0]
	request("GET", "/museums", "", "", cookie, 401)
	request("GET", "/workspace?museum_id=another", "", "", selected, 403)
	request("GET", "/workspace?museum_id=hidden", "", "", selected, 200)
	user, err := repo.FindUserByEmail(ctx, s.config.PlatformAdminEmail)
	if err != nil || user.MuseumID != nil || user.EmailVerifiedAt == nil {
		t.Fatalf("bad provisioned user: %+v, %v", user, err)
	}
	entries, err := repo.GetUserActivity(ctx, user.ID)
	if err != nil || len(entries) != 1 || entries[0].Action != "platform_museum_context" {
		t.Fatalf("missing context audit: %+v, %v", entries, err)
	}
	activate("admin example password 2")
	request("GET", "/workspace?museum_id=hidden", "", "", selected, 401)
	request("POST", "/login", login, s.config.PlatformAdminOrigin, nil, 401)
}

func TestPlatformAdminLoginRateLimit(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	now := s.config.now()
	check := func(source string, at time.Time, want bool) {
		t.Helper()
		if allowed, err := repo.AllowPlatformAdminLogin(ctx, source, at); err != nil || allowed != want {
			t.Fatalf("source %s: allowed=%v, want %v, error=%v", source, allowed, want, err)
		}
	}
	for i := 0; i < 10; i++ {
		check("one", now, true)
	}
	check("one", now, false)
	check("two", now, true)
	check("one", now.Add(15*time.Minute), true)
	if err := repo.ClearPlatformAdminLogin(ctx, "two"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 10; i++ {
		check("two", now, true)
	}
}

func TestMovePlatformAdminEmail(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	oldEmail, newEmail := "old-admin@example.test", "new-admin@example.test"
	s.config.PlatformAdminEmail = oldEmail
	if err := s.BootstrapPlatformAdmin(ctx); err != nil {
		t.Fatal(err)
	}
	user, err := repo.FindUserByEmail(ctx, oldEmail)
	if err != nil {
		t.Fatal(err)
	}
	now := s.config.now()
	if err := repo.CreatePasswordResetToken(ctx, "first", user.ID, tokenHashString("first"), now.Add(time.Hour), now); err != nil {
		t.Fatal(err)
	}
	if err := s.ResetPassword(ctx, "first", "first admin password"); err != nil {
		t.Fatal(err)
	}
	pair, err := s.login(ctx, loginRequest{Email: oldEmail, Password: "first admin password"}, platformAdminRole)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreatePasswordResetToken(ctx, "stale", user.ID, tokenHashString("stale"), now.Add(time.Hour), now); err != nil {
		t.Fatal(err)
	}
	if err := repo.QueuePasswordReset(ctx, "old-mail", oldEmail, now); err != nil {
		t.Fatal(err)
	}
	s.config.PlatformAdminPreviousEmail = oldEmail
	s.config.PlatformAdminEmail = newEmail
	for i := 0; i < 2; i++ {
		if err := s.BootstrapPlatformAdmin(ctx); err != nil {
			t.Fatal(err)
		}
	}
	moved, err := repo.FindUserByEmail(ctx, newEmail)
	if err != nil || moved.ID != user.ID || moved.Status != "ADMIN_PENDING" || moved.EmailVerifiedAt != nil {
		t.Fatalf("account not migrated correctly: %+v, %v", moved, err)
	}
	if _, _, err := s.Authenticate(ctx, pair.AccessToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old session still valid: %v", err)
	}
	if err := s.ResetPassword(ctx, "stale", "another admin password"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("old recovery link still valid: %v", err)
	}
	if _, err := repo.LeasePasswordReset(ctx, now); err == nil {
		t.Fatal("stale reset email still queued")
	}
}
