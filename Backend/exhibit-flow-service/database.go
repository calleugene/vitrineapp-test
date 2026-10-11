package main

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
)

// database converts the service's portable ? placeholders into PostgreSQL
// placeholders. Tests use SQLite; production uses pgx/PostgreSQL.
type database struct {
	raw      *sql.DB
	postgres bool
}

type transaction struct {
	raw      *sql.Tx
	postgres bool
}

func newDatabase(raw *sql.DB, postgres bool) *database {
	return &database{raw: raw, postgres: postgres}
}
func (d *database) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return d.raw.ExecContext(ctx, rebind(query, d.postgres), args...)
}
func (d *database) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return d.raw.QueryContext(ctx, rebind(query, d.postgres), args...)
}
func (d *database) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return d.raw.QueryRowContext(ctx, rebind(query, d.postgres), args...)
}
func (d *database) BeginTx(ctx context.Context, opts *sql.TxOptions) (*transaction, error) {
	tx, err := d.raw.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &transaction{raw: tx, postgres: d.postgres}, nil
}
func (d *database) Close() error { return d.raw.Close() }

func (t *transaction) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return t.raw.ExecContext(ctx, rebind(query, t.postgres), args...)
}
func (t *transaction) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return t.raw.QueryContext(ctx, rebind(query, t.postgres), args...)
}
func (t *transaction) Commit() error   { return t.raw.Commit() }
func (t *transaction) Rollback() error { return t.raw.Rollback() }

func rebind(query string, postgres bool) string {
	if !postgres {
		return query
	}
	var result strings.Builder
	argument := 1
	for _, symbol := range query {
		if symbol == '?' {
			result.WriteByte('$')
			result.WriteString(strconv.Itoa(argument))
			argument++
			continue
		}
		result.WriteRune(symbol)
	}
	return result.String()
}
