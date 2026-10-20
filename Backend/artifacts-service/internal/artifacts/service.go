package artifacts

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

type Service struct {
	repo      Repository
	config    Config
	publishMu sync.Mutex
}

func NewService(repo Repository, config Config) *Service {
	return &Service{repo: repo, config: config}
}

func (s *Service) ListArtifacts(ctx context.Context, status, category, sort string, page, limit int, museumID *string) ([]Artifact, pagination, error) {
	items, total, err := s.repo.ListArtifacts(ctx, status, category, sort, page, limit, museumID)
	if err != nil {
		return nil, pagination{}, err
	}
	for index := range items {
		if items[index].PublishedRevision > 0 && items[index].Status != "archived" {
			items[index].PublicURL = s.publicURL(items[index].PublicCode)
		}
	}
	return items, pagination{Page: page, Limit: limit, Total: total}, nil
}

func (s *Service) ListMuseumProfiles(ctx context.Context) ([]MuseumProfile, error) {
	return s.repo.ListMuseumProfiles(ctx)
}

func (s *Service) GetMuseumProfile(ctx context.Context, museumID string) (MuseumProfile, error) {
	return s.repo.GetMuseumProfile(ctx, museumID)
}

func (s *Service) CreateMuseumProfile(ctx context.Context, museumID string, req museumProfileRequest) (MuseumProfile, error) {
	if strings.TrimSpace(req.Name) == "" {
		return MuseumProfile{}, ErrBadRequest
	}
	now := s.config.now()
	return s.repo.CreateMuseumProfile(ctx, MuseumProfile{MuseumID: museumID, Name: strings.TrimSpace(req.Name), ShortDescription: strings.TrimSpace(req.ShortDescription), Description: strings.TrimSpace(req.Description), Website: strings.TrimSpace(req.Website), Address: strings.TrimSpace(req.Address), LogoURL: strings.TrimSpace(req.LogoURL), CreatedAt: now, UpdatedAt: now})
}

func (s *Service) UpdateMuseumProfile(ctx context.Context, museumID string, req museumProfileRequest) (MuseumProfile, error) {
	current, err := s.repo.GetMuseumProfile(ctx, museumID)
	if err != nil {
		return MuseumProfile{}, err
	}
	if strings.TrimSpace(req.Name) == "" {
		return MuseumProfile{}, ErrBadRequest
	}
	current.Name, current.ShortDescription, current.Description = strings.TrimSpace(req.Name), strings.TrimSpace(req.ShortDescription), strings.TrimSpace(req.Description)
	current.Website, current.Address, current.LogoURL, current.UpdatedAt = strings.TrimSpace(req.Website), strings.TrimSpace(req.Address), strings.TrimSpace(req.LogoURL), s.config.now()
	return s.repo.UpdateMuseumProfile(ctx, current)
}

func (s *Service) GetSummary(ctx context.Context, museumID *string) (summaryResponse, error) {
	return s.repo.GetSummary(ctx, museumID)
}

func (s *Service) CreateArtifact(ctx context.Context, req createArtifactRequest, museumID *string) (Artifact, error) {
	if strings.TrimSpace(req.Title) == "" {
		return Artifact{}, ErrBadRequest
	}
	now := s.config.now()
	status := "draft"
	if req.Status != "" {
		status = req.Status
	}
	var tagsJSON string
	if len(req.Tags) > 0 {
		tagsBytes, _ := json.Marshal(req.Tags)
		tagsJSON = string(tagsBytes)
	}
	item := Artifact{
		ID:                newID("art"),
		MuseumID:          museumID,
		Title:             strings.TrimSpace(req.Title),
		ShortDescription:  strings.TrimSpace(req.ShortDescription),
		Description:       strings.TrimSpace(req.Description),
		Category:          defaultCategory(req.Category),
		CreatedDate:       strings.TrimSpace(req.CreatedDate),
		Period:            strings.TrimSpace(req.Period),
		OriginPlace:       strings.TrimSpace(req.OriginPlace),
		Tags:              tagsJSON,
		Status:            status,
		PublicCode:        newPublicCode(),
		DraftRevision:     1,
		PublishedRevision: 0,
		Visibility:        "public",
		RouteAccess:       "all",
		ShowViews:         true,
		AllowDownloads:    false,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := s.repo.CreateArtifact(ctx, item); err != nil {
		return Artifact{}, err
	}
	return item, nil
}

func defaultCategory(category string) string {
	if value := strings.TrimSpace(category); value != "" {
		return value
	}
	return "exhibit"
}

func (s *Service) GetArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err == nil && item.PublishedRevision > 0 && item.Status != "archived" {
		item.PublicURL = s.publicURL(item.PublicCode)
	}
	return item, err
}

