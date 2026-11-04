package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type publicStats struct {
	Museums            *int64   `json:"museums"`
	Artifacts          *int64   `json:"artifacts"`
	ViewedArtifacts    *int64   `json:"viewed_artifacts"`
	Visitors           *int64   `json:"visitors"`
	ViewSeconds        *float64 `json:"view_seconds"`
	Devices            []string `json:"devices"`
	Methodists         *int64   `json:"methodists"`
	SessionSeconds     *float64 `json:"session_seconds"`
	AddArtifactSeconds *float64 `json:"add_artifact_seconds"`
}

func (s *server) publicStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	stats := publicStats{Devices: []string{}}
	if s.artifactsDB != nil {
		_ = s.artifactsDB.QueryRowContext(ctx, `SELECT
			(SELECT COUNT(*) FROM museum_profiles),
			(SELECT COUNT(*) FROM artifacts)`).Scan(&stats.Museums, &stats.Artifacts)
	}
	if s.authDB != nil {
		_ = s.authDB.QueryRowContext(ctx, `SELECT
			COUNT(CASE WHEN role = 'visitor' THEN 1 END),
			COUNT(CASE WHEN role = 'methodist' THEN 1 END)
			FROM users`).Scan(&stats.Visitors, &stats.Methodists)
	}
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(DISTINCT artifact_id)
		FROM analytics_events WHERE type = 'scene_view'`).Scan(&stats.ViewedArtifacts)
	_ = s.db.QueryRowContext(ctx, `SELECT AVG(seconds) FROM (
		SELECT SUM(active_ms) / 1000.0 AS seconds
		FROM analytics_events WHERE type = 'engagement'
		GROUP BY visitor_key, session_id, artifact_id
	) AS views`).Scan(&stats.ViewSeconds)
	_ = s.db.QueryRowContext(ctx, `SELECT AVG(seconds) FROM (
		SELECT SUM(duration_ms) / 1000.0 AS seconds
		FROM methodist_metrics WHERE kind = 'session'
		GROUP BY session_key
	) AS sessions`).Scan(&stats.SessionSeconds)
	_ = s.db.QueryRowContext(ctx, `SELECT AVG(duration_ms / 1000.0)
		FROM methodist_metrics WHERE kind = 'artifact'`).Scan(&stats.AddArtifactSeconds)

	stats.Devices = s.popularDevices(ctx)
	w.Header().Set("Cache-Control", "public, max-age=60")
	jsonOut(w, http.StatusOK, stats)
}

func (s *server) popularDevices(ctx context.Context) []string {
	devices := []string{}
	rows, err := s.db.QueryContext(ctx, `WITH counts AS (
		SELECT device, COUNT(*) AS total FROM (
			SELECT DISTINCT device, visitor_key, session_id, artifact_id
			FROM analytics_events WHERE type = 'scene_view' AND device <> ''
		) AS views GROUP BY device
	)
	SELECT device FROM counts WHERE total = (SELECT MAX(total) FROM counts) ORDER BY device`)
	if err != nil {
		return devices
	}
	defer rows.Close()
	for rows.Next() {
		var device string
		if rows.Scan(&device) != nil {
			return []string{}
		}
		devices = append(devices, device)
	}
	if rows.Err() != nil {
		return []string{}
	}
	return devices
}

func viewingDevice(r *http.Request) string {
	ua := strings.ToLower(r.UserAgent())
	switch {
	case strings.Contains(ua, "ipad"), strings.Contains(ua, "tablet"),
		strings.Contains(ua, "kindle"), strings.Contains(ua, "silk/"),
		strings.Contains(ua, "android") && !strings.Contains(ua, "mobile"):
		return "tablet"
	case r.Header.Get("Sec-CH-UA-Mobile") == "?1", strings.Contains(ua, "mobile"), strings.Contains(ua, "iphone"):
		return "phone"
	case strings.Contains(ua, "windows"), strings.Contains(ua, "macintosh"),
		strings.Contains(ua, "linux"), strings.Contains(ua, "cros"):
		return "desktop"
	default:
		return ""
	}
}

func (s *server) recordMethodistMetric(w http.ResponseWriter, r *http.Request) {
	if _, status := s.authorize(r); status != 0 {
		fail(w, status, "unauthorized")
		return
	}
	var sample struct {
		ID         string `json:"id"`
		SessionKey string `json:"session_key"`
		Kind       string `json:"kind"`
		DurationMS int    `json:"duration_ms"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	if decoder.Decode(&sample) != nil || decoder.Decode(new(any)) != io.EOF ||
		!validID(sample.ID) || !validID(sample.SessionKey) || sample.DurationMS < 1 ||
		!(sample.Kind == "session" && sample.DurationMS <= 15000 ||
			sample.Kind == "artifact" && sample.DurationMS <= 24*60*60*1000) {
		fail(w, 400, "invalid_metric")
		return
	}
	if !s.allowed("methodist:"+sample.SessionKey, s.now()) {
		fail(w, 429, "rate_limited")
		return
	}
	_, err := s.db.ExecContext(r.Context(), s.bind(`INSERT INTO methodist_metrics
		(kind, id, session_key, duration_ms) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`),
		sample.Kind, sample.ID, sample.SessionKey, sample.DurationMS)
	if err != nil {
		fail(w, 503, "database_unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func addViewingDeviceColumn(db *sql.DB, driver string) error {
	if driver == "pgx" {
		_, err := db.Exec(`ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT ''`)
		return err
	}
	var exists bool
	if err := db.QueryRow(`SELECT EXISTS(
		SELECT 1 FROM pragma_table_info('analytics_events') WHERE name = 'device'
	)`).Scan(&exists); err != nil || exists {
		return err
	}
	_, err := db.Exec(`ALTER TABLE analytics_events ADD COLUMN device TEXT NOT NULL DEFAULT ''`)
	return err
}
