package artifacts

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeletionIsDistinctFromArchiveAndKeepsSnapshots(t *testing.T) {
	for _, published := range []bool{false, true} {
		name := "draft"
		if published {
			name = "published"
		}
		t.Run(name, func(t *testing.T) {
			env := newTestEnv(t)
			created := performJSON(t, env.handler, http.MethodPost, "/artifacts", map[string]any{"title": "Delete test"})
			var item artifactResponse
			decodeResponse(t, created, &item)
			id := item.Artifact.ID
			var publication publishResponse
			if published {
				screen := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+id+"/screens", map[string]any{"type": "text", "title": "Keep snapshot", "payload": `{"body":"Immutable content"}`})
				if screen.Code != http.StatusCreated {
					t.Fatal(screen.Body.String())
				}
				resp := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+id+"/publish", map[string]any{"expected_draft_revision": 2})
				if resp.Code != http.StatusOK {
					t.Fatal(resp.Body.String())
				}
				decodeResponse(t, resp, &publication)
			}
			repo := NewSQLiteRepository(env.db)
			museum := "mus_001"
			before, err := repo.GetSummary(context.Background(), &museum)
			if err != nil {
				t.Fatal(err)
			}
			resp := performNoBody(t, env.handler, http.MethodDelete, "/artifacts/"+id)
			if resp.Code != http.StatusNoContent {
				t.Fatalf("delete: %d %s", resp.Code, resp.Body.String())
			}
			for _, path := range []string{"/artifacts/" + id, "/artifacts/" + id + "/screens", "/artifacts/" + id + "/qr.png"} {
				resp := performNoBody(t, env.handler, http.MethodGet, path)
				if resp.Code != http.StatusNotFound {
					t.Fatalf("%s: %d", path, resp.Code)
				}
			}
			for _, operation := range []string{"restore", "duplicate", "archive"} {
				resp := performJSON(t, env.handler, http.MethodPost, "/artifacts/"+id+"/"+operation, map[string]any{})
				if resp.Code != http.StatusNotFound {
					t.Fatalf("%s: %d", operation, resp.Code)
				}
			}
			for _, status := range []string{"all", "draft", "published", "archived"} {
				items, _, err := repo.ListArtifacts(context.Background(), status, "", "", 1, 500, &museum)
				if err != nil {
					t.Fatal(err)
				}
				for _, row := range items {
					if row.ID == id {
						t.Fatalf("deleted item in %s", status)
					}
				}
			}
			after, err := repo.GetSummary(context.Background(), &museum)
			if err != nil {
				t.Fatal(err)
			}
			if after.Total != before.Total-1 || after.Archived != before.Archived {
				t.Fatalf("delete counted as archive: before=%+v after=%+v", before, after)
			}
			if published {
				request := httptest.NewRequest(http.MethodGet, "/api/v1/public/artifacts/"+publication.PublicCode, nil)
				public := httptest.NewRecorder()
				env.handler.ServeHTTP(public, request)
				if public.Code != http.StatusNotFound {
					t.Fatalf("deleted public link: %d", public.Code)
				}
				var count int
				if err := env.db.QueryRow("SELECT COUNT(*) FROM artifact_publications WHERE artifact_id = ?", id).Scan(&count); err != nil || count != 1 {
					t.Fatalf("snapshot removed: count=%d err=%v", count, err)
				}
			}
		})
	}
}

func TestArchiveAndRestoreRemainAvailable(t *testing.T) {
	env := newTestEnv(t)
	for _, operation := range []struct{ action, status string }{{"archive", "archived"}, {"restore", "draft"}} {
		resp := performJSON(t, env.handler, http.MethodPost, "/artifacts/art_001/"+operation.action, map[string]any{})
		if resp.Code != http.StatusOK {
			t.Fatalf("%s: %d", operation.action, resp.Code)
		}
		var item artifactResponse
		decodeResponse(t, resp, &item)
		if item.Artifact.Status != operation.status {
			t.Fatalf("status: %s", item.Artifact.Status)
		}
	}
}
