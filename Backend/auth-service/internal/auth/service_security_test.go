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

func TestDirectMethodistsReceiveDistinctPersistentMuseumContexts(t *testing.T) {
	service, _ := newTestService(t)
	var ids []string
	for _, email := range []string{"first@example.test", "second@example.test"} {
		registered, err := service.Register(context.Background(), registerRequest{Consents: testConsents(false), Email: email, Password: "correct horse battery staple", FullName: email})
		if err != nil {
			t.Fatal(err)
		}
		if registered.User.MuseumID == nil || !strings.HasPrefix(*registered.User.MuseumID, "mus_") {
			t.Fatalf("registration has no museum context: %+v", registered.User)
		}
		pair, err := service.Login(context.Background(), loginRequest{Email: email, Password: "correct horse battery staple"})
		if err != nil {
			t.Fatal(err)
		}
		claims, err := service.parseAccessToken(pair.AccessToken)
		if err != nil || claims.MuseumID != *registered.User.MuseumID {
			t.Fatalf("login museum = %q, registration museum = %q, err = %v", claims.MuseumID, *registered.User.MuseumID, err)
		}
		refreshed, err := service.Refresh(context.Background(), pair.RefreshToken)
		if err != nil {
			t.Fatal(err)
		}
		refreshClaims, err := service.parseAccessToken(refreshed.AccessToken)
		if err != nil || refreshClaims.MuseumID != claims.MuseumID {
			t.Fatalf("refresh lost museum context: %+v, %v", refreshClaims, err)
		}
		ids = append(ids, claims.MuseumID)
	}
	if ids[0] == ids[1] {
		t.Fatalf("separate methodists share museum %q", ids[0])
	}
}

func TestLegacyMethodistMuseumProvisionIsIdempotent(t *testing.T) {
	service, repo := newTestService(t)
	now := time.Now().UTC()
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	legacy := User{ID: "legacy", Email: "legacy@example.test", FullName: "Legacy", Role: "methodist", Status: "active", RegisteredAt: now, CreatedAt: now, UpdatedAt: now}
	if err := repo.CreateUser(context.Background(), legacy, hash); err != nil {
		t.Fatal(err)
	}
	oldPair, err := service.Login(context.Background(), loginRequest{Email: legacy.Email, Password: "correct horse battery staple"})
	if err != nil {
		t.Fatal(err)
	}
	oldClaims, err := service.parseAccessToken(oldPair.AccessToken)
	if err != nil || oldClaims.MuseumID != "" {
		t.Fatalf("old token = %+v, %v", oldClaims, err)
	}

	first, err := service.ProvisionMuseumContext(context.Background(), oldPair.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	second, err := service.ProvisionMuseumContext(context.Background(), oldPair.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	if first.User.MuseumID == nil || second.User.MuseumID == nil || *first.User.MuseumID != *second.User.MuseumID {
		t.Fatalf("provision changed museum context: %+v %+v", first.User.MuseumID, second.User.MuseumID)
	}
	claims, err := service.parseAccessToken(first.AccessToken)
	if err != nil || claims.MuseumID != *first.User.MuseumID || claims.SessionID != oldClaims.SessionID {
		t.Fatalf("new token = %+v, %v", claims, err)
	}
	refreshed, err := service.Refresh(context.Background(), oldPair.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	refreshClaims, err := service.parseAccessToken(refreshed.AccessToken)
	if err != nil || refreshClaims.MuseumID != claims.MuseumID {
		t.Fatalf("refresh = %+v, %v", refreshClaims, err)
	}
}

func TestMuseumProvisionEndpointRequiresMethodistSession(t *testing.T) {
	service, _ := newTestService(t)
	handler := NewHandler(service)
	request := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/museum-context", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	if rec := request(""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", rec.Code)
	}
	registered, err := service.RegisterVisitor(context.Background(), visitorRegisterRequest{Email: "visitor2@example.test", Password: "correct horse battery staple", DisplayName: "Visitor"})
	if err != nil {
		t.Fatal(err)
	}
	if registered.User.MuseumID != nil {
		t.Fatal("visitor unexpectedly has museum")
	}
	pair, err := service.LoginVisitor(context.Background(), loginRequest{Email: "visitor2@example.test", Password: "correct horse battery staple"})
	if err != nil {
		t.Fatal(err)
	}
	if rec := request(pair.AccessToken); rec.Code != http.StatusForbidden {
		t.Fatalf("visitor status = %d body=%s", rec.Code, rec.Body.String())
	}
}
