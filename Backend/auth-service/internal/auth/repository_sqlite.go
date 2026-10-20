package auth

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

type SQLiteRepository struct {
	db *sql.DB
	*profileRepository
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db, profileRepository: &profileRepository{db: db}}
}

func (r *SQLiteRepository) CreateUser(ctx context.Context, user User, passwordHash string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO users (id, email, password_hash, full_name, role, museum_id, status,
			phone, position, about, birth_date, gender,
			timezone, interface_language, extra_languages, note, avatar_url,
			notifications_enabled, two_factor_enabled,
			email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Email, passwordHash, user.FullName, user.Role, user.MuseumID, user.Status,
		nullableString(user.Phone), nullableString(user.Position), nullableString(user.About),
		nullableString(user.BirthDate), nullableString(user.Gender),
		nullableString(user.Timezone), nullableString(user.InterfaceLanguage),
		nullableString(user.ExtraLanguages), nullableString(user.Note), nullableString(user.AvatarURL),
		user.NotificationsEnabled, user.TwoFactorEnabled,
		nullableTime(user.EmailVerifiedAt), user.RegisteredAt.Format(time.RFC3339),
		nullableTime(user.LastLoginAt), nullableString(user.RegistrationSource),
		user.CreatedAt.Format(time.RFC3339), user.UpdatedAt.Format(time.RFC3339))
	if err == nil && user.MuseumID != nil {
		_, err = tx.ExecContext(ctx, r.query(`INSERT INTO museum_memberships(user_id,museum_id,role) VALUES(?,?,'owner') ON CONFLICT(user_id,museum_id) DO NOTHING`), user.ID, *user.MuseumID)
	}
	if err != nil {
		return err
	}
	for _, c := range user.registrationConsents {
		if _, err = tx.ExecContext(ctx, r.profileRepository.query(`INSERT INTO user_consents(id,user_id,consent_type,document_version,confirmed_at,accepted) VALUES(?,?,?,?,?,?)`), newID("cns"), user.ID, c.Type, c.Version, user.CreatedAt.Format(time.RFC3339Nano), c.Accepted); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *SQLiteRepository) FindUserByEmail(ctx context.Context, email string) (User, error) {
	row := r.db.QueryRowContext(ctx, userSelectColumns+" WHERE email = ?", email)
	return scanUserRow(row)
}

func (r *SQLiteRepository) FindUserByID(ctx context.Context, userID string) (User, error) {
	row := r.db.QueryRowContext(ctx, userSelectColumns+" WHERE id = ?", userID)
	return scanUserRow(row)
}

func (r *SQLiteRepository) FindUserWithPasswordByEmail(ctx context.Context, email string) (User, string, error) {
	row := r.db.QueryRowContext(ctx, userSelectWithPasswordColumns+" WHERE email = ?", email)
	return scanUserWithPasswordRow(row)
}

func (r *SQLiteRepository) UpdateUser(ctx context.Context, user User) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE users SET full_name = ?, phone = ?, position = ?, about = ?, birth_date = ?,
			gender = ?, timezone = ?, interface_language = ?, extra_languages = ?,
			note = ?, notifications_enabled = ?, level = ?, is_guest = ?, locale = ?, updated_at = ?
		WHERE id = ? AND LOWER(status)='active'`,
		user.FullName, nullableString(user.Phone), nullableString(user.Position),
		nullableString(user.About), nullableString(user.BirthDate), nullableString(user.Gender),
		nullableString(user.Timezone), nullableString(user.InterfaceLanguage),
		nullableString(user.ExtraLanguages), nullableString(user.Note),
		user.NotificationsEnabled, user.Level, user.IsGuest, user.Locale, user.UpdatedAt.Format(time.RFC3339), user.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) UpdateUserPassword(ctx context.Context, userID, passwordHash string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, passwordHash, now.Format(time.RFC3339), userID)
	return err
}

func (r *SQLiteRepository) UpdateUserAvatar(ctx context.Context, userID, avatarURL string, now time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ? AND LOWER(status)='active'`, nullableString(avatarURL), now.Format(time.RFC3339), userID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) UpdateUserRole(ctx context.Context, userID, role string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET role = ?, updated_at = ? WHERE id = ?`, role, now.Format(time.RFC3339), userID)
	return err
}

func (r *SQLiteRepository) UpdateUserStatus(ctx context.Context, userID, status string, now time.Time) (User, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE users SET status = ?, updated_at = ? WHERE id = ?`, status, now.Format(time.RFC3339), userID)
	if err != nil {
		return User{}, err
	}
	if err := ensureRows(res); err != nil {
		return User{}, err
	}
	return r.FindUserByID(ctx, userID)
}

func (r *SQLiteRepository) UpdateLastLogin(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET last_login_at = ? WHERE id = ?`, now.Format(time.RFC3339), userID)
	return err
}

func (r *SQLiteRepository) EnsureMuseumID(ctx context.Context, userID, museumID string, now time.Time) (User, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET museum_id = ?, updated_at = ? WHERE id = ? AND role = 'methodist' AND museum_id IS NULL`, museumID, now.Format(time.RFC3339), userID)
	if err != nil {
		return User{}, err
	}
	user, err := r.FindUserByID(ctx, userID)
	if err != nil {
		return User{}, err
	}
	if user.MuseumID != nil {
		_, err = r.db.ExecContext(ctx, r.query(`INSERT INTO museum_memberships(user_id,museum_id,role) VALUES(?,?,'owner') ON CONFLICT(user_id,museum_id) DO NOTHING`), user.ID, *user.MuseumID)
	}
	return user, err
}

