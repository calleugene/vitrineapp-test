package auth

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestService(t *testing.T) (*Service, *SQLiteRepository) {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := InitSQLite(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	repo := NewSQLiteRepository(db)
	return NewService(repo, Config{AccessTokenTTL: time.Hour, RefreshTokenTTL: time.Hour, ResetTokenTTL: time.Hour, VerifyTokenTTL: time.Hour, TokenSecret: strings.Repeat("s", 32)}), repo
}

func createTestUser(t *testing.T, repo Repository, id, role string) User {
	t.Helper()
	now := time.Now().UTC()
	museumID := "museum-1"
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	user := User{ID: id, Email: id + "@example.test", FullName: id, Role: role, MuseumID: &museumID, Status: "active", NotificationsEnabled: true, RegisteredAt: now, CreatedAt: now, UpdatedAt: now, Level: "новичок", Locale: "ru"}
	if err := repo.CreateUser(context.Background(), user, hash); err != nil {
		t.Fatal(err)
	}
	return user
}

func TestUsersRoutesRejectUnauthenticatedRequests(t *testing.T) {
	service, repo := newTestService(t)
	createTestUser(t, repo, "victim", "methodist")
	req := httptest.NewRequest(http.MethodPost, "/users/victim/reset-password", strings.NewReader(`{"new_password":"new correct password"}`))
	rec := httptest.NewRecorder()
	NewHandler(service).ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestUserCannotEditAnotherUser(t *testing.T) {
	service, repo := newTestService(t)
	actor := createTestUser(t, repo, "actor", "methodist")
	createTestUser(t, repo, "victim", "methodist")
	pair, err := service.issueSession(context.Background(), actor)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPatch, "/users/victim", strings.NewReader(`{"full_name":"attacker"}`))
	req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
	rec := httptest.NewRecorder()
	NewHandler(service).ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestRefreshTokenCanBeUsedOnlyOnce(t *testing.T) {
	service, repo := newTestService(t)
	user := createTestUser(t, repo, "user", "methodist")
	pair, err := service.issueSession(context.Background(), user)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Refresh(context.Background(), pair.RefreshToken); err != nil {
		t.Fatalf("first refresh: %v", err)
	}
	if _, err := service.Refresh(context.Background(), pair.RefreshToken); err != ErrUnauthorized {
		t.Fatalf("second refresh = %v, want ErrUnauthorized", err)
	}
}

func TestGamificationFieldsPersist(t *testing.T) {
	service, repo := newTestService(t)
	createTestUser(t, repo, "user", "methodist")
	if err := service.UpdateUserLevel(context.Background(), "user", "исследователь"); err != nil {
		t.Fatal(err)
	}
	if err := service.SetGuestFlag(context.Background(), "user"); err != nil {
		t.Fatal(err)
	}
	if err := service.UpdateLocale(context.Background(), "user", "en"); err != nil {
		t.Fatal(err)
	}
	user, err := repo.FindUserByID(context.Background(), "user")
	if err != nil {
		t.Fatal(err)
	}
	if user.Level != "исследователь" || !user.IsGuest || user.Locale != "en" {
		t.Fatalf("gamification not persisted: %+v", user)
	}
}

func TestPasswordHashUsesArgon2id(t *testing.T) {
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "argon2id$") || !verifyPassword("correct horse battery staple", hash) || verifyPassword("wrong", hash) {
		t.Fatal("invalid Argon2id password behavior")
	}
}

func TestVisitorRegistrationAndLoginAreRoleScoped(t *testing.T) {
	service, _ := newTestService(t)
	registered, err := service.RegisterVisitor(context.Background(), visitorRegisterRequest{Email: "visitor@example.test", Password: "correct horse battery staple", DisplayName: "Елена"})
	if err != nil {
		t.Fatal(err)
	}
	if registered.User.Role != "visitor" {
		t.Fatalf("role = %q, want visitor", registered.User.Role)
	}
	if _, err := service.LoginVisitor(context.Background(), loginRequest{Email: "visitor@example.test", Password: "correct horse battery staple"}); err != nil {
		t.Fatalf("visitor login: %v", err)
	}
}