func (s *Service) UpdateArtifact(ctx context.Context, artifactID string, req updateArtifactRequest) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		item.Title = strings.TrimSpace(*req.Title)
	}
	if req.ShortDescription != nil {
		item.ShortDescription = strings.TrimSpace(*req.ShortDescription)
	}
	if req.Description != nil {
		item.Description = strings.TrimSpace(*req.Description)
	}
	if req.Category != nil && strings.TrimSpace(*req.Category) != "" {
		item.Category = strings.TrimSpace(*req.Category)
	}
	if req.CreatedDate != nil {
		item.CreatedDate = strings.TrimSpace(*req.CreatedDate)
	}
	if req.Period != nil {
		item.Period = strings.TrimSpace(*req.Period)
	}
	if req.OriginPlace != nil {
		item.OriginPlace = strings.TrimSpace(*req.OriginPlace)
	}
	if req.Tags != nil {
		tagsBytes, _ := json.Marshal(req.Tags)
		item.Tags = string(tagsBytes)
	}
	if req.Status != nil {
		item.Status = strings.TrimSpace(*req.Status)
		if item.Status != "archived" {
			item.ArchivedAt = nil
		}
	}
	if req.Visibility != nil {
		item.Visibility = strings.TrimSpace(*req.Visibility)
	}
	if req.RouteAccess != nil {
		item.RouteAccess = strings.TrimSpace(*req.RouteAccess)
	}
	if req.ShowViews != nil {
		item.ShowViews = *req.ShowViews
	}
	if req.AllowDownloads != nil {
		item.AllowDownloads = *req.AllowDownloads
	}
	item.UpdatedAt = s.config.now()
	item.DraftRevision++
	if err := s.repo.UpdateArtifact(ctx, item); err != nil {
		return Artifact{}, err
	}
	return item, nil
}

func (s *Service) DeleteArtifact(ctx context.Context, artifactID string) error {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return err
	}
	if item.PublishedRevision > 0 || item.Status == "published" {
		_, err := s.ArchiveArtifact(ctx, artifactID)
		return err
	}
	return s.repo.DeleteArtifact(ctx, artifactID)
}

func (s *Service) ArchiveArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	now := s.config.now()
	item.Status = "archived"
	item.ArchivedAt = &now
	item.UpdatedAt = now
	if err := s.repo.UpdateArtifact(ctx, item); err != nil {
		return Artifact{}, err
	}
	return item, nil
}

func (s *Service) RestoreArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	item.Status = "draft"
	item.ArchivedAt = nil
	item.UpdatedAt = s.config.now()
	if err := s.repo.UpdateArtifact(ctx, item); err != nil {
		return Artifact{}, err
	}
	return item, nil
}

func (s *Service) DuplicateArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	now := s.config.now()
	copyItem := Artifact{
		ID:                newID("art"),
		MuseumID:          item.MuseumID,
		Title:             item.Title + " Copy",
		ShortDescription:  item.ShortDescription,
		Description:       item.Description,
		Category:          item.Category,
		CreatedDate:       item.CreatedDate,
		Period:            item.Period,
		OriginPlace:       item.OriginPlace,
		Tags:              item.Tags,
		Status:            "draft",
		PublicCode:        newPublicCode(),
		DraftRevision:     1,
		PublishedRevision: 0,
		Visibility:        "public",
		RouteAccess:       "all",
		ShowViews:         true,
		AllowDownloads:    false,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := s.repo.CreateArtifact(ctx, copyItem); err != nil {
		return Artifact{}, err
	}
	screens, err := s.repo.ListScreens(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	for _, screen := range screens {
		copyScreen := screen
		copyScreen.ID = newID("scr")
		copyScreen.ArtifactID = copyItem.ID
		copyScreen.CreatedAt, copyScreen.UpdatedAt = now, now
		if err := s.repo.CreateScreen(ctx, copyScreen); err != nil {
			return Artifact{}, err
		}
	}
	return copyItem, nil
}

func (s *Service) UploadCover(ctx context.Context, artifactID, extension string, data []byte) (string, error) {
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return "", err
	}
	if s.config.AssetStore == nil {
		return "", fmt.Errorf("asset storage is not configured")
	}
	coverURL, err := s.config.AssetStore.PutCover(ctx, artifactID, extension, data)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateArtifactCover(ctx, artifactID, coverURL, s.config.now()); err != nil {
		return "", err
	}
	if err := s.touchDraft(ctx, artifactID); err != nil {
		return "", err
	}
	return coverURL, nil
}

