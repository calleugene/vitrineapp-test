package auth

import (
	"net/http"
	"time"
)

type Config struct {
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
