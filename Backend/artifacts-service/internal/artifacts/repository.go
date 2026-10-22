package artifacts

import (
	"context"
	"time"
)

type Repository interface {
	ListMuseumProfiles(ctx context.Context) ([]MuseumProfile, error)
	GetMuseumProfile(ctx context.Context, museumID string) (MuseumProfile, error)
	CreateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error)
	UpdateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error)

	ListArtifacts(ctx context.Context, status, category, sort string, page, limit int, museumID *string) ([]Artifact, int, error)
	CreateArtifact(ctx context.Context, artifact Artifact) error
	GetArtifact(ctx context.Context, artifactID string) (Artifact, error)
	UpdateArtifact(ctx context.Context, artifact Artifact) error
	DeleteArtifact(ctx context.Context, artifactID string) error
	UpdateArtifactCover(ctx context.Context, artifactID, coverURL string, now time.Time) error
	GetArtifactByPublicCode(ctx context.Context, publicCode string) (Artifact, error)
	CreatePublication(ctx context.Context, publication Publication) error
	GetLatestPublication(ctx context.Context, publicCode string) (Publication, error)

	GetSummary(ctx context.Context, museumID *string) (summaryResponse, error)

	ListScreens(ctx context.Context, artifactID string) ([]Screen, error)
	CreateScreen(ctx context.Context, screen Screen) error
	GetScreen(ctx context.Context, artifactID, screenID string) (Screen, error)
	UpdateScreen(ctx context.Context, screen Screen) error
	DeleteScreen(ctx context.Context, artifactID, screenID string) error
	ReorderScreens(ctx context.Context, artifactID string, items []reorderScreenItem, now time.Time) error

	ListDrafts(ctx context.Context, artifactID string) ([]Draft, error)
	CreateDraft(ctx context.Context, draft Draft) error
	GetDraft(ctx context.Context, artifactID, draftID string) (Draft, error)
	UpdateDraft(ctx context.Context, draft Draft) error

	CreateMedia(ctx context.Context, media Media) error
	GetMedia(ctx context.Context, mediaID string) (Media, error)
	DeleteMedia(ctx context.Context, mediaID string) error

	CreateModel(ctx context.Context, model Model) error
	GetModel(ctx context.Context, modelID string) (Model, error)
	UpdateModelStatus(ctx context.Context, modelID, status string, now time.Time) (Model, error)

	MarkArtifactFound(ctx context.Context, visitorID, artifactID string, now time.Time) error
	ToggleFavorite(ctx context.Context, visitorID, artifactID string, now time.Time) (ArtifactVisitorStatus, error)
	GetArtifactStatus(ctx context.Context, visitorID, artifactID string) (ArtifactVisitorStatus, error)
}
