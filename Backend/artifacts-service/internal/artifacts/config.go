package artifacts

import "time"

type Config struct {
	// Enable only after the deployment logging/privacy review. No visitor records are stored.
	EmbedCountingEnabled bool
	Now                  func() time.Time
	PublicBaseURL        string
	AssetStore           AssetStore
	// TokenSecret is shared with AuthService. An empty value is allowed only by
	// explicit test configuration; the production entrypoint requires it.
	TokenSecret    string
	AuthServiceURL string
}

func (c Config) now() time.Time {
	if c.Now != nil {
		return c.Now().UTC()
	}
	return time.Now().UTC()
}