func (r *SQLiteRepository) VerifyUserEmail(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`, now.Format(time.RFC3339), now.Format(time.RFC3339), userID)
	return err
}

func (r *SQLiteRepository) CreateSession(ctx context.Context, session Session) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sessions (id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		session.ID, session.UserID, session.RefreshTokenHash, session.RefreshExpiresAt.Format(time.RFC3339), nil, session.CreatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) FindSessionByID(ctx context.Context, sessionID string) (Session, error) {
	return scanSessionRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at FROM sessions WHERE id = ?`, sessionID))
}

func (r *SQLiteRepository) FindSessionByRefreshHash(ctx context.Context, tokenHash string) (Session, error) {
	return scanSessionRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at FROM sessions WHERE refresh_token_hash = ?`, tokenHash))
}

func (r *SQLiteRepository) RevokeSession(ctx context.Context, sessionID string, now time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`, now.Format(time.RFC3339), sessionID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) RevokeSessionsByUserID(ctx context.Context, userID string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, now.Format(time.RFC3339), userID)
	return err
}

func (r *SQLiteRepository) RotateSession(ctx context.Context, refreshTokenHash string, now time.Time, next Session) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM sessions WHERE refresh_token_hash = ?`, refreshTokenHash).Scan(&userID); err != nil {
		return "", err
	}
	res, err := tx.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL AND refresh_expires_at > ?`, now.Format(time.RFC3339), refreshTokenHash, now.Format(time.RFC3339))
	if err != nil {
		return "", err
	}
	if err := ensureRows(res); err != nil {
		return "", err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO sessions (id, user_id, refresh_token_hash, refresh_expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)`, next.ID, next.UserID, next.RefreshTokenHash, next.RefreshExpiresAt.Format(time.RFC3339), next.CreatedAt.Format(time.RFC3339)); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return userID, nil
}

func (r *SQLiteRepository) CreateEmailVerificationToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`, id, userID, tokenHash, expiresAt.Format(time.RFC3339), nil, createdAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) FindEmailVerificationToken(ctx context.Context, tokenHash string) (verificationTokenRecord, error) {
	return scanVerificationTokenRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?`, tokenHash))
}

func (r *SQLiteRepository) MarkEmailVerificationTokenUsed(ctx context.Context, id string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE email_verification_tokens SET used_at = ? WHERE id = ?`, now.Format(time.RFC3339), id)
	return err
}

func (r *SQLiteRepository) ConsumeEmailVerificationToken(ctx context.Context, tokenHash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM email_verification_tokens WHERE token_hash = ?`, tokenHash).Scan(&userID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`, now.Format(time.RFC3339), tokenHash, now.Format(time.RFC3339))
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	res, err = tx.ExecContext(ctx, `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND LOWER(status)='active'`, now.Format(time.RFC3339), now.Format(time.RFC3339), userID)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SQLiteRepository) CreatePasswordResetToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`, id, userID, tokenHash, expiresAt.Format(time.RFC3339), nil, createdAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) FindPasswordResetToken(ctx context.Context, tokenHash string) (resetTokenRecord, error) {
	return scanResetTokenRow(r.db.QueryRowContext(ctx, `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?`, tokenHash))
}

func (r *SQLiteRepository) MarkPasswordResetTokenUsed(ctx context.Context, id string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`, now.Format(time.RFC3339), id)
	return err
}

func (r *SQLiteRepository) ConsumePasswordResetToken(ctx context.Context, tokenHash, passwordHash string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var userID string
	if err := tx.QueryRowContext(ctx, `SELECT user_id FROM password_reset_tokens WHERE token_hash = ?`, tokenHash).Scan(&userID); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`, now.Format(time.RFC3339), tokenHash, now.Format(time.RFC3339))
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	res, err = tx.ExecContext(ctx, `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, passwordHash, now.Format(time.RFC3339), userID)
	if err != nil {
		return err
	}
	if err := ensureRows(res); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, now.Format(time.RFC3339), userID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SQLiteRepository) GetUserActivity(ctx context.Context, userID string) ([]userActivity, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, user_id, action, details, created_at FROM user_activities WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such table") {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()
	return scanActivityRows(rows)
}

func isSQLiteConstraint(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}

func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullableTime(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.Format(time.RFC3339)
}

var userSelectColumns = `SELECT id, email, full_name, role, museum_id, status,
	phone, position, about, birth_date, gender,
	timezone, interface_language, extra_languages, note, avatar_url,
	notifications_enabled, two_factor_enabled,
	email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at, level, is_guest, locale, deactivated_at, scheduled_deletion_at FROM users`

var userSelectWithPasswordColumns = `SELECT id, email, password_hash, full_name, role, museum_id, status,
	phone, position, about, birth_date, gender,
	timezone, interface_language, extra_languages, note, avatar_url,
	notifications_enabled, two_factor_enabled,
	email_verified_at, registered_at, last_login_at, registration_source, created_at, updated_at, level, is_guest, locale, deactivated_at, scheduled_deletion_at FROM users`