// UploadScreenImage stores a background image independently from the screen
// payload. The returned stable URL is then kept in the screen JSON snapshot.
func (s *Service) UploadScreenImage(ctx context.Context, artifactID, screenID, extension string, data []byte) (string, error) {
	if _, err := s.repo.GetScreen(ctx, artifactID, screenID); err != nil {
		return "", err
	}
	if s.config.AssetStore == nil {
		return "", fmt.Errorf("asset storage is not configured")
	}
	return s.config.AssetStore.PutScreenImage(ctx, artifactID, screenID, extension, data)
}

func (s *Service) GetPublication(ctx context.Context, artifactID string) (Artifact, error) {
	return s.repo.GetArtifact(ctx, artifactID)
}

func (s *Service) UpdatePublication(ctx context.Context, artifactID string, req publicationSettingsRequest) (Artifact, error) {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return Artifact{}, err
	}
	if req.Status != nil {
		item.Status = strings.TrimSpace(*req.Status)
	}
	if req.Visibility != nil {
		item.Visibility = strings.TrimSpace(*req.Visibility)
	}
	if req.RouteAccess != nil {
		item.RouteAccess = strings.TrimSpace(*req.RouteAccess)
	}
	if req.ShowViews != nil {
		item.ShowViews = *req.ShowViews
	}
	if req.AllowDownloads != nil {
		item.AllowDownloads = *req.AllowDownloads
	}
	item.UpdatedAt = s.config.now()
	if err := s.repo.UpdateArtifact(ctx, item); err != nil {
		return Artifact{}, err
	}
	return item, nil
}

func (s *Service) Publish(ctx context.Context, artifactID string) (publishResponse, error) {
	return s.PublishExpected(ctx, artifactID, nil)
}

func (s *Service) PublishExpected(ctx context.Context, artifactID string, expected *int64) (publishResponse, error) {
	// Publication changes two persisted records. Serialising this critical section
	// prevents two in-process requests from accepting the same draft revision.
	s.publishMu.Lock()
	defer s.publishMu.Unlock()
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return publishResponse{}, err
	}
	if expected != nil && *expected != item.DraftRevision {
		return publishResponse{}, ErrRevisionConflict
	}
	if item.DraftRevision == item.PublishedRevision {
		return publishResponse{}, ErrNoUnpublishedChanges
	}
	if item.Status == "archived" {
		return publishResponse{}, ErrArchivedArtifact
	}
	screens, err := s.repo.ListScreens(ctx, artifactID)
	if err != nil {
		return publishResponse{}, err
	}
	if len(screens) == 0 {
		return publishResponse{}, ErrCannotPublishEmpty
	}
	snapshot := map[string]any{
		"schema_version": 1,
		"artifact":       map[string]any{"id": item.ID, "museum_id": item.MuseumID, "title": item.Title, "short_description": item.ShortDescription, "cover_url": item.CoverURL, "public_code": item.PublicCode},
		"screens":        screens,
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return publishResponse{}, err
	}
	original := item
	now := s.config.now()
	item.Status = "published"
	item.PublishedAt = &now
	item.UpdatedAt = now
	item.PublishedRevision = item.DraftRevision
	if err := s.repo.UpdateArtifact(ctx, item); err != nil {
		return publishResponse{}, err
	}
	if err := s.repo.CreatePublication(ctx, Publication{ArtifactID: item.ID, Version: item.PublishedRevision, SnapshotJSON: string(payload), PublishedAt: now}); err != nil {
		// Revert the visible publication state if storing its immutable snapshot
		// failed. This is the compensating action for repositories without a
		// shared transaction primitive.
		if rollbackErr := s.repo.UpdateArtifact(ctx, original); rollbackErr != nil {
			return publishResponse{}, fmt.Errorf("publish snapshot: %w; rollback: %v", err, rollbackErr)
		}
		return publishResponse{}, err
	}
	publicURL := s.publicURL(item.PublicCode)
	return publishResponse{
		ArtifactID:         artifactID,
		PublicURL:          publicURL,
		QRCodeURL:          "/api/v1/artifacts/" + artifactID + "/qr.png",
		PublicCode:         item.PublicCode,
		Version:            item.PublishedRevision,
		IsFirstPublication: item.PublishedRevision == 1,
		Downloads:          map[string]string{},
	}, nil
}

