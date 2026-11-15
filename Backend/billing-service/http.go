package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type service struct {
	db                     *sql.DB
	bank                   *tochka
	plans                  []plan
	authURL, secret        string
	termsURL, termsVersion string
	authClient             *http.Client
}

type museumActor struct {
	ID     string `json:"id"`
	Museum string `json:"museum_id"`
	Role   string `json:"role"`
	Status string `json:"status"`
	Email  string `json:"email"`
}

func (s *service) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.PingContext(r.Context()); err != nil {
			httpError(w, 503, "service_unavailable")
			return
		}
		w.WriteHeader(200)
	})
	mux.HandleFunc("GET /api/v1/billing/subscription", s.museumOnly(s.summary))
	mux.HandleFunc("POST /api/v1/billing/orders", s.museumOnly(s.checkout))
	mux.HandleFunc("GET /api/v1/billing/orders/{id}", s.museumOnly(s.museumOrder))
	mux.HandleFunc("POST /api/v1/billing/webhooks/tochka", s.webhook)
	mux.HandleFunc("GET /internal/admin/payments", s.adminOnly(s.adminList))
	mux.HandleFunc("GET /internal/admin/payments/{id}", s.adminOnly(s.adminDetail))
	mux.HandleFunc("POST /internal/admin/payments/{id}/recheck", s.adminOnly(s.adminRecheck))
	mux.HandleFunc("POST /internal/admin/payments/{id}/note", s.adminOnly(s.adminNote))
	mux.HandleFunc("POST /internal/admin/payments/{id}/resolve-missing", s.adminOnly(s.adminResolveMissing))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
		mux.ServeHTTP(w, r)
	})
}

func report(action string, err error) {
	// Bank responses, tokens, checkout links and customer data never go to logs.
	log.Printf("billing %s failed (%T)", action, err)
}

func reply(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(value)
}

func httpError(w http.ResponseWriter, status int, code string) {
	reply(w, status, map[string]any{"error": map[string]string{"code": code, "message": code}})
}

func internalError(w http.ResponseWriter, action string, err error) {
	report(action, err)
	httpError(w, 503, "service_unavailable")
}

func readJSON(r *http.Request, value any) error {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(value); err != nil {
		return err
	}
	if !errors.Is(d.Decode(new(any)), io.EOF) {
		return errors.New("single request object required")
	}
	return nil
}

func (s *service) museumOnly(next func(http.ResponseWriter, *http.Request, museumActor)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			httpError(w, 401, "unauthorized")
			return
		}
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, s.authURL+"/auth/authorize-museum", nil)
		if err != nil {
			internalError(w, "auth request", err)
			return
		}
		req.Header.Set("Authorization", header)
		response, err := s.authClient.Do(req)
		if err != nil {
			internalError(w, "auth lookup", err)
			return
		}
		defer response.Body.Close()
		switch response.StatusCode {
		case 401:
			httpError(w, 401, "unauthorized")
			return
		case 403:
			httpError(w, 403, "forbidden")
			return
		case 200:
		default:
			httpError(w, 503, "service_unavailable")
			return
		}
		var result struct{ User museumActor }
		if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&result); err != nil {
			internalError(w, "auth response", err)
			return
		}
		actor := result.User
		if actor.ID == "" || actor.Museum == "" || actor.Role != "methodist" || !strings.EqualFold(actor.Status, "active") {
			httpError(w, 403, "forbidden")
			return
		}
		next(w, r, actor)
	}
}

func (s *service) adminOnly(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actor := r.Header.Get("X-Billing-Admin")
		if actor == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Service-Secret")), []byte(s.secret)) != 1 {
			httpError(w, 403, "forbidden")
			return
		}
		next(w, r, actor)
	}
}

func (s *service) summary(w http.ResponseWriter, r *http.Request, actor museumActor) {
	var end *time.Time
	err := s.db.QueryRowContext(r.Context(), "SELECT ends_at FROM billing_subscriptions WHERE museum_id=$1", actor.Museum).Scan(&end)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		internalError(w, "subscription", err)
		return
	}
	orders, err := s.listPayments(r.Context(), actor.Museum, "", "", 15, 0)
	if err != nil {
		internalError(w, "order history", err)
		return
	}
	for i := range orders {
		orders[i] = orders[i].forMuseum()
	}
	status := "none"
	if end != nil {
		status = "expired"
		if end.After(time.Now()) {
			status = "active"
		}
	}
	reply(w, 200, map[string]any{
		"checkout_enabled": s.bank != nil, "plans": s.plans, "subscription": map[string]any{"status": status, "ends_at": end},
		"orders":    orders,
		"terms_url": s.termsURL, "terms_version": s.termsVersion,
	})
}

