package auth

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"regexp"
	"strings"
)

var adminContentPath = regexp.MustCompile(`^(artifacts(?:/[a-zA-Z0-9_-]+(?:/(?:archive|restore|unpublish|duplicate|cover|publish|publication|screens(?:/[a-zA-Z0-9_-]+(?:/(?:image|model|duplicate))?)?))?)?|museums/profile(?:/image)?|museum-state)$`)

func (s *Service) adminExhibits(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.adminSession(w, r); ok {
		s.proxyAdminContent(w, r, "/internal/admin/exhibits", "", true)
	}
}

func (s *Service) adminCreateMuseum(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	id := newID("mus")
	if err := s.auditAdmin(r.Context(), actor.UserID, "platform_museum_create", id, ""); err != nil {
		writeServiceError(w, err)
		return
	}
	s.proxyAdminContent(w, r, "/internal/admin/museums/"+id, "", true)
}

func (s *Service) adminContent(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.adminSession(w, r)
	if !ok {
		return
	}
	path := r.PathValue("path")
	if !adminContentPath.MatchString(path) {
		writeServiceError(w, ErrNotFound)
		return
	}
	if actor.MuseumID == "" || r.URL.Query().Get("museum_id") != actor.MuseumID {
		writeServiceError(w, ErrForbidden)
		return
	}
	reason, err := url.PathUnescape(r.Header.Get("X-Admin-Reason"))
	reason = strings.TrimSpace(reason)
	if err != nil || len(reason) > 1200 || ((r.Method == http.MethodDelete || strings.HasSuffix(path, "/archive")) && reason == "") {
		writeServiceError(w, ErrBadRequest)
		return
	}
	if path == "museum-state" {
		s.adminMuseumState(w, r, actor, reason)
		return
	}
	if r.Method != http.MethodGet {
		if err := s.auditAdmin(r.Context(), actor.UserID, "platform_content_"+r.Method, actor.MuseumID+"/"+path, reason); err != nil {
			writeServiceError(w, err)
			return
		}
	}
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
	cookie, _ := r.Cookie(platformAdminCookie)
	access, _, _ := strings.Cut(cookie.Value, "~")
	s.proxyAdminContent(w, r, "/"+path, access, false)
}

func (s *Service) adminMuseumState(w http.ResponseWriter, r *http.Request, actor accessClaims, reason string) {
	var req struct {
		Action string `json:"action"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if r.Method != http.MethodPut || decodeJSON(r.Body, &req) != nil {
		writeServiceError(w, ErrBadRequest)
		return
	}
	switch req.Action {
	case "archive", "delete":
		if reason == "" {
			writeServiceError(w, ErrBadRequest)
			return
		}
	case "publish", "hide", "restore":
	default:
		writeServiceError(w, ErrBadRequest)
		return
	}
	if err := s.auditAdmin(r.Context(), actor.UserID, "platform_museum_"+req.Action, actor.MuseumID, reason); err != nil {
		writeServiceError(w, err)
		return
	}
	payload, _ := json.Marshal(req)
	r.Body = io.NopCloser(bytes.NewReader(payload))
	r.ContentLength = int64(len(payload))
	s.proxyAdminContent(w, r, "/internal/admin/museums/"+url.PathEscape(actor.MuseumID)+"/state", "", true)
}

func (s *Service) proxyAdminContent(w http.ResponseWriter, r *http.Request, path, access string, internal bool) {
	target, err := url.Parse(strings.TrimRight(s.config.MuseumServiceURL, "/"))
	if err != nil || target.Host == "" {
		writeServiceError(w, ErrServiceUnavailable)
		return
	}
	proxy := httputil.ReverseProxy{
		Rewrite: func(p *httputil.ProxyRequest) {
			p.SetURL(target)
			p.Out.URL.Path = strings.TrimRight(target.Path, "/") + path
			p.Out.URL.RawPath = ""
			p.Out.Header.Del("Cookie")
			p.Out.Header.Del("Authorization")
			p.Out.Header.Del("X-Service-Secret")
			p.Out.Header.Del("X-Museum-ID")
			p.Out.Header.Del("X-Admin-Reason")
			if internal {
				p.Out.Header.Set("X-Service-Secret", s.config.TokenSecret)
			} else {
				p.Out.Header.Set("Authorization", "Bearer "+access)
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Del("Set-Cookie")
			resp.Header.Set("Cache-Control", "no-store")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "service_unavailable"})
		},
	}
	proxy.ServeHTTP(w, r)
}
