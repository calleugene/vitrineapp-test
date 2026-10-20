package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

var (
	ErrCodeNotFound              = errors.New("code_not_found")
	ErrCodeInvalid               = errors.New("code_invalid")
	ErrAlreadyJoined             = errors.New("already_joined")
	ErrJoinRateLimited           = errors.New("join_rate_limited")
	ErrEmailConfirmationRequired = errors.New("email_confirmation_required")
)

func (s *Service) profileRoutes(mux *http.ServeMux) {
	for _, prefix := range []string{"", "/api/v1"} {
		mux.HandleFunc("POST "+prefix+"/auth/deactivate", s.accountTransition(false))
		mux.HandleFunc("POST "+prefix+"/auth/reactivate", s.accountTransition(true))
		mux.HandleFunc("POST "+prefix+"/auth/museums/join", s.joinMuseum)
		mux.HandleFunc("POST "+prefix+"/auth/museums/select", s.selectMuseum)
		mux.HandleFunc("POST "+prefix+"/auth/museums/code", s.museumCode)
		mux.HandleFunc("DELETE "+prefix+"/auth/museums/code", s.museumCode)
		mux.HandleFunc("POST "+prefix+"/auth/email-change", s.requestEmailChange)
		mux.HandleFunc("POST "+prefix+"/auth/email-change/confirm", s.confirmEmailChange)
		mux.HandleFunc("GET "+prefix+"/auth/authorize-museum", func(w http.ResponseWriter, r *http.Request) {
			claims, user, err := s.Authenticate(r.Context(), bearerToken(r.Header.Get("Authorization")))
			if err != nil {
				writeServiceError(w, err)
				return
			}
			if !strings.EqualFold(user.Status, "active") {
				writeServiceError(w, ErrForbidden)
				return
			}
			if _, err = s.repo.MuseumRole(r.Context(), user.ID, claims.MuseumID); err != nil {
				writeServiceError(w, ErrForbidden)
				return
			}
			// The active context is validated against persisted membership, not a submitted ID.
			user.MuseumID = &claims.MuseumID
			writeJSON(w, 200, meResponse{User: user})
		})
	}
}
func (s *Service) activeUser(w http.ResponseWriter, r *http.Request) (User, bool) {
	_, user, err := s.Authenticate(r.Context(), bearerToken(r.Header.Get("Authorization")))
	if err != nil {
		writeServiceError(w, err)
		return User{}, false
	}
	if !strings.EqualFold(user.Status, "active") {
		writeServiceError(w, ErrForbidden)
		return User{}, false
	}
	return user, true
}
func (s *Service) accountTransition(activate bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, user, err := s.Authenticate(r.Context(), bearerToken(r.Header.Get("Authorization")))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if err = s.repo.TransitionAccount(r.Context(), user.ID, activate, s.config.now()); err != nil {
			writeServiceError(w, err)
			return
		}
		user, err = s.repo.FindUserByID(r.Context(), user.ID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, 200, userResponse{User: user})
	}
}
func (s *Service) joinMuseum(w http.ResponseWriter, r *http.Request) {
	user, ok := s.activeUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Code     string `json:"code"`
		MuseumID string `json:"museum_id"`
	}
	if decodeJSON(r.Body, &req) != nil || len(req.Code) > 512 || strings.TrimSpace(req.MuseumID) == "" || len(req.MuseumID) > 128 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if err := s.repo.JoinMuseum(r.Context(), user.ID, strings.TrimSpace(req.MuseumID), tokenHashString(strings.TrimSpace(req.Code)), s.config.now()); err != nil {
		writeServiceError(w, err)
		return
	}
	museums, err := s.GetUserMuseums(r.Context(), user.ID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, museumsResponse{Museums: museums})
}
func (s *Service) selectMuseum(w http.ResponseWriter, r *http.Request) {
	user, ok := s.activeUser(w, r)
	if !ok {
		return
	}
	var req struct {
		MuseumID string `json:"museum_id"`
	}
	if decodeJSON(r.Body, &req) != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if err := s.repo.SetActiveMuseum(r.Context(), user.ID, req.MuseumID); err != nil {
		writeServiceError(w, ErrForbidden)
		return
	}
	claims, _, err := s.Authenticate(r.Context(), bearerToken(r.Header.Get("Authorization")))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	user, err = s.repo.FindUserByID(r.Context(), user.ID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	claims.MuseumID = req.MuseumID
	claims.ExpiresAt = s.config.now().Add(s.config.AccessTokenTTL).Unix()
	token, err := s.signAccessToken(claims)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, museumContextResponse{User: user, AccessToken: token, TokenType: "Bearer", ExpiresIn: int64(s.config.AccessTokenTTL.Seconds())})
}
func (s *Service) museumCode(w http.ResponseWriter, r *http.Request) {
	user, ok := s.activeUser(w, r)
	if !ok {
		return
	}
	if user.MuseumID == nil {
		writeServiceError(w, ErrForbidden)
		return
	}
	role, err := s.repo.MuseumRole(r.Context(), user.ID, *user.MuseumID)
	if err != nil || (role != "owner" && role != "museum_admin") {
		writeServiceError(w, ErrForbidden)
		return
	}
	if r.Method == http.MethodDelete {
		if err = s.repo.RevokeMuseumCode(r.Context(), *user.MuseumID); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(204)
		return
	}
	// Refuse to invite users to a museum without a real organization profile.
	if _, err = s.loadMuseum(r.Context(), *user.MuseumID); err != nil {
		writeServiceError(w, err)
		return
	}
	code, hash, err := generateOpaqueToken()
	if err != nil {
		writeServiceError(w, err)
		return
	}
	expiry := s.config.now().Add(7 * 24 * time.Hour)
	if err = s.repo.RotateMuseumCode(r.Context(), *user.MuseumID, hash, expiry); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"code": code, "museum_id": *user.MuseumID, "expires_at": expiry})
}
func (s *Service) uploadProfileAvatar(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, _, err := r.FormFile("file")
	if err != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, (5<<20)+1))
	if err != nil || len(data) > 5<<20 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") || cfg.Width*cfg.Height > 25000000 {
		writeServiceError(w, ErrBadRequest)
		return
	}
	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	width, height := cfg.Width, cfg.Height
	if width > 512 || height > 512 {
		if width >= height {
			height = max(1, height*512/width)
			width = 512
		} else {
			width = max(1, width*512/height)
			height = 512
		}
	}
	thumb := image.NewRGBA(image.Rect(0, 0, width, height))
	bounds := source.Bounds()
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			c := color.NRGBAModel.Convert(source.At(bounds.Min.X+x*cfg.Width/width, bounds.Min.Y+y*cfg.Height/height)).(color.NRGBA)
			a := uint32(c.A)
			thumb.SetRGBA(x, y, color.RGBA{R: uint8((uint32(c.R)*a + 255*(255-a)) / 255), G: uint8((uint32(c.G)*a + 255*(255-a)) / 255), B: uint8((uint32(c.B)*a + 255*(255-a)) / 255), A: 255})
		}
	}
	var encoded bytes.Buffer
	if err = jpeg.Encode(&encoded, thumb, &jpeg.Options{Quality: 85}); err != nil {
		writeServiceError(w, err)
		return
	}
	url := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(encoded.Bytes())
	user, err := s.UpdateUserAvatar(r.Context(), r.PathValue("userId"), url)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, userResponse{User: user})
}
func (s *Service) requestEmailChange(w http.ResponseWriter, r *http.Request) {
	user, ok := s.activeUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Email string `json:"email"`
	}
	if decodeJSON(r.Body, &req) != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	email := normalizeEmail(req.Email)
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || len(email) > 254 || email == user.Email {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if _, err = s.repo.FindUserByEmail(r.Context(), email); err == nil {
		writeServiceError(w, ErrEmailAlreadyExists)
		return
	}
	allowed, limitErr := s.repo.AllowPasswordReset(r.Context(), "email-change:"+user.ID, s.config.now())
	if limitErr != nil {
		writeServiceError(w, limitErr)
		return
	}
	if !allowed {
		writeError(w, 429, "email_change_rate_limited")
		return
	}
	token, hash, err := generateOpaqueToken()
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if s.config.SendEmailChange == nil && !s.config.ExposeDebugTokens {
		writeServiceError(w, ErrServiceUnavailable)
		return
	}
	if err = s.repo.SaveEmailChange(r.Context(), user.ID, email, hash, s.config.now().Add(time.Hour)); err != nil {
		writeServiceError(w, err)
		return
	}
	if s.config.SendEmailChange != nil {
		if err = s.config.SendEmailChange(r.Context(), email, token); err != nil {
			writeServiceError(w, ErrServiceUnavailable)
			return
		}
	}
	result := map[string]string{"message": "email_confirmation_sent"}
	if s.config.ExposeDebugTokens {
		result["debug_token"] = token
	}
	writeJSON(w, 200, result)
}
func (s *Service) confirmEmailChange(w http.ResponseWriter, r *http.Request) {
	user, ok := s.activeUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Token string `json:"token"`
	}
	if decodeJSON(r.Body, &req) != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if err := s.repo.ConfirmEmailChange(r.Context(), user.ID, tokenHashString(req.Token), s.config.now()); err != nil {
		writeServiceError(w, err)
		return
	}
	user, err := s.repo.FindUserByID(r.Context(), user.ID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, 200, userResponse{User: user})
}

// RunAccountDeletion is idempotent and may be called by each service replica.
func (s *Service) RunAccountDeletion(ctx context.Context) error {
	return s.repo.DeleteExpiredAccounts(ctx, s.config.now())
}
