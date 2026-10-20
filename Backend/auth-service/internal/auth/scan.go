package auth

import (
	"database/sql"
	"errors"
	"time"
)

func scanUserRow(row *sql.Row) (User, error) {
	var user User
	var museumID, phone, position, about, birthDate, gender, timezone, interfaceLanguage, extraLanguages, note, avatarURL, registrationSource any
	var verifiedAt, lastLoginAt, registeredAt, createdAt, updatedAt, deactivatedAt, scheduledDeletionAt any

	if err := row.Scan(
		&user.ID, &user.Email, &user.FullName, &user.Role, &museumID, &user.Status,
		&phone, &position, &about, &birthDate, &gender,
		&timezone, &interfaceLanguage, &extraLanguages, &note, &avatarURL,
		&user.NotificationsEnabled, &user.TwoFactorEnabled,
		&verifiedAt, &registeredAt, &lastLoginAt, &registrationSource, &createdAt, &updatedAt, &user.Level, &user.IsGuest, &user.Locale, &deactivatedAt, &scheduledDeletionAt,
	); err != nil {
		return User{}, err
	}
	user.MuseumID = mustParseStringPtr(museumID)
	user.Phone = mustParseString(phone)
	user.Position = mustParseString(position)
	user.About = mustParseString(about)
	user.BirthDate = mustParseString(birthDate)
	user.Gender = mustParseString(gender)
	user.Timezone = mustParseString(timezone)
	user.InterfaceLanguage = mustParseString(interfaceLanguage)
	user.ExtraLanguages = mustParseString(extraLanguages)
	user.Note = mustParseString(note)
	user.AvatarURL = mustParseString(avatarURL)
	user.RegistrationSource = mustParseString(registrationSource)
	user.EmailVerifiedAt = mustParseTimePtr(verifiedAt)
	user.RegisteredAt = mustParseTime(registeredAt)
	user.LastLoginAt = mustParseTimePtr(lastLoginAt)
	user.CreatedAt = mustParseTime(createdAt)
	user.UpdatedAt = mustParseTime(updatedAt)
	user.DeactivatedAt = mustParseTimePtr(deactivatedAt)
	user.ScheduledDeletionAt = mustParseTimePtr(scheduledDeletionAt)
	return user, nil
}

