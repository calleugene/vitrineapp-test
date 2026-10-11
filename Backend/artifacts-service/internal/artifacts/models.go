package artifacts

import "time"

type Artifact struct {
	ID                    string     `json:"id"`
	MuseumID              *string    `json:"museum_id,omitempty"`
	Title                 string     `json:"title"`
	ShortDescription      string     `json:"short_description,omitempty"`
	Description           string     `json:"description"`
	Category              string     `json:"category"`
	CreatedDate           string     `json:"created_date,omitempty"`
	Period                string     `json:"period,omitempty"`
	OriginPlace           string     `json:"origin_place,omitempty"`
	Tags                  string     `json:"tags,omitempty"`
	CoverURL              string     `json:"cover_url,omitempty"`
	Status                string     `json:"status"`
	PublicCode            string     `json:"public_code,omitempty"`
	PublicURL             string     `json:"public_url,omitempty"`
	DraftRevision         int64      `json:"draft_revision"`
	PublishedRevision     int64      `json:"published_revision"`
	HasUnpublishedChanges bool       `json:"has_unpublished_changes"`
	Visibility            string     `json:"visibility,omitempty"`
	RouteAccess           string     `json:"route_access,omitempty"`
	ShowViews             bool       `json:"show_views"`
	AllowDownloads        bool       `json:"allow_downloads"`
	OrderInRoute          int        `json:"order_in_route,omitempty"`
	StoryID               string     `json:"story_id,omitempty"`
	FoundCount            int        `json:"found_count,omitempty"`
	PublishedAt           *time.Time `json:"published_at,omitempty"`
	ArchivedAt            *time.Time `json:"archived_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type MuseumProfile struct {
	MuseumID         string    `json:"museum_id"`
	Code             string    `json:"code"`
	Name             string    `json:"name"`
	ShortDescription string    `json:"short_description"`
	Description      string    `json:"description"`
	Website          string    `json:"website"`
	Address          string    `json:"address"`
	LogoURL          string    `json:"logo_url"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Publication struct {
	ArtifactID   string    `json:"artifact_id"`
	Version      int64     `json:"version"`
	SnapshotJSON string    `json:"snapshot_json"`
	PublishedAt  time.Time `json:"published_at"`
}

type ArtifactVisitorStatus struct {
	ID          string     `json:"id"`
	VisitorID   string     `json:"visitor_id"`
	ArtifactID  string     `json:"artifact_id"`
	Found       bool       `json:"found"`
	FoundAt     *time.Time `json:"found_at,omitempty"`
	IsFavorite  bool       `json:"is_favorite"`
	FavoritedAt *time.Time `json:"favorited_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Screen struct {
	ID         string    `json:"id"`
	ArtifactID string    `json:"artifact_id"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Subtitle   string    `json:"subtitle,omitempty"`
	Payload    string    `json:"payload"`
	Position   int       `json:"order"`
	IsSystem   bool      `json:"is_system"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Draft struct {
	ID         string    `json:"id"`
	ArtifactID string    `json:"artifact_id"`
	Name       string    `json:"name"`
	Content    string    `json:"content"`
	Status     string    `json:"status"`
	Version    int       `json:"version"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Media struct {
	ID         string    `json:"id"`
	ArtifactID *string   `json:"artifact_id,omitempty"`
	FileName   string    `json:"file_name"`
	MIMEType   string    `json:"mime_type"`
	URL        string    `json:"url"`
	SizeBytes  int64     `json:"size_bytes"`
	CreatedAt  time.Time `json:"created_at"`
}

type Model struct {
	ID               string    `json:"id"`
	ArtifactID       *string   `json:"artifact_id,omitempty"`
	FileName         string    `json:"file_name"`
	Format           string    `json:"format"`
	StorageURL       string    `json:"storage_url"`
	ProcessingStatus string    `json:"processing_status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
