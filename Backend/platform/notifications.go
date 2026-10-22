package platform

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

type Notification struct {
	Document
	Title  string `json:"title"`
	Type   string `json:"type"`
	Source string `json:"source"`
	Unread bool   `json:"unread"`
}

func notificationOf(x Record) Notification {
	var n Notification
	_ = json.Unmarshal([]byte(x.Body), &n)
	n.Document = x.Meta()
	return n
}
func (s *Server) notificationHandlers(m *http.ServeMux) {
	m.HandleFunc("GET /api/v1/notifications", s.notificationsList)
	m.HandleFunc("POST /api/v1/notifications/{id}/read", s.notificationRead)
	m.HandleFunc("POST /api/v1/notifications/read-all", s.notificationReadAll)
}
func (s *Server) syncNotifications(r *http.Request, museum, source, base string) error {
	var at int64
	var afterID string
	err := s.DB.QueryRowContext(r.Context(), s.Q(`SELECT at_time,event_id FROM source_cursors WHERE museum_id=? AND source=?`), museum, source).Scan(&at, &afterID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	// Replay a minute to include transactions committed out of timestamp order.
	// Upserts keep delivery idempotent, including after a process restart.
	if at > 60000 {
		at -= 60000
		afterID = ""
	}
	for batch := 0; batch < 10; batch++ {
		var feed struct {
			Events []Event `json:"events"`
		}
		u := fmt.Sprintf("%s/events?after=%d&after_id=%s", base, at, url.QueryEscape(afterID))
		if s.Fetch(r, u, &feed) != 200 {
			return fmt.Errorf("%s unavailable", source)
		}
		if len(feed.Events) == 0 {
			return nil
		}
		tx, err := s.DB.BeginTx(r.Context(), nil)
		if err != nil {
			return err
		}
		for _, event := range feed.Events {
			if event.MuseumID != museum {
				tx.Rollback()
				return fmt.Errorf("event scope mismatch")
			}
			id := source + "_" + event.ID
			n := Notification{Title: event.Title, Type: event.Type, Source: source}
			_, err = tx.ExecContext(r.Context(), s.Q(`INSERT INTO records(id,museum_id,kind,body,version,created_at,updated_at) VALUES(?,?,'notification',?,1,?,?) ON CONFLICT DO NOTHING`), id, museum, body(n), event.CreatedAt, event.CreatedAt)
			if err != nil {
				tx.Rollback()
				return err
			}
		}
		last := feed.Events[len(feed.Events)-1]
		_, err = tx.ExecContext(r.Context(), s.Q(`INSERT INTO source_cursors(museum_id,source,at_time,event_id) VALUES(?,?,?,?) ON CONFLICT(museum_id,source) DO UPDATE SET at_time=excluded.at_time,event_id=excluded.event_id WHERE source_cursors.at_time<excluded.at_time OR (source_cursors.at_time=excluded.at_time AND source_cursors.event_id<excluded.event_id)`), museum, source, last.CreatedAt, last.ID)
		if err != nil {
			tx.Rollback()
			return err
		}
		if err = tx.Commit(); err != nil {
			return err
		}
		at, afterID = last.CreatedAt, last.ID
		if len(feed.Events) < 100 {
			return nil
		}
	}
	return nil
}
func (s *Server) notificationsList(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	if id := r.Header.Get("X-User-ID"); id != "" && id != c.UserID {
		Fail(w, 403, "user_mismatch")
		return
	}
	p, l, ok := Page(w, r)
	if !ok {
		return
	}
	unread := r.URL.Query().Get("unread")
	if unread != "" && unread != "true" && unread != "false" {
		Fail(w, 400, "invalid_filter")
		return
	}
	unavailable := []string{}
	for _, source := range []struct{ name, base string }{{"route", s.RouteURL}, {"feedback", s.FeedbackURL}} {
		if err := s.syncNotifications(r, c.MuseumID, source.name, source.base); err != nil {
			unavailable = append(unavailable, source.name)
		}
	}
	xs, err := s.List(r.Context(), "notification", c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), s.Q(`SELECT notification_id FROM notification_reads WHERE user_id=?`), c.UserID)
	if err != nil {
		recordError(w, err)
		return
	}
	read := map[string]bool{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) != nil {
			rows.Close()
			Fail(w, 503, "storage_unavailable")
			return
		}
		read[id] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		recordError(w, err)
		return
	}
	out := []Notification{}
	count := 0
	for _, x := range xs {
		v := notificationOf(x)
		v.Unread = !read[v.ID]
		if v.Unread {
			count++
		}
		if unread == "true" && !v.Unread {
			continue
		}
		out = append(out, v)
	}
	a, b := Window(len(out), p, l)
	JSON(w, 200, map[string]any{"items": out[a:b], "total": len(out), "unread_count": count, "page": p, "limit": l, "unavailable_sources": unavailable})
}
func (s *Server) notificationRead(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	x, err := s.Get(r.Context(), "notification", r.PathValue("id"), c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	_, err = s.DB.ExecContext(r.Context(), s.Q(`INSERT INTO notification_reads(notification_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING`), x.ID, c.UserID)
	if err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]bool{"read": true})
}
func (s *Server) notificationReadAll(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	_, err := s.DB.ExecContext(r.Context(), s.Q(`INSERT INTO notification_reads(notification_id,user_id) SELECT id,? FROM records WHERE museum_id=? AND kind='notification' ON CONFLICT DO NOTHING`), c.UserID, c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	JSON(w, 200, map[string]bool{"read": true})
}
