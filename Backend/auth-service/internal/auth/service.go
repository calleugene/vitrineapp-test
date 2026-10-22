package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"
)

type Service struct {
	repo       Repository
	config     Config
	httpClient *http.Client
}

func NewService(repo Repository, config Config) *Service {
	client := config.MuseumHTTPClient
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &Service{repo: repo, config: config, httpClient: client}
}

func (s *Service) Register(ctx context.Context, req registerRequest) (registerResponse, error) {
	if err := validateConsents(req.Consents); err != nil {
		return registerResponse{}, err
	}
	return s.register(ctx, req, "methodist")
}

func (s *Service) RegisterVisitor(ctx context.Context, req visitorRegisterRequest) (registerResponse, error) {
	name := strings.TrimSpace(req.DisplayName)
	if name == "" {
		name = "Посетитель"
	}
	return s.register(ctx, registerRequest{Email: req.Email, Password: req.Password, FullName: name}, "visitor")
}

func (s *Service) register(ctx context.Context, req registerRequest, role string) (registerResponse, error) {
	email := normalizeEmail(req.Email)
	if !validEmail(email) || strings.TrimSpace(req.Password) == "" || strings.TrimSpace(req.FullName) == "" || (utf8.RuneCountInString(req.Password) < 12 || len(req.Password) > 1024) {
		return registerResponse{}, ErrBadRequest
	}
	if _, err := s.repo.FindUserByEmail(ctx, email); err == nil {
		return registerResponse{}, ErrEmailAlreadyExists
	} else if !errors.Is(err, sql.ErrNoRows) {
		return registerResponse{}, err
	}

	now := s.config.now()
	user := User{
		ID:                   newID("usr"),
		registrationConsents: req.Consents,
		Email:                email,
		FullName:             strings.TrimSpace(req.FullName),
		Role:                 role,
		Status:               "ACTIVE",
		NotificationsEnabled: true,
		RegisteredAt:         now,
		RegistrationSource:   "direct",
		CreatedAt:            now,
		UpdatedAt:            now,
	}
	if role == "methodist" {
		museumID, err := newMuseumID()
		if err != nil {
			return registerResponse{}, err
		}
		user.MuseumID = &museumID
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		return registerResponse{}, err
	}
	if err := s.repo.CreateUser(ctx, user, hash); err != nil {
		if isSQLiteConstraint(err) {
			return registerResponse{}, ErrEmailAlreadyExists
		}
		return registerResponse{}, err
	}

	token, tokenHash, err := generateOpaqueToken()
	if err != nil {
		return registerResponse{}, err
	}
	if err := s.repo.CreateEmailVerificationToken(ctx, newID("evt"), user.ID, tokenHash, now.Add(s.config.VerifyTokenTTL), now); err != nil {
		return registerResponse{}, err
	}
	resp := registerResponse{User: user}
	if s.config.ExposeDebugTokens {
		resp.EmailVerificationToken = token
	}
	return resp, nil
}

func (s *Service) Login(ctx context.Context, req loginRequest) (tokenPairResponse, error) {
	return s.login(ctx, req, "")
}

func (s *Service) LoginVisitor(ctx context.Context, req loginRequest) (tokenPairResponse, error) {
	return s.login(ctx, req, "visitor")
}

func (s *Service) login(ctx context.Context, req loginRequest, requiredRole string) (tokenPairResponse, error) {
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		return tokenPairResponse{}, ErrBadRequest
	}
	user, passwordHash, err := s.repo.FindUserWithPasswordByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return tokenPairResponse{}, ErrInvalidCredentials
		}
		return tokenPairResponse{}, err
	}
	if !verifyPassword(req.Password, passwordHash) {
		return tokenPairResponse{}, ErrInvalidCredentials
	}
	if requiredRole != "" && user.Role != requiredRole {
		return tokenPairResponse{}, ErrInvalidCredentials
	}
	if user.Status == "disabled" || user.Status == "DELETED" {
		return tokenPairResponse{}, ErrUserBlocked
	}
	if passwordNeedsRehash(passwordHash) {
		hash, err := hashPassword(req.Password)
		if err != nil {
			return tokenPairResponse{}, err
		}
		if err := s.repo.UpdateUserPassword(ctx, user.ID, hash, s.config.now()); err != nil {
			return tokenPairResponse{}, err
		}
	}
	now := s.config.now()
	if err := s.repo.UpdateLastLogin(ctx, user.ID, now); err != nil {
		return tokenPairResponse{}, err
	}
	return s.issueSession(ctx, user)
}

