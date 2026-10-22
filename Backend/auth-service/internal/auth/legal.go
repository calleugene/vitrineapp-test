package auth

import (
	"context"
	"embed"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

//go:embed legal_documents/*
var legalFiles embed.FS

type legalDocument struct {
	Type      string          `json:"type"`
	Title     string          `json:"title"`
	Version   string          `json:"version"`
	UpdatedAt string          `json:"updatedAt"`
	Text      string          `json:"text"`
	Blocks    json.RawMessage `json:"blocks,omitempty"`
}
type consentInput struct {
	Type     string `json:"type"`
	Version  string `json:"version"`
	Accepted bool   `json:"accepted"`
}

func publishedDocuments() []legalDocument {
	docs := []legalDocument{}
	for _, key := range []string{"privacy", "personal_data", "marketing"} {
		data, err := legalFiles.ReadFile("legal_documents/" + key + ".json")
		if err != nil {
			panic(err)
		}
		var doc legalDocument
		if err = json.Unmarshal(data, &doc); err != nil {
			panic(err)
		}
		docs = append(docs, doc)
	}
	return docs
}
func legalHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	writeJSON(w, http.StatusOK, publishedDocuments())
}
func validateConsents(consents []consentInput) error {
	docs := publishedDocuments()
	versions := map[string]string{}
	for _, doc := range docs {
		versions[doc.Type] = doc.Version
	}
	seen := map[string]bool{}
	for _, c := range consents {
		if (c.Type != "personal_data" && c.Type != "marketing") || seen[c.Type] || versions[c.Type] != c.Version {
			return ErrBadRequest
		}
		seen[c.Type] = true
		if c.Type == "personal_data" && !c.Accepted {
			return ErrBadRequest
		}
	}
	if !seen["personal_data"] || !seen["marketing"] {
		return ErrBadRequest
	}
	return nil
}

func (r *profileRepository) AllowPasswordReset(ctx context.Context, key string, now time.Time) (bool, error) {
	// Atomic persistent quota shared across service instances; unknown addresses use the same path.
	var count int
	err := r.db.QueryRowContext(ctx, r.query(`INSERT INTO password_reset_limits(key,window_start,attempts) VALUES(?,?,1)
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN password_reset_limits.window_start<=? THEN 1 ELSE password_reset_limits.attempts+1 END,
 window_start=CASE WHEN password_reset_limits.window_start<=? THEN excluded.window_start ELSE password_reset_limits.window_start END RETURNING attempts`), key, now.Format(time.RFC3339), now.Add(-30*time.Minute).Format(time.RFC3339), now.Add(-30*time.Minute).Format(time.RFC3339)).Scan(&count)
	limit := 3
	if strings.HasPrefix(key, "ip:") || strings.HasPrefix(key, "reset-ip:") {
		limit = 30
	}
	return count <= limit, err
}
