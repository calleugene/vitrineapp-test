// Command dbmigrate applies the versioned PostgreSQL migrations for
// artifacts-service.  It deliberately does not call the application's legacy
// InitSchema helper: production schema ownership belongs to this command.
package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type migration struct {
	version  string
	path     string
	checksum string
	sql      string
}

func main() {
	var (
		dsn        = flag.String("dsn", os.Getenv("ARTIFACTS_DB_DSN"), "PostgreSQL DSN (or ARTIFACTS_DB_DSN)")
		migrations = flag.String("migrations", "migrations", "directory with *.up.sql files")
		dryRun     = flag.Bool("dry-run", false, "print pending migrations without applying them")
		status     = flag.Bool("status", false, "print applied and pending migrations")
	)
	flag.Parse()
	if !isPostgresDSN(*dsn) {
		log.Fatal("PostgreSQL DSN is required; SQLite is intentionally unsupported by dbmigrate")
	}
	items, err := readMigrations(*migrations)
	if err != nil {
		log.Fatal(err)
	}
	db, err := sql.Open("pgx", *dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("connect PostgreSQL: %v", err)
	}
	if err := ensureLedger(ctx, db); err != nil {
		log.Fatal(err)
	}
	applied, err := appliedMigrations(ctx, db)
	if err != nil {
		log.Fatal(err)
	}
	if *status {
		for _, item := range items {
			state := "pending"
			if checksum, ok := applied[item.version]; ok {
				if checksum != item.checksum {
					state = "CHECKSUM_MISMATCH"
				} else {
					state = "applied"
				}
			}
			fmt.Printf("%s %s\n", state, filepath.Base(item.path))
		}
		return
	}
	if *dryRun {
		for _, item := range items {
			if _, ok := applied[item.version]; !ok {
				fmt.Println(filepath.Base(item.path))
			}
		}
		return
	}
	for _, item := range items {
		if checksum, ok := applied[item.version]; ok {
			if checksum != item.checksum {
				log.Fatalf("migration %s has changed after application; add a new migration instead", item.version)
			}
			continue
		}
		if err := apply(ctx, db, item); err != nil {
			log.Fatalf("apply %s: %v", filepath.Base(item.path), err)
		}
		fmt.Printf("applied %s\n", filepath.Base(item.path))
	}
}

func readMigrations(dir string) ([]migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migrations %q: %w", dir, err)
	}
	items := make([]migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".up.sql") {
			continue
		}
		version := strings.SplitN(entry.Name(), "_", 2)[0]
		if version == "" {
			return nil, fmt.Errorf("migration %q has no version prefix", entry.Name())
		}
		path := filepath.Join(dir, entry.Name())
		contents, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		sum := sha256.Sum256(contents)
		items = append(items, migration{version: version, path: path, checksum: fmt.Sprintf("%x", sum[:]), sql: string(contents)})
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("no *.up.sql migrations in %q", dir)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].version < items[j].version })
	for i := 1; i < len(items); i++ {
		if items[i-1].version == items[i].version {
			return nil, fmt.Errorf("duplicate migration version %s", items[i].version)
		}
	}
	return items, nil
}

func ensureLedger(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		checksum TEXT NOT NULL,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`)
	return err
}

func appliedMigrations(ctx context.Context, db *sql.DB) (map[string]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT version, checksum FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]string{}
	for rows.Next() {
		var version, checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, err
		}
		result[version] = checksum
	}
	return result, rows.Err()
}

func apply(ctx context.Context, db *sql.DB, item migration) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Serialize deploys even when two release jobs race against one database.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(742921001)`); err != nil {
		return err
	}
	var checksum string
	err = tx.QueryRowContext(ctx, `SELECT checksum FROM schema_migrations WHERE version = $1`, item.version).Scan(&checksum)
	if err == nil {
		if checksum != item.checksum {
			return errors.New("migration checksum differs from the applied version")
		}
		return tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if _, err := tx.ExecContext(ctx, item.sql); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)`, item.version, item.checksum); err != nil {
		return err
	}
	return tx.Commit()
}

func isPostgresDSN(dsn string) bool {
	value := strings.ToLower(strings.TrimSpace(dsn))
	return strings.HasPrefix(value, "postgres://") || strings.HasPrefix(value, "postgresql://") || strings.Contains(value, "host=")
}