func (s *Service) Logout(ctx context.Context, accessToken, refreshToken string) error {
	claims, err := s.parseAccessToken(accessToken)
	if err != nil {
		return ErrUnauthorized
	}
	session, err := s.repo.FindSessionByID(ctx, claims.SessionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUnauthorized
		}
		return err
	}
	if tokenHashString(refreshToken) != session.RefreshTokenHash {
		return ErrUnauthorized
	}
	return s.repo.RevokeSession(ctx, session.ID, s.config.now())
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (tokenPairResponse, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return tokenPairResponse{}, ErrBadRequest
	}
	tokenHash := tokenHashString(refreshToken)
	session, err := s.repo.FindSessionByRefreshHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return tokenPairResponse{}, ErrUnauthorized
		}
		return tokenPairResponse{}, err
	}
	now := s.config.now()
	if session.RevokedAt != nil || session.RefreshExpiresAt.Before(now) {
		return tokenPairResponse{}, ErrUnauthorized
	}
	user, err := s.repo.FindUserByID(ctx, session.UserID)
	if err != nil {
		return tokenPairResponse{}, err
	}
	if user.Status == "disabled" || user.Status == "DELETED" {
		return tokenPairResponse{}, ErrUserBlocked
	}
	return s.rotateSession(ctx, user, tokenHash)
}

func (s *Service) ForgotPassword(ctx context.Context, email string) (forgotPasswordResponse, error) {
	resp := forgotPasswordResponse{Message: "Если аккаунт с указанной почтой существует, мы отправили письмо с инструкцией по восстановлению пароля"}
	if s.config.SendPasswordReset == nil {
		return resp, ErrServiceUnavailable
	}
	email = normalizeEmail(email)
	if !validEmail(email) {
		return resp, ErrBadRequest
	}
	allowed, err := s.repo.AllowPasswordReset(ctx, "email:"+tokenHashString(email), s.config.now())
	if err != nil {
		return resp, err
	}
	if !allowed {
		return resp, nil
	}
	// Queue every address identically; account lookup and SMTP happen off the request path.
	err = s.repo.QueuePasswordReset(ctx, newID("mail"), email, s.config.now())
	return resp, err
}

func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	if strings.TrimSpace(token) == "" || strings.TrimSpace(newPassword) == "" || (utf8.RuneCountInString(newPassword) < 12 || len(newPassword) > 1024) {
		return ErrBadRequest
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	err = s.repo.ConsumePasswordResetToken(ctx, tokenHashString(token), hash, s.config.now())
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}

func (s *Service) VerifyEmail(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return ErrBadRequest
	}
	err := s.repo.ConsumeEmailVerificationToken(ctx, tokenHashString(token), s.config.now())
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidToken
	}
	return err
}

func (s *Service) Me(ctx context.Context, accessToken string) (User, error) {
	_, user, err := s.Authenticate(ctx, accessToken)
	return user, err
}

// ProvisionMuseumContext assigns an existing methodist a museum only once.
// The new access token keeps the current session and refresh token valid.
func (s *Service) ProvisionMuseumContext(ctx context.Context, accessToken string) (museumContextResponse, error) {
	claims, user, err := s.Authenticate(ctx, accessToken)
	if err != nil {
		return museumContextResponse{}, err
	}
	if !strings.EqualFold(user.Status, "active") {
		return museumContextResponse{}, ErrForbidden
	}
	if user.Role != "methodist" {
		return museumContextResponse{}, ErrForbidden
	}
	if user.MuseumID == nil {
		museumID, err := newMuseumID()
		if err != nil {
			return museumContextResponse{}, err
		}
		user, err = s.repo.EnsureMuseumID(ctx, user.ID, museumID, s.config.now())
		if err != nil {
			return museumContextResponse{}, err
		}
	}
	if user.Role != "methodist" || user.MuseumID == nil {
		return museumContextResponse{}, ErrForbidden
	}
	claims.MuseumID = *user.MuseumID
	claims.ExpiresAt = s.config.now().Add(s.config.AccessTokenTTL).Unix()
	token, err := s.signAccessToken(claims)
	if err != nil {
		return museumContextResponse{}, err
	}
	return museumContextResponse{User: user, AccessToken: token, TokenType: "Bearer", ExpiresIn: int64(s.config.AccessTokenTTL.Seconds())}, nil
}

