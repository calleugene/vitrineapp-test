package auth

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

func (s *Service) billingRoutes(mux *http.ServeMux) {
	for _, pattern := range []string{
		"GET /api/v1/billing/subscription",
		"GET /api/v1/billing/orders/{id}",
		"POST /api/v1/billing/orders",
		"POST /api/v1/billing/webhooks/tochka",
	} {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
			s.proxyBilling(w, r, r.URL.Path, "")
		})
	}
}

func (s *Service) adminBilling(w http.ResponseWriter, r *http.Request) {
	_, user, _, err := s.platformAdminSession(r)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/auth/admin/billing")
	s.proxyBilling(w, r, "/internal/admin"+path, user.ID)
}

func (s *Service) proxyBilling(w http.ResponseWriter, r *http.Request, path, admin string) {
	target, err := url.Parse(s.config.BillingServiceURL)
	if err != nil || target.Host == "" || (target.Scheme != "http" && target.Scheme != "https") {
		writeServiceError(w, ErrServiceUnavailable)
		return
	}
	proxy := httputil.ReverseProxy{
		Rewrite: func(p *httputil.ProxyRequest) {
			p.SetURL(target)
			p.Out.URL.Path = path
			p.Out.URL.RawPath = ""
			p.Out.Header.Del("Cookie")
			p.Out.Header.Del("X-Service-Secret")
			p.Out.Header.Del("X-Billing-Admin")
			if admin != "" {
				p.Out.Header.Del("Authorization")
				p.Out.Header.Set("X-Service-Secret", s.config.TokenSecret)
				p.Out.Header.Set("X-Billing-Admin", admin)
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Del("Set-Cookie")
			resp.Header.Set("Cache-Control", "no-store")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, _ error) {
			writeServiceError(w, ErrServiceUnavailable)
		},
	}
	proxy.ServeHTTP(w, r)
}
