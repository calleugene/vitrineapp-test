package auth

import "encoding/json"

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type visitorRegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type registerResponse struct {
	User                   User   `json:"user"`
	EmailVerificationToken string `json:"email_verification_token,omitempty"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type tokenPairResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (r *logoutRequest) UnmarshalJSON(data []byte) error {
	type alias struct {
		RefreshTokenSnake string `json:"refresh_token"`
		RefreshTokenCamel string `json:"refreshToken"`
	}
	var payload alias
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	r.RefreshToken = payload.RefreshTokenSnake
	if r.RefreshToken == "" {
		r.RefreshToken = payload.RefreshTokenCamel
	}
	return nil
}

func (r *refreshRequest) UnmarshalJSON(data []byte) error {
	type alias struct {
		RefreshTokenSnake string `json:"refresh_token"`
		RefreshTokenCamel string `json:"refreshToken"`
	}
	var payload alias
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	r.RefreshToken = payload.RefreshTokenSnake
	if r.RefreshToken == "" {
		r.RefreshToken = payload.RefreshTokenCamel
	}
	return nil
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type forgotPasswordResponse struct {
	Message    string `json:"message"`
	ResetToken string `json:"reset_token,omitempty"`
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

type verifyEmailRequest struct {
	Token string `json:"token"`
}

type meResponse struct {
	User User `json:"user"`
}

type userResponse struct {
	User User `json:"user"`
}

type updateUserRequest struct {
	FullName             *string  `json:"full_name,omitempty"`
	Phone                *string  `json:"phone,omitempty"`
	Position             *string  `json:"position,omitempty"`
	About                *string  `json:"about,omitempty"`
	BirthDate            *string  `json:"birth_date,omitempty"`
	Gender               *string  `json:"gender,omitempty"`
	Timezone             *string  `json:"timezone,omitempty"`
	InterfaceLanguage    *string  `json:"interface_language,omitempty"`
	ExtraLanguages       []string `json:"extra_languages,omitempty"`
	Note                 *string  `json:"note,omitempty"`
	NotificationsEnabled *bool    `json:"notifications_enabled,omitempty"`
}

type rolesResponse struct {
	Roles          []string `json:"roles"`
	AvailableRoles []string `json:"available_roles"`
}

type addRoleRequest struct {
	Role string `json:"role"`
}

type museumsResponse struct {
	Museums []museumAccess `json:"museums"`
}

type activityResponse struct {
	Activities []userActivity `json:"activities"`
}

type avatarResponse struct {
	AvatarURL string `json:"avatar_url"`
}

type resetPasswordAdminRequest struct {
	NewPassword string `json:"new_password"`
}

type messageResponse struct {
	Message string `json:"message"`
}

type userProfileResponse struct {
	User User `json:"user"`
}

type updateLevelRequest struct {
	Level string `json:"level"`
}

type updateLocaleRequest struct {
	Locale string `json:"locale"`
}