func (s *service) checkout(w http.ResponseWriter, r *http.Request, actor museumActor) {
	if s.bank == nil {
		httpError(w, 503, "checkout_unavailable")
		return
	}
	var input struct {
		Plan           string `json:"plan_id"`
		RequestID      string `json:"request_id"`
		ExpectedAmount int64  `json:"expected_amount_kopecks"`
		Accepted       bool   `json:"terms_accepted"`
		TermsVersion   string `json:"terms_version"`
	}
	if readJSON(r, &input) != nil || !uuidPattern.MatchString(input.RequestID) || !input.Accepted {
		httpError(w, 400, "bad_request")
		return
	}
	var selected plan
	for _, p := range s.plans {
		if p.ID == input.Plan {
			selected = p
			break
		}
	}
	if selected.ID == "" || selected.Amount != input.ExpectedAmount || input.TermsVersion != s.termsVersion {
		httpError(w, 409, "offer_changed")
		return
	}
	address, err := mail.ParseAddress(actor.Email)
	if err != nil || address.Address != actor.Email {
		httpError(w, 409, "receipt_email_required")
		return
	}
	order, created, err := s.reserve(r.Context(), actor, selected, input.RequestID)
	if err != nil {
		internalError(w, "reserve checkout", err)
		return
	}
	if order.Plan != selected.ID {
		httpError(w, 409, "pending_order")
		return
	}
	if created {
		result, createErr := s.bank.create(r.Context(), order, actor.Email)
		// Preserve the result even when the browser disconnects after the bank call.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 3*time.Second)
		defer cancel()
		if err = s.recordCreate(ctx, order, result, createErr); err != nil {
			internalError(w, "save checkout", err)
			return
		}
		order, err = s.getPayment(ctx, order.ID, actor.Museum)
		if err != nil {
			internalError(w, "read checkout", err)
			return
		}
	}
	reply(w, 200, order.forMuseum())
}

func (s *service) museumOrder(w http.ResponseWriter, r *http.Request, actor museumActor) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		httpError(w, 404, "not_found")
		return
	}
	p, err := s.getPayment(r.Context(), id, actor.Museum)
	if orderError(w, err) {
		return
	}
	reply(w, 200, p.forMuseum())
}

func orderError(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, sql.ErrNoRows):
		httpError(w, 404, "not_found")
	case errors.Is(err, errOperationMismatch):
		httpError(w, 409, "operation_mismatch")
	case errors.Is(err, errOperationUnknown):
		httpError(w, 409, "operation_id_required")
	default:
		internalError(w, "order operation", err)
	}
	return true
}

func (s *service) webhook(w http.ResponseWriter, r *http.Request) {
	if s.bank == nil {
		httpError(w, 503, "checkout_unavailable")
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		httpError(w, 400, "bad_request")
		return
	}
	event, err := s.bank.verifiedEvent(r.Context(), strings.TrimSpace(string(body)))
	if errors.Is(err, errInvalidWebhook) {
		httpError(w, 403, "invalid_webhook")
		return
	}
	if err != nil {
		internalError(w, "webhook verification", err)
		return
	}
	if event.Type != "acquiringInternetPayment" || !uuidPattern.MatchString(event.OperationID) {
		w.WriteHeader(200)
		return
	}
	orderID := event.OrderID
	if !uuidPattern.MatchString(orderID) {
		err = s.db.QueryRowContext(r.Context(), "SELECT id::text FROM billing_orders WHERE operation_id=$1", event.OperationID).Scan(&orderID)
		if errors.Is(err, sql.ErrNoRows) {
			w.WriteHeader(200)
			return
		}
		if err != nil {
			internalError(w, "webhook order lookup", err)
			return
		}
	}
	err = s.refreshPayment(r.Context(), orderID, event.OperationID, "tochka", "")
	if err != nil && !errors.Is(err, sql.ErrNoRows) && !errors.Is(err, errOperationMismatch) {
		internalError(w, "webhook reconcile", err)
		return
	}
	w.WriteHeader(200)
}

func (s *service) adminList(w http.ResponseWriter, r *http.Request, _ string) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	search := strings.TrimSpace(q.Get("q"))
	status := q.Get("status")
	if page < 0 || page > 10_000 || len(search) > 128 {
		httpError(w, 400, "bad_request")
		return
	}
	const size = 25
	items, err := s.listPayments(r.Context(), "", status, search, size+1, page*size)
	if err != nil {
		internalError(w, "admin list", err)
		return
	}
	more := len(items) > size
	if more {
		items = items[:size]
	}
	for i := range items {
		items[i].Link = ""
	}
	reply(w, 200, map[string]any{"orders": items, "more": more, "checkout_enabled": s.bank != nil})
}

