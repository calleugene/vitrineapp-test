package artifacts

import (
	"net/http"
	"strings"
	"testing"
)

func TestPublicationRequiresCurrentScreenRevision(t *testing.T) {
	env := newTestEnv(t)
	created := performJSON(t, env.handler, http.MethodPost, "/artifacts", map[string]any{"title": "Revision regression", "category": "other"})
	var item artifactResponse
	decodeResponse(t, created, &item)
	path := "/artifacts/" + item.Artifact.ID
	empty := performJSON(t, env.handler, http.MethodPost, path+"/publish", map[string]any{})
	if empty.Code != http.StatusUnprocessableEntity || !strings.Contains(empty.Body.String(), "cannot_publish_empty") {
		t.Fatalf("empty publication: %d %s", empty.Code, empty.Body.String())
	}
	screen := performJSON(t, env.handler, http.MethodPost, path+"/screens", map[string]any{"type": "text", "title": "Screen", "payload": `{"body":"Regression"}`})
	if screen.Code != http.StatusCreated {
		t.Fatalf("screen: %s", screen.Body.String())
	}
	stale := performJSON(t, env.handler, http.MethodPost, path+"/publish", map[string]any{"expected_draft_revision": item.Artifact.DraftRevision})
	if stale.Code != http.StatusConflict || !strings.Contains(stale.Body.String(), "revision_conflict") {
		t.Fatalf("stale publication: %d %s", stale.Code, stale.Body.String())
	}
	latest := performNoBody(t, env.handler, http.MethodGet, path)
	decodeResponse(t, latest, &item)
	published := performJSON(t, env.handler, http.MethodPost, path+"/publish", map[string]any{"expected_draft_revision": item.Artifact.DraftRevision})
	if published.Code != http.StatusOK {
		t.Fatalf("current publication: %d %s", published.Code, published.Body.String())
	}
}
