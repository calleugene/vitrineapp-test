package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type service struct {
	analyticsURL string
	routeURL     string
	feedbackURL  string
	client       *http.Client
}

func main() {
	s := &service{analyticsURL: strings.TrimRight(env("DASHBOARD_ANALYTICS_URL", "http://analytics-service:8085"), "/"), routeURL: strings.TrimRight(env("DASHBOARD_ROUTE_URL", "http://route-service:8083"), "/"), feedbackURL: strings.TrimRight(env("DASHBOARD_FEEDBACK_URL", "http://feedback-service:8086"), "/"), client: &http.Client{Timeout: 5 * time.Second}}
	log.Fatal(http.ListenAndServe(env("DASHBOARD_HTTP_ADDR", ":8084"), s.routes()))
}
func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
func output(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func unavailable(w http.ResponseWriter, code string) {
	output(w, 503, map[string]any{"error": map[string]string{"code": code, "message": code}})
}
func (s *service) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { output(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		resp, err := s.client.Get(s.analyticsURL + "/readyz")
		if err != nil {
			unavailable(w, "analytics_unavailable")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			unavailable(w, "analytics_unavailable")
			return
		}
		output(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("GET /api/v1/dashboard/{view}", s.read)
	return mux
}
func (s *service) get(r *http.Request, path string, query url.Values) (map[string]any, int) {
	return s.getSource(r, s.analyticsURL, path, query)
}
func (s *service) getSource(r *http.Request, base, path string, query url.Values) (map[string]any, int) {
	if base == "" {
		return nil, 503
	}
	u := base + "/api/v1/" + path
	if encoded := query.Encode(); encoded != "" {
		u += "?" + encoded
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, u, nil)
	if err != nil {
		return nil, 503
	}
	req.Header.Set("Authorization", r.Header.Get("Authorization"))
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 503
	}
	defer resp.Body.Close()
	var body map[string]any
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body) != nil {
		return nil, 503
	}
	return body, resp.StatusCode
}
func (s *service) read(w http.ResponseWriter, r *http.Request) {
	view := r.PathValue("view")
	if view == "popular-routes" || view == "feedback" { // Authorize before reporting a missing source.
		body, status := s.get(r, "visitors/summary", r.URL.Query())
		if status != 200 {
			s.passError(w, body, status)
			return
		}
		if view == "popular-routes" {
			body, status = s.getSource(r, s.routeURL, "routes/popular", nil)
		} else {
			body, status = s.getSource(r, s.feedbackURL, "feedback", url.Values{"limit": {"5"}})
			if status == 200 {
				items := []any{}
				if list, ok := body["items"].([]any); ok {
					for _, raw := range list {
						if item, ok := raw.(map[string]any); ok {
							items = append(items, map[string]any{"id": item["id"], "title": item["title"], "subtitle": item["body"], "created_at": item["created_at"]})
						}
					}
				}
				body = map[string]any{"items": items}
			}
		}
		if status != 200 {
			if (view == "popular-routes" && s.routeURL == "") || (view == "feedback" && s.feedbackURL == "") {
				unavailable(w, "source_unavailable")
				return
			}
			s.passError(w, body, status)
			return
		}
		output(w, 200, body)
		return
	}
	switch view {
	case "summary":
		requested, status := s.get(r, "visitors/summary", r.URL.Query())
		if status != 200 {
			s.passError(w, requested, status)
			return
		}
		q := r.URL.Query()
		q.Set("period", "month")
		q.Del("from")
		q.Del("to")
		body, status := s.get(r, "visitors/summary", q)
		if status != 200 {
			s.passError(w, body, status)
			return
		}
		visitorDelta := any(nil)
		if deltas, ok := body["deltas"].(map[string]any); ok {
			visitorDelta = deltas["total_visitors"]
		}
		result := map[string]any{"visitors_per_month": body["total_visitors"], "avg_route_duration_minutes": nil, "avg_progress_percent": nil, "museum_rating": nil, "deltas": map[string]any{"visitors_per_month": visitorDelta, "avg_route_duration_minutes": nil, "avg_progress_percent": nil, "museum_rating": nil}, "meta": requested["meta"], "visitors_per_month_meta": body["meta"]}
		availability := map[string]string{}
		if metrics, status := s.getSource(r, s.routeURL, "routes/metrics", nil); status == 200 {
			result["avg_route_duration_minutes"] = metrics["avg_route_duration_minutes"]
			result["avg_progress_percent"] = metrics["avg_progress_percent"]
			result["route_metrics_scope"] = "all_time"
		} else {
			availability["avg_route_duration_minutes"] = "route_source_unavailable"
			availability["avg_progress_percent"] = "route_source_unavailable"
		}
		if feedback, status := s.getSource(r, s.feedbackURL, "feedback/summary", nil); status == 200 {
			result["museum_rating"] = feedback["rating"]
			result["rating_scope"] = "all_time"
		} else {
			availability["museum_rating"] = "feedback_source_unavailable"
		}
		result["availability"] = availability
		output(w, 200, result)
	case "attendance":
		body, status := s.get(r, "visitors/dynamics", r.URL.Query())
		if status != 200 {
			s.passError(w, body, status)
			return
		}
		output(w, 200, map[string]any{"labels": body["labels"], "values": body["values"], "buckets": body["buckets"], "note": "Уникальные браузерные посетители по дням", "meta": body["meta"]})
	case "recent-activity":
		body, status := s.get(r, "analytics/recent-activity", r.URL.Query())
		if status != 200 {
			s.passError(w, body, status)
			return
		}
		output(w, 200, body)
	default:
		output(w, 404, map[string]any{"error": map[string]string{"code": "not_found", "message": "not_found"}})
	}
}
func (s *service) passError(w http.ResponseWriter, body map[string]any, status int) {
	if body == nil {
		unavailable(w, "analytics_unavailable")
		return
	}
	output(w, status, body)
}
