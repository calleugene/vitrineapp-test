package auth

import (
	"context"
	"time"
)

type Repository interface {
	CreateUser(ctx context.Context, user User, passwordHash string) error
	FindUserByEmail(ctx context.Context, email string) (User, error)
	FindUserByID(ctx context.Context, userID string) (User, error)
	FindUserWithPasswordByEmail(ctx context.Context, email string) (User, string, error)
	UpdateUser(ctx context.Context, user User) error
	UpdateUserPassword(ctx context.Context, userID, passwordHash string, now time.Time) error
	UpdateUserAvatar(ctx context.Context, userID, avatarURL string, now time.Time) error
	UpdateUserRole(ctx context.Context, userID, role string, now time.Time) error
	UpdateUserStatus(ctx context.Context, userID, status string, now time.Time) (User, error)
	UpdateLastLogin(ctx context.Context, userID string, now time.Time) error
	VerifyUserEmail(ctx context.Context, userID string, now time.Time) error

	CreateSession(ctx context.Context, session Session) error
	FindSessionByID(ctx context.Context, sessionID string) (Session, error)
	FindSessionByRefreshHash(ctx context.Context, tokenHash string) (Session, error)
	RevokeSession(ctx context.Context, sessionID string, now time.Time) error
	RevokeSessionsByUserID(ctx context.Context, userID string, now time.Time) error
	RotateSession(ctx context.Context, refreshTokenHash string, now time.Time, next Session) (string, error)

	CreateEmailVerificationToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error
	FindEmailVerificationToken(ctx context.Context, tokenHash string) (verificationTokenRecord, error)
	MarkEmailVerificationTokenUsed(ctx context.Context, id string, now time.Time) error
	ConsumeEmailVerificationToken(ctx context.Context, tokenHash string, now time.Time) error

	CreatePasswordResetToken(ctx context.Context, id, userID, tokenHash string, expiresAt, createdAt time.Time) error
	FindPasswordResetToken(ctx context.Context, tokenHash string) (resetTokenRecord, error)
	MarkPasswordResetTokenUsed(ctx context.Context, id string, now time.Time) error
	ConsumePasswordResetToken(ctx context.Context, tokenHash, passwordHash string, now time.Time) error

	GetUserActivity(ctx context.Context, userID string) ([]userActivity, error)
}
