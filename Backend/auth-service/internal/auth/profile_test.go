package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func profileRequest(t *testing.T, s *Service, token, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	NewHandler(s).ServeHTTP(rec, req)
	return rec
}
func TestProfileLifecycleAndDeadline(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	user := createTestUser(t, repo, "lifecycle", "methodist")
	now := time.Now().UTC().Truncate(time.Second)
	s.config.Now = func() time.Time { return now }
	s.config.RefreshTokenTTL = 90 * 24 * time.Hour
	s.config.AccessTokenTTL = 90 * 24 * time.Hour
	pair, err := s.issueSession(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if rec := profileRequest(t, s, pair.AccessToken, "POST", "/auth/deactivate", ""); rec.Code != 200 {
		t.Fatalf("deactivate: %d %s", rec.Code, rec.Body)
	}
	dormant, err := repo.FindUserByID(ctx, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if dormant.Status != "DORMANT" || dormant.DeactivatedAt == nil || !dormant.ScheduledDeletionAt.Equal(now.Add(30*24*time.Hour)) {
		t.Fatalf("bad lifecycle: %+v", dormant)
	}
	deadline := *dormant.ScheduledDeletionAt
	for _, route := range []struct{ method, path, body string }{
		{"PATCH", "/users/lifecycle", `{"full_name":"Changed Name"}`},
		{"POST", "/auth/museums/join", `{"museum_id":"museum-1","code":"anything"}`},
		{"POST", "/auth/museum-context", `{}`},
		{"GET", "/auth/authorize-museum", ``},
		{"POST", "/auth/museums/select", `{"museum_id":"museum-1"}`},
	} {
		rec := profileRequest(t, s, pair.AccessToken, route.method, route.path, route.body)
		if rec.Code != 403 {
			t.Errorf("dormant %s: %d %s", route.path, rec.Code, rec.Body)
		}
	}
	now = now.Add(24 * time.Hour)
	if _, err = s.Login(ctx, loginRequest{Email: user.Email, Password: "correct horse battery staple"}); err != nil {
		t.Fatal(err)
	}
	afterLogin, _ := repo.FindUserByID(ctx, user.ID)
	if !afterLogin.ScheduledDeletionAt.Equal(deadline) || afterLogin.Status != "DORMANT" {
		t.Fatal("login changed deletion deadline")
	}
	if rec := profileRequest(t, s, pair.AccessToken, "POST", "/auth/reactivate", ""); rec.Code != 200 {
		t.Fatalf("reactivate: %d %s", rec.Code, rec.Body)
	}
	active, _ := repo.FindUserByID(ctx, user.ID)
	if active.Status != "ACTIVE" || active.DeactivatedAt != nil || active.ScheduledDeletionAt != nil {
		t.Fatal("reactivation did not clear deadline")
	}
	if rec := profileRequest(t, s, pair.AccessToken, "PATCH", "/users/lifecycle", `{"full_name":"Changed Name","phone":"123","about":"About"}`); rec.Code != 200 {
		t.Fatalf("restored edit: %d %s", rec.Code, rec.Body)
	}
	if rec := profileRequest(t, s, pair.AccessToken, "POST", "/auth/deactivate", ""); rec.Code != 200 {
		t.Fatal(rec.Body)
	}
	now = now.Add(30 * 24 * time.Hour)
	if rec := profileRequest(t, s, pair.AccessToken, "POST", "/auth/reactivate", ""); rec.Code != 403 {
		t.Fatalf("expired reactivation: %d", rec.Code)
	}
	if err = s.RunAccountDeletion(ctx); err != nil {
		t.Fatal(err)
	}
	if err = s.RunAccountDeletion(ctx); err != nil {
		t.Fatal(err)
	}
	deleted, _ := repo.FindUserByID(ctx, user.ID)
	if deleted.Status != "DELETED" || deleted.Phone != "" || deleted.FullName != "" || deleted.MuseumID != nil || deleted.AvatarURL != "" {
		t.Fatalf("PII retained: %+v", deleted)
	}
	memberships, _ := repo.MuseumMemberships(ctx, user.ID)
	if len(memberships) != 0 {
		t.Fatal("memberships retained")
	}
	if rec := profileRequest(t, s, pair.AccessToken, "GET", "/auth/me", ""); rec.Code != 401 {
		t.Fatalf("deleted session allowed: %d", rec.Code)
	}
}

func TestMuseumCodesMembershipsAndSwitch(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	owner := createTestUser(t, repo, "owner", "methodist")
	member := createTestUser(t, repo, "member", "methodist")
	// Give the invitee a different original museum, as in a real multi-museum account.
	if _, err := repo.db.Exec(`DELETE FROM museum_memberships WHERE user_id='member'`); err != nil {
		t.Fatal(err)
	}
	museum := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Service-Secret") != s.config.TokenSecret {
			t.Error("missing internal authorization")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"museum": map[string]string{"museum_id": "museum-1", "name": "Музей", "logo_url": "/logo.png"}})
	}))
	defer museum.Close()
	s.config.MuseumServiceURL = museum.URL
	ownerPair, _ := s.issueSession(ctx, owner)
	memberPair, _ := s.issueSession(ctx, member)
	rec := profileRequest(t, s, ownerPair.AccessToken, "POST", "/auth/museums/code", "")
	if rec.Code != 200 {
		t.Fatalf("code creation: %d %s", rec.Code, rec.Body)
	}
	var payload struct {
		Code string `json:"code"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &payload)
	if len(payload.Code) < 32 || strings.Contains(payload.Code, "museum-1") {
		t.Fatal("not an opaque token")
	}
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/select", `{"museum_id":"museum-1"}`)
	if rec.Code != 403 {
		t.Fatal("unjoined museum allowed")
	}
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/join", `{"code":"`+payload.Code+`"}`)
	if rec.Code != 400 {
		t.Fatal("museum ID is required")
	}
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/join", `{"museum_id":"wrong-museum","code":"`+payload.Code+`"}`)
	if rec.Code != 410 {
		t.Fatalf("mismatched museum and code accepted: %d", rec.Code)
	}
	unjoined, _ := repo.MuseumMemberships(ctx, member.ID)
	if len(unjoined) != 0 {
		t.Fatal("mismatched code granted membership")
	}
	body := `{"museum_id":"museum-1","code":"` + payload.Code + `"}`
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/join", body)
	if rec.Code != 200 {
		t.Fatalf("join: %d %s", rec.Code, rec.Body)
	}
	var list museumsResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Museums) != 1 || list.Museums[0].LogoURL != "/logo.png" || list.Museums[0].Role != "methodist" {
		t.Fatalf("bad memberships: %+v", list)
	}
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/join", body)
	if rec.Code != 409 {
		t.Fatal("duplicate not rejected")
	}
	rec = profileRequest(t, s, memberPair.AccessToken, "POST", "/auth/museums/select", `{"museum_id":"museum-1"}`)
	if rec.Code != 200 {
		t.Fatal(rec.Body)
	}
	var selected museumContextResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &selected)
	claims, err := s.parseAccessToken(selected.AccessToken)
	if err != nil || claims.MuseumID != "museum-1" {
		t.Fatal("context not signed")
	}
	if rec = profileRequest(t, s, selected.AccessToken, "POST", "/auth/museums/code", ""); rec.Code != 403 {
		t.Fatal("member could generate invitations")
	}
	if rec = profileRequest(t, s, ownerPair.AccessToken, "DELETE", "/auth/museums/code", ""); rec.Code != 204 {
		t.Fatal(rec.Body)
	}
	if err = repo.JoinMuseum(ctx, member.ID, "museum-1", tokenHashString(payload.Code), s.config.now()); err != ErrCodeInvalid {
		t.Fatalf("revoked code: %v", err)
	}
}

func TestJoinRateLimitAndExpiry(t *testing.T) {
	s, repo := newTestService(t)
	ctx := context.Background()
	createTestUser(t, repo, "limited", "methodist")
	now := s.config.now()
	for i := 0; i < 5; i++ {
		if err := repo.JoinMuseum(ctx, "limited", "museum-2", "invalid", now); err != ErrCodeNotFound {
			t.Fatal(err)
		}
	}
	if err := repo.JoinMuseum(ctx, "limited", "museum-2", "invalid", now); err != ErrJoinRateLimited {
		t.Fatalf("limit: %v", err)
	}
	if err := repo.RotateMuseumCode(ctx, "museum-2", "expired", now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	now = now.Add(16 * time.Minute)
	if err := repo.JoinMuseum(ctx, "limited", "museum-2", "expired", now); err != ErrCodeInvalid {
		t.Fatalf("expired: %v", err)
	}
	if err := repo.RotateMuseumCode(ctx, "museum-2", "fresh", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := repo.JoinMuseum(ctx, "limited", "museum-2", "fresh", now); err != nil {
		t.Fatal(err)
	}
	if err := repo.RotateMuseumCode(ctx, "museum-2", "replacement", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := repo.JoinMuseum(ctx, "limited", "museum-2", "fresh", now); err != ErrCodeInvalid {
		t.Fatalf("old code after rotation: %v", err)
	}
}

func TestProfileEmailConfirmation(t *testing.T) {
	s, repo := newTestService(t)
	user := createTestUser(t, repo, "email", "methodist")
	pair, _ := s.issueSession(context.Background(), user)
	var delivered string
	s.config.SendEmailChange = func(_ context.Context, email, token string) error {
		if email != "new@example.test" {
			t.Fatal(email)
		}
		delivered = token
		return nil
	}
	rec := profileRequest(t, s, pair.AccessToken, "PATCH", "/users/email", `{"email":"new@example.test"}`)
	if rec.Code != 409 {
		t.Fatal("email changed without verification")
	}
	rec = profileRequest(t, s, pair.AccessToken, "POST", "/auth/email-change", `{"email":"new@example.test"}`)
	if rec.Code != 200 || delivered == "" {
		t.Fatalf("request: %d %s", rec.Code, rec.Body)
	}
	before, _ := repo.FindUserByID(context.Background(), user.ID)
	if before.Email != user.Email {
		t.Fatal("email changed before verification")
	}
	rec = profileRequest(t, s, pair.AccessToken, "POST", "/auth/email-change/confirm", `{"token":"wrong"}`)
	if rec.Code != 400 {
		t.Fatal("invalid code allowed")
	}
	body := `{"token":"` + delivered + `"}`
	rec = profileRequest(t, s, pair.AccessToken, "POST", "/auth/email-change/confirm", body)
	if rec.Code != 200 {
		t.Fatal(rec.Body)
	}
	after, _ := repo.FindUserByID(context.Background(), user.ID)
	if after.Email != "new@example.test" || after.EmailVerifiedAt == nil {
		t.Fatal("confirmation not persisted")
	}
	if rec = profileRequest(t, s, pair.AccessToken, "POST", "/auth/email-change/confirm", body); rec.Code != 400 {
		t.Fatal("token reused")
	}
}

func TestAvatarUploadAndDormantRejection(t *testing.T) {
	s, repo := newTestService(t)
	user := createTestUser(t, repo, "avatar", "methodist")
	pair, _ := s.issueSession(context.Background(), user)
	upload := func() *httptest.ResponseRecorder {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, _ := writer.CreateFormFile("file", "avatar.png")
		_ = png.Encode(part, image.NewRGBA(image.Rect(0, 0, 800, 600)))
		_ = writer.Close()
		req := httptest.NewRequest("POST", "/users/avatar/avatar", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
		rec := httptest.NewRecorder()
		NewHandler(s).ServeHTTP(rec, req)
		return rec
	}
	if rec := upload(); rec.Code != 200 {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}
	after, _ := repo.FindUserByID(context.Background(), user.ID)
	if !strings.HasPrefix(after.AvatarURL, "data:image/jpeg;base64,") || len(after.AvatarURL) > 500000 {
		t.Fatal("avatar not normalized")
	}
	if err := repo.TransitionAccount(context.Background(), user.ID, false, s.config.now()); err != nil {
		t.Fatal(err)
	}
	if rec := upload(); rec.Code != 403 {
		t.Fatal("dormant avatar upload allowed")
	}
}