func (s *Service) Authenticate(ctx context.Context, accessToken string) (accessClaims, User, error) {
	claims, err := s.parseAccessToken(accessToken)
	if err != nil {
		return accessClaims{}, User{}, ErrUnauthorized
	}
	session, err := s.repo.FindSessionByID(ctx, claims.SessionID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return accessClaims{}, User{}, ErrUnauthorized
		}
		return accessClaims{}, User{}, err
	}
	if session.UserID != claims.UserID || session.RevokedAt != nil || !session.RefreshExpiresAt.After(s.config.now()) {
		return accessClaims{}, User{}, ErrUnauthorized
	}
	user, err := s.repo.FindUserByID(ctx, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return accessClaims{}, User{}, ErrUnauthorized
		}
		return accessClaims{}, User{}, err
	}
	if user.Status == "disabled" || user.Status == "DELETED" {
		return accessClaims{}, User{}, ErrUserBlocked
	}
	return claims, user, nil
}

func (s *Service) AuthorizeTarget(ctx context.Context, accessToken, targetUserID string, adminOnly bool) error {
	_, actor, err := s.Authenticate(ctx, accessToken)
	if err != nil {
		return err
	}
	if !strings.EqualFold(actor.Status, "active") {
		return ErrForbidden
	}
	if !adminOnly && actor.ID == targetUserID {
		return nil
	}
	if actor.Role != "museum_admin" {
		return ErrForbidden
	}
	target, err := s.repo.FindUserByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	if actor.MuseumID != nil {
		role, err := s.repo.MuseumRole(ctx, actor.ID, *actor.MuseumID)
		if err != nil || (role != "owner" && role != "museum_admin") {
			return ErrForbidden
		}
	}
	if actor.MuseumID == nil || target.MuseumID == nil || *actor.MuseumID != *target.MuseumID {
		return ErrForbidden
	}
	return nil
}

func (s *Service) GetUser(ctx context.Context, userID string) (User, error) {
	return s.repo.FindUserByID(ctx, userID)
}

func (s *Service) UpdateUser(ctx context.Context, userID string, req updateUserRequest) (User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return User{}, err
	}
	if !strings.EqualFold(user.Status, "active") {
		return User{}, ErrForbidden
	}
	if req.Email != nil && normalizeEmail(*req.Email) != user.Email {
		return User{}, ErrEmailConfirmationRequired
	}
	if req.FullName != nil && (len(strings.TrimSpace(*req.FullName)) == 0 || len(*req.FullName) > 200) {
		return User{}, ErrBadRequest
	}
	if req.About != nil && len([]rune(*req.About)) > 500 {
		return User{}, ErrBadRequest
	}
	if req.Phone != nil && len(*req.Phone) > 40 {
		return User{}, ErrBadRequest
	}
	if req.FullName != nil {
		user.FullName = strings.TrimSpace(*req.FullName)
	}
	if req.Phone != nil {
		user.Phone = strings.TrimSpace(*req.Phone)
	}
	if req.Position != nil {
		user.Position = strings.TrimSpace(*req.Position)
	}
	if req.About != nil {
		user.About = strings.TrimSpace(*req.About)
	}
	if req.BirthDate != nil {
		user.BirthDate = strings.TrimSpace(*req.BirthDate)
	}
	if req.Gender != nil {
		user.Gender = strings.TrimSpace(*req.Gender)
	}
	if req.Timezone != nil {
		user.Timezone = strings.TrimSpace(*req.Timezone)
	}
	if req.InterfaceLanguage != nil {
		user.InterfaceLanguage = strings.TrimSpace(*req.InterfaceLanguage)
	}
	if req.ExtraLanguages != nil {
		extraJSON, _ := json.Marshal(req.ExtraLanguages)
		user.ExtraLanguages = string(extraJSON)
	}
	if req.Note != nil {
		user.Note = strings.TrimSpace(*req.Note)
	}
	if req.NotificationsEnabled != nil {
		user.NotificationsEnabled = *req.NotificationsEnabled
	}
	user.UpdatedAt = s.config.now()
	if err := s.repo.UpdateUser(ctx, user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (s *Service) UpdateUserAvatar(ctx context.Context, userID, avatarURL string) (User, error) {
	if _, err := s.repo.FindUserByID(ctx, userID); err != nil {
		return User{}, err
	}
	if err := s.repo.UpdateUserAvatar(ctx, userID, avatarURL, s.config.now()); err != nil {
		return User{}, err
	}
	return s.repo.FindUserByID(ctx, userID)
}

func (s *Service) GetUserRoles(ctx context.Context, userID string) (rolesResponse, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return rolesResponse{}, err
	}
	var roleLabels []string
	switch user.Role {
	case "methodist":
		roleLabels = []string{"Методист"}
	case "visitor":
		roleLabels = []string{"Посетитель"}
	case "museum_admin":
		roleLabels = []string{"Администратор музея"}
	case "moderator":
		roleLabels = []string{"Модератор"}
	default:
		roleLabels = []string{user.Role}
	}
	return rolesResponse{
		Roles:          roleLabels,
		AvailableRoles: []string{"methodist", "museum_admin", "moderator"},
	}, nil
}

