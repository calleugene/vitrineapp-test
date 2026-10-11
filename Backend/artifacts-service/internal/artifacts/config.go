package artifacts

import "time"

type Config struct {
	Now           func() time.Time
	PublicBaseURL string
	AssetStore    AssetStore
	// TokenSecret is shared with AuthService. An empty value is allowed only by
	// explicit test configuration; the production entrypoint requires it.
	TokenSecret string
}

func (c Config) now() time.Time {
	if c.Now != nil {
		return c.Now().UTC()
	}
	return time.Now().UTC()
}
