package platform

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"
)

type Route struct {
	Document
	Title          string   `json:"title"`
	Subtitle       string   `json:"subtitle"`
	Description    string   `json:"description"`
	Duration       string   `json:"duration"`
	Difficulty     string   `json:"difficulty"`
	Audience       string   `json:"audience"`
	Language       string   `json:"language"`
	Status         string   `json:"status"`
	Visibility     string   `json:"visibility"`
	ShowOnMap      bool     `json:"show_on_map"`
	RequireQR      bool     `json:"require_qr"`
	ArtifactIDs    []string `json:"artifact_ids"`
	ArtifactsCount int      `json:"artifacts_count"`
	Views          int      `json:"views"`
}
type routeInput struct {
	Title       *string   `json:"title"`
	Subtitle    *string   `json:"subtitle"`
	Description *string   `json:"description"`
	Duration    *string   `json:"duration"`
	Difficulty  *string   `json:"difficulty"`
	Audience    *string   `json:"audience"`
	Language    *string   `json:"language"`
	Status      *string   `json:"status"`
	Visibility  *string   `json:"visibility"`
	ShowOnMap   *bool     `json:"show_on_map"`
	RequireQR   *bool     `json:"require_qr"`
	ArtifactIDs *[]string `json:"artifact_ids"`
	Version     *int      `json:"version"`
}
type Visit struct {
	Document
	RouteID      string   `json:"route_id"`
	VisitorKey   string   `json:"visitor_key"`
	SessionID    string   `json:"session_id"`
	ArtifactIDs  []string `json:"artifact_ids"`
	CompletedIDs []string `json:"completed_artifact_ids"`
	Completed    bool     `json:"completed"`
	StartedAt    int64    `json:"started_at"`
	CompletedAt  int64    `json:"completed_at"`
}

