package artifacts

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	goqr "github.com/piglig/go-qr"
)

type artifactContextKey string

const ArtifactMuseumIDKey artifactContextKey = "museum_id"

type accessClaims struct {
	MuseumID  string `json:"museum_id"`
	Role      string `json:"role"`
	ExpiresAt int64  `json:"exp"`
}

const (
	MaxPageLimit = 500
	DefaultLimit = 24
)

func NewHandler(service *Service) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/internal/museums/{museumId}", func(w http.ResponseWriter, r *http.Request) {
		if service.config.TokenSecret == "" || !hmac.Equal([]byte(r.Header.Get("X-Service-Secret")), []byte(service.config.TokenSecret)) {
			writeError(w, 403, "forbidden")
			return
		}
		profile, err := service.GetMuseumProfile(r.Context(), r.PathValue("museumId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, 200, museumProfileResponse{Museum: profile})
	})

	museumIDMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			museumID := r.Header.Get("X-Museum-ID")
			if service.config.TokenSecret != "" {
				claims, ok := parseAccessClaims(r.Header.Get("Authorization"), service.config.TokenSecret)
				if !ok || claims.MuseumID == "" || !canManageArtifacts(claims.Role) {
					writeError(w, http.StatusUnauthorized, "unauthorized")
					return
				}
				if service.config.AuthServiceURL != "" {
					req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, strings.TrimRight(service.config.AuthServiceURL, "/")+"/auth/authorize-museum", nil)
					if err != nil {
						writeError(w, 503, "auth_unavailable")
						return
					}
					req.Header.Set("Authorization", r.Header.Get("Authorization"))
					response, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
					if err != nil {
						writeError(w, 503, "auth_unavailable")
						return
					}
					response.Body.Close()
					if response.StatusCode != 200 {
						writeError(w, 403, "account_access_denied")
						return
					}
				}
				museumID = claims.MuseumID
			}
			if strings.TrimSpace(museumID) == "" {
				writeError(w, http.StatusBadRequest, "museum_id_required")
				return
			}
			if artifactID := r.PathValue("artifactId"); artifactID != "" {
				artifact, err := service.GetArtifact(r.Context(), artifactID)
				if err != nil || artifact.MuseumID == nil || *artifact.MuseumID != museumID {
					writeError(w, http.StatusNotFound, "not_found")
					return
				}
			}
			ctx := context.WithValue(r.Context(), ArtifactMuseumIDKey, museumID)
			next(w, r.WithContext(ctx))
		}
	}

	listArtifactsHandler := func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		category := r.URL.Query().Get("category")
		sort := r.URL.Query().Get("sort")

		page, err := strconv.Atoi(r.URL.Query().Get("page"))
		if err != nil || page < 1 {
			page = 1
		}
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil || limit < 1 {
			limit = DefaultLimit
		}
		if limit > MaxPageLimit {
			limit = MaxPageLimit
		}
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		items, pag, err := service.ListArtifacts(r.Context(), status, category, sort, page, limit, &museumID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if items == nil {
			items = []Artifact{}
		}
		writeJSON(w, http.StatusOK, artifactListResponse{Artifacts: items, Pagination: pag})
	}
	summaryHandler := func(w http.ResponseWriter, r *http.Request) {
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		summary, err := service.GetSummary(r.Context(), &museumID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, summary)
	}
	createArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		var req createArtifactRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		item, err := service.CreateArtifact(r.Context(), req, &museumID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, artifactResponse{Artifact: item})
	}
	getArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetArtifact(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	updateArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		var req updateArtifactRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UpdateArtifact(r.Context(), r.PathValue("artifactId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	deleteArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteArtifact(r.Context(), r.PathValue("artifactId")); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	archiveArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.ArchiveArtifact(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	restoreArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.RestoreArtifact(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	duplicateArtifactHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.DuplicateArtifact(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, artifactResponse{Artifact: item})
	}
	uploadCoverHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_form")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "file_required")
			return
		}
		defer file.Close()
		if header.Size > 10<<20 {
			writeError(w, http.StatusBadRequest, "file_too_large")
			return
		}
		data, err := io.ReadAll(io.LimitReader(file, (10<<20)+1))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if len(data) > 10<<20 {
			writeError(w, http.StatusBadRequest, "file_too_large")
			return
		}
		mime := http.DetectContentType(data)
		var extension string
		switch mime {
		case "image/jpeg":
			extension = ".jpg"
		case "image/png":
			extension = ".png"
		case "image/webp":
			extension = ".webp"
		default:
			writeError(w, http.StatusBadRequest, "unsupported_image_type")
			return
		}
		if mime != "image/webp" {
			config, _, err := image.DecodeConfig(bytes.NewReader(data))
			if err != nil || config.Width < 1 || config.Height < 1 || config.Width*config.Height > 25_000_000 {
				writeError(w, http.StatusBadRequest, "invalid_image")
				return
			}
		}
		coverURL, err := service.UploadCover(r.Context(), r.PathValue("artifactId"), extension, data)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, coverResponse{CoverURL: coverURL})
	}
	uploadScreenImageHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_form")
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "file_required")
			return
		}
		defer file.Close()
		if header.Size > 10<<20 {
			writeError(w, http.StatusBadRequest, "file_too_large")
			return
		}
		data, err := io.ReadAll(io.LimitReader(file, (10<<20)+1))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if len(data) > 10<<20 {
			writeError(w, http.StatusBadRequest, "file_too_large")
			return
		}
		mime := http.DetectContentType(data)
		var extension string
		switch mime {
		case "image/jpeg":
			extension = ".jpg"
		case "image/png":
			extension = ".png"
		case "image/webp":
			extension = ".webp"
		default:
			writeError(w, http.StatusBadRequest, "unsupported_image_type")
			return
		}
		if mime != "image/webp" {
			config, _, err := image.DecodeConfig(bytes.NewReader(data))
			if err != nil || config.Width < 1 || config.Height < 1 || config.Width*config.Height > 25_000_000 {
				writeError(w, http.StatusBadRequest, "invalid_image")
				return
			}
		}
		url, err := service.UploadScreenImage(r.Context(), r.PathValue("artifactId"), r.PathValue("screenId"), extension, data)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"image_url": url})
	}
	getPublicationHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetPublication(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	updatePublicationHandler := func(w http.ResponseWriter, r *http.Request) {
		var req publicationSettingsRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UpdatePublication(r.Context(), r.PathValue("artifactId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactResponse{Artifact: item})
	}
	publishHandler := func(w http.ResponseWriter, r *http.Request) {
		var req publishRequest
		if r.ContentLength > 0 {
			if err := decodeJSON(r.Body, &req); err != nil {
				writeError(w, http.StatusBadRequest, "invalid_json")
				return
			}
		}
		resp, err := service.PublishExpected(r.Context(), r.PathValue("artifactId"), req.ExpectedDraftRevision)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
	duplicateScreenHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.DuplicateScreen(r.Context(), r.PathValue("artifactId"), r.PathValue("screenId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, screenResponse{Screen: item})
	}
	qrHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetArtifact(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if item.PublishedRevision == 0 {
			writeError(w, http.StatusConflict, "artifact_not_published")
			return
		}
		code, err := goqr.EncodeText(service.publicURL(item.PublicCode)+"?source=qr", goqr.Medium)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		png, err := code.ToPNGBytes(goqr.NewQrCodeImgConfig(8, 4))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(png)
	}
	publicResolveHandler := func(w http.ResponseWriter, r *http.Request) {
		publication, err := service.ResolvePublic(r.Context(), r.PathValue("publicCode"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		artifact, err := service.GetArtifact(r.Context(), publication.ArtifactID)
		if err != nil || artifact.MuseumID == nil {
			writeError(w, http.StatusServiceUnavailable, "museum_context_unavailable")
			return
		}
		var snapshot map[string]any
		if err := json.Unmarshal([]byte(publication.SnapshotJSON), &snapshot); err != nil {
			writeError(w, http.StatusServiceUnavailable, "publication_unavailable")
			return
		}
		publishedArtifact, ok := snapshot["artifact"].(map[string]any)
		if !ok {
			writeError(w, http.StatusServiceUnavailable, "publication_unavailable")
			return
		}
		publishedArtifact["museum_id"] = *artifact.MuseumID
		w.Header().Set("Cache-Control", "public, max-age=60")
		writeJSON(w, http.StatusOK, snapshot)
	}
	publicMuseumArtifactsHandler := func(w http.ResponseWriter, r *http.Request) {
		museumID := strings.TrimSpace(r.PathValue("museumId"))
		if museumID == "" {
			writeError(w, http.StatusBadRequest, "museum_id_required")
			return
		}

		// This is a public catalogue: it deliberately exposes only published
		// records. Drafts are available exclusively through the curator API.
		items, pag, err := service.ListArtifacts(r.Context(), "published", "", "created_at_desc", 1, MaxPageLimit, &museumID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if items == nil {
			items = []Artifact{}
		}
		w.Header().Set("Cache-Control", "public, max-age=60")
		writeJSON(w, http.StatusOK, artifactListResponse{Artifacts: items, Pagination: pag})
	}
	publicMuseumProfileHandler := func(w http.ResponseWriter, r *http.Request) {
		profile, err := service.GetMuseumProfile(r.Context(), strings.TrimSpace(r.PathValue("museumId")))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=60")
		writeJSON(w, http.StatusOK, museumProfileResponse{Museum: profile})
	}
	getMuseumProfileHandler := func(w http.ResponseWriter, r *http.Request) {
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		profile, err := service.GetMuseumProfile(r.Context(), museumID)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, museumProfileResponse{Museum: profile})
	}
	createMuseumProfileHandler := func(w http.ResponseWriter, r *http.Request) {
		var req museumProfileRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		profile, err := service.CreateMuseumProfile(r.Context(), museumID, req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, museumProfileResponse{Museum: profile})
	}
	updateMuseumProfileHandler := func(w http.ResponseWriter, r *http.Request) {
		var req museumProfileRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		museumID := r.Context().Value(ArtifactMuseumIDKey).(string)
		profile, err := service.UpdateMuseumProfile(r.Context(), museumID, req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, museumProfileResponse{Museum: profile})
	}
	publicCollectHandler := func(w http.ResponseWriter, r *http.Request) {
		var req markFoundRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		publication, err := service.ResolvePublic(r.Context(), r.PathValue("publicCode"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if err := service.MarkArtifactFound(r.Context(), req.VisitorID, publication.ArtifactID); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "artifact_collected"})
	}
	listScreensHandler := func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListScreens(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if items == nil {
			items = []Screen{}
		}
		writeJSON(w, http.StatusOK, screensResponse{Screens: items})
	}
	createScreenHandler := func(w http.ResponseWriter, r *http.Request) {
		var req createScreenRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.CreateScreen(r.Context(), r.PathValue("artifactId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, screenResponse{Screen: item})
	}
	getScreenHandler := func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetScreen(r.Context(), r.PathValue("artifactId"), r.PathValue("screenId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, screenResponse{Screen: item})
	}
	updateScreenHandler := func(w http.ResponseWriter, r *http.Request) {
		var req updateScreenRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UpdateScreen(r.Context(), r.PathValue("artifactId"), r.PathValue("screenId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, screenResponse{Screen: item})
	}
	deleteScreenHandler := func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteScreen(r.Context(), r.PathValue("artifactId"), r.PathValue("screenId")); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	reorderScreensHandler := func(w http.ResponseWriter, r *http.Request) {
		var req reorderScreensRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.ReorderScreens(r.Context(), r.PathValue("artifactId"), req); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "screens reordered"})
	}

	registerRoute := func(pattern string, handler http.HandlerFunc) {
		wrappedHandler := museumIDMiddleware(handler)
		mux.HandleFunc(pattern, wrappedHandler)
		mux.HandleFunc(strings.Replace(pattern, "/", "/api/v1/", 1), wrappedHandler)
	}

	registerRoute("GET /artifacts", listArtifactsHandler)
	registerRoute("GET /artifacts/summary", summaryHandler)
	registerRoute("GET /museums/profile", getMuseumProfileHandler)
	registerRoute("POST /museums/profile", createMuseumProfileHandler)
	registerRoute("PATCH /museums/profile", updateMuseumProfileHandler)
	registerRoute("POST /museums/profile/image", service.uploadMuseumImage)
	registerRoute("POST /artifacts", createArtifactHandler)
	registerRoute("GET /artifacts/{artifactId}", getArtifactHandler)
	registerRoute("PATCH /artifacts/{artifactId}", updateArtifactHandler)
	registerRoute("DELETE /artifacts/{artifactId}", deleteArtifactHandler)
	registerRoute("POST /artifacts/{artifactId}/archive", archiveArtifactHandler)
	registerRoute("POST /artifacts/{artifactId}/restore", restoreArtifactHandler)
	registerRoute("POST /artifacts/{artifactId}/duplicate", duplicateArtifactHandler)
	registerRoute("POST /artifacts/{artifactId}/cover", uploadCoverHandler)
	registerRoute("GET /artifacts/{artifactId}/publication", getPublicationHandler)
	registerRoute("PATCH /artifacts/{artifactId}/publication", updatePublicationHandler)
	registerRoute("POST /artifacts/{artifactId}/publish", publishHandler)
	registerRoute("GET /artifacts/{artifactId}/qr.png", qrHandler)
	registerRoute("GET /artifacts/{artifactId}/screens", listScreensHandler)
	registerRoute("POST /artifacts/{artifactId}/screens", createScreenHandler)
	registerRoute("POST /artifacts/{artifactId}/screens/{screenId}/image", uploadScreenImageHandler)
	registerRoute("POST /artifacts/{artifactId}/screens/{screenId}/model", service.uploadScreenModel)
	registerRoute("GET /artifacts/{artifactId}/screens/{screenId}", getScreenHandler)
	registerRoute("PATCH /artifacts/{artifactId}/screens/{screenId}", updateScreenHandler)
	registerRoute("DELETE /artifacts/{artifactId}/screens/{screenId}", deleteScreenHandler)
	registerRoute("POST /artifacts/{artifactId}/screens/{screenId}/duplicate", duplicateScreenHandler)
	registerRoute("PUT /artifacts/{artifactId}/screens/reorder", reorderScreensHandler)
	mux.HandleFunc("GET /api/v1/public/artifacts/{publicCode}", publicResolveHandler)
	mux.HandleFunc("POST /api/v1/public/artifacts/{publicCode}/collect", publicCollectHandler)
	mux.HandleFunc("GET /api/v1/public/museums/{museumId}/artifacts", publicMuseumArtifactsHandler)
	mux.HandleFunc("GET /api/v1/public/museums/{museumId}", publicMuseumProfileHandler)
	mux.HandleFunc("GET /api/v1/public/museums", func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListMuseumProfiles(r.Context())
		if err != nil {
			writeServiceError(w, err)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		writeJSON(w, http.StatusOK, map[string]any{"museums": items})
	})

	// Drafts (inline for brevity since they follow same pattern)
	registerDraftHandlers(mux, service)
	registerMediaHandlers(mux, service)
	registerModelHandlers(mux, service)
	registerVisitorTrackingHandlers(mux, service)

	return mux
}

func canManageArtifacts(role string) bool {
	switch role {
	case "methodist", "museum_admin", "moderator", "ORG_ADMIN", "EDITOR":
		return true
	default:
		return false
	}
}

func parseAccessClaims(header, secret string) (accessClaims, bool) {
	var claims accessClaims
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return claims, false
	}
	parts := strings.Split(strings.TrimPrefix(header, prefix), ".")
	if len(parts) != 2 {
		return claims, false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(parts[0]))
	if !hmac.Equal([]byte(parts[1]), []byte(base64.RawURLEncoding.EncodeToString(mac.Sum(nil)))) {
		return claims, false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(payload, &claims) != nil || claims.ExpiresAt < time.Now().UTC().Unix() {
		return accessClaims{}, false
	}
	return claims, true
}

func registerVisitorTrackingHandlers(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("POST /artifacts/{artifactId}/mark-found", func(w http.ResponseWriter, r *http.Request) {
		var req markFoundRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		if err := service.MarkArtifactFound(r.Context(), req.VisitorID, r.PathValue("artifactId")); err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, messageResponse{Message: "artifact marked as found"})
	})
	mux.HandleFunc("PATCH /artifacts/{artifactId}/toggle-favorite", func(w http.ResponseWriter, r *http.Request) {
		var req toggleFavoriteRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		status, err := service.ToggleFavorite(r.Context(), req.VisitorID, r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactVisitorStatusResponse{Status: status})
	})
	mux.HandleFunc("GET /artifacts/{artifactId}/status/{visitorId}", func(w http.ResponseWriter, r *http.Request) {
		status, err := service.GetArtifactStatus(r.Context(), r.PathValue("visitorId"), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, artifactVisitorStatusResponse{Status: status})
	})
}

func registerDraftHandlers(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("GET /artifacts/{artifactId}/drafts", func(w http.ResponseWriter, r *http.Request) {
		items, err := service.ListDrafts(r.Context(), r.PathValue("artifactId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		if items == nil {
			items = []Draft{}
		}
		writeJSON(w, http.StatusOK, draftsResponse{Drafts: items})
	})
	mux.HandleFunc("POST /artifacts/{artifactId}/drafts", func(w http.ResponseWriter, r *http.Request) {
		var req createDraftRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.CreateDraft(r.Context(), r.PathValue("artifactId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, draftResponse{Draft: item})
	})
	mux.HandleFunc("GET /artifacts/{artifactId}/drafts/{draftId}", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetDraft(r.Context(), r.PathValue("artifactId"), r.PathValue("draftId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, draftResponse{Draft: item})
	})
	mux.HandleFunc("PATCH /artifacts/{artifactId}/drafts/{draftId}", func(w http.ResponseWriter, r *http.Request) {
		var req updateDraftRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UpdateDraft(r.Context(), r.PathValue("artifactId"), r.PathValue("draftId"), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, draftResponse{Draft: item})
	})
	mux.HandleFunc("POST /artifacts/{artifactId}/drafts/{draftId}/publish-ready", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.PublishReadyDraft(r.Context(), r.PathValue("artifactId"), r.PathValue("draftId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, draftResponse{Draft: item})
	})
	mux.HandleFunc("POST /artifacts/{artifactId}/drafts/{draftId}/discard", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.DiscardDraft(r.Context(), r.PathValue("artifactId"), r.PathValue("draftId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, draftResponse{Draft: item})
	})
}

func registerMediaHandlers(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("POST /media/upload", func(w http.ResponseWriter, r *http.Request) {
		var req uploadMediaRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UploadMedia(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, mediaResponse{Media: item})
	})
	mux.HandleFunc("GET /media/{mediaId}", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetMedia(r.Context(), r.PathValue("mediaId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, mediaResponse{Media: item})
	})
	mux.HandleFunc("DELETE /media/{mediaId}", func(w http.ResponseWriter, r *http.Request) {
		if err := service.DeleteMedia(r.Context(), r.PathValue("mediaId")); err != nil {
			writeServiceError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

func registerModelHandlers(mux *http.ServeMux, service *Service) {
	mux.HandleFunc("POST /models/upload", func(w http.ResponseWriter, r *http.Request) {
		var req uploadModelRequest
		if err := decodeJSON(r.Body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		item, err := service.UploadModel(r.Context(), req)
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, modelResponse{Model: item})
	})
	mux.HandleFunc("GET /models/{modelId}", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetModel(r.Context(), r.PathValue("modelId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, modelResponse{Model: item})
	})
	mux.HandleFunc("POST /models/{modelId}/process", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.ProcessModel(r.Context(), r.PathValue("modelId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, processModelResponse{Model: item})
	})
	mux.HandleFunc("GET /models/{modelId}/status", func(w http.ResponseWriter, r *http.Request) {
		item, err := service.GetModelStatus(r.Context(), r.PathValue("modelId"))
		if err != nil {
			writeServiceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, modelResponse{Model: item})
	})
}

func decodeJSON(body io.ReadCloser, dst any) error {
	defer body.Close()
	return json.NewDecoder(body).Decode(dst)
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
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found")
	case errors.Is(err, ErrCannotDelete):
		writeError(w, http.StatusForbidden, "cannot_delete_system_screen")
	case errors.Is(err, ErrCannotReorder):
		writeError(w, http.StatusBadRequest, "invalid_reorder")
	case errors.Is(err, ErrRevisionConflict):
		writeError(w, http.StatusConflict, "revision_conflict")
	case errors.Is(err, ErrNoUnpublishedChanges):
		writeError(w, http.StatusConflict, "no_unpublished_changes")
	case errors.Is(err, ErrUnsupportedScreenType):
		writeError(w, http.StatusUnprocessableEntity, "unsupported_screen_type")
	case errors.Is(err, ErrScreenIncomplete):
		writeError(w, http.StatusUnprocessableEntity, "screen_content_incomplete")
	case errors.Is(err, ErrCannotPublishEmpty):
		writeError(w, http.StatusUnprocessableEntity, "cannot_publish_empty")
	case errors.Is(err, ErrArchivedArtifact):
		writeError(w, http.StatusConflict, "archived_artifact")
	default:
		log.Printf("artifacts handler internal error: %v", err)
		writeError(w, http.StatusInternalServerError, "internal_error")
	}
}
