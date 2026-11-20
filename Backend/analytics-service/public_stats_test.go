package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func TestPublicStats(t *testing.T) {
	s, handler := testServer(t)
	s.authDB = s.artifactsDB
	if _, err := s.artifactsDB.Exec(`ALTER TABLE artifacts ADD COLUMN deleted_at TEXT;
		INSERT INTO artifacts VALUES ('deleted', 'museum-a', '2026-10-17');
		CREATE TABLE museum_profiles (museum_id TEXT PRIMARY KEY);
		INSERT INTO museum_profiles VALUES ('museum-a');
		CREATE TABLE users (role TEXT);
		INSERT INTO users VALUES ('visitor'), ('visitor'), ('methodist'), ('moderator');`); err != nil {
		t.Fatal(err)
	}
	if err := s.migrate(); err != nil {
		t.Fatalf("repeat migration: %v", err)
	}

	postMetric := func(body, authorization string, want int) {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/analytics/methodist-metrics", strings.NewReader(body))
		req.Header.Set("Authorization", authorization)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Fatalf("metric: got %d, want %d: %s", rec.Code, want, rec.Body)
		}
	}
	session := `{"id":"sample","session_key":"tab","kind":"session","duration_ms":12000}`
	postMetric(session, "", 401)
	postMetric(session, token("museum-a"), 204)
	postMetric(session, token("museum-a"), 204)
	postMetric(`{"id":"art-1","session_key":"tab","kind":"artifact","duration_ms":30000}`, token("museum-a"), 204)

	if _, err := s.db.Exec(`INSERT INTO analytics_events
		(id, payload_hash, museum_id, artifact_id, public_code, visitor_key, session_id, type, screen_id, active_ms, occurred_at, received_at, device)
		VALUES
		('1', '', 'm', 'art-1', 'c', 'v', 's', 'scene_view', 's1', 0, 0, 0, 'phone'),
		('2', '', 'm', 'art-1', 'c', 'v', 's', 'scene_view', 's2', 0, 0, 0, 'phone'),
		('3', '', 'm', 'art-1', 'c', 'v', 's', 'engagement', 's2', 10000, 0, 0, ''),
		('4', '', 'm', 'art-1', 'c', 'v', 't', 'scene_view', 's1', 0, 0, 0, 'desktop'),
		('5', '', 'm', 'art-1', 'c', 'v', 't', 'engagement', 's1', 6000, 0, 0, '');`); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/public/stats", nil))
	var got publicStats
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &got) != nil {
		t.Fatalf("stats: %d %s", rec.Code, rec.Body)
	}
	for _, check := range []struct {
		value *int64
		want  int64
	}{{got.Museums, 1}, {got.Artifacts, 1}, {got.ViewedArtifacts, 1}, {got.Visitors, 2}, {got.Methodists, 1}} {
		if check.value == nil || *check.value != check.want {
			t.Fatalf("unexpected totals: %s", rec.Body)
		}
	}
	for _, check := range []struct {
		value *float64
		want  float64
	}{{got.ViewSeconds, 8}, {got.SessionSeconds, 12}, {got.AddArtifactSeconds, 30}} {
		if check.value == nil || *check.value != check.want {
			t.Fatalf("unexpected averages: %s", rec.Body)
		}
	}
	if !reflect.DeepEqual(got.Devices, []string{"desktop", "phone"}) {
		t.Fatalf("unexpected leading devices: %v", got.Devices)
	}
}