func scanUserRows(rows *sql.Rows) ([]User, error) {
	var users []User
	for rows.Next() {
		user, err := scanUserRowsScanner(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func scanUserRowsScanner(scanner interface{ Scan(dest ...any) error }) (User, error) {
	var user User
	var museumID, phone, position, about, birthDate, gender, timezone, interfaceLanguage, extraLanguages, note, avatarURL, registrationSource any
	var verifiedAt, lastLoginAt, registeredAt, createdAt, updatedAt, deactivatedAt, scheduledDeletionAt any

	if err := scanner.Scan(
		&user.ID, &user.Email, &user.FullName, &user.Role, &museumID, &user.Status,
		&phone, &position, &about, &birthDate, &gender,
		&timezone, &interfaceLanguage, &extraLanguages, &note, &avatarURL,
		&user.NotificationsEnabled, &user.TwoFactorEnabled,
		&verifiedAt, &registeredAt, &lastLoginAt, &registrationSource, &createdAt, &updatedAt, &user.Level, &user.IsGuest, &user.Locale, &deactivatedAt, &scheduledDeletionAt,
	); err != nil {
		return User{}, err
	}
	user.MuseumID = mustParseStringPtr(museumID)
	user.Phone = mustParseString(phone)
	user.Position = mustParseString(position)
	user.About = mustParseString(about)
	user.BirthDate = mustParseString(birthDate)
	user.Gender = mustParseString(gender)
	user.Timezone = mustParseString(timezone)
	user.InterfaceLanguage = mustParseString(interfaceLanguage)
	user.ExtraLanguages = mustParseString(extraLanguages)
	user.Note = mustParseString(note)
	user.AvatarURL = mustParseString(avatarURL)
	user.RegistrationSource = mustParseString(registrationSource)
	user.EmailVerifiedAt = mustParseTimePtr(verifiedAt)
	user.RegisteredAt = mustParseTime(registeredAt)
	user.LastLoginAt = mustParseTimePtr(lastLoginAt)
	user.CreatedAt = mustParseTime(createdAt)
	user.UpdatedAt = mustParseTime(updatedAt)
	user.DeactivatedAt = mustParseTimePtr(deactivatedAt)
	user.ScheduledDeletionAt = mustParseTimePtr(scheduledDeletionAt)
	return user, nil
}

func scanUserWithPasswordRow(row *sql.Row) (User, string, error) {
	var user User
	var passwordHash string
	var museumID, phone, position, about, birthDate, gender, timezone, interfaceLanguage, extraLanguages, note, avatarURL, registrationSource any
	var verifiedAt, lastLoginAt, registeredAt, createdAt, updatedAt, deactivatedAt, scheduledDeletionAt any

	if err := row.Scan(
		&user.ID, &user.Email, &passwordHash, &user.FullName, &user.Role, &museumID, &user.Status,
		&phone, &position, &about, &birthDate, &gender,
		&timezone, &interfaceLanguage, &extraLanguages, &note, &avatarURL,
		&user.NotificationsEnabled, &user.TwoFactorEnabled,
		&verifiedAt, &registeredAt, &lastLoginAt, &registrationSource, &createdAt, &updatedAt, &user.Level, &user.IsGuest, &user.Locale, &deactivatedAt, &scheduledDeletionAt,
	); err != nil {
		return User{}, "", err
	}
	user.MuseumID = mustParseStringPtr(museumID)
	user.Phone = mustParseString(phone)
	user.Position = mustParseString(position)
	user.About = mustParseString(about)
	user.BirthDate = mustParseString(birthDate)
	user.Gender = mustParseString(gender)
	user.Timezone = mustParseString(timezone)
	user.InterfaceLanguage = mustParseString(interfaceLanguage)
	user.ExtraLanguages = mustParseString(extraLanguages)
	user.Note = mustParseString(note)
	user.AvatarURL = mustParseString(avatarURL)
	user.RegistrationSource = mustParseString(registrationSource)
	user.EmailVerifiedAt = mustParseTimePtr(verifiedAt)
	user.RegisteredAt = mustParseTime(registeredAt)
	user.LastLoginAt = mustParseTimePtr(lastLoginAt)
	user.CreatedAt = mustParseTime(createdAt)
	user.UpdatedAt = mustParseTime(updatedAt)
	user.DeactivatedAt = mustParseTimePtr(deactivatedAt)
	user.ScheduledDeletionAt = mustParseTimePtr(scheduledDeletionAt)
	return user, passwordHash, nil
}

func scanSessionRow(row *sql.Row) (Session, error) {
	var session Session
	var refreshExpiresAt, revokedAt, createdAt any
	if err := row.Scan(&session.ID, &session.UserID, &session.RefreshTokenHash, &refreshExpiresAt, &revokedAt, &createdAt); err != nil {
		return Session{}, err
	}
	session.RefreshExpiresAt = mustParseTime(refreshExpiresAt)
	session.RevokedAt = mustParseTimePtr(revokedAt)
	session.CreatedAt = mustParseTime(createdAt)
	return session, nil
}

func scanVerificationTokenRow(row *sql.Row) (verificationTokenRecord, error) {
	var rec verificationTokenRecord
	var expiresAt, usedAt any
	if err := row.Scan(&rec.ID, &rec.UserID, &expiresAt, &usedAt); err != nil {
		return verificationTokenRecord{}, err
	}
	rec.ExpiresAt = mustParseTime(expiresAt)
	rec.UsedAt = mustParseTimePtr(usedAt)
	return rec, nil
}

func scanResetTokenRow(row *sql.Row) (resetTokenRecord, error) {
	var rec resetTokenRecord
	var expiresAt, usedAt any
	if err := row.Scan(&rec.ID, &rec.UserID, &expiresAt, &usedAt); err != nil {
		return resetTokenRecord{}, err
	}
	rec.ExpiresAt = mustParseTime(expiresAt)
	rec.UsedAt = mustParseTimePtr(usedAt)
	return rec, nil
}

func scanActivityRows(rows *sql.Rows) ([]userActivity, error) {
	var items []userActivity
	for rows.Next() {
		var item userActivity
		var details, createdAt any
		if err := rows.Scan(&item.ID, &item.UserID, &item.Action, &details, &createdAt); err != nil {
			return nil, err
		}
		item.Details = mustParseString(details)
		item.CreatedAt = mustParseTime(createdAt)
		items = append(items, item)
	}
	return items, rows.Err()
}

func mustParseTime(value any) time.Time {
	switch v := value.(type) {
	case time.Time:
		return v.UTC()
	case *time.Time:
		if v == nil {
			return time.Time{}
		}
		return v.UTC()
	case string:
		ts, _ := time.Parse(time.RFC3339, v)
		return ts
	case []byte:
		ts, _ := time.Parse(time.RFC3339, string(v))
		return ts
	case sql.NullString:
		if !v.Valid {
			return time.Time{}
		}
		ts, _ := time.Parse(time.RFC3339, v.String)
		return ts
	default:
		return time.Time{}
	}
}

func mustParseTimePtr(value any) *time.Time {
	switch v := value.(type) {
	case nil:
		return nil
	case time.Time:
		ts := v.UTC()
		return &ts
	case *time.Time:
		if v == nil {
			return nil
		}
		ts := v.UTC()
		return &ts
	case string:
		if v == "" {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, v)
		return &ts
	case []byte:
		if len(v) == 0 {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, string(v))
		return &ts
	case sql.NullString:
		if !v.Valid {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, v.String)
		return &ts
	default:
		return nil
	}
}

func mustParseString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case []byte:
		return string(v)
	case sql.NullString:
		if v.Valid {
			return v.String
		}
		return ""
	default:
		return ""
	}
}

func mustParseStringPtr(value any) *string {
	switch v := value.(type) {
	case nil:
		return nil
	case string:
		if v == "" {
			return nil
		}
		return &v
	case []byte:
		if len(v) == 0 {
			return nil
		}
		s := string(v)
		return &s
	case sql.NullString:
		if !v.Valid {
			return nil
		}
		return &v.String
	default:
		return nil
	}
}

func ensureRows(res sql.Result) error {
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func wrapNotFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return sql.ErrNoRows
	}
	return err
}
