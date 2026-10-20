package auth

import (
	"context"
	"net/http"
	"time"
)

type Config struct {
	TrustedProxyCIDRs []string
	SendPasswordReset func(context.Context, string, string) error
	SendEmailChange   func(context.Context, string, string) error
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	ResetTokenTTL     time.Duration
	VerifyTokenTTL    time.Duration
	TokenSecret       string
	MuseumServiceURL  string
	ExposeDebugTokens bool
	MuseumHTTPClient  *http.Client
	Now               func() time.Time
}

func (c Config) now() time.Time {
	if c.Now != nil {
		return c.Now().UTC()
	}
	return time.Now().UTC()
}
