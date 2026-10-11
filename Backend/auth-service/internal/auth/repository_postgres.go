package auth

import (
	"context"
	"database/sql"
	"time"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(ctx context.Context, user User, passwordHash string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, role, museum_id, status,
			phone, position, about, birth_date, gender,
			timezone, interface_language, extra_languages, note, avatar_url,
			notifications_enabled, two_factor_enabled,
			email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
		user.ID, user.Email, passwordHash, user.FullName, user.Role, user.MuseumID, user.Status,
		ns(user.Phone), ns(user.Position), ns(user.About), ns(user.BirthDate), ns(user.Gender),
		ns(user.Timezone), ns(user.InterfaceLanguage), ns(user.ExtraLanguages), ns(user.Note), ns(user.AvatarURL),
		user.NotificationsEnabled, user.TwoFactorEnabled,
		user.EmailVerifiedAt, user.RegisteredAt, user.LastLoginAt, ns(user.RegistrationSource),
		user.CreatedAt, user.UpdatedAt)
	return err
}

func (r *PostgresRepository) FindUserByEmail(ctx context.Context, email string) (User, error) {
	row := r.db.QueryRowContext(ctx, userSelectColumnsPG+" WHERE email = $1", email)
	return scanUserRow(row)
}

func (r *PostgresRepository) FindUserByID(ctx context.Context, userID string) (User, error) {
	row := r.db.QueryRowContext(ctx, userSelectColumnsPG+" WHERE id = $1", userID)
	return scanUserRow(row)
}

func (r *PostgresRepository) FindUserWithPasswordByEmail(ctx context.Context, email string) (User, string, error) {
	row := r.db.QueryRowContext(ctx, userSelectWithPasswordColumnsPG+" WHERE email = $1", email)
	return scanUserWithPasswordRow(row)
}

func (r *PostgresRepository) UpdateUser(ctx context.Context, user User) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE users SET full_name = $1, phone = $2, position = $3, about = $4, birth_date = $5,
			gender = $6, timezone = $7, interface_language = $8, extra_languages = $9,
			note = $10, notifications_enabled = $11, level = $12, is_guest = $13, locale = $14, updated_at = $15
		WHERE id = $16`,
		user.FullName, ns(user.Phone), ns(user.Position), ns(user.About), ns(user.BirthDate),
		ns(user.Gender), ns(user.Timezone), ns(user.InterfaceLanguage), ns(user.ExtraLanguages),
		ns(user.Note), user.NotificationsEnabled, user.Level, user.IsGuest, user.Locale, user.UpdatedAt, user.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) UpdateUserPassword(ctx context.Context, userID, passwordHash string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, passwordHash, now, userID)
	return err
}

func (r *PostgresRepository) UpdateUserAvatar(ctx context.Context, userID, avatarURL string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET avatar_url = $1, updated_at = $2 WHERE id = $3`, ns(avatarURL), now, userID)
	return err
}

func (r *PostgresRepository) UpdateUserRole(ctx context.Context, userID, role string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET role = $1, updated_at = $2 WHERE id = $3`, role, now, userID)
	return err
}

func (r *PostgresRepository) UpdateUserStatus(ctx context.Context, userID, status string, now time.Time) (User, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE users SET status = $1, updated_at = $2 WHERE id = $3`, status, now, userID)
	if err != nil {
		return User{}, err
	}
	if err := ensureRows(res); err != nil {
		return User{}, err
	}
	return r.FindUserByID(ctx, userID)
}

func (r *PostgresRepository) UpdateLastLogin(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET last_login_at = $1 WHERE id = $2`, now, userID)
	return err
}

func (r *PostgresRepository) VerifyUserEmail(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET email_verified_at = $1, updated_at = $2 WHERE id = $3`, now, now, userID)
	return err
}

func (r *PostgresRepository) CreateSession(ctx context.Context, session Session) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		session.ID, session.UserID, session.RefreshTokenHash, session.RefreshExpiresAt, session.RevokedAt, session.CreatedAt)
	return err
}

