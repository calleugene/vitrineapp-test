package auth

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testConsents(marketing bool) []consentInput {
	result := []consentInput{}
	for _, d := range publishedDocuments() {
		if d.Type != "privacy" {
			result = append(result, consentInput{Type: d.Type, Version: d.Version, Accepted: d.Type == "personal_data" || marketing})
		}
	}
	return result
}
func TestRegistrationConsentValidationAndPersistence(t *testing.T) {
	s, r := newTestService(t)
	ctx := context.Background()
	req := registerRequest{Email: "consent@example.test", Password: "correct horse battery staple", FullName: "Тест"}
	if _, err := s.Register(ctx, req); !errors.Is(err, ErrBadRequest) {
		t.Fatalf("missing consent: %v", err)
	}
	req.Consents = testConsents(false)
	req.Consents[0].Version = "outdated"
	if _, err := s.Register(ctx, req); !errors.Is(err, ErrBadRequest) {
		t.Fatalf("old version: %v", err)
	}
	req.Consents = testConsents(false)
	req.Consents[0].Accepted = false
	if _, err := s.Register(ctx, req); !errors.Is(err, ErrBadRequest) {
		t.Fatalf("declined required consent: %v", err)
	}
	req.Consents = testConsents(false)
	registered, err := s.Register(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := r.db.Query(`SELECT consent_type,document_version,confirmed_at,accepted FROM user_consents WHERE user_id=?`, registered.User.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var typ, version, at string
		var accepted bool
		if err := rows.Scan(&typ, &version, &at, &accepted); err != nil {
			t.Fatal(err)
		}
		count++
		if version == "" || at == "" || accepted != (typ == "personal_data") {
			t.Fatalf("bad audit record: %s %s %s %v", typ, version, at, accepted)
		}
	}
	if count != 2 {
		t.Fatalf("consent rows=%d", count)
	}
}
func TestPasswordResetDeliverySecurity(t *testing.T) {
	s, r := newTestService(t)
	ctx := context.Background()
	u := createTestUser(t, r, "reset-user", "methodist")
	clock := time.Date(2026, 10, 17, 12, 0, 0, 0, time.UTC)
	s.config.Now = func() time.Time { return clock }
	pair, err := s.issueSession(ctx, u)
	if err != nil {
		t.Fatal(err)
	}
	var delivered string
	sent := 0
	s.config.SendPasswordReset = func(_ context.Context, email, token string) error { sent++; delivered = token; return nil }
	known, err := s.ForgotPassword(ctx, u.Email)
	if err != nil {
		t.Fatal(err)
	}
	unknown, err := s.ForgotPassword(ctx, "unknown@example.test")
	if err != nil {
		t.Fatal(err)
	}
	if known != unknown || known.ResetToken != "" {
		t.Fatal("response disclosed account or token")
	}
	if sent != 0 {
		t.Fatal("mail sent on request path")
	}
	for i := 0; i < 2; i++ {
		if err = s.deliverPasswordReset(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if sent != 1 || len(delivered) < 32 {
		t.Fatal("missing opaque token delivery")
	}
	record, err := r.FindPasswordResetToken(ctx, tokenHashString(delivered))
	if err != nil {
		t.Fatal(err)
	}
	if record.ExpiresAt.Sub(clock) != 30*time.Minute {
		t.Fatal("wrong TTL")
	}
	var plainCount int
	r.db.QueryRow(`SELECT count(*) FROM password_reset_tokens WHERE token_hash=?`, delivered).Scan(&plainCount)
	if plainCount != 0 {
		t.Fatal("raw token stored")
	}
	if err = s.ResetPassword(ctx, delivered, "новыйпароль"); !errors.Is(err, ErrBadRequest) {
		t.Fatalf("short Unicode password: %v", err)
	}
	if err = s.ResetPassword(ctx, delivered, "new correct horse battery staple"); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Me(ctx, pair.AccessToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old session survives: %v", err)
	}
	if _, err = s.Refresh(ctx, pair.RefreshToken); !errors.Is(err, ErrUnauthorized) {
		t.Fatal("old refresh survives")
	}
	if err = s.ResetPassword(ctx, delivered, "another correct horse battery staple"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("token reusable: %v", err)
	}
	if _, err = s.Login(ctx, loginRequest{Email: u.Email, Password: "new correct horse battery staple"}); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ForgotPassword(ctx, u.Email); err != nil {
		t.Fatal(err)
	}
	if err = s.deliverPasswordReset(ctx); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(30 * time.Minute)
	if err = s.ResetPassword(ctx, delivered, "another correct horse battery staple"); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expired token accepted: %v", err)
	}
}
func TestPasswordResetQuotaAndRetry(t *testing.T) {
	s, r := newTestService(t)
	ctx := context.Background()
	u := createTestUser(t, r, "retry-user", "methodist")
	clock := time.Now().UTC()
	s.config.Now = func() time.Time { return clock }
	s.config.SendPasswordReset = func(context.Context, string, string) error { return errors.New("mail unavailable") }
	for i := 0; i < 5; i++ {
		if _, err := s.ForgotPassword(ctx, u.Email); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	r.db.QueryRow(`SELECT count(*) FROM password_reset_mail`).Scan(&count)
	if count != 3 {
		t.Fatalf("quota jobs=%d", count)
	}
	if err := s.deliverPasswordReset(ctx); err == nil {
		t.Fatal("delivery failure ignored")
	}
	var pending int
	r.db.QueryRow(`SELECT count(*) FROM password_reset_mail WHERE attempts=1`).Scan(&pending)
	if pending != 1 {
		t.Fatal("retry lost")
	}
	clock = clock.Add(31 * time.Minute)
	if _, err := s.ForgotPassword(ctx, u.Email); err != nil {
		t.Fatal(err)
	}
	allowed, err := r.AllowPasswordReset(ctx, "independent", clock)
	if err != nil || !allowed {
		t.Fatal(err)
	}
}
func TestLegalDocumentsPublicAndNoLegacyLinks(t *testing.T) {
	s, _ := newTestService(t)
	rec := httptest.NewRecorder()
	NewHandler(s).ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/auth/legal-documents", nil))
	if rec.Code != 200 {
		t.Fatal(rec.Code)
	}
	var docs []legalDocument
	if err := json.Unmarshal(rec.Body.Bytes(), &docs); err != nil {
		t.Fatal(err)
	}
	if len(docs) != 3 {
		t.Fatal("wrong documents")
	}
	for _, d := range docs {
		if len(d.Text) < 1000 || !strings.Contains(d.Text, "5 сентября 2026 года") {
			t.Fatal("incomplete text")
		}
	}
}
func TestConsentFailureRollsBackUser(t *testing.T) {
	s, r := newTestService(t)
	ctx := context.Background()
	_, err := r.db.Exec(`CREATE TRIGGER reject_consent BEFORE INSERT ON user_consents BEGIN SELECT RAISE(ABORT,'reject'); END`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.Register(ctx, registerRequest{Email: "rollback@example.test", Password: "correct horse battery staple", FullName: "Rollback", Consents: testConsents(false)})
	if err == nil {
		t.Fatal("registration succeeded")
	}
	if _, err = r.FindUserByEmail(ctx, "rollback@example.test"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("partial user survived: %v", err)
	}
}

func TestResetClientIPRequiresTrustedProxy(t *testing.T) {
	s, _ := newTestService(t)
	request := httptest.NewRequest("POST", "/api/v1/auth/forgot-password", nil)
	request.RemoteAddr = "127.0.0.1:8080"
	request.Header.Set("X-Forwarded-For", "203.0.113.9, 198.51.100.10")
	if got := s.clientIP(request); got != "127.0.0.1" {
		t.Fatalf("untrusted forwarded IP: %s", got)
	}
	s.config.TrustedProxyCIDRs = []string{"127.0.0.1/32"}
	if got := s.clientIP(request); got != "198.51.100.10" {
		t.Fatalf("wrong client hop: %s", got)
	}
	s.config.TrustedProxyCIDRs = append(s.config.TrustedProxyCIDRs, "198.51.100.0/24")
	if got := s.clientIP(request); got != "203.0.113.9" {
		t.Fatalf("wrong multi-proxy client: %s", got)
	}
}

func TestForgotPasswordHTTPQuota(t *testing.T) {
	s, _ := newTestService(t)
	s.config.SendPasswordReset = func(context.Context, string, string) error { return nil }
	handler := NewHandler(s)
	for i := 0; i < 31; i++ {
		request := httptest.NewRequest("POST", "/api/v1/auth/forgot-password", strings.NewReader(`{"email":"unknown@example.test"}`))
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		expected := 200
		if i == 30 {
			expected = 429
		}
		if response.Code != expected {
			t.Fatalf("request %d status %d", i, response.Code)
		}
		if i == 30 && response.Header().Get("Retry-After") != "1800" {
			t.Fatal("missing retry delay")
		}
	}
}

func TestLegalPublishedTextMatchesOriginalWordFiles(t *testing.T) {
	for _, doc := range publishedDocuments() {
		original, err := legalFiles.ReadFile("legal_documents/" + doc.Type + ".docx")
		if err != nil {
			t.Fatal(err)
		}
		archive, err := zip.NewReader(bytes.NewReader(original), int64(len(original)))
		if err != nil {
			t.Fatal(err)
		}
		var paragraphs []string
		for _, entry := range archive.File {
			if entry.Name != "word/document.xml" {
				continue
			}
			reader, err := entry.Open()
			if err != nil {
				t.Fatal(err)
			}
			decoder := xml.NewDecoder(reader)
			var paragraph strings.Builder
			inText := false
			for {
				token, err := decoder.Token()
				if errors.Is(err, io.EOF) {
					break
				}
				if err != nil {
					t.Fatal(err)
				}
				switch value := token.(type) {
				case xml.StartElement:
					if value.Name.Local == "p" {
						paragraph.Reset()
					}
					if value.Name.Local == "t" {
						inText = true
					}
				case xml.EndElement:
					if value.Name.Local == "t" {
						inText = false
					}
					if value.Name.Local == "p" {
						paragraphs = append(paragraphs, paragraph.String())
					}
				case xml.CharData:
					if inText {
						paragraph.Write(value)
					}
				}
			}
			reader.Close()
		}
		if strings.Join(paragraphs, "\n") != doc.Text {
			t.Fatalf("%s loses or changes original content", doc.Type)
		}
		if !strings.HasSuffix(doc.Version, fmt.Sprintf("%x", sha256.Sum256([]byte(doc.Text)))[:12]) {
			t.Fatal("version hash mismatch")
		}
		var blocks []struct {
			Kind, Text string
			Rows       [][]string
		}
		if err = json.Unmarshal(doc.Blocks, &blocks); err != nil {
			t.Fatal(err)
		}
		var rendered []string
		for _, block := range blocks {
			if block.Kind == "paragraph" {
				rendered = append(rendered, block.Text)
			} else {
				for _, row := range block.Rows {
					for _, cell := range row {
						rendered = append(rendered, strings.Split(cell, "\n")...)
					}
				}
			}
		}
		if strings.Join(rendered, "\n") != doc.Text {
			t.Fatalf("%s rendered structure omits text", doc.Type)
		}
	}
}
