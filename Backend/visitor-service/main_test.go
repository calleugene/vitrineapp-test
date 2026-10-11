package main

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestService(t *testing.T) *service {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := initSchema(context.Background(), db, "sqlite"); err != nil {
		t.Fatal(err)
	}
	return &service{db: db, driver: "sqlite", tokenSecret: strings.Repeat("s", 32), now: func() time.Time { return time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC) }}
}

func TestLinkMovesGuestProgressToStableVisitor(t *testing.T) {
	s := newTestService(t)
	ctx := context.Background()
	guestID, err := randomID("gst")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO visitors (id, user_id, is_guest, guest_link_token_hash, merged_into, created_at, linked_at) VALUES (?, NULL, ?, ?, NULL, ?, NULL)`, guestID, true, tokenHash("guest-secret"), s.now()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO visitor_artifact_status (visitor_id, artifact_id, found, is_favorite, updated_at) VALUES (?, ?, ?, ?, ?)`, guestID, "artifact-1", true, false, s.now()); err != nil {
		t.Fatal(err)
	}

	linked, err := s.link(ctx, "usr_visitor", guestID, "guest-secret")
	if err != nil {
		t.Fatal(err)
	}
	if linked.IsGuest || !strings.HasPrefix(linked.ID, "acc_") {
		t.Fatalf("unexpected linked visitor: %+v", linked)
	}
	var found bool
	if err := s.db.QueryRowContext(ctx, `SELECT found FROM visitor_artifact_status WHERE visitor_id = ? AND artifact_id = ?`, linked.ID, "artifact-1").Scan(&found); err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("guest progress was not moved")
	}
	if _, err := s.link(ctx, "usr_other", guestID, "guest-secret"); !errors.Is(err, errGuestAlreadyLinked) {
		t.Fatalf("second link error = %v", err)
	}
}

func TestLinkRejectsWrongGuestSecret(t *testing.T) {
	s := newTestService(t)
	ctx := context.Background()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO visitors (id, user_id, is_guest, guest_link_token_hash, merged_into, created_at, linked_at) VALUES (?, NULL, ?, ?, NULL, ?, NULL)`, "gst_test", true, tokenHash("correct"), s.now()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.link(ctx, "usr_visitor", "gst_test", "wrong"); !errors.Is(err, errInvalidGuestToken) {
		t.Fatalf("link error = %v", err)
	}
}