func (r *PostgresRepository) FindSessionByID(ctx context.Context, sessionID string) (Session, error) {
	return scanSessionRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at FROM sessions WHERE id = $1`, sessionID))
}

func (r *PostgresRepository) FindSessionByRefreshHash(ctx context.Context, tokenHash string) (Session, error) {
	return scanSessionRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at FROM sessions WHERE refresh_token_hash = $1`, tokenHash))
}

func (r *PostgresRepository) RevokeSession(ctx context.Context, sessionID string, now time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = $1 WHERE id = $2 AND revoked_at IS NULL`, now, sessionID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) RevokeSessionsByUserID(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL`, now, userID)
	return err
}

func (r *PostgresRepository) RotateSession(ctx context.Context, refreshTokenHash string, now time.Time, next Session) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM sessions WHERE refresh_token_hash = $1`, refreshTokenHash).Scan(&userID); err != nil {
		return "", err
	}
	res, err := tx.ExecContext(ctx, `UPDATE sessions SET revoked_at = $1 WHERE refresh_token_hash = $2 AND revoked_at IS NULL AND refresh_expires_at > $1`, now, refreshTokenHash)
	if err != nil {
		return "", err
	}
	if err := ensureRows(res); err != nil {
		return "", err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO sessions (id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at) VALUES ($1, $2, $3, $4, NULL, $5)`, next.ID, next.UserID, next.RefreshTokenHash, next.RefreshExpiresAt, next.CreatedAt); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return userID, nil
}

func (r *PostgresRepository) CreateEmailVerificationToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, id, userID, tokenHash, expiresAt, nil, createdAt)
	return err
}

func (r *PostgresRepository) FindEmailVerificationToken(ctx context.Context, tokenHash string) (verificationTokenRecord, error) {
	return scanVerificationTokenRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = $1`, tokenHash))
}

func (r *PostgresRepository) MarkEmailVerificationTokenUsed(ctx context.Context, id string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE email_verification_tokens SET used_at = $1 WHERE id = $2`, now, id)
	return err
}

func (r *PostgresRepository) ConsumeEmailVerificationToken(ctx context.Context, tokenHash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM email_verification_tokens WHERE token_hash = $1`, tokenHash).Scan(&userID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `UPDATE email_verification_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL AND expires_at > $1`, now, tokenHash)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	res, err = tx.ExecContext(ctx, `UPDATE users SET email_verified_at = $1, updated_at = $1 WHERE id = $2`, now, userID)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PostgresRepository) CreatePasswordResetToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`, id, userID, tokenHash, expiresAt, nil, createdAt)
	return err
}

func (r *PostgresRepository) FindPasswordResetToken(ctx context.Context, tokenHash string) (resetTokenRecord, error) {
	return scanResetTokenRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`, tokenHash))
}

func (r *PostgresRepository) MarkPasswordResetTokenUsed(ctx context.Context, id string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2`, now, id)
	return err
}

func (r *PostgresRepository) ConsumePasswordResetToken(ctx context.Context, tokenHash, passwordHash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM password_reset_tokens WHERE token_hash = $1`, tokenHash).Scan(&userID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2 AND used_at IS NULL AND expires_at > $1`, now, tokenHash)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	res, err = tx.ExecContext(ctx, `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, passwordHash, now, userID)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL`, now, userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *PostgresRepository) GetUserActivity(ctx context.Context, userID string) ([]userActivity, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, user_id, action, details, created_at FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanActivityRows(rows)
}

func ns(s string) any {
	if s == "" {
		return nil
	}
	return s
}

var userSelectColumnsPG = `SELECT id, email, full_name, role, museum_id, status,
	phone, position, about, birth_date, gender,
	timezone, interface_language, extra_languages, note, avatar_url,
	notifications_enabled, two_factor_enabled,
	email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at, level, is_guest, locale FROM users`

var userSelectWithPasswordColumnsPG = `SELECT id, email, password_hash, full_name, role, museum_id, status,
	phone, position, about, birth_date, gender,
	timezone, interface_language, extra_languages, note, avatar_url,
	notifications_enabled, two_factor_enabled,
	email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at, level, is_guest, locale FROM users`