func (s *Service) ResolvePublic(ctx context.Context, publicCode string) (Publication, error) {
	item, err := s.repo.GetArtifactByPublicCode(ctx, publicCode)
	if err != nil {
		return Publication{}, err
	}
	if item.Status == "archived" || item.PublishedRevision == 0 {
		return Publication{}, ErrNotFound
	}
	return s.repo.GetLatestPublication(ctx, publicCode)
}

func (s *Service) publicURL(publicCode string) string {
	base := strings.TrimRight(s.config.PublicBaseURL, "/")
	if base == "" {
		return "/exhibits/" + publicCode
	}
	return base + "/exhibits/" + publicCode
}

func (s *Service) ListScreens(ctx context.Context, artifactID string) ([]Screen, error) {
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return nil, err
	}
	return s.repo.ListScreens(ctx, artifactID)
}

func (s *Service) CreateScreen(ctx context.Context, artifactID string, req createScreenRequest) (Screen, error) {
	if strings.TrimSpace(req.Type) == "" || strings.TrimSpace(req.Title) == "" {
		return Screen{}, ErrBadRequest
	}
	if strings.TrimSpace(req.Type) != "text" {
		return Screen{}, ErrUnsupportedScreenType
	}
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return Screen{}, err
	}
	screens, err := s.repo.ListScreens(ctx, artifactID)
	if err != nil {
		return Screen{}, err
	}
	now := s.config.now()
	position := len(screens) + 1
	screen := Screen{
		ID:         newID("scr"),
		ArtifactID: artifactID,
		Type:       strings.TrimSpace(req.Type),
		Title:      strings.TrimSpace(req.Title),
		Payload:    req.Payload,
		Position:   position,
		IsSystem:   false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.repo.CreateScreen(ctx, screen); err != nil {
		return Screen{}, err
	}
	if err := s.touchDraft(ctx, artifactID); err != nil {
		return Screen{}, err
	}
	return screen, nil
}

func (s *Service) GetScreen(ctx context.Context, artifactID, screenID string) (Screen, error) {
	return s.repo.GetScreen(ctx, artifactID, screenID)
}

func (s *Service) UpdateScreen(ctx context.Context, artifactID, screenID string, req updateScreenRequest) (Screen, error) {
	screen, err := s.repo.GetScreen(ctx, artifactID, screenID)
	if err != nil {
		return Screen{}, err
	}
	if req.Title != nil && strings.TrimSpace(*req.Title) != "" {
		screen.Title = strings.TrimSpace(*req.Title)
	}
	if req.Payload != nil {
		screen.Payload = *req.Payload
	}
	screen.UpdatedAt = s.config.now()
	if err := s.repo.UpdateScreen(ctx, screen); err != nil {
		return Screen{}, err
	}
	if err := s.touchDraft(ctx, artifactID); err != nil {
		return Screen{}, err
	}
	return screen, nil
}

func (s *Service) DeleteScreen(ctx context.Context, artifactID, screenID string) error {
	screen, err := s.repo.GetScreen(ctx, artifactID, screenID)
	if err != nil {
		return err
	}
	if screen.IsSystem {
		return ErrCannotDelete
	}
	if err := s.repo.DeleteScreen(ctx, artifactID, screenID); err != nil {
		return err
	}
	return s.touchDraft(ctx, artifactID)
}