func routeOf(x Record) Route {
	var v Route
	_ = json.Unmarshal([]byte(x.Body), &v)
	v.Document = x.Meta()
	v.ArtifactsCount = len(v.ArtifactIDs)
	return v
}
func visitOf(x Record) Visit {
	var v Visit
	_ = json.Unmarshal([]byte(x.Body), &v)
	v.Document = x.Meta()
	return v
}
func body(v any) string { b, _ := json.Marshal(v); return string(b) }
func (s *Server) routeHandlers(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/routes", s.routesList)
	m.HandleFunc("POST /api/v1/routes", s.routeWrite)
	m.HandleFunc("GET /api/v1/routes/summary", s.routeSummary)
	m.HandleFunc("GET /api/v1/routes/recent-activity", s.routeActivity)
	m.HandleFunc("GET /api/v1/routes/popular", s.routePopular)
	m.HandleFunc("GET /api/v1/routes/metrics", s.routeMetrics)
	m.HandleFunc("GET /api/v1/routes/{id}", s.routeGet)
	m.HandleFunc("PATCH /api/v1/routes/{id}", s.routeWrite)
	m.HandleFunc("DELETE /api/v1/routes/{id}", s.routeDelete)
	m.HandleFunc("POST /api/v1/routes/{id}/artifacts", s.routeArtifacts)
	m.HandleFunc("DELETE /api/v1/routes/{id}/artifacts/{artifact}", s.routeArtifacts)
	m.HandleFunc("PUT /api/v1/routes/{id}/artifacts/reorder", s.routeArtifacts)
	m.HandleFunc("GET /api/v1/public/museums/{museum}/routes", s.publicRoutes)
	m.HandleFunc("GET /api/v1/public/routes/{id}", s.publicRoute)
	m.HandleFunc("POST /api/v1/public/routes/{id}/start", s.routeProgress)
	m.HandleFunc("POST /api/v1/public/routes/{id}/progress", s.routeProgress)
}
func (s *Server) routesList(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	p, l, ok := Page(w, r)
	if !ok {
		return
	}
	xs, err := s.List(r.Context(), "route", c.MuseumID)
	if err != nil {
		Fail(w, 503, "storage_unavailable")
		return
	}
	visits, err := s.List(r.Context(), "visit", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	views := map[string]int{}
	for _, visit := range visits {
		views[visitOf(visit).RouteID]++
	}
	items := []Route{}
	status := r.URL.Query().Get("status")
	if status != "" && !contains([]string{"draft", "published", "archived", "all"}, status) {
		Fail(w, 400, "invalid_status")
		return
	}
	q := strings.ToLower(r.URL.Query().Get("search"))
	for _, x := range xs {
		v := routeOf(x)
		v.Views = views[v.ID]
		if status != "" && status != "all" && v.Status != status {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(v.Title), q) {
			continue
		}
		items = append(items, v)
	}
	a, b := Window(len(items), p, l)
	JSON(w, 200, map[string]any{"routes": items[a:b], "items": items[a:b], "total": len(items), "page": p, "limit": l})
}
func (s *Server) routeGet(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	x, err := s.Get(r.Context(), "route", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]any{"route": routeOf(x)})
}
func recordError(w http.ResponseWriter, err error) {
	if err == sql.ErrNoRows {
		Fail(w, 404, "not_found")
	} else if err == ErrConflict {
		Fail(w, 409, "version_conflict")
	} else {
		Fail(w, 503, "storage_unavailable")
	}
}
func (s *Server) validateArtifacts(w http.ResponseWriter, r *http.Request, museum string, ids []string, published bool) bool {
	if len(ids) > 100 {
		Fail(w, 400, "too_many_artifacts")
		return false
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if !Valid(id) || seen[id] {
			Fail(w, 400, "invalid_artifact_ids")
			return false
		}
		seen[id] = true
		var p struct {
			Artifact struct {
				ID         string `json:"id"`
				MuseumID   string `json:"museum_id"`
				PublicCode string `json:"public_code"`
			} `json:"artifact"`
		}
		status := s.Fetch(r, s.ArtifactsURL+"/artifacts/"+url.PathEscape(id), &p)
		if status != 200 {
			if status == 404 || status == 403 {
				Fail(w, 400, "artifact_not_in_museum")
			} else {
				Fail(w, 503, "artifacts_unavailable")
			}
			return false
		}
		if p.Artifact.MuseumID != museum {
			Fail(w, 400, "artifact_not_in_museum")
			return false
		}
		if published {
			if p.Artifact.PublicCode == "" {
				Fail(w, 409, "artifact_not_published")
				return false
			}
			var public map[string]any
			if s.Fetch(r, s.ArtifactsURL+"/public/artifacts/"+url.PathEscape(p.Artifact.PublicCode), &public) != 200 {
				Fail(w, 409, "artifact_not_published")
				return false
			}
		}
	}
	return true
}
func applyRoute(v *Route, in routeInput) {
	for _, pair := range []struct {
		to   *string
		from *string
	}{{&v.Title, in.Title}, {&v.Subtitle, in.Subtitle}, {&v.Description, in.Description}, {&v.Duration, in.Duration}, {&v.Difficulty, in.Difficulty}, {&v.Audience, in.Audience}, {&v.Language, in.Language}, {&v.Status, in.Status}, {&v.Visibility, in.Visibility}} {
		if pair.from != nil {
			*pair.to = strings.TrimSpace(*pair.from)
		}
	}
	if in.ArtifactIDs != nil {
		v.ArtifactIDs = *in.ArtifactIDs
	}
	if in.ShowOnMap != nil {
		v.ShowOnMap = *in.ShowOnMap
	}
	if in.RequireQR != nil {
		v.RequireQR = *in.RequireQR
	}
}
func validRoute(v Route) bool {
	return len(v.Title) > 0 && len(v.Title) <= 200 && len(v.Subtitle) <= 500 && len(v.Description) <= 10000 && len(v.Duration) <= 100 && len(v.Audience) <= 500 && len(v.Language) <= 16 && contains([]string{"draft", "published", "archived"}, v.Status) && contains([]string{"public", "private"}, v.Visibility) && contains([]string{"basic", "easy", "medium", "hard", "advanced"}, v.Difficulty)
}
func (s *Server) routeWrite(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	var in routeInput
	if !Decode(w, r, &in) {
		return
	}
	x := Record{ID: ID("rte"), Museum: c.MuseumID, Kind: "route", Created: Now()}
	v := Route{Status: "draft", Visibility: "public", Difficulty: "basic", Language: "ru", ArtifactIDs: []string{}}
	action := "route_created"
	if r.Method == "PATCH" {
		var err error
		x, err = s.Get(r.Context(), "route", r.PathValue("id"), c.MuseumID)
		if err != nil {
			recordError(w, err)
			return
		}
		v = routeOf(x)
		action = "route_updated"
		if in.Version != nil && *in.Version != x.Version {
			Fail(w, 409, "version_conflict")
			return
		}
	}
	applyRoute(&v, in)
	if !validRoute(v) {
		Fail(w, 400, "invalid_route")
		return
	}
	if v.Status == "published" && len(v.ArtifactIDs) == 0 {
		Fail(w, 409, "empty_route")
		return
	}
	if !s.validateArtifacts(w, r, c.MuseumID, v.ArtifactIDs, v.Status == "published") {
		return
	}
	x.Body = body(v)
	x.Updated = Now()
	if err := s.Save(r.Context(), x, activity(c, action, "Маршрут «"+v.Title+"»: "+v.Status)); err != nil {
		recordError(w, err)
		return
	}
	x.Version++
	JSON(w, 200, map[string]any{"route": routeOf(x)})
}
func (s *Server) routeDelete(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	x, err := s.Get(r.Context(), "route", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	v := routeOf(x)
	v.Status = "archived"
	v.Visibility = "private"
	x.Body = body(v)
	x.Updated = Now()
	if err = s.Save(r.Context(), x, activity(c, "route_archived", "Архивирован маршрут «"+v.Title+"»")); err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]bool{"archived": true})
}
func (s *Server) routeArtifacts(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	x, err := s.Get(r.Context(), "route", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	v := routeOf(x)
	ids := append([]string{}, v.ArtifactIDs...)
	switch r.Method {
	case "POST":
		var in struct {
			ArtifactID string `json:"artifact_id"`
			Order      int    `json:"order"`
		}
		if !Decode(w, r, &in) {
			return
		}
		if !Valid(in.ArtifactID) || contains(ids, in.ArtifactID) || in.Order < 0 || in.Order > len(ids) {
			Fail(w, 400, "invalid_artifact_order")
			return
		}
		ids = append(ids, "")
		copy(ids[in.Order+1:], ids[in.Order:])
		ids[in.Order] = in.ArtifactID
	case "DELETE":
		ids = []string{}
		for _, id := range v.ArtifactIDs {
			if id != r.PathValue("artifact") {
				ids = append(ids, id)
			}
		}
	case "PUT":
		var in struct {
			IDs []string `json:"artifact_ids"`
		}
		if !Decode(w, r, &in) {
			return
		}
		if len(in.IDs) != len(ids) {
			Fail(w, 400, "invalid_reorder")
			return
		}
		for _, id := range in.IDs {
			if !contains(ids, id) {
				Fail(w, 400, "invalid_reorder")
				return
			}
		}
		ids = in.IDs
	}
	if v.Status == "published" && len(ids) == 0 {
		Fail(w, 409, "empty_route")
		return
	}
	if !s.validateArtifacts(w, r, c.MuseumID, ids, v.Status == "published") {
		return
	}
	v.ArtifactIDs = ids
	x.Body = body(v)
	x.Updated = Now()
	if err = s.Save(r.Context(), x, activity(c, "route_updated", "Обновлены экспонаты маршрута «"+v.Title+"»")); err != nil {
		recordError(w, err)
		return
	}
	x.Version++
	JSON(w, 200, map[string]any{"route": routeOf(x)})
}
func (s *Server) routeSummary(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	xs, err := s.List(r.Context(), "route", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	pub, draft := 0, 0
	for _, x := range xs {
		v := routeOf(x)
		if v.Status == "published" {
			pub++
		}
		if v.Status == "draft" {
			draft++
		}
	}
	visits, err := s.List(r.Context(), "visit", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]any{"total": len(xs), "published": pub, "draft": draft, "total_views": len(visits)})
}
func (s *Server) routeActivity(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), s.Q(`SELECT id,title,created_at FROM events WHERE museum_id=? ORDER BY created_at DESC,id DESC LIMIT 20`), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title string
		var at int64
		if rows.Scan(&id, &title, &at) != nil {
			Fail(w, 503, "storage_unavailable")
			return
		}
		out = append(out, map[string]any{"id": id, "title": title, "created_at": Stamp(at)})
	}
	if rows.Err() != nil {
		Fail(w, 503, "storage_unavailable")
		return
	}
	JSON(w, 200, map[string]any{"activities": out})
}
func (s *Server) publicRoutes(w http.ResponseWriter, r *http.Request) {
	xs, err := s.List(r.Context(), "route", r.PathValue("museum"))
	if err != nil {
		recordError(w, err)
		return
	}
	out := []Route{}
	for _, x := range xs {
		v := routeOf(x)
		if v.Status == "published" && v.Visibility == "public" {
			out = append(out, v)
		}
	}
	JSON(w, 200, map[string]any{"routes": out})
}
func (s *Server) publicRoute(w http.ResponseWriter, r *http.Request) {
	x, err := s.Find(r.Context(), "route", r.PathValue("id"))
	if err != nil {
		recordError(w, err)
		return
	}
	v := routeOf(x)
	if v.Status != "published" || v.Visibility != "public" {
		Fail(w, 404, "not_found")
		return
	}
	JSON(w, 200, map[string]any{"route": v})
}
func visitID(route, visitor, session string) string {
	h := sha256.Sum256([]byte(route + "\x00" + visitor + "\x00" + session))
	return "vst_" + hex.EncodeToString(h[:])
}
func (s *Server) routeProgress(w http.ResponseWriter, r *http.Request) {
	var in struct {
		VisitorKey string `json:"visitor_key"`
		SessionID  string `json:"session_id"`
		ArtifactID string `json:"artifact_id"`
		Source     string `json:"source"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if !Valid(in.VisitorKey) || !Valid(in.SessionID) {
		Fail(w, 400, "invalid_identity")
		return
	}
	rx, err := s.Find(r.Context(), "route", r.PathValue("id"))
	if err != nil {
		recordError(w, err)
		return
	}
	route := routeOf(rx)
	if route.Status != "published" || route.Visibility != "public" {
		Fail(w, 404, "not_found")
		return
	}
	id := visitID(route.ID, in.VisitorKey, in.SessionID)
	x, err := s.Get(r.Context(), "visit", id, rx.Museum)
	if err != nil && err != sql.ErrNoRows {
		recordError(w, err)
		return
	}
	v := visitOf(x)
	if err == sql.ErrNoRows {
		if route.RequireQR && (in.Source != "qr" || !strings.HasSuffix(r.URL.Path, "/start")) {
			Fail(w, 409, "qr_start_required")
			return
		}
		v = Visit{RouteID: route.ID, VisitorKey: in.VisitorKey, SessionID: in.SessionID, ArtifactIDs: append([]string{}, route.ArtifactIDs...), CompletedIDs: []string{}, StartedAt: Now()}
		x = Record{ID: id, Museum: rx.Museum, Kind: "visit", Created: v.StartedAt}
	}
	if strings.HasSuffix(r.URL.Path, "/progress") {
		if !contains(v.ArtifactIDs, in.ArtifactID) {
			Fail(w, 400, "artifact_not_in_route")
			return
		}
		if s.artifactsDB == nil {
			Fail(w, 503, "collection_source_unavailable")
			return
		}
		var found bool
		err = s.artifactsDB.QueryRowContext(r.Context(), Bind(s.artifactsDriver, `SELECT found FROM artifact_visitor_status WHERE visitor_id=? AND artifact_id=?`), in.VisitorKey, in.ArtifactID).Scan(&found)
		if err != nil && err != sql.ErrNoRows {
			Fail(w, 503, "collection_source_unavailable")
			return
		}
		if !found {
			Fail(w, 409, "collection_not_confirmed")
			return
		}
		if !contains(v.CompletedIDs, in.ArtifactID) {
			v.CompletedIDs = append(v.CompletedIDs, in.ArtifactID)
		}
	}
	if !v.Completed && len(v.ArtifactIDs) > 0 && len(v.ArtifactIDs) == len(v.CompletedIDs) {
		v.Completed = true
		v.CompletedAt = Now()
	}
	x.Body = body(v)
	x.Updated = Now()
	if err = s.Save(r.Context(), x, nil); err != nil {
		if existing, e := s.Get(r.Context(), "visit", id, rx.Museum); e == nil && r.URL.Path[len(r.URL.Path)-5:] == "start" {
			JSON(w, 200, map[string]any{"visit": visitOf(existing)})
			return
		}
		recordError(w, err)
		return
	}
	x.Version++
	JSON(w, 200, map[string]any{"visit": visitOf(x)})
}
func (s *Server) routePopular(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	routes, err := s.List(r.Context(), "route", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	visits, err := s.List(r.Context(), "visit", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	counts, completions := map[string]int{}, map[string]int{}
	for _, x := range visits {
		v := visitOf(x)
		counts[v.RouteID]++
		if v.Completed {
			completions[v.RouteID]++
		}
	}
	out := []map[string]any{}
	for _, x := range routes {
		v := routeOf(x)
		if v.Status != "published" {
			continue
		}
		var percent any
		if counts[v.ID] > 0 {
			percent = 100 * float64(completions[v.ID]) / float64(counts[v.ID])
		}
		out = append(out, map[string]any{"id": v.ID, "title": v.Title, "description": v.Description, "visits": counts[v.ID], "completion_percent": percent})
	}
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i]["visits"].(int), out[j]["visits"].(int)
		if a == b {
			return out[i]["id"].(string) < out[j]["id"].(string)
		}
		return a > b
	})
	for i := range out {
		out[i]["rank"] = i + 1
	}
	JSON(w, 200, map[string]any{"routes": out})
}
func (s *Server) routeMetrics(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	xs, err := s.List(r.Context(), "visit", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	completed := 0
	duration, progress := 0.0, 0.0
	for _, x := range xs {
		v := visitOf(x)
		if len(v.ArtifactIDs) > 0 {
			progress += 100 * float64(len(v.CompletedIDs)) / float64(len(v.ArtifactIDs))
		}
		if v.Completed {
			completed++
			duration += float64(v.CompletedAt-v.StartedAt) / 60000
		}
	}
	var avgDuration, avgProgress any
	if completed > 0 {
		avgDuration = duration / float64(completed)
	}
	if len(xs) > 0 {
		avgProgress = progress / float64(len(xs))
	}
	JSON(w, 200, map[string]any{"avg_route_duration_minutes": avgDuration, "avg_progress_percent": avgProgress, "sessions": len(xs), "completed_sessions": completed, "scope": "all_time", "identity": "browser_pseudonym"})
}
