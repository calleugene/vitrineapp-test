package auth

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
)

func NewHandler(service *Service) http.Handler {
	mux := http.NewServeMux()
	requireTarget := func(next http.HandlerFunc, adminOnly bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if err := service.AuthorizeTarget(r.Context(), bearerToken(r.Header.Get("Authorization")), r.PathValue("userId"), adminOnly); err != nil {
				writeServiceError(w, err)
				return
			}
			next(w, r)
		}
	}

	registerHandler := func(w http.ResponseWriter, r *http.Request) {
		var req registerRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.Register(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	}
	visitorRegisterHandler := func(w http.ResponseWriter, r *http.Request) {
		var req visitorRegisterRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.RegisterVisitor(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	}
	loginHandler := func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.Login(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	visitorLoginHandler := func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.LoginVisitor(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	logoutHandler := func(w http.ResponseWriter, r *http.Request) {
		var req logoutRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.Logout(r.Context(), bearerToken(r.Header.Get("Authorization")), req.RefreshToken); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	refreshHandler := func(w http.ResponseWriter, r *http.Request) {
		var req refreshRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.Refresh(r.Context(), req.RefreshToken)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	forgotPasswordHandler := func(w http.ResponseWriter, r *http.Request) {
		var req forgotPasswordRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		resp, err := service.ForgotPassword(r.Context(), req.Email)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	resetPasswordHandler := func(w http.ResponseWriter, r *http.Request) {
		var req resetPasswordRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "password reset successful"})
	}
	verifyEmailHandler := func(w http.ResponseWriter, r *http.Request) {
		var req verifyEmailRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.VerifyEmail(r.Context(), req.Token); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "email verified"})
	}
	meHandler := func(w http.ResponseWriter, r *http.Request) {
		user, err := service.Me(r.Context(), bearerToken(r.Header.Get("Authorization")))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, meResponse{User: user})
	}
	getUserHandler := func(w http.ResponseWriter, r *http.Request) {
		user, err := service.GetUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userResponse{User: user})
	}
	updateUserHandler := func(w http.ResponseWriter, r *http.Request) {
		var req updateUserRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		user, err := service.UpdateUser(r.Context(), r.PathValue("userId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userResponse{User: user})
	}
	uploadAvatarHandler := func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotImplemented, "avatar_upload_unavailable")
	}
	getRolesHandler := func(w http.ResponseWriter, r *http.Request) {
		resp, err := service.GetUserRoles(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	addRoleHandler := func(w http.ResponseWriter, r *http.Request) {
		var req addRoleRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.AddRole(r.Context(), r.PathValue("userId"), req.Role); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "role added"})
	}
	removeRoleHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := service.RemoveRole(r.Context(), r.PathValue("userId"), r.PathValue("role")); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "role removed"})
	}
	getMuseumsHandler := func(w http.ResponseWriter, r *http.Request) {
		museums, err := service.GetUserMuseums(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if museums == nil {
			museums = []museumAccess{}
		}
		writeJSON(w, http.StatusOK, museumsResponse{Museums: museums})
	}
	getActivityHandler := func(w http.ResponseWriter, r *http.Request) {
		activities, err := service.GetUserActivity(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if activities == nil {
			activities = []userActivity{}
		}
		writeJSON(w, http.StatusOK, activityResponse{Activities: activities})
	}
	blockUserHandler := func(w http.ResponseWriter, r *http.Request) {
		user, err := service.BlockUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userResponse{User: user})
	}
	unblockUserHandler := func(w http.ResponseWriter, r *http.Request) {
		user, err := service.UnblockUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userResponse{User: user})
	}
	resetPasswordAdminHandler := func(w http.ResponseWriter, r *http.Request) {
		var req resetPasswordAdminRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.ResetUserPassword(r.Context(), r.PathValue("userId"), req.NewPassword); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "password reset successful"})
	}
	getUserProfileHandler := func(w http.ResponseWriter, r *http.Request) {
		user, err := service.GetUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userProfileResponse{User: user})
	}
	updateUserLevelHandler := func(w http.ResponseWriter, r *http.Request) {
		var req updateLevelRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.UpdateUserLevel(r.Context(), r.PathValue("userId"), req.Level); err != nil {
			writeServiceError(w, err)
			return
		}
		user, err := service.GetUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userProfileResponse{User: user})
	}
	setGuestFlagHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := service.SetGuestFlag(r.Context(), r.PathValue("userId")); err != nil {
			writeServiceError(w, err)
			return
		}
		user, err := service.GetUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userProfileResponse{User: user})
	}
	updateLocaleHandler := func(w http.ResponseWriter, r *http.Request) {
		var req updateLocaleRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.UpdateLocale(r.Context(), r.PathValue("userId"), req.Locale); err != nil {
			writeServiceError(w, err)
			return
		}
		user, err := service.GetUser(r.Context(), r.PathValue("userId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, userProfileResponse{User: user})
	}

	// Auth endpoints
	mux.HandleFunc("POST /auth/register", registerHandler)
	mux.HandleFunc("POST /api/v1/auth/register", registerHandler)
	mux.HandleFunc("POST /auth/visitor/register", visitorRegisterHandler)
	mux.HandleFunc("POST /api/v1/auth/visitor/register", visitorRegisterHandler)
	mux.HandleFunc("POST /auth/login", loginHandler)
	mux.HandleFunc("POST /api/v1/auth/login", loginHandler)
	mux.HandleFunc("POST /auth/visitor/login", visitorLoginHandler)
	mux.HandleFunc("POST /api/v1/auth/visitor/login", visitorLoginHandler)
	mux.HandleFunc("POST /auth/logout", logoutHandler)
	mux.HandleFunc("POST /api/v1/auth/logout", logoutHandler)
	mux.HandleFunc("POST /auth/refresh", refreshHandler)
	mux.HandleFunc("POST /api/v1/auth/refresh", refreshHandler)
	mux.HandleFunc("POST /auth/forgot-password", forgotPasswordHandler)
	mux.HandleFunc("POST /api/v1/auth/forgot-password", forgotPasswordHandler)
	mux.HandleFunc("POST /auth/reset-password", resetPasswordHandler)
	mux.HandleFunc("POST /api/v1/auth/reset-password", resetPasswordHandler)
	mux.HandleFunc("POST /auth/verify-email", verifyEmailHandler)
	mux.HandleFunc("POST /api/v1/auth/verify-email", verifyEmailHandler)
	mux.HandleFunc("GET /auth/me", meHandler)
	mux.HandleFunc("GET /api/v1/auth/me", meHandler)

	// User profile endpoints
	mux.Handle("GET /users/{userId}", requireTarget(getUserHandler, false))
	mux.Handle("GET /api/v1/users/{userId}", requireTarget(getUserHandler, false))
	mux.Handle("PATCH /users/{userId}", requireTarget(updateUserHandler, false))
	mux.Handle("PATCH /api/v1/users/{userId}", requireTarget(updateUserHandler, false))
	mux.Handle("POST /users/{userId}/avatar", requireTarget(uploadAvatarHandler, false))
	mux.Handle("POST /api/v1/users/{userId}/avatar", requireTarget(uploadAvatarHandler, false))
	mux.Handle("GET /users/{userId}/roles", requireTarget(getRolesHandler, false))
	mux.Handle("GET /api/v1/users/{userId}/roles", requireTarget(getRolesHandler, false))
	mux.Handle("POST /users/{userId}/roles", requireTarget(addRoleHandler, true))
	mux.Handle("POST /api/v1/users/{userId}/roles", requireTarget(addRoleHandler, true))
	mux.Handle("DELETE /users/{userId}/roles/{role}", requireTarget(removeRoleHandler, true))
	mux.Handle("DELETE /api/v1/users/{userId}/roles/{role}", requireTarget(removeRoleHandler, true))
	mux.Handle("GET /users/{userId}/museums", requireTarget(getMuseumsHandler, false))
	mux.Handle("GET /api/v1/users/{userId}/museums", requireTarget(getMuseumsHandler, false))
	mux.Handle("GET /users/{userId}/activity", requireTarget(getActivityHandler, false))
	mux.Handle("GET /api/v1/users/{userId}/activity", requireTarget(getActivityHandler, false))
	mux.Handle("POST /users/{userId}/block", requireTarget(blockUserHandler, true))
	mux.Handle("POST /api/v1/users/{userId}/block", requireTarget(blockUserHandler, true))
	mux.Handle("POST /users/{userId}/unblock", requireTarget(unblockUserHandler, true))
	mux.Handle("POST /api/v1/users/{userId}/unblock", requireTarget(unblockUserHandler, true))
	mux.Handle("POST /users/{userId}/reset-password", requireTarget(resetPasswordAdminHandler, true))
	mux.Handle("POST /api/v1/users/{userId}/reset-password", requireTarget(resetPasswordAdminHandler, true))

	// Gamification endpoints
	mux.Handle("GET /users/{userId}/profile", requireTarget(getUserProfileHandler, false))
	mux.Handle("GET /api/v1/users/{userId}/profile", requireTarget(getUserProfileHandler, false))
	mux.Handle("PATCH /users/{userId}/level", requireTarget(updateUserLevelHandler, true))
	mux.Handle("PATCH /api/v1/users/{userId}/level", requireTarget(updateUserLevelHandler, true))
	mux.Handle("POST /users/{userId}/guest-flag", requireTarget(setGuestFlagHandler, true))
	mux.Handle("POST /api/v1/users/{userId}/guest-flag", requireTarget(setGuestFlagHandler, true))
	mux.Handle("PATCH /users/{userId}/locale", requireTarget(updateLocaleHandler, false))
	mux.Handle("PATCH /api/v1/users/{userId}/locale", requireTarget(updateLocaleHandler, false))

	return http.MaxBytesHandler(mux, 6<<20)
}

func decodeJSON(body io.ReadCloser, dst any) error {
	defer body.Close()
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request must contain one JSON value")
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrBadRequest):
		writeError(w, http.StatusBadRequest, "bad_request")
	case errors.Is(err, ErrEmailAlreadyExists):
		writeError(w, http.StatusConflict, "email_already_exists")
	case errors.Is(err, ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
	case errors.Is(err, ErrInvalidToken):
		writeError(w, http.StatusBadRequest, "invalid_token")
	case errors.Is(err, ErrUnauthorized):
		writeError(w, http.StatusUnauthorized, "unauthorized")
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found")
	case errors.Is(err, ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden")
	case errors.Is(err, ErrUserBlocked):
		writeError(w, http.StatusForbidden, "user_blocked")
	case errors.Is(err, ErrUserNotFound):
		writeError(w, http.StatusNotFound, "user_not_found")
	default:
		log.Printf("auth handler internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error")
	}
}