func (s *Service) AddRole(ctx context.Context, userID, role string) error {
	if !validRole(role) {
		return ErrBadRequest
	}
	return s.repo.UpdateUserRole(ctx, userID, role, s.config.now())
}

func (s *Service) RemoveRole(ctx context.Context, userID, role string) error {
	if !validRole(role) {
		return ErrBadRequest
	}
	// For simplicity, reset to methodist when removing a role
	return s.repo.UpdateUserRole(ctx, userID, "methodist", s.config.now())
}

func (s *Service) GetUserMuseums(ctx context.Context, userID string) ([]museumAccess, error) {
	memberships, err := s.repo.MuseumMemberships(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := []museumAccess{}
	for _, membership := range memberships {
		m, err := s.loadMuseum(ctx, membership.ID)
		if errors.Is(err, ErrNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		m.Role = membership.Role
		m.AccessLevel = membership.AccessLevel
		result = append(result, m)
	}
	return result, nil
}

func (s *Service) loadMuseum(ctx context.Context, id string) (museumAccess, error) {
	base := strings.TrimRight(s.config.MuseumServiceURL, "/")
	if base == "" {
		base = "http://localhost:8081/api/v1"
	}
	req, err := http.NewRequestWithContext(ctx, "GET", base+"/internal/museums/"+id, nil)
	if err != nil {
		return museumAccess{}, err
	}
	req.Header.Set("X-Service-Secret", s.config.TokenSecret)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return museumAccess{}, ErrServiceUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return museumAccess{}, ErrNotFound
	}
	if resp.StatusCode != 200 {
		return museumAccess{}, ErrServiceUnavailable
	}
	var result struct {
		Museum struct {
			ID      string `json:"museum_id"`
			Name    string `json:"name"`
			Address string `json:"address"`
			LogoURL string `json:"logo_url"`
		} `json:"museum"`
	}
	if err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return museumAccess{}, ErrServiceUnavailable
	}
	if result.Museum.ID != id || result.Museum.Name == "" {
		return museumAccess{}, ErrCodeInvalid
	}
	return museumAccess{ID: id, Name: result.Museum.Name, City: result.Museum.Address, LogoURL: result.Museum.LogoURL}, nil
}

func (s *Service) GetUserActivity(ctx context.Context, userID string) ([]userActivity, error) {
	return s.repo.GetUserActivity(ctx, userID)
}

func (s *Service) BlockUser(ctx context.Context, userID string) (User, error) {
	existing, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return User{}, err
	}
	if existing.Status == "DORMANT" || existing.Status == "DELETED" {
		return User{}, ErrForbidden
	}
	now := s.config.now()
	user, err := s.repo.UpdateUserStatus(ctx, userID, "disabled", now)
	if err != nil {
		return User{}, err
	}
	if err := s.repo.RevokeSessionsByUserID(ctx, userID, now); err != nil {
		return User{}, err
	}
	return user, nil
}

func (s *Service) UnblockUser(ctx context.Context, userID string) (User, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		return User{}, err
	}
	if user.Status != "disabled" {
		return User{}, ErrForbidden
	}
	return s.repo.UpdateUserStatus(ctx, userID, "active", s.config.now())
}

