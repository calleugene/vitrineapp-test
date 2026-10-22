package artifacts

import (
	"context"
	"testing"
	"time"
)

func TestRepeatedCollectionPreservesFirstFoundAt(t *testing.T) {
	env := newTestEnv(t)
	repo := NewSQLiteRepository(env.db)
	first := time.Date(2026, 10, 16, 10, 0, 0, 0, time.UTC)
	later := first.Add(24 * time.Hour)
	if err := repo.MarkArtifactFound(context.Background(), "visitor-1", "artifact-1", first); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkArtifactFound(context.Background(), "visitor-1", "artifact-1", later); err != nil {
		t.Fatal(err)
	}
	var foundAt string
	var rows int
	if err := env.db.QueryRow(`SELECT found_at FROM artifact_visitor_status WHERE visitor_id='visitor-1' AND artifact_id='artifact-1'`).Scan(&foundAt); err != nil {
		t.Fatal(err)
	}
	if err := env.db.QueryRow(`SELECT COUNT(*) FROM artifact_visitor_status WHERE visitor_id='visitor-1' AND artifact_id='artifact-1'`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if foundAt != first.Format(time.RFC3339) || rows != 1 {
		t.Fatalf("found_at=%s rows=%d", foundAt, rows)
	}
}
