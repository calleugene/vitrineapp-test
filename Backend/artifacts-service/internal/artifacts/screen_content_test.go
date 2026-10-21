package artifacts

import (
	"bytes"
	"encoding/binary"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"
)

func glbFixture(manifest string) []byte {
	for len(manifest)%4 != 0 {
		manifest += " "
	}
	data := make([]byte, 20+len(manifest))
	copy(data, "glTF")
	binary.LittleEndian.PutUint32(data[4:8], 2)
	binary.LittleEndian.PutUint32(data[8:12], uint32(len(data)))
	binary.LittleEndian.PutUint32(data[12:16], uint32(len(manifest)))
	copy(data[16:20], "JSON")
	copy(data[20:], manifest)
	return data
}

func TestInteractiveScreenPublicationAndValidation(t *testing.T) {
	env := newTestEnv(t)
	artifact := performJSON(t, env.handler, "POST", "/artifacts", map[string]any{"title": "Interactive exhibit"})
	var item artifactResponse
	decodeResponse(t, artifact, &item)
	path := "/artifacts/" + item.Artifact.ID
	quiz := performJSON(t, env.handler, "POST", path+"/screens", map[string]any{"type": "quiz", "title": "Question", "payload": `{"content":{"options":[]}}`})
	if quiz.Code != 201 {
		t.Fatalf("create quiz: %d %s", quiz.Code, quiz.Body)
	}
	var created screenResponse
	decodeResponse(t, quiz, &created)
	incomplete := performJSON(t, env.handler, "POST", path+"/publish", map[string]any{})
	if incomplete.Code != 422 || !strings.Contains(incomplete.Body.String(), "screen_content_incomplete") {
		t.Fatalf("incomplete: %d %s", incomplete.Code, incomplete.Body)
	}
	for _, payload := range []string{`{"content":{"options":["A","A"],"correct_answer":"A"}}`, `{"content":{"options":["A","B"],"correct_answer":"C"}}`} {
		rec := performJSON(t, env.handler, "PATCH", path+"/screens/"+created.Screen.ID, map[string]any{"payload": payload})
		if rec.Code != 400 {
			t.Fatalf("invalid quiz accepted: %d %s", rec.Code, rec.Body)
		}
	}
	payload := `{"content":{"options":["A","B"],"correct_answer":"B","explanation":"Why"}}`
	saved := performJSON(t, env.handler, "PATCH", path+"/screens/"+created.Screen.ID, map[string]any{"payload": payload})
	if saved.Code != 200 {
		t.Fatal(saved.Body)
	}
	model := performJSON(t, env.handler, "POST", path+"/screens", map[string]any{"type": "model", "title": "Model", "payload": `{"content":{"model_url":"/media-files/model.glb"}}`})
	if model.Code != 201 {
		t.Fatalf("model: %d %s", model.Code, model.Body)
	}
	pub := performJSON(t, env.handler, "POST", path+"/publish", map[string]any{})
	if pub.Code != 200 {
		t.Fatalf("publish: %d %s", pub.Code, pub.Body)
	}
	var publication publishResponse
	decodeResponse(t, pub, &publication)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/public/artifacts/"+publication.PublicCode, nil))
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), "correct_answer") || !strings.Contains(rec.Body.String(), "model.glb") {
		t.Fatalf("public interactive content: %d %s", rec.Code, rec.Body)
	}
}

func TestGLBUploadAndMuseumScope(t *testing.T) {
	env := newTestEnv(t)
	store, err := NewLocalAssetStore(t.TempDir(), "/media-files")
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(NewService(NewSQLiteRepository(env.db), Config{AssetStore: store}))
	created := performJSON(t, handler, "POST", "/artifacts/art_001/screens", map[string]any{"type": "model", "title": "Model", "payload": `{"content":{}}`})
	var screen screenResponse
	decodeResponse(t, created, &screen)
	path := "/api/v1/artifacts/art_001/screens/" + screen.Screen.ID + "/model"
	valid := glbFixture(`{"asset":{"version":"2.0"},"scenes":[{}],"scene":0}`)
	external := glbFixture(`{"asset":{"version":"2.0"},"buffers":[{"uri":"https://example.com/private"}]}`)
	for _, tc := range []struct {
		data   []byte
		museum string
		want   int
	}{{valid, "mus_001", 200}, {external, "mus_001", 400}, {[]byte("invalid"), "mus_001", 400}, {valid, "other-museum", 404}} {
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		part, _ := form.CreateFormFile("file", "model.glb")
		part.Write(tc.data)
		form.Close()
		req := httptest.NewRequest("POST", path, &body)
		req.Header.Set("Content-Type", form.FormDataContentType())
		req.Header.Set("X-Museum-ID", tc.museum)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != tc.want {
			t.Fatalf("upload %s: %d want %d: %s", tc.museum, rec.Code, tc.want, rec.Body)
		}
	}
	if validGLB(valid[:len(valid)-1]) {
		t.Fatal("truncated GLB accepted")
	}
}
