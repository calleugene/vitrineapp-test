package auth

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"strings"
)

//go:embed testdata/schema.sql testdata/schema.postgres.sql
var schemaFS embed.FS

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
	if err := ensureGamificationColumns(ctx, db, driver); err != nil {
		return fmt.Errorf("migrate users: %w", err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS user_consents (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), consent_type TEXT NOT NULL,
 document_version TEXT NOT NULL, confirmed_at TEXT NOT NULL, accepted BOOLEAN NOT NULL);
 CREATE INDEX IF NOT EXISTS user_consents_user ON user_consents(user_id);
 CREATE TABLE IF NOT EXISTS password_reset_mail (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, available_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS password_reset_mail_available ON password_reset_mail(available_at);
 CREATE TABLE IF NOT EXISTS password_reset_limits (key TEXT PRIMARY KEY, window_start TEXT NOT NULL, attempts INTEGER NOT NULL);`); err != nil {
		return err
	}
	return initProfileSchema(ctx, db, driver)
}

func ensureGamificationColumns(ctx context.Context, db *sql.DB, driver string) error {
	if strings.Contains(strings.ToLower(driver), "pgx") || strings.Contains(strings.ToLower(driver), "postgres") {
		_, err := db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS level VARCHAR(50) DEFAULT 'новичок'; ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'ru';`)
		return err
	}
	rows, err := db.QueryContext(ctx, `PRAGMA table_info(users)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull, pk int
		var dflt any
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dflt, &pk); err != nil {
			return err
		}
		have[name] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, migration := range []struct{ column, statement string }{
		{"level", `ALTER TABLE users ADD COLUMN level TEXT DEFAULT 'новичок'`},
		{"is_guest", `ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0`},
		{"locale", `ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'ru'`},
	} {
		if !have[migration.column] {
			if _, err := db.ExecContext(ctx, migration.statement); err != nil {
				return err
			}
		}
	}
	return nil
}

func InitSQLite(ctx context.Context, db *sql.DB) error {
	return InitSchema(ctx, db, "sqlite")
}
