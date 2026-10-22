package auth

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type ProfileRepository interface {
	MuseumMembers(context.Context, string) ([]museumMember, error)
	RemoveMuseumMember(context.Context, string, string, string, time.Time) error
	MuseumMemberships(context.Context, string) ([]museumAccess, error)
	MuseumRole(context.Context, string, string) (string, error)
	RotateMuseumCode(context.Context, string, string, time.Time) error
	RevokeMuseumCode(context.Context, string) error
	JoinMuseum(context.Context, string, string, string, time.Time) error
	SetActiveMuseum(context.Context, string, string) error
	TransitionAccount(context.Context, string, bool, time.Time) error
	DeleteExpiredAccounts(context.Context, time.Time) error
	SaveEmailChange(context.Context, string, string, string, time.Time) error
	ConfirmEmailChange(context.Context, string, string, time.Time) error
}

type profileRepository struct {
	db       *sql.DB
	postgres bool
}

func (r *profileRepository) query(q string) string {
	if !r.postgres {
		return q
	}
	i := 0
	return replacePlaceholders(q, &i)
}
func replacePlaceholders(q string, i *int) string {
	var b strings.Builder
	for _, c := range q {
		if c == '?' {
			*i++
			fmt.Fprintf(&b, "$%d", *i)
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}
func initProfileSchema(ctx context.Context, db *sql.DB, driver string) error {
	pg := strings.Contains(driver, "pg") || strings.Contains(driver, "postgres")
	typ := "TEXT"
	if pg {
		typ = "TIMESTAMPTZ"
	}
	for _, col := range []string{"deactivated_at", "scheduled_deletion_at"} {
		if pg {
			if _, err := db.ExecContext(ctx, "ALTER TABLE users ADD COLUMN IF NOT EXISTS "+col+" "+typ); err != nil {
				return err
			}
		} else {
			rows, err := db.QueryContext(ctx, "PRAGMA table_info(users)")
			if err != nil {
				return err
			}
			found := false
			for rows.Next() {
				var id, nn, pk int
				var name, t string
				var d any
				if err := rows.Scan(&id, &name, &t, &nn, &d, &pk); err != nil {
					rows.Close()
					return err
				}
				if name == col {
					found = true
				}
			}
			err = rows.Err()
			rows.Close()
			if err != nil {
				return err
			}
			if !found {
				if _, err = db.ExecContext(ctx, "ALTER TABLE users ADD COLUMN "+col+" "+typ); err != nil {
					return err
				}
			}
		}
	}
	_, err := db.ExecContext(ctx, `
 CREATE TABLE IF NOT EXISTS museum_memberships (user_id TEXT NOT NULL REFERENCES users(id), museum_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(user_id,museum_id));
 CREATE TABLE IF NOT EXISTS museum_join_codes (token_hash TEXT PRIMARY KEY, museum_id TEXT NOT NULL, expires_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS museum_join_codes_museum ON museum_join_codes(museum_id);
 CREATE TABLE IF NOT EXISTS museum_join_attempts (user_id TEXT PRIMARY KEY REFERENCES users(id), window_start TEXT NOT NULL, attempts INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS profile_email_changes (user_id TEXT PRIMARY KEY REFERENCES users(id), email TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL);
 UPDATE users SET status='ACTIVE' WHERE status='active';
 INSERT INTO museum_memberships(user_id,museum_id,role) SELECT id,museum_id,'owner' FROM users WHERE museum_id IS NOT NULL AND LOWER(status) NOT IN ('deleted') ON CONFLICT(user_id,museum_id) DO NOTHING;
 `)
	return err
}

func (r *profileRepository) MuseumMemberships(ctx context.Context, id string) ([]museumAccess, error) {
	rows, err := r.db.QueryContext(ctx, r.query(`SELECT museum_id,role FROM museum_memberships WHERE user_id=? ORDER BY museum_id`), id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []museumAccess{}
	for rows.Next() {
		var m museumAccess
		if err := rows.Scan(&m.ID, &m.Role); err != nil {
			return nil, err
		}
		m.AccessLevel = "edit"
		result = append(result, m)
	}
	return result, rows.Err()
}
func (r *profileRepository) MuseumRole(ctx context.Context, id, museum string) (string, error) {
	var role string
	err := r.db.QueryRowContext(ctx, r.query(`SELECT role FROM museum_memberships WHERE user_id=? AND museum_id=?`), id, museum).Scan(&role)
	return role, err
}
func (r *profileRepository) RotateMuseumCode(ctx context.Context, museum, hash string, expiry time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Serialize rotation for a museum, including its first code, across instances.
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE museum_memberships SET role=role WHERE museum_id=? AND role='owner'`), museum); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE museum_join_codes SET revoked=1 WHERE museum_id=?`), museum); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, r.query(`INSERT INTO museum_join_codes(token_hash,museum_id,expires_at) VALUES(?,?,?)`), hash, museum, expiry.UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	return tx.Commit()
}
func (r *profileRepository) RevokeMuseumCode(ctx context.Context, museum string) error {
	_, err := r.db.ExecContext(ctx, r.query(`UPDATE museum_join_codes SET revoked=1 WHERE museum_id=?`), museum)
	return err
}

func (r *profileRepository) JoinMuseum(ctx context.Context, id, museumID, hash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	lock, err := tx.ExecContext(ctx, r.query(`UPDATE users SET status=status WHERE id=? AND LOWER(status)='active'`), id)
	if err != nil {
		return err
	}
	if err = ensureRows(lock); err != nil {
		return ErrForbidden
	}

	stamp := now.UTC().Format(time.RFC3339)
	cutoff := now.Add(-15 * time.Minute).UTC().Format(time.RFC3339)
	// Persistent counter and transaction serialize parallel attempts on every replica.
	_, err = tx.ExecContext(ctx, r.query(`INSERT INTO museum_join_attempts(user_id,window_start,attempts) VALUES(?,?,0) ON CONFLICT(user_id) DO NOTHING`), id, stamp)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, r.query(`UPDATE museum_join_attempts SET attempts=CASE WHEN window_start<=? THEN 0 ELSE attempts END, window_start=CASE WHEN window_start<=? THEN ? ELSE window_start END WHERE user_id=?`), cutoff, cutoff, stamp, id)
	if err != nil {
		return err
	}
	var attempts int
	if err = tx.QueryRowContext(ctx, r.query(`SELECT attempts FROM museum_join_attempts WHERE user_id=?`), id).Scan(&attempts); err != nil {
		return err
	}
	if attempts >= 5 {
		return ErrJoinRateLimited
	}
	if _, err = tx.ExecContext(ctx, r.query(`UPDATE museum_join_attempts SET attempts=attempts+1 WHERE user_id=?`), id); err != nil {
		return err
	}
	fail := func(e error) error {
		if err := tx.Commit(); err != nil {
			return err
		}
		return e
	}
	var museum, expiry string
	var revoked int
	codeQuery := `SELECT museum_id,expires_at,revoked FROM museum_join_codes WHERE token_hash=?`
	if r.postgres {
		codeQuery += " FOR UPDATE"
	}
	err = tx.QueryRowContext(ctx, r.query(codeQuery), hash).Scan(&museum, &expiry, &revoked)
	if err == sql.ErrNoRows {
		return fail(ErrCodeNotFound)
	}
	if err != nil {
		return err
	}
	if museum != museumID || revoked != 0 || expiry <= stamp {
		return fail(ErrCodeInvalid)
	}
	var status, role string
	if err = tx.QueryRowContext(ctx, r.query(`SELECT status,role FROM users WHERE id=?`), id).Scan(&status, &role); err != nil {
		return err
	}
	if !strings.EqualFold(status, "active") || (role != "methodist" && role != "museum_admin") {
		return fail(ErrForbidden)
	}
	res, err := tx.ExecContext(ctx, r.query(`INSERT INTO museum_memberships(user_id,museum_id,role) VALUES(?,?,'methodist') ON CONFLICT(user_id,museum_id) DO NOTHING`), id, museum)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fail(ErrAlreadyJoined)
	}
	return tx.Commit()
}
func (r *profileRepository) SetActiveMuseum(ctx context.Context, id, museum string) error {
	res, err := r.db.ExecContext(ctx, r.query(`UPDATE users SET museum_id=? WHERE id=? AND LOWER(status)='active' AND EXISTS(SELECT 1 FROM museum_memberships WHERE user_id=? AND museum_id=?)`), museum, id, id, museum)
	if err != nil {
		return err
	}
	return ensureRows(res)
}
func (r *profileRepository) TransitionAccount(ctx context.Context, id string, activate bool, now time.Time) error {
	q := `UPDATE users SET status='DORMANT',deactivated_at=?,scheduled_deletion_at=?,updated_at=? WHERE id=? AND LOWER(status)='active'`
	args := []any{now.UTC().Format(time.RFC3339), now.Add(30 * 24 * time.Hour).UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339), id}
	if activate {
		q = `UPDATE users SET status='ACTIVE',deactivated_at=NULL,scheduled_deletion_at=NULL,updated_at=? WHERE id=? AND status='DORMANT' AND scheduled_deletion_at>?`
		args = []any{now.UTC().Format(time.RFC3339), id, now.UTC().Format(time.RFC3339)}
	}
	res, err := r.db.ExecContext(ctx, r.query(q), args...)
	if err != nil {
		return err
	}
	if err = ensureRows(res); err != nil {
		return ErrForbidden
	}
	return nil
}
func (r *profileRepository) DeleteExpiredAccounts(ctx context.Context, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Remove queued mail before replacing the address with a tombstone.
	if _, err = tx.ExecContext(ctx, r.query(`DELETE FROM password_reset_mail WHERE expires_at<=? OR email IN (SELECT email FROM users WHERE status='DORMANT' AND scheduled_deletion_at<=?)`), now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	// Tombstones retain a non-identifying user key; organization-owned content lives in other services.
	res, err := tx.ExecContext(ctx, r.query(`UPDATE users SET status='DELETED',email=id || '@deleted.invalid',password_hash='',full_name='',phone='',position='',about='',birth_date='',gender='',timezone='',interface_language='',extra_languages='',note='',avatar_url='',email_verified_at=NULL,last_login_at=NULL,registration_source='',museum_id=NULL,updated_at=? WHERE status='DORMANT' AND scheduled_deletion_at<=?`), now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339))
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return err
	}
	for _, table := range []string{"sessions", "email_verification_tokens", "password_reset_tokens", "user_activities", "profile_email_changes", "museum_join_attempts", "museum_memberships"} {
		if _, err = tx.ExecContext(ctx, `DELETE FROM `+table+` WHERE user_id IN (SELECT id FROM users WHERE status='DELETED')`); err != nil {
			return err
		}
	}
	return tx.Commit()
}
func (r *profileRepository) SaveEmailChange(ctx context.Context, id, email, hash string, expiry time.Time) error {
	_, err := r.db.ExecContext(ctx, r.query(`INSERT INTO profile_email_changes(user_id,email,token_hash,expires_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,token_hash=excluded.token_hash,expires_at=excluded.expires_at`), id, email, hash, expiry.UTC().Format(time.RFC3339))
	return err
}
func (r *profileRepository) ConfirmEmailChange(ctx context.Context, id, hash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var email string
	if err = tx.QueryRowContext(ctx, r.query(`SELECT email FROM profile_email_changes WHERE user_id=? AND token_hash=? AND expires_at>?`), id, hash, now.UTC().Format(time.RFC3339)).Scan(&email); err == sql.ErrNoRows {
		return ErrInvalidToken
	} else if err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, r.query(`UPDATE users SET email=?,email_verified_at=?,updated_at=? WHERE id=? AND LOWER(status)='active'`), email, now.UTC().Format(time.RFC3339), now.UTC().Format(time.RFC3339), id)
	if err != nil {
		return ErrEmailAlreadyExists
	}
	if err = ensureRows(res); err != nil {
		return ErrForbidden
	}
	// Consuming the exact token must succeed, so two parallel confirmations cannot both commit.
	res, err = tx.ExecContext(ctx, r.query(`DELETE FROM profile_email_changes WHERE user_id=? AND token_hash=?`), id, hash)
	if err != nil {
		return err
	}
	if err = ensureRows(res); err != nil {
		return ErrInvalidToken
	}
	if _, err = tx.ExecContext(ctx, r.query(`DELETE FROM email_verification_tokens WHERE user_id=?`), id); err != nil {
		return err
	}
	return tx.Commit()
}
