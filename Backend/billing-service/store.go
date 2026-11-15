package main

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

const paymentFields = "id::text, museum_id, plan_id, months, amount_kopecks, status, bank_status, coalesce(operation_id,''), checkout_url, issue, merchant_id, customer_code, created_at, paid_at"

type payment struct {
	ID          string     `json:"id"`
	Museum      string     `json:"museum_id"`
	Plan        string     `json:"plan_id"`
	Months      int        `json:"months"`
	Amount      int64      `json:"amount_kopecks"`
	Status      string     `json:"status"`
	BankStatus  string     `json:"bank_status,omitempty"`
	OperationID string     `json:"operation_id,omitempty"`
	Link        string     `json:"checkout_url,omitempty"`
	Issue       string     `json:"issue,omitempty"`
	Merchant    string     `json:"-"`
	Customer    string     `json:"-"`
	CreatedAt   time.Time  `json:"created_at"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
}

type scanner interface{ Scan(...any) error }

func scanPayment(row scanner) (payment, error) {
	var p payment
	err := row.Scan(&p.ID, &p.Museum, &p.Plan, &p.Months, &p.Amount, &p.Status, &p.BankStatus, &p.OperationID,
		&p.Link, &p.Issue, &p.Merchant, &p.Customer, &p.CreatedAt, &p.PaidAt)
	return p, err
}

func (p payment) forMuseum() payment {
	p.OperationID = ""
	p.BankStatus = ""
	if p.Issue != "" {
		p.Issue = "requires_review"
	}
	if p.Status != "pending" || p.Issue != "" {
		p.Link = ""
	}
	return p
}

func (s *service) reserve(ctx context.Context, actor museumActor, p plan, requestID string) (payment, bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return payment{}, false, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 749113))", actor.Museum); err != nil {
		return payment{}, false, err
	}
	existing, err := scanPayment(tx.QueryRowContext(ctx, "SELECT "+paymentFields+`
		FROM billing_orders WHERE museum_id=$1 AND (id=(SELECT order_id FROM billing_checkout_requests
			WHERE museum_id=$1 AND request_id=$2) OR status IN ('creating','pending'))
		ORDER BY (id=(SELECT order_id FROM billing_checkout_requests
			WHERE museum_id=$1 AND request_id=$2)) DESC NULLS LAST LIMIT 1`, actor.Museum, requestID))
	if err == nil {
		if existing.Plan == p.ID {
			if err := bindCheckoutRequest(ctx, tx, actor.Museum, requestID, existing.ID); err != nil {
				return payment{}, false, err
			}
		}
		return existing, false, tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return payment{}, false, err
	}
	created, err := scanPayment(tx.QueryRowContext(ctx, "INSERT INTO billing_orders "+
		"(id,museum_id,user_id,plan_id,months,amount_kopecks,request_id,terms_version,merchant_id,customer_code,status) "+
		"VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,'creating') RETURNING "+paymentFields,
		actor.Museum, actor.ID, p.ID, p.Months, p.Amount, requestID, s.termsVersion, s.bank.merchant, s.bank.customer))
	if err != nil {
		return payment{}, false, err
	}
	if err := bindCheckoutRequest(ctx, tx, actor.Museum, requestID, created.ID); err != nil {
		return payment{}, false, err
	}
	return created, true, tx.Commit()
}

func bindCheckoutRequest(ctx context.Context, tx *sql.Tx, museum, requestID, orderID string) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO billing_checkout_requests (museum_id, request_id, order_id)
		VALUES ($1,$2,$3) ON CONFLICT (museum_id, request_id) DO NOTHING`, museum, requestID, orderID)
	return err
}

func (s *service) getPayment(ctx context.Context, id, museum string) (payment, error) {
	return scanPayment(s.db.QueryRowContext(ctx, "SELECT "+paymentFields+
		" FROM billing_orders WHERE id=$1 AND ($2='' OR museum_id=$2)", id, museum))
}

