package platform

import (
	"net/http"
	"sort"
	"time"
)

type metricFact struct {
	At              int64
	Kind, ID, Title string
	Rating          int
	Completed       bool
	Duration        float64
}

func metricRange(r *http.Request) (time.Time, time.Time, *time.Location, bool) {
	q := r.URL.Query()
	loc := time.UTC
	var err error
	if zone := q.Get("timezone"); zone != "" {
		loc, err = time.LoadLocation(zone)
		if err != nil {
			return time.Time{}, time.Time{}, nil, false
		}
	}
	fromText, toText := q.Get("from"), q.Get("to")
	if fromText != "" || toText != "" {
		if q.Get("period") != "" {
			return time.Time{}, time.Time{}, nil, false
		}
		from, e1 := time.Parse(time.RFC3339, fromText)
		to, e2 := time.Parse(time.RFC3339, toText)
		if e1 != nil || e2 != nil || !to.After(from) || to.Sub(from) > 367*24*time.Hour {
			return time.Time{}, time.Time{}, nil, false
		}
		return from.UTC(), to.UTC(), loc, true
	}
	now := time.Now().In(loc)
	from := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	var to time.Time
	switch q.Get("period") {
	case "day":
		to = from.AddDate(0, 0, 1)
	case "week":
		from = from.AddDate(0, 0, -(int(from.Weekday())+6)%7)
		to = from.AddDate(0, 0, 7)
	case "", "month":
		from = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		to = from.AddDate(0, 1, 0)
	case "year":
		from = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		to = from.AddDate(1, 0, 0)
	default:
		return time.Time{}, time.Time{}, nil, false
	}
	return from.UTC(), to.UTC(), loc, true
}
func (s *Server) sourceStats(w http.ResponseWriter, r *http.Request) {
	c, ok := s.Auth(w, r, true)
	if !ok {
		return
	}
	from, to, loc, ok := metricRange(r)
	if !ok {
		Fail(w, 400, "invalid_range")
		return
	}
	view := r.PathValue("view")
	if !contains([]string{"summary", "chart", "breakdown", "ranked", "bars"}, view) {
		Fail(w, 404, "not_found")
		return
	}
	facts := []metricFact{}
	kind := "feedback"
	titles := map[string]string{}
	if s.Kind == "route" {
		kind = "visit"
		routes, err := s.List(r.Context(), "route", c.MuseumID)
		if err != nil {
			recordError(w, err)
			return
		}
		for _, x := range routes {
			titles[x.ID] = routeOf(x).Title
		}
	}
	xs, err := s.List(r.Context(), kind, c.MuseumID)
	if err != nil {
		recordError(w, err)
		return
	}
	for _, x := range xs {
		if x.Created < from.UnixMilli() || x.Created >= to.UnixMilli() {
			continue
		}
		if kind == "visit" {
			v := visitOf(x)
			completed := v.Completed && v.CompletedAt < to.UnixMilli()
			duration := 0.0
			if completed {
				duration = float64(v.CompletedAt-v.StartedAt) / 60000
			}
			facts = append(facts, metricFact{At: x.Created, Kind: "started", ID: v.RouteID, Title: titles[v.RouteID], Completed: completed, Duration: duration})
		} else {
			v := feedbackOf(x)
			rating := 0
			if v.Type == "review" && v.Status == "published" {
				rating = v.Rating
			}
			facts = append(facts, metricFact{At: x.Created, Kind: v.Type, ID: v.ArtifactID, Title: v.PublicCode, Rating: rating})
		}
	}
	meta := map[string]any{"from": from.Format(time.RFC3339), "to": to.Format(time.RFC3339), "timezone": loc.String(), "generated_at": time.Now().UTC().Format(time.RFC3339), "scope": "created_in_range"}
	title := "Сообщения посетителей"
	if kind == "visit" {
		title = "Сессии маршрутов"
	}
	switch view {
	case "summary":
		cards := []map[string]any{{"code": kind + "_count", "title": title, "value": len(facts), "delta": nil}}
		completed, ratingCount, ratingSum := 0, 0, 0
		duration := 0.0
		for _, f := range facts {
			if f.Completed {
				completed++
				duration += f.Duration
			}
			if f.Rating > 0 {
				ratingCount++
				ratingSum += f.Rating
			}
		}
		if kind == "visit" {
			var avg any
			if completed > 0 {
				avg = duration / float64(completed)
			}
			cards = append(cards, map[string]any{"code": "completed_sessions", "title": "Завершённые сессии маршрутов", "value": completed, "delta": nil}, map[string]any{"code": "avg_completed_minutes", "title": "Среднее время завершённого маршрута", "value": avg, "unit": "minutes", "delta": nil})
		} else {
			var avg any
			if ratingCount > 0 {
				avg = float64(ratingSum) / float64(ratingCount)
			}
			cards = append(cards, map[string]any{"code": "rating", "title": "Оценка по опубликованным отзывам", "value": avg, "delta": nil})
		}
		JSON(w, 200, map[string]any{"summary": cards, "meta": meta})
	case "chart":
		counts := map[string]int{}
		for _, f := range facts {
			counts[time.UnixMilli(f.At).In(loc).Format("2006-01-02")]++
		}
		labels, values := []string{}, []int{}
		buckets := []map[string]string{}
		for start := from; start.Before(to); {
			local := start.In(loc)
			next := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, loc).UTC()
			if next.After(to) {
				next = to
			}
			labels = append(labels, local.Format("02.01"))
			values = append(values, counts[local.Format("2006-01-02")])
			buckets = append(buckets, map[string]string{"from": start.Format(time.RFC3339), "to": next.Format(time.RFC3339)})
			start = next
		}
		JSON(w, 200, map[string]any{"labels": labels, "values": values, "buckets": buckets, "chart_label": title, "meta": meta})
	case "breakdown":
		counts := map[string]int{}
		if kind == "visit" {
			counts = map[string]int{"Завершены": 0, "Не завершены": 0}
			for _, f := range facts {
				key := "Не завершены"
				if f.Completed {
					key = "Завершены"
				}
				counts[key]++
			}
		} else {
			counts = map[string]int{"Отзывы": 0, "Вопросы": 0, "Предложения": 0}
			for _, f := range facts {
				counts[map[string]string{"review": "Отзывы", "question": "Вопросы", "suggestion": "Предложения"}[f.Kind]]++
			}
		}
		keys := []string{}
		for key := range counts {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		items := []map[string]any{}
		for _, key := range keys {
			percent := 0.0
			if len(facts) > 0 {
				percent = 100 * float64(counts[key]) / float64(len(facts))
			}
			items = append(items, map[string]any{"label": key, "count": counts[key], "value": percent})
		}
		breakdownTitle := "Типы сообщений"
		if kind == "visit" {
			breakdownTitle = "Завершение сессий маршрутов"
		}
		JSON(w, 200, map[string]any{"title": breakdownTitle, "items": items, "meta": meta})
	default:
		counts := map[string]int{}
		labels := map[string]string{}
		for _, f := range facts {
			counts[f.ID]++
			labels[f.ID] = f.Title
		}
		ids := []string{}
		for id := range counts {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool {
			if counts[ids[i]] == counts[ids[j]] {
				return ids[i] < ids[j]
			}
			return counts[ids[i]] > counts[ids[j]]
		})
		items := []map[string]any{}
		for i, id := range ids {
			share := 0.0
			if len(facts) > 0 {
				share = 100 * float64(counts[id]) / float64(len(facts))
			}
			items = append(items, map[string]any{"id": id, "rank": i + 1, "title": labels[id], "label": labels[id], "views": counts[id], "count": counts[id], "share": share, "delta": nil})
		}
		sectionTitle := "Экспонаты по сообщениям"
		if kind == "visit" {
			sectionTitle = "Маршруты по сессиям"
		}
		JSON(w, 200, map[string]any{"title": sectionTitle, "items": items, "meta": meta})
	}
}