func (s *Service) ResetUserPassword(ctx context.Context, userID, newPassword string) error {
	if strings.TrimSpace(newPassword) == "" || (utf8.RuneCountInString(newPassword) < 12 || len(newPassword) > 1024) {
		return ErrBadRequest
	}
	hash, err := hashPassword(newPassword)
	if err != nil {
		return err
	}
	now := s.config.now()
	if err := s.repo.UpdateUserPassword(ctx, userID, hash, now); err != nil {
		return err
	}
	return s.repo.RevokeSessionsByUserID(ctx, userID, now)
}

func (s *Service) issueSession(ctx context.Context, user User) (tokenPairResponse, error) {
	now := s.config.now()
	sessionID := newID("ses")
	refreshToken, refreshHash, err := generateOpaqueToken()
	if err != nil {
		return tokenPairResponse{}, err
	}
	session := Session{
		ID:               sessionID,
		UserID:           user.ID,
		RefreshTokenHash: refreshHash,
		RefreshExpiresAt: now.Add(s.config.RefreshTokenTTL),
		CreatedAt:        now,
	}
	if err := s.repo.CreateSession(ctx, session); err != nil {
		return tokenPairResponse{}, err
	}
	museumID := ""
	if user.MuseumID != nil {
		museumID = *user.MuseumID
	}
	accessToken, err := s.signAccessToken(accessClaims{
		UserID:    user.ID,
		SessionID: sessionID,
		MuseumID:  museumID,
		Role:      user.Role,
		ExpiresAt: now.Add(s.config.AccessTokenTTL).Unix(),
	})
	if err != nil {
		return tokenPairResponse{}, err
	}
	return tokenPairResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.config.AccessTokenTTL.Seconds()),
	}, nil
}

func (s *Service) rotateSession(ctx context.Context, user User, oldRefreshHash string) (tokenPairResponse, error) {
	now := s.config.now()
	refreshToken, refreshHash, err := generateOpaqueToken()
	if err != nil {
		return tokenPairResponse{}, err
	}
	session := Session{
		ID: newID("ses"), UserID: user.ID, RefreshTokenHash: refreshHash,
		RefreshExpiresAt: now.Add(s.config.RefreshTokenTTL), CreatedAt: now,
	}
	museumID := ""
	if user.MuseumID != nil {
		museumID = *user.MuseumID
	}
	accessToken, err := s.signAccessToken(accessClaims{UserID: user.ID, SessionID: session.ID, MuseumID: museumID, Role: user.Role, ExpiresAt: now.Add(s.config.AccessTokenTTL).Unix()})
	if err != nil {
		return tokenPairResponse{}, err
	}
	if _, err := s.repo.RotateSession(ctx, oldRefreshHash, now, session); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return tokenPairResponse{}, ErrUnauthorized
		}
		return tokenPairResponse{}, err
	}
	return tokenPairResponse{AccessToken: accessToken, RefreshToken: refreshToken, TokenType: "Bearer", ExpiresIn: int64(s.config.AccessTokenTTL.Seconds())}, nil
}

func (s *Service) UpdateUserLevel(ctx context.Context, userID, level string) error {
	if strings.TrimSpace(userID) == "" || !validLevel(level) {
		return ErrBadRequest
	}
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	user.Level = level
	user.UpdatedAt = s.config.now()
	return s.repo.UpdateUser(ctx, user)
}

func (s *Service) SetGuestFlag(ctx context.Context, userID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrBadRequest
	}
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	user.IsGuest = true
	user.UpdatedAt = s.config.now()
	return s.repo.UpdateUser(ctx, user)
}

func (s *Service) UpdateLocale(ctx context.Context, userID, locale string) error {
	if strings.TrimSpace(userID) == "" || !validLocale(locale) {
		return ErrBadRequest
	}
	user, err := s.repo.FindUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	user.Locale = locale
	user.UpdatedAt = s.config.now()
	return s.repo.UpdateUser(ctx, user)
}

func normalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }
func validRole(role string) bool {
	return role == "visitor" || role == "methodist" || role == "museum_admin" || role == "moderator"
}
func validLevel(level string) bool {
	return level == "новичок" || level == "исследователь" || level == "эксперт"
}
func validLocale(locale string) bool { return locale == "ru" || locale == "en" }

func validEmail(email string) bool {
	if len(email) > 254 || strings.ContainsAny(email, "\r\n") {
		return false
	}
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email
}
