package platform

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
)

type Feedback struct {
	Document
	UserID      string `json:"user_id"`
	PublicCode  string `json:"public_code"`
	ArtifactID  string `json:"artifact_id"`
	AuthorName  string `json:"author_name"`
	Type        string `json:"type"`
	Title       string `json:"title"`
	Body        string `json:"body"`
	Rating      int    `json:"rating"`
	Status      string `json:"status"`
	Reply       string `json:"reply"`
	ReplyStatus string `json:"reply_status"`
	ReplyAuthor string `json:"reply_author"`
	ReplyAt     string `json:"reply_at"`
	Source      string `json:"source"`
}

func feedbackOf(x Record) Feedback {
	var v Feedback
	_ = json.Unmarshal([]byte(x.Body), &v)
	v.Document = x.Meta()
	return v
}
func (s *Server) feedbackHandlers(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/feedback", s.feedbackList)
	m.HandleFunc("GET /api/v1/feedback/summary", s.feedbackSummary)
	m.HandleFunc("GET /api/v1/feedback/{id}", s.feedbackGet)
	m.HandleFunc("PUT /api/v1/feedback/{id}/reply", s.feedbackReply)
	m.HandleFunc("PATCH /api/v1/feedback/{id}", s.feedbackModerate)
	m.HandleFunc("POST /api/v1/public/feedback", s.feedbackCreate)
	m.HandleFunc("GET /api/v1/public/museums/{museum}/reviews", s.publicReviews)
	m.HandleFunc("GET /api/v1/public/feedback/{id}", s.ownFeedback)
}
func (s *Server) feedbackCreate(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, false)
	if !ok {
		return
	}
	if c.Role != "visitor" {
		Fail(w, 403, "visitor_required")
		return
	}
	var in struct {
		ID         string `json:"id"`
		PublicCode string `json:"public_code"`
		Type       string `json:"type"`
		Title      string `json:"title"`
		Body       string `json:"body"`
		Rating     int    `json:"rating"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	if in.Title == "" {
		in.Title = map[string]string{"review": "Отзыв посетителя", "question": "Вопрос посетителя", "suggestion": "Предложение посетителя"}[in.Type]
	}
	if !Valid(in.ID) || !Valid(in.PublicCode) || !contains([]string{"review", "question", "suggestion"}, in.Type) || len(in.Title) > 200 || len(in.Body) < 1 || len(in.Body) > 5000 || (in.Type == "review" && (in.Rating < 1 || in.Rating > 5)) || (in.Type != "review" && in.Rating != 0) {
		Fail(w, 400, "invalid_feedback")
		return
	}
	var pub struct {
		Artifact struct {
			ID       string `json:"id"`
			MuseumID string `json:"museum_id"`
		} `json:"artifact"`
	}
	status := s.Fetch(r, s.ArtifactsURL+"/public/artifacts/"+url.PathEscape(in.PublicCode), &pub)
	if status != 200 || !Valid(pub.Artifact.MuseumID) {
		if status == 404 || status == 410 {
			Fail(w, 404, "publication_not_found")
		} else {
			Fail(w, 503, "artifacts_unavailable")
		}
		return
	}
	sum := sha256.Sum256([]byte(c.UserID + "\x00" + in.ID))
	id := "fb_" + hex.EncodeToString(sum[:])
	existing, err := s.Get(r.Context(), "feedback", id, pub.Artifact.MuseumID)
	if err == nil {
		v := feedbackOf(existing)
		if v.PublicCode != in.PublicCode || v.Type != in.Type || v.Title != in.Title || v.Body != in.Body || v.Rating != in.Rating {
			Fail(w, 409, "idempotency_conflict")
			return
		}
		JSON(w, 200, map[string]any{"feedback": v, "duplicate": true})
		return
	}
	if err != sql.ErrNoRows {
		recordError(w, err)
		return
	}
	var count int
	if err = s.DB.QueryRowContext(r.Context(), s.Q(`SELECT COUNT(*) FROM events WHERE actor_id=? AND type='feedback_created' AND created_at>=?`), c.UserID, Now()-3600000).Scan(&count); err != nil {
		recordError(w, err)
		return
	}
	if count >= 10 {
		Fail(w, 429, "rate_limited")
		return
	}
	v := Feedback{UserID: c.UserID, PublicCode: in.PublicCode, ArtifactID: pub.Artifact.ID, AuthorName: c.Name, Type: in.Type, Title: in.Title, Body: in.Body, Rating: in.Rating, Status: "pending", ReplyStatus: "none", Source: "Visitor"}
	if v.AuthorName == "" {
		v.AuthorName = "Посетитель"
	}
	if v.Title == "" {
		v.Title = map[string]string{"review": "Отзыв посетителя", "question": "Вопрос посетителя", "suggestion": "Предложение посетителя"}[v.Type]
	}
	at := Now()
	x := Record{ID: id, Museum: pub.Artifact.MuseumID, Kind: "feedback", Body: body(v), Created: at, Updated: at}
	c.MuseumID = x.Museum
	if err = s.Save(r.Context(), x, activity(c, "feedback_created", "Новое сообщение: "+v.Title)); err != nil {
		Fail(w, 409, "concurrent_submission_retry")
		return
	}
	x.Version = 1
	JSON(w, 201, map[string]any{"feedback": feedbackOf(x), "duplicate": false})
}
func (s *Server) feedbackList(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	p, l, ok := Page(w, r)
	if !ok {
		return
	}
	kind, status, reply := r.URL.Query().Get("type"), r.URL.Query().Get("status"), r.URL.Query().Get("reply_status")
	if kind != "" && !contains([]string{"review", "question", "suggestion"}, kind) || status != "" && !contains([]string{"pending", "published", "rejected"}, status) || reply != "" && !contains([]string{"none", "draft", "published"}, reply) {
		Fail(w, 400, "invalid_filter")
		return
	}
	xs, err := s.List(r.Context(), "feedback", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	out := []Feedback{}
	for _, x := range xs {
		v := feedbackOf(x)
		if kind != "" && v.Type != kind || status != "" && v.Status != status || reply != "" && v.ReplyStatus != reply {
			continue
		}
		out = append(out, v)
	}
	a, b := Window(len(out), p, l)
	JSON(w, 200, map[string]any{"items": out[a:b], "total": len(out), "page": p, "limit": l})
}
func (s *Server) feedbackGet(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	x, err := s.Get(r.Context(), "feedback", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]any{"feedback": feedbackOf(x)})
}
func (s *Server) feedbackReply(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	var in struct {
		Body    string `json:"body"`
		Status  string `json:"status"`
		Version *int   `json:"version"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Body = strings.TrimSpace(in.Body)
	if len(in.Body) < 1 || len(in.Body) > 5000 || !contains([]string{"draft", "published"}, in.Status) {
		Fail(w, 400, "invalid_reply")
		return
	}
	x, err := s.Get(r.Context(), "feedback", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	if in.Version != nil && *in.Version != x.Version {
		Fail(w, 409, "version_conflict")
		return
	}
	v := feedbackOf(x)
	v.Reply = in.Body
	v.ReplyStatus = in.Status
	v.ReplyAuthor = c.Name
	if v.ReplyAuthor == "" {
		v.ReplyAuthor = "Сотрудник музея"
	}
	v.ReplyAt = Stamp(Now())
	x.Body = body(v)
	x.Updated = Now()
	if err = s.Save(r.Context(), x, activity(c, "feedback_replied", "Сохранён ответ на «"+v.Title+"»")); err != nil {
		recordError(w, err)
		return
	}
	x.Version++
	JSON(w, 200, map[string]any{"feedback": feedbackOf(x)})
}
func (s *Server) feedbackModerate(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	var in struct {
		Status  string `json:"status"`
		Version *int   `json:"version"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if !contains([]string{"pending", "published", "rejected"}, in.Status) {
		Fail(w, 400, "invalid_status")
		return
	}
	x, err := s.Get(r.Context(), "feedback", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	v := feedbackOf(x)
	if in.Status == "published" && v.Type != "review" {
		Fail(w, 400, "only_reviews_are_public")
		return
	}
	if in.Version != nil && *in.Version != x.Version {
		Fail(w, 409, "version_conflict")
		return
	}
	v.Status = in.Status
	x.Body = body(v)
	x.Updated = Now()
	if err = s.Save(r.Context(), x, activity(c, "feedback_moderated", "Модерация сообщения «"+v.Title+"»: "+in.Status)); err != nil {
		recordError(w, err)
		return
	}
	x.Version++
	JSON(w, 200, map[string]any{"feedback": feedbackOf(x)})
}
func (s *Server) feedbackSummary(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	xs, err := s.List(r.Context(), "feedback", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	total, rating := 0, 0
	for _, x := range xs {
		v := feedbackOf(x)
		if v.Type == "review" && v.Status == "published" {
			total++
			rating += v.Rating
		}
	}
	var avg any
	if total > 0 {
		avg = float64(rating) / float64(total)
	}
	JSON(w, 200, map[string]any{"total": len(xs), "published_reviews": total, "rating": avg, "scope": "all_time"})
}
func (s *Server) publicReviews(w http.ResponseWriter, r *http.Request) {
	p, l, ok := Page(w, r)
	if !ok {
		return
	}
	xs, err := s.List(r.Context(), "feedback", r.PathValue("museum"))
	if err != nil {
		recordError(w, err)
		return
	}
	out := []map[string]any{}
	for _, x := range xs {
		v := feedbackOf(x)
		if v.Type != "review" || v.Status != "published" {
			continue
		}
		reply := ""
		if v.ReplyStatus == "published" {
			reply = v.Reply
		}
		out = append(out, map[string]any{"id": v.ID, "title": v.Title, "body": v.Body, "rating": v.Rating, "author_name": v.AuthorName, "created_at": v.CreatedAt, "reply": reply})
	}
	a, b := Window(len(out), p, l)
	JSON(w, 200, map[string]any{"items": out[a:b], "total": len(out), "page": p, "limit": l})
}
func (s *Server) ownFeedback(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, false)
	if !ok {
		return
	}
	x, err := s.Find(r.Context(), "feedback", r.PathValue("id"))
	if err != nil {
		recordError(w, err)
		return
	}
	v := feedbackOf(x)
	if v.UserID != c.UserID {
		Fail(w, 404, "not_found")
		return
	}
	if v.ReplyStatus != "published" {
		v.Reply = ""
		v.ReplyAuthor = ""
		v.ReplyAt = ""
	}
	JSON(w, 200, map[string]any{"feedback": v})
}