func (s *Service) ReorderScreens(ctx context.Context, artifactID string, req reorderScreensRequest) error {
	if len(req.Items) == 0 {
		return ErrBadRequest
	}
	screens, err := s.repo.ListScreens(ctx, artifactID)
	if err != nil {
		return err
	}
	if len(req.Items) != len(screens) {
		return ErrCannotReorder
	}
	known, positions := map[string]bool{}, map[int]bool{}
	for _, sc := range screens {
		known[sc.ID] = true
	}
	for _, item := range req.Items {
		if !known[item.ScreenID] || positions[item.Order] || item.Order < 1 || item.Order > len(screens) {
			return ErrCannotReorder
		}
		positions[item.Order] = true
	}
	if err := s.repo.ReorderScreens(ctx, artifactID, req.Items, s.config.now()); err != nil {
		return err
	}
	return s.touchDraft(ctx, artifactID)
}

func (s *Service) DuplicateScreen(ctx context.Context, artifactID, screenID string) (Screen, error) {
	original, err := s.repo.GetScreen(ctx, artifactID, screenID)
	if err != nil {
		return Screen{}, err
	}
	if original.IsSystem {
		return Screen{}, ErrCannotDelete
	}
	screens, err := s.repo.ListScreens(ctx, artifactID)
	if err != nil {
		return Screen{}, err
	}
	now := s.config.now()
	copy := original
	copy.ID = newID("scr")
	copy.Title = original.Title + " — копия"
	copy.Position = len(screens) + 1
	copy.CreatedAt, copy.UpdatedAt = now, now
	if err := s.repo.CreateScreen(ctx, copy); err != nil {
		return Screen{}, err
	}
	if err := s.touchDraft(ctx, artifactID); err != nil {
		return Screen{}, err
	}
	return copy, nil
}

func (s *Service) touchDraft(ctx context.Context, artifactID string) error {
	item, err := s.repo.GetArtifact(ctx, artifactID)
	if err != nil {
		return err
	}
	item.DraftRevision++
	item.UpdatedAt = s.config.now()
	return s.repo.UpdateArtifact(ctx, item)
}

func (s *Service) ListDrafts(ctx context.Context, artifactID string) ([]Draft, error) {
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return nil, err
	}
	return s.repo.ListDrafts(ctx, artifactID)
}

func (s *Service) CreateDraft(ctx context.Context, artifactID string, req createDraftRequest) (Draft, error) {
	if strings.TrimSpace(req.Name) == "" {
		return Draft{}, ErrBadRequest
	}
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return Draft{}, err
	}
	drafts, err := s.repo.ListDrafts(ctx, artifactID)
	if err != nil {
		return Draft{}, err
	}
	now := s.config.now()
	item := Draft{
		ID:         newID("drf"),
		ArtifactID: artifactID,
		Name:       strings.TrimSpace(req.Name),
		Content:    req.Content,
		Status:     "draft",
		Version:    len(drafts) + 1,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return item, s.repo.CreateDraft(ctx, item)
}

func (s *Service) GetDraft(ctx context.Context, artifactID, draftID string) (Draft, error) {
	return s.repo.GetDraft(ctx, artifactID, draftID)
}

func (s *Service) UpdateDraft(ctx context.Context, artifactID, draftID string, req updateDraftRequest) (Draft, error) {
	item, err := s.repo.GetDraft(ctx, artifactID, draftID)
	if err != nil {
		return Draft{}, err
	}
	if strings.TrimSpace(req.Name) != "" {
		item.Name = strings.TrimSpace(req.Name)
	}
	if req.Content != "" {
		item.Content = req.Content
	}
	item.Version++
	item.UpdatedAt = s.config.now()
	return item, s.repo.UpdateDraft(ctx, item)
}

func (s *Service) PublishReadyDraft(ctx context.Context, artifactID, draftID string) (Draft, error) {
	item, err := s.repo.GetDraft(ctx, artifactID, draftID)
	if err != nil {
		return Draft{}, err
	}
	item.Status = "publish-ready"
	item.Version++
	item.UpdatedAt = s.config.now()
	return item, s.repo.UpdateDraft(ctx, item)
}

