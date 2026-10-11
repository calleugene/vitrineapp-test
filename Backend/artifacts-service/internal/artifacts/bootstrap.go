package artifacts

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"sort"
	"strings"
	"time"
)

//go:embed testdata/schema.sql testdata/schema.postgres.sql
var schemaFS embed.FS

//go:embed migrations/*.postgres.sql
var migrationsFS embed.FS

// ApplyPostgresMigrations is the only runtime schema bootstrap. SQLite schemas
// are retained exclusively as test fixtures under testdata.
func ApplyPostgresMigrations(ctx context.Context, db *sql.DB) error {
	files, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("list migrations: %w", err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)`); err != nil {
		return fmt.Errorf("create migration ledger: %w", err)
	}
	if _, err := db.ExecContext(ctx, `SELECT pg_advisory_lock(726410923)`); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	defer db.ExecContext(context.Background(), `SELECT pg_advisory_unlock(726410923)`)

	names := make([]string, 0, len(files))
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".postgres.sql") {
			names = append(names, file.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		var applied bool
		if err := db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, name).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if applied {
			continue
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, string(body)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version, applied_at) VALUES ($1, $2)`, name, time.Now().UTC()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", name, err)
		}
	}
	return nil
}

func InitSchema(ctx context.Context, db *sql.DB, driver string) error {
	schemaPath := "testdata/schema.sql"
	if strings.Contains(strings.ToLower(driver), "pgx") || strings.Contains(strings.ToLower(driver), "postgres") {
		schemaPath = "testdata/schema.postgres.sql"
	}
	schema, err := schemaFS.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("read schema: %w", err)
	}
	if _, err := db.ExecContext(ctx, string(schema)); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}

func InitSQLite(ctx context.Context, db *sql.DB) error {
	return InitSchema(ctx, db, "sqlite")
}
