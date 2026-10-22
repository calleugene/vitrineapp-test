package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDashboardProjectionAndUnavailableSource(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer museum-session" {
			output(w, 401, map[string]any{"error": map[string]string{"code": "unauthorized", "message": "unauthorized"}})
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/v1/visitors/summary") {
			output(w, 200, map[string]any{"total_visitors": 0, "deltas": map[string]any{"total_visitors": nil}, "meta": map[string]any{"timezone": "UTC"}})
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/v1/visitors/dynamics") {
			output(w, 200, map[string]any{"labels": []string{}, "values": []int{}, "buckets": []any{}, "meta": map[string]any{"timezone": "UTC"}})
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/v1/analytics/recent-activity") {
			output(w, 200, map[string]any{"activities": []any{}, "meta": map[string]any{"timezone": "UTC"}})
			return
		}
		w.WriteHeader(404)
	}))
	defer upstream.Close()
	s := &service{analyticsURL: upstream.URL, client: &http.Client{Timeout: time.Second}}
	for _, path := range []string{"summary", "attendance", "recent-activity"} {
		req := httptest.NewRequest("GET", "/api/v1/dashboard/"+path, nil)
		req.Header.Set("Authorization", "Bearer museum-session")
		rec := httptest.NewRecorder()
		s.routes().ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	req := httptest.NewRequest("GET", "/api/v1/dashboard/popular-routes", nil)
	req.Header.Set("Authorization", "Bearer museum-session")
	rec := httptest.NewRecorder()
	s.routes().ServeHTTP(rec, req)
	if rec.Code != 503 || !strings.Contains(rec.Body.String(), "source_unavailable") {
		t.Fatalf("missing route source: %d %s", rec.Code, rec.Body.String())
	}
	req = httptest.NewRequest("GET", "/api/v1/dashboard/feedback", nil)
	rec = httptest.NewRecorder()
	s.routes().ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("unauthorized source read: %d", rec.Code)
	}
}

func TestDashboardConnectedRouteAndFeedbackSources(t *testing.T) {
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer museum-session" {
			output(w, 401, map[string]any{"error": map[string]string{"code": "unauthorized"}})
			return
		}
		switch r.URL.Path {
		case "/api/v1/visitors/summary":
			output(w, 200, map[string]any{"total_visitors": 3, "meta": map[string]string{"timezone": "UTC"}})
		case "/api/v1/routes/popular":
			output(w, 200, map[string]any{"routes": []map[string]any{{"id": "r1", "title": "Route", "visits": 2}}})
		case "/api/v1/routes/metrics":
			output(w, 200, map[string]any{"avg_route_duration_minutes": 5, "avg_progress_percent": 50})
		case "/api/v1/feedback/summary":
			output(w, 200, map[string]any{"rating": 4.5})
		case "/api/v1/feedback":
			output(w, 200, map[string]any{"items": []map[string]any{{"id": "f1", "title": "Review", "body": "Useful", "created_at": "2026-10-20T00:00:00Z"}}})
		default:
			w.WriteHeader(404)
		}
	}))
	defer source.Close()
	s := &service{analyticsURL: source.URL, routeURL: source.URL, feedbackURL: source.URL, client: source.Client()}
	for _, view := range []string{"summary", "feedback", "popular-routes"} {
		req := httptest.NewRequest("GET", "/api/v1/dashboard/"+view, nil)
		req.Header.Set("Authorization", "Bearer museum-session")
		rec := httptest.NewRecorder()
		s.routes().ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", view, rec.Code, rec.Body.String())
		}
		if view == "summary" && !strings.Contains(rec.Body.String(), `"museum_rating":4.5`) {
			t.Fatal(rec.Body.String())
		}
	}
}