func (s *Service) DiscardDraft(ctx context.Context, artifactID, draftID string) (Draft, error) {
	item, err := s.repo.GetDraft(ctx, artifactID, draftID)
	if err != nil {
		return Draft{}, err
	}
	item.Status = "discarded"
	item.Version++
	item.UpdatedAt = s.config.now()
	return item, s.repo.UpdateDraft(ctx, item)
}

func (s *Service) UploadMedia(ctx context.Context, req uploadMediaRequest) (Media, error) {
	if strings.TrimSpace(req.FileName) == "" || strings.TrimSpace(req.URL) == "" || strings.TrimSpace(req.MIMEType) == "" {
		return Media{}, ErrBadRequest
	}
	if req.ArtifactID != nil {
		if _, err := s.repo.GetArtifact(ctx, *req.ArtifactID); err != nil {
			return Media{}, err
		}
	}
	item := Media{
		ID:         newID("med"),
		ArtifactID: req.ArtifactID,
		FileName:   strings.TrimSpace(req.FileName),
		MIMEType:   strings.TrimSpace(req.MIMEType),
		URL:        strings.TrimSpace(req.URL),
		SizeBytes:  req.SizeBytes,
		CreatedAt:  s.config.now(),
	}
	return item, s.repo.CreateMedia(ctx, item)
}

func (s *Service) GetMedia(ctx context.Context, mediaID string) (Media, error) {
	return s.repo.GetMedia(ctx, mediaID)
}

func (s *Service) DeleteMedia(ctx context.Context, mediaID string) error {
	return s.repo.DeleteMedia(ctx, mediaID)
}

func (s *Service) UploadModel(ctx context.Context, req uploadModelRequest) (Model, error) {
	if strings.TrimSpace(req.FileName) == "" || strings.TrimSpace(req.StorageURL) == "" || strings.TrimSpace(req.Format) == "" {
		return Model{}, ErrBadRequest
	}
	if req.ArtifactID != nil {
		if _, err := s.repo.GetArtifact(ctx, *req.ArtifactID); err != nil {
			return Model{}, err
		}
	}
	now := s.config.now()
	item := Model{
		ID:               newID("mdl"),
		ArtifactID:       req.ArtifactID,
		FileName:         strings.TrimSpace(req.FileName),
		Format:           strings.TrimSpace(req.Format),
		StorageURL:       strings.TrimSpace(req.StorageURL),
		ProcessingStatus: "uploaded",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	return item, s.repo.CreateModel(ctx, item)
}

func (s *Service) GetModel(ctx context.Context, modelID string) (Model, error) {
	return s.repo.GetModel(ctx, modelID)
}

func (s *Service) ProcessModel(ctx context.Context, modelID string) (Model, error) {
	if _, err := s.repo.UpdateModelStatus(ctx, modelID, "processing", s.config.now()); err != nil {
		return Model{}, err
	}
	return s.repo.UpdateModelStatus(ctx, modelID, "ready", s.config.now())
}

func (s *Service) GetModelStatus(ctx context.Context, modelID string) (Model, error) {
	return s.repo.GetModel(ctx, modelID)
}

func (s *Service) MarkArtifactFound(ctx context.Context, visitorID, artifactID string) error {
	if strings.TrimSpace(visitorID) == "" || strings.TrimSpace(artifactID) == "" {
		return ErrBadRequest
	}
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return err
	}
	return s.repo.MarkArtifactFound(ctx, visitorID, artifactID, s.config.now())
}

func (s *Service) ToggleFavorite(ctx context.Context, visitorID, artifactID string) (ArtifactVisitorStatus, error) {
	if strings.TrimSpace(visitorID) == "" || strings.TrimSpace(artifactID) == "" {
		return ArtifactVisitorStatus{}, ErrBadRequest
	}
	if _, err := s.repo.GetArtifact(ctx, artifactID); err != nil {
		return ArtifactVisitorStatus{}, err
	}
	return s.repo.ToggleFavorite(ctx, visitorID, artifactID, s.config.now())
}

func (s *Service) GetArtifactStatus(ctx context.Context, visitorID, artifactID string) (ArtifactVisitorStatus, error) {
	if strings.TrimSpace(visitorID) == "" || strings.TrimSpace(artifactID) == "" {
		return ArtifactVisitorStatus{}, ErrBadRequest
	}
	return s.repo.GetArtifactStatus(ctx, visitorID, artifactID)
}
