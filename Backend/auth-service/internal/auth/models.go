package auth

import "time"

type User struct {
	registrationConsents []consentInput
	DeactivatedAt        *time.Time `json:"deactivated_at,omitempty"`
	ScheduledDeletionAt  *time.Time `json:"scheduled_deletion_at,omitempty"`
	ID                   string     `json:"id"`
	Email                string     `json:"email"`
	FullName             string     `json:"full_name"`
	Role                 string     `json:"role"`
	MuseumID             *string    `json:"museum_id,omitempty"`
	Status               string     `json:"status"`
	Phone                string     `json:"phone,omitempty"`
	Position             string     `json:"position,omitempty"`
	About                string     `json:"about,omitempty"`
	BirthDate            string     `json:"birth_date,omitempty"`
	Gender               string     `json:"gender,omitempty"`
	Timezone             string     `json:"timezone,omitempty"`
	InterfaceLanguage    string     `json:"interface_language,omitempty"`
	ExtraLanguages       string     `json:"extra_languages,omitempty"`
	Note                 string     `json:"note,omitempty"`
	AvatarURL            string     `json:"avatar_url,omitempty"`
	NotificationsEnabled bool       `json:"notifications_enabled"`
	TwoFactorEnabled     bool       `json:"two_factor_enabled"`
	RegisteredAt         time.Time  `json:"registered_at"`
	LastLoginAt          *time.Time `json:"last_login_at,omitempty"`
	RegistrationSource   string     `json:"registration_source,omitempty"`
	EmailVerifiedAt      *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	Level                string     `json:"level"`
	IsGuest              bool       `json:"is_guest"`
	Locale               string     `json:"locale"`
}

type Session struct {
	ID               string
	UserID           string
	RefreshTokenHash string
	RefreshExpiresAt time.Time
	RevokedAt        *time.Time
	CreatedAt        time.Time
}

type verificationTokenRecord struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
	UsedAt    *time.Time
}

type resetTokenRecord struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
	UsedAt    *time.Time
}

type accessClaims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	MuseumID  string `json:"museum_id,omitempty"`
	Role      string `json:"role,omitempty"`
	ExpiresAt int64  `json:"exp"`
}

type userActivity struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"`
	Details   string    `json:"details,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type museumAccess struct {
	Role        string `json:"role,omitempty"`
	LogoURL     string `json:"logo_url,omitempty"`
	ID          string `json:"id"`
	Name        string `json:"name"`
	City        string `json:"city,omitempty"`
	AccessLevel string `json:"access_level"`
}
