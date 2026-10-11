package artifacts

type createArtifactRequest struct {
	Title            string   `json:"title"`
	ShortDescription string   `json:"short_description,omitempty"`
	Description      string   `json:"description"`
	Category         string   `json:"category"`
	CreatedDate      string   `json:"created_date,omitempty"`
	Period           string   `json:"period,omitempty"`
	OriginPlace      string   `json:"origin_place,omitempty"`
	Tags             []string `json:"tags,omitempty"`
	Status           string   `json:"status,omitempty"`
}

type updateArtifactRequest struct {
	Title            *string  `json:"title,omitempty"`
	ShortDescription *string  `json:"short_description,omitempty"`
	Description      *string  `json:"description,omitempty"`
	Category         *string  `json:"category,omitempty"`
	CreatedDate      *string  `json:"created_date,omitempty"`
	Period           *string  `json:"period,omitempty"`
	OriginPlace      *string  `json:"origin_place,omitempty"`
	Tags             []string `json:"tags,omitempty"`
	Status           *string  `json:"status,omitempty"`
	Visibility       *string  `json:"visibility,omitempty"`
	RouteAccess      *string  `json:"route_access,omitempty"`
	ShowViews        *bool    `json:"show_views,omitempty"`
	AllowDownloads   *bool    `json:"allow_downloads,omitempty"`
}

type artifactListResponse struct {
	Artifacts  []Artifact `json:"artifacts"`
	Pagination pagination `json:"pagination"`
}

type artifactResponse struct {
	Artifact Artifact `json:"artifact"`
}

type pagination struct {
	Page  int `json:"page"`
	Limit int `json:"limit"`
	Total int `json:"total"`
}

type summaryResponse struct {
	Total      int            `json:"total"`
	Published  int            `json:"published"`
	Draft      int            `json:"draft"`
	Archived   int            `json:"archived"`
	Moderation int            `json:"moderation"`
	ByCategory map[string]int `json:"by_category"`
}

type coverResponse struct {
	CoverURL string `json:"cover_url"`
}

type publicationSettingsRequest struct {
	Status         *string `json:"status,omitempty"`
	Visibility     *string `json:"visibility,omitempty"`
	RouteAccess    *string `json:"route_access,omitempty"`
	ShowViews      *bool   `json:"show_views,omitempty"`
	AllowDownloads *bool   `json:"allow_downloads,omitempty"`
}

type publishResponse struct {
	ArtifactID         string            `json:"artifact_id"`
	PublicURL          string            `json:"public_url"`
	QRCodeURL          string            `json:"qr_code_url"`
	PublicCode         string            `json:"public_code"`
	Version            int64             `json:"version"`
	IsFirstPublication bool              `json:"is_first_publication"`
	Downloads          map[string]string `json:"downloads"`
}

type publishRequest struct {
	ExpectedDraftRevision *int64 `json:"expected_draft_revision,omitempty"`
}

type createScreenRequest struct {
	Type    string `json:"type"`
	Title   string `json:"title"`
	Payload string `json:"payload"`
}

type updateScreenRequest struct {
	Title   *string `json:"title,omitempty"`
	Payload *string `json:"payload,omitempty"`
}

type reorderScreensRequest struct {
	Items []reorderScreenItem `json:"items"`
}

type reorderScreenItem struct {
	ScreenID string `json:"screenId"`
	Order    int    `json:"order"`
}

type screensResponse struct {
	Screens []Screen `json:"screens"`
}

type screenResponse struct {
	Screen Screen `json:"screen"`
}

type createDraftRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type updateDraftRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

type draftsResponse struct {
	Drafts []Draft `json:"drafts"`
}

type draftResponse struct {
	Draft Draft `json:"draft"`
}

type uploadMediaRequest struct {
	ArtifactID *string `json:"artifact_id"`
	FileName   string  `json:"file_name"`
	MIMEType   string  `json:"mime_type"`
	URL        string  `json:"url"`
	SizeBytes  int64   `json:"size_bytes"`
}

type mediaResponse struct {
	Media Media `json:"media"`
}

type museumProfileRequest struct {
	Name             string `json:"name"`
	ShortDescription string `json:"short_description"`
	Description      string `json:"description"`
	Website          string `json:"website"`
	Address          string `json:"address"`
	LogoURL          string `json:"logo_url"`
}

type museumProfileResponse struct {
	Museum MuseumProfile `json:"museum"`
}

type uploadModelRequest struct {
	ArtifactID *string `json:"artifact_id"`
	FileName   string  `json:"file_name"`
	Format     string  `json:"format"`
	StorageURL string  `json:"storage_url"`
}

type modelResponse struct {
	Model Model `json:"model"`
}

type processModelResponse struct {
	Model Model `json:"model"`
}

type messageResponse struct {
	Message string `json:"message"`
}

type markFoundRequest struct {
	VisitorID string `json:"visitor_id"`
}

type toggleFavoriteRequest struct {
	VisitorID string `json:"visitor_id"`
}

type artifactVisitorStatusResponse struct {
	Status ArtifactVisitorStatus `json:"status"`
}
