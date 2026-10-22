//go:build integration

package artifacts

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestRegistrationToVisitorPublicSnapshot(t *testing.T) {
	authDir, err := filepath.Abs(filepath.Join("..", "..", "..", "auth-service"))
	if err != nil {
		t.Fatal(err)
	}
	binary := filepath.Join(t.TempDir(), "auth-service")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	build := exec.Command("go", "build", "-o", binary, ".")
	build.Dir = authDir
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build auth service: %v\n%s", err, output)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := listener.Addr().String()
	_ = listener.Close()
	secret := strings.Repeat("integration-secret-", 3)
	cmd := exec.Command(binary)
	cmd.Dir = authDir
	cmd.Env = append(os.Environ(),
		"AUTH_DB_DSN=file:"+filepath.ToSlash(filepath.Join(t.TempDir(), "auth.db"))+"?_pragma=foreign_keys(1)",
		"AUTH_HTTP_ADDR="+addr,
		"AUTH_TOKEN_SECRET="+secret,
	)
	var authLog bytes.Buffer
	cmd.Stdout, cmd.Stderr = &authLog, &authLog
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = cmd.Process.Kill(); _ = cmd.Wait() })
	authBase := "http://" + addr + "/api/v1/auth"
	client := &http.Client{Timeout: 2 * time.Second}
	ready := false
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
		resp, err := client.Get("http://" + addr + "/")
		if err == nil {
			_ = resp.Body.Close()
			ready = true
			break
		}
	}
	if !ready {
		t.Fatalf("auth service did not start: %s", authLog.String())
	}
	postAuth := func(path string, body any) (int, map[string]any) {
		t.Helper()
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		resp, err := client.Post(authBase+path, "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var result map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode, result
	}

	var tokens, museums []string
	for i := 1; i <= 2; i++ {
		email := fmt.Sprintf("museum%d@example.test", i)
		status, registered := postAuth("/register", map[string]string{"email": email, "password": "correct horse battery staple", "full_name": email})
		if status != http.StatusCreated {
			t.Fatalf("register: %d %+v", status, registered)
		}
		museum, _ := registered["user"].(map[string]any)["museum_id"].(string)
		if museum == "" {
			t.Fatalf("registration has no museum: %+v", registered)
		}
		status, loggedIn := postAuth("/login", map[string]string{"email": email, "password": "correct horse battery staple"})
		if status != http.StatusOK {
			t.Fatalf("login: %d %+v", status, loggedIn)
		}
		token, _ := loggedIn["access_token"].(string)
		if token == "" {
			t.Fatalf("login has no token: %+v", loggedIn)
		}
		tokens, museums = append(tokens, token), append(museums, museum)
	}
	if museums[0] == museums[1] {
		t.Fatal("two registered users share museum")
	}

	env := newTestEnv(t)
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{TokenSecret: secret}))
	for i, token := range tokens {
		name := fmt.Sprintf("New Museum %d", i+1)
		resp := testMuseumRequest(t, handler, http.MethodPost, "/museums/profile", token, museums[1-i], map[string]string{"name": name})
		if resp.Code != http.StatusCreated || !strings.Contains(resp.Body.String(), museums[i]) {
			t.Fatalf("profile: %d %s", resp.Code, resp.Body.String())
		}
	}
	created := testMuseumRequest(t, handler, http.MethodPost, "/artifacts", tokens[0], museums[1], map[string]string{"title": "First museum artifact"})
	if created.Code != http.StatusCreated {
		t.Fatalf("artifact: %d %s", created.Code, created.Body.String())
	}
	var artifact artifactResponse
	decodeResponse(t, created, &artifact)
	foreign := testMuseumRequest(t, handler, http.MethodGet, "/artifacts/"+artifact.Artifact.ID, tokens[1], museums[0], nil)
	if foreign.Code != http.StatusNotFound {
		t.Fatalf("foreign read: %d %s", foreign.Code, foreign.Body.String())
	}
	screen := testMuseumRequest(t, handler, http.MethodPost, "/artifacts/"+artifact.Artifact.ID+"/screens", tokens[0], "", map[string]string{"type": "text", "title": "Visitor story", "payload": `{"body":"Published content"}`})
	if screen.Code != http.StatusCreated {
		t.Fatalf("screen: %d %s", screen.Code, screen.Body.String())
	}
	published := testMuseumRequest(t, handler, http.MethodPost, "/artifacts/"+artifact.Artifact.ID+"/publish", tokens[0], "", map[string]int{"expected_draft_revision": 2})
	if published.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", published.Code, published.Body.String())
	}
	var publication publishResponse
	decodeResponse(t, published, &publication)
	// Visitor's /exhibits/{code} page fetches this endpoint without a methodist token.
	public := testMuseumRequest(t, handler, http.MethodGet, "/api/v1/public/artifacts/"+publication.PublicCode, "", "", nil)
	if public.Code != http.StatusOK || !strings.Contains(public.Body.String(), museums[0]) || !strings.Contains(public.Body.String(), "Published content") {
		t.Fatalf("visitor snapshot: %d %s", public.Code, public.Body.String())
	}
	status, relogged := postAuth("/login", map[string]string{"email": "museum1@example.test", "password": "correct horse battery staple"})
	if status != http.StatusOK {
		t.Fatalf("repeat login: %d %+v", status, relogged)
	}
	repeatProfile := testMuseumRequest(t, handler, http.MethodGet, "/museums/profile", relogged["access_token"].(string), "", nil)
	if repeatProfile.Code != http.StatusOK || !strings.Contains(repeatProfile.Body.String(), museums[0]) {
		t.Fatalf("repeat context: %d %s", repeatProfile.Code, repeatProfile.Body.String())
	}
}