func (s *service) adminDetail(w http.ResponseWriter, r *http.Request, _ string) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		httpError(w, 404, "not_found")
		return
	}
	p, err := s.getPayment(r.Context(), id, "")
	if orderError(w, err) {
		return
	}
	p.Link = ""
	rows, err := s.db.QueryContext(r.Context(),
		"SELECT actor_id,action,note,created_at FROM billing_audit WHERE order_id=$1 ORDER BY id DESC LIMIT 50", id)
	if err != nil {
		internalError(w, "admin history", err)
		return
	}
	defer rows.Close()
	history := []auditEvent{}
	for rows.Next() {
		var event auditEvent
		if err := rows.Scan(&event.Actor, &event.Action, &event.Note, &event.At); err != nil {
			internalError(w, "admin history row", err)
			return
		}
		history = append(history, event)
	}
	if err = rows.Err(); err != nil {
		internalError(w, "admin history rows", err)
		return
	}
	rows.Close()
	var period struct {
		StartsAt time.Time `json:"starts_at"`
		EndsAt   time.Time `json:"ends_at"`
	}
	var appliedPeriod any
	err = s.db.QueryRowContext(r.Context(), "SELECT starts_at,ends_at FROM billing_grants WHERE order_id=$1", id).
		Scan(&period.StartsAt, &period.EndsAt)
	if err == nil {
		appliedPeriod = period
	} else if !errors.Is(err, sql.ErrNoRows) {
		internalError(w, "admin paid period", err)
		return
	}
	reply(w, 200, map[string]any{"order": p, "history": history, "period": appliedPeriod})
}

func validReason(reason string) bool {
	size := utf8.RuneCountInString(strings.TrimSpace(reason))
	return size >= 3 && size <= 500 && !strings.ContainsRune(reason, 0)
}

func (s *service) adminRecheck(w http.ResponseWriter, r *http.Request, actor string) {
	if s.bank == nil {
		httpError(w, 503, "checkout_unavailable")
		return
	}
	id := r.PathValue("id")
	var input struct {
		Reason    string `json:"reason"`
		Operation string `json:"operation_id"`
	}
	if !uuidPattern.MatchString(id) || readJSON(r, &input) != nil || !validReason(input.Reason) ||
		(input.Operation != "" && !uuidPattern.MatchString(input.Operation)) {
		httpError(w, 400, "bad_request")
		return
	}
	if orderError(w, s.refreshPayment(r.Context(), id, input.Operation, actor, strings.TrimSpace(input.Reason))) {
		return
	}
	s.adminDetail(w, r, actor)
}

func (s *service) adminNote(w http.ResponseWriter, r *http.Request, actor string) {
	id := r.PathValue("id")
	var input struct {
		Reason string `json:"reason"`
	}
	if !uuidPattern.MatchString(id) || readJSON(r, &input) != nil || !validReason(input.Reason) {
		httpError(w, 400, "bad_request")
		return
	}
	ctx := r.Context()
	if _, err := s.getPayment(ctx, id, ""); orderError(w, err) {
		return
	}
	_, err := s.db.ExecContext(ctx, "INSERT INTO billing_audit (order_id,actor_id,action,note) VALUES ($1,$2,'note',$3)",
		id, actor, strings.TrimSpace(input.Reason))
	if err != nil {
		internalError(w, "save admin note", err)
		return
	}
	s.adminDetail(w, r, actor)
}

func (s *service) adminResolveMissing(w http.ResponseWriter, r *http.Request, actor string) {
	id := r.PathValue("id")
	var input struct {
		Reason string `json:"reason"`
	}
	if !uuidPattern.MatchString(id) || readJSON(r, &input) != nil || !validReason(input.Reason) {
		httpError(w, 400, "bad_request")
		return
	}
	ctx := r.Context()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		internalError(w, "resolve missing operation", err)
		return
	}
	defer tx.Rollback()
	var orderID string
	err = tx.QueryRowContext(ctx, `UPDATE billing_orders
		SET status='failed', issue='', updated_at=now()
		WHERE id=$1 AND status='creating' AND operation_id IS NULL AND created_at<now()-interval '45 minutes'
		RETURNING id::text`, id).Scan(&orderID)
	if errors.Is(err, sql.ErrNoRows) {
		httpError(w, 409, "cannot_close_order")
		return
	}
	if err == nil {
		err = audit(ctx, tx, orderID, actor, "operation_not_found", strings.TrimSpace(input.Reason))
	}
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		internalError(w, "resolve missing operation", err)
		return
	}
	s.adminDetail(w, r, actor)
}