func (s *service) listPayments(ctx context.Context, museum, status, search string, limit, offset int) ([]payment, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+paymentFields+`
		FROM billing_orders WHERE ($1='' OR museum_id=$1)
		AND ($2='' OR status=$2 OR ($2='review' AND issue<>'') OR
		    ($2='review' AND status='creating' AND created_at<now()-interval '1 minute'))
		AND ($3='' OR museum_id=$3 OR id::text=$3 OR operation_id=$3)
		ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, museum, status, search, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []payment{}
	for rows.Next() {
		p, err := scanPayment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

func (s *service) recordCreate(ctx context.Context, p payment, result operation, createErr error) error {
	status, issue := "creating", "create_unknown"
	var operationID any
	var link string
	switch {
	case errors.Is(createErr, errBankRejected):
		status, issue = "failed", "create_rejected"
	case createErr == nil && uuidPattern.MatchString(result.ID):
		operationID = result.ID
		status, issue = "pending", "checkout_link_invalid"
		if s.bank.safeLink(result.Link) {
			link, issue = result.Link, ""
		}
	}
	_, err := s.db.ExecContext(ctx, `UPDATE billing_orders
		SET status=$2, issue=$3, operation_id=$4, checkout_url=$5, updated_at=now(),
		next_check_at=now()+interval '20 seconds' WHERE id=$1 AND status='creating' AND operation_id IS NULL`,
		p.ID, status, issue, operationID, link)
	return err
}

type auditEvent struct {
	Actor  string    `json:"actor_id"`
	Action string    `json:"action"`
	Note   string    `json:"note"`
	At     time.Time `json:"created_at"`
}

func audit(ctx context.Context, tx *sql.Tx, id, actor, action, note string) error {
	_, err := tx.ExecContext(ctx, "INSERT INTO billing_audit (order_id,actor_id,action,note) VALUES ($1,$2,$3,$4)",
		id, actor, action, note)
	return err
}

var errOperationMismatch = errors.New("bank operation does not match order")
var errOperationUnknown = errors.New("bank operation is not linked")

func (s *service) refreshPayment(ctx context.Context, id, operationID, actor, reason string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Lock before querying the bank so an older response cannot overwrite a newer result.
	p, err := scanPayment(tx.QueryRowContext(ctx, "SELECT "+paymentFields+" FROM billing_orders WHERE id=$1 FOR UPDATE", id))
	if err != nil {
		return err
	}
	if operationID == "" {
		operationID = p.OperationID
	}
	if operationID == "" {
		return errOperationUnknown
	}
	if p.OperationID != "" && p.OperationID != operationID {
		return errOperationMismatch
	}
	info, err := s.bank.lookup(ctx, operationID)
	if err != nil {
		return err
	}
	bankAmount, amountErr := amountKopecks(info.Amount)
	if info.OrderID != p.ID || info.Customer != p.Customer || info.Merchant != p.Merchant ||
		amountErr != nil || bankAmount != p.Amount {
		if (actor == "worker" || actor == "tochka") && p.OperationID != "" {
			if _, err = tx.ExecContext(ctx, "UPDATE billing_orders SET issue='operation_mismatch',updated_at=now(),next_check_at=now()+interval '1 hour' WHERE id=$1", p.ID); err != nil {
				return err
			}
			if p.Issue != "operation_mismatch" {
				if err = audit(ctx, tx, id, actor, "review", "operation_mismatch"); err != nil {
					return err
				}
			}
			return tx.Commit()
		}
		return errOperationMismatch
	}

	status := p.Status
	var issue string
	nextCheck := time.Now().Add(time.Minute)
	if p.Status == "paid" || p.Status == "refunded" {
		nextCheck = time.Now().Add(24 * time.Hour)
	}
	switch info.Status {
	case "APPROVED":
		if status != "refunded" {
			status = "paid"
			if p.PaidAt == nil {
				at, _ := time.Parse(time.RFC3339, info.PaidAt)
				if at.IsZero() {
					at = time.Now()
				}
				if err = applyPeriod(ctx, tx, p, at.UTC()); err != nil {
					return err
				}
				p.PaidAt = &at
			}
		} else {
			issue = "bank_status_conflict"
		}
		nextCheck = time.Now().Add(24 * time.Hour)
	case "EXPIRED":
		if status == "creating" || status == "pending" {
			status = "expired"
		} else if status == "paid" {
			issue = "bank_status_conflict"
		}
	case "CREATED", "WAIT_FULL_PAYMENT", "AUTHORIZED":
		if status == "creating" {
			status = "pending"
		} else if status != "pending" {
			issue = "bank_status_conflict"
		}
	case "REFUNDED":
		status, issue = "refunded", "refund_review"
	case "REFUNDED_PARTIALLY", "ON-REFUND":
		issue = "refund_review"
	default:
		issue = "unknown_bank_status"
	}
	link := p.Link
	if s.bank.safeLink(info.Link) {
		link = info.Link
	}
	if status == "pending" && issue == "" && link == "" {
		issue = "checkout_link_invalid"
	}
	if status == "pending" && issue == "" && time.Since(p.CreatedAt) > (bankCheckoutTTLMinutes+15)*time.Minute {
		issue = "bank_status_overdue"
	}
	if status == "pending" && issue != "" {
		nextCheck = time.Now().Add(10 * time.Minute)
	}
	if _, err = tx.ExecContext(ctx, `UPDATE billing_orders SET operation_id=$2, status=$3, bank_status=$4,
		checkout_url=$5, issue=$6, paid_at=$7, updated_at=now(), next_check_at=$8 WHERE id=$1`,
		id, operationID, status, info.Status, link, issue, p.PaidAt, nextCheck); err != nil {
		return err
	}
	if actor != "worker" && actor != "tochka" {
		if err = audit(ctx, tx, id, actor, "recheck", reason); err != nil {
			return err
		}
	}
	if p.Status != status || p.BankStatus != info.Status || p.Issue != issue || p.OperationID != operationID {
		if err = audit(ctx, tx, id, actor, "bank_status", strings.TrimSpace(info.Status+" "+issue)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func applyPeriod(ctx context.Context, tx *sql.Tx, p payment, at time.Time) error {
	if _, err := tx.ExecContext(ctx, `INSERT INTO billing_subscriptions (museum_id, ends_at)
		VALUES ($1,$2) ON CONFLICT (museum_id) DO NOTHING`, p.Museum, at); err != nil {
		return err
	}
	var currentEnd time.Time
	if err := tx.QueryRowContext(ctx, "SELECT ends_at FROM billing_subscriptions WHERE museum_id=$1 FOR UPDATE", p.Museum).
		Scan(&currentEnd); err != nil {
		return err
	}
	start := at
	if currentEnd.After(start) {
		start = currentEnd
	}
	end := addMonths(start.UTC(), p.Months)
	if _, err := tx.ExecContext(ctx, "INSERT INTO billing_grants (order_id,museum_id,starts_at,ends_at) VALUES ($1,$2,$3,$4)",
		p.ID, p.Museum, start, end); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, "UPDATE billing_subscriptions SET ends_at=$2 WHERE museum_id=$1", p.Museum, end)
	return err
}

func addMonths(start time.Time, months int) time.Time {
	y, m, d := start.Date()
	last := time.Date(y, m+time.Month(months)+1, 0, 0, 0, 0, 0, start.Location()).Day()
	if d > last {
		d = last
	}
	return time.Date(y, m+time.Month(months), d, start.Hour(), start.Minute(), start.Second(), start.Nanosecond(), start.Location())
}

func (s *service) reconcileLoop(ctx context.Context) {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.reconcileDue(ctx)
		}
	}
}

func (s *service) reconcileDue(ctx context.Context) {
	rows, err := s.db.QueryContext(ctx, `SELECT id::text FROM billing_orders WHERE operation_id IS NOT NULL
		AND next_check_at <= now() AND (status='pending' OR
		(status='paid' AND paid_at > now()-interval '120 days')) ORDER BY next_check_at LIMIT 12`)
	if err != nil {
		report("reconcile query", err)
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			break
		}
		ids = append(ids, id)
	}
	if errors.Join(err, rows.Err(), rows.Close()) != nil {
		report("reconcile rows", errors.New("could not read due orders"))
		return
	}
	for _, id := range ids {
		if ctx.Err() != nil {
			return
		}
		if err := s.refreshPayment(ctx, id, "", "worker", ""); err != nil {
			report("reconcile order", err)
			_, _ = s.db.ExecContext(ctx, `UPDATE billing_orders SET next_check_at=now()+interval '2 minutes'
				WHERE id=$1 AND next_check_at<=now()`, id)
		}
	}
}
