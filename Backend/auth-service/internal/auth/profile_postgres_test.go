package auth

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresProfileRepository(t *testing.T) {
	dsn := os.Getenv("AUTH_PROFILE_TEST_DSN")
	if dsn == "" {
		t.Skip("AUTH_PROFILE_TEST_DSN must point to an isolated test database")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err = InitSchema(ctx, db, "pgx"); err != nil {
		t.Fatal(err)
	}
	if err = InitSchema(ctx, db, "pgx"); err != nil {
		t.Fatal(err)
	}
	repo := NewPostgresRepository(db)
	user := createTestUser(t, repo, "postgres-profile", "methodist")
	now := time.Now().UTC().Truncate(time.Second)
	if err = repo.RotateMuseumCode(ctx, "second-museum", "test-hash", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err = repo.JoinMuseum(ctx, user.ID, "second-museum", "test-hash", now); err != nil {
		t.Fatal(err)
	}
	if err = repo.JoinMuseum(ctx, user.ID, "second-museum", "test-hash", now); err != ErrAlreadyJoined {
		t.Fatal(err)
	}
	memberships, err := repo.MuseumMemberships(ctx, user.ID)
	if err != nil || len(memberships) != 2 {
		t.Fatalf("memberships: %+v, %v", memberships, err)
	}
	if err = repo.SetActiveMuseum(ctx, user.ID, "second-museum"); err != nil {
		t.Fatal(err)
	}
	if err = repo.SaveEmailChange(ctx, user.ID, "changed@example.test", "email-hash", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err = repo.ConfirmEmailChange(ctx, user.ID, "email-hash", now); err != nil {
		t.Fatal(err)
	}
	if err = repo.TransitionAccount(ctx, user.ID, false, now); err != nil {
		t.Fatal(err)
	}
	if err = repo.UpdateUser(ctx, user); err == nil {
		t.Fatal("dormant update succeeded")
	}
	if err = repo.TransitionAccount(ctx, user.ID, true, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err = repo.TransitionAccount(ctx, user.ID, false, now); err != nil {
		t.Fatal(err)
	}
	if err = repo.DeleteExpiredAccounts(ctx, now.Add(31*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	deleted, err := repo.FindUserByID(ctx, user.ID)
	if err != nil || deleted.Status != "DELETED" || deleted.FullName != "" {
		t.Fatalf("deleted: %+v, %v", deleted, err)
	}
}

func TestPostgresMuseumTeamRemoval(t *testing.T) {
	dsn := os.Getenv("AUTH_PROFILE_TEST_DSN")
	if dsn == "" {
		t.Skip("AUTH_PROFILE_TEST_DSN must point to an isolated test database")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err = InitSchema(ctx, db, "pgx"); err != nil {
		t.Fatal(err)
	}
	repo := NewPostgresRepository(db)
	owner := createTestUser(t, repo, "pg-team-owner", "methodist")
	member := createTestUser(t, repo, "pg-team-member", "methodist")
	if _, err = db.Exec("UPDATE museum_memberships SET role='methodist' WHERE user_id=$1", member.ID); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	if err = repo.RotateMuseumCode(ctx, "other-team-museum", "team-hash", now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err = repo.JoinMuseum(ctx, member.ID, "other-team-museum", "team-hash", now); err != nil {
		t.Fatal(err)
	}
	if err = repo.RemoveMuseumMember(ctx, member.ID, "museum-1", owner.ID, now); err != ErrForbidden {
		t.Fatalf("methodist removal: %v", err)
	}
	if err = repo.RemoveMuseumMember(ctx, owner.ID, "museum-1", member.ID, now); err != nil {
		t.Fatal(err)
	}
	if _, err = repo.MuseumRole(ctx, member.ID, "museum-1"); err == nil {
		t.Fatal("membership remains")
	}
	if _, err = repo.MuseumRole(ctx, member.ID, "other-team-museum"); err != nil {
		t.Fatalf("other membership lost: %v", err)
	}
	if _, err = repo.FindUserByID(ctx, member.ID); err != nil {
		t.Fatal(err)
	}
}
