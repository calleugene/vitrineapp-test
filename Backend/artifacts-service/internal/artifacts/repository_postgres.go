package artifacts

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) GetMuseumProfile(ctx context.Context, museumID string) (MuseumProfile, error) {
	var item MuseumProfile
	err := r.db.QueryRowContext(ctx, `SELECT museum_id, code, name, short_description, description, website, address, logo_url, created_at, updated_at FROM museum_profiles WHERE museum_id = $1`, museumID).Scan(&item.MuseumID, &item.Code, &item.Name, &item.ShortDescription, &item.Description, &item.Website, &item.Address, &item.LogoURL, &item.CreatedAt, &item.UpdatedAt)
	if err == sql.ErrNoRows {
		return MuseumProfile{}, ErrNotFound
	}
	return item, err
}

func (r *PostgresRepository) CreateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error) {
	var number int64
	if err := r.db.QueryRowContext(ctx, `SELECT nextval('museum_profile_code_seq')`).Scan(&number); err != nil {
		return MuseumProfile{}, err
	}
	profile.Code = fmt.Sprintf("GIM-%04d", number)
	_, err := r.db.ExecContext(ctx, `INSERT INTO museum_profiles (museum_id, code, name, short_description, description, website, address, logo_url, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, profile.MuseumID, profile.Code, profile.Name, profile.ShortDescription, profile.Description, profile.Website, profile.Address, profile.LogoURL, profile.CreatedAt, profile.UpdatedAt)
	return profile, err
}

func (r *PostgresRepository) UpdateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE museum_profiles SET name=$1, short_description=$2, description=$3, website=$4, address=$5, logo_url=$6, updated_at=$7 WHERE museum_id=$8`, profile.Name, profile.ShortDescription, profile.Description, profile.Website, profile.Address, profile.LogoURL, profile.UpdatedAt, profile.MuseumID)
	if err != nil {
		return MuseumProfile{}, err
	}
	if err := ensureRows(res); err != nil {
		return MuseumProfile{}, err
	}
	return r.GetMuseumProfile(ctx, profile.MuseumID)
}

func (r *PostgresRepository) ListArtifacts(ctx context.Context, status, category, sort string, page, limit int, museumID *string) ([]Artifact, int, error) {
	where := "WHERE 1=1"
	var args []any
	paramIdx := 1

	if status != "" && status != "all" {
		where += fmt.Sprintf(" AND status = $%d", paramIdx)
		args = append(args, status)
		paramIdx++
	}
	if category != "" && category != "all" {
		where += fmt.Sprintf(" AND category = $%d", paramIdx)
		args = append(args, category)
		paramIdx++
	}
	if museumID != nil && *museumID != "" {
		where += fmt.Sprintf(" AND museum_id = $%d", paramIdx)
		args = append(args, *museumID)
		paramIdx++
	}

	countQuery := "SELECT COUNT(*) FROM artifacts " + where
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "ORDER BY created_at DESC"
	switch sort {
	case "created_at_asc":
		orderBy = "ORDER BY created_at ASC"
	case "title_asc":
		orderBy = "ORDER BY title ASC"
	case "title_desc":
		orderBy = "ORDER BY title DESC"
	}

	limitIdx := paramIdx
	offsetIdx := paramIdx + 1
	query := fmt.Sprintf(`SELECT id, museum_id, title, short_description, description, category,
		created_date, period, origin_place, tags, cover_url,
		status, visibility, route_access, show_views, allow_downloads, public_code, draft_revision, published_revision,
		published_at, archived_at, created_at, updated_at
		FROM artifacts %s %s LIMIT $%d OFFSET $%d`, where, orderBy, limitIdx, offsetIdx)

	queryArgs := append(args, limit, (page-1)*limit)
	rows, err := r.db.QueryContext(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items, err := scanArtifacts(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *PostgresRepository) CreateArtifact(ctx context.Context, artifact Artifact) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO artifacts (id, museum_id, title, short_description, description, category,
		created_date, period, origin_place, tags, cover_url,
		status, public_code, draft_revision, published_revision, visibility, route_access, show_views, allow_downloads,
		published_at, archived_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)`,
		artifact.ID, artifact.MuseumID, artifact.Title, artifact.ShortDescription, artifact.Description,
		artifact.Category, ns(artifact.CreatedDate), ns(artifact.Period), ns(artifact.OriginPlace),
		ns(artifact.Tags), ns(artifact.CoverURL),
		artifact.Status, ns(artifact.PublicCode), artifact.DraftRevision, artifact.PublishedRevision, ns(artifact.Visibility), ns(artifact.RouteAccess),
		artifact.ShowViews, artifact.AllowDownloads,
		artifact.PublishedAt, artifact.ArchivedAt,
		artifact.CreatedAt, artifact.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	row := r.db.QueryRowContext(ctx, artifactSelectColumnsPG+" WHERE id = $1", artifactID)
	return scanArtifactRow(row)
}

func (r *PostgresRepository) GetArtifactByPublicCode(ctx context.Context, publicCode string) (Artifact, error) {
	row := r.db.QueryRowContext(ctx, artifactSelectColumnsPG+" WHERE public_code = $1", publicCode)
	return scanArtifactRow(row)
}

func (r *PostgresRepository) CreatePublication(ctx context.Context, publication Publication) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO artifact_publications(artifact_id, version, snapshot_json, published_at) VALUES ($1, $2, $3::jsonb, $4)`, publication.ArtifactID, publication.Version, publication.SnapshotJSON, publication.PublishedAt)
	return err
}

func (r *PostgresRepository) GetLatestPublication(ctx context.Context, publicCode string) (Publication, error) {
	var publication Publication
	var publishedAt any
	err := r.db.QueryRowContext(ctx, `SELECT p.artifact_id, p.version, p.snapshot_json::text, p.published_at FROM artifact_publications p JOIN artifacts a ON a.id = p.artifact_id WHERE a.public_code = $1 ORDER BY p.version DESC LIMIT 1`, publicCode).Scan(&publication.ArtifactID, &publication.Version, &publication.SnapshotJSON, &publishedAt)
	if err == sql.ErrNoRows {
		return Publication{}, ErrNotFound
	}
	if err == nil {
		publication.PublishedAt = mustParseTime(publishedAt)
	}
	return publication, err
}

func (r *PostgresRepository) UpdateArtifact(ctx context.Context, artifact Artifact) error {
	res, err := r.db.ExecContext(ctx, `UPDATE artifacts SET title = $1, short_description = $2, description = $3,
		category = $4, created_date = $5, period = $6, origin_place = $7, tags = $8, cover_url = $9,
		status = $10, public_code = $11, draft_revision = $12, published_revision = $13, visibility = $14, route_access = $15, show_views = $16, allow_downloads = $17,
		published_at = $18, archived_at = $19, updated_at = $20
		WHERE id = $21`,
		artifact.Title, artifact.ShortDescription, artifact.Description,
		artifact.Category, ns(artifact.CreatedDate), ns(artifact.Period), ns(artifact.OriginPlace),
		ns(artifact.Tags), ns(artifact.CoverURL),
		artifact.Status, ns(artifact.PublicCode), artifact.DraftRevision, artifact.PublishedRevision, ns(artifact.Visibility), ns(artifact.RouteAccess),
		artifact.ShowViews, artifact.AllowDownloads,
		artifact.PublishedAt, artifact.ArchivedAt,
		artifact.UpdatedAt, artifact.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) DeleteArtifact(ctx context.Context, artifactID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM artifacts WHERE id = $1`, artifactID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) UpdateArtifactCover(ctx context.Context, artifactID, coverURL string, now time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE artifacts SET cover_url = $1, updated_at = $2 WHERE id = $3`, coverURL, now, artifactID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) GetSummary(ctx context.Context, museumID *string) (summaryResponse, error) {
	summary := summaryResponse{ByCategory: make(map[string]int)}
	museumFilter := ""
	var args []any

	if museumID != nil && *museumID != "" {
		museumFilter = " AND museum_id = $1"
		args = append(args, *museumID)
	}

	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE 1=1"+museumFilter, args...).Scan(&summary.Total)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'published'"+museumFilter, args...).Scan(&summary.Published)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'draft'"+museumFilter, args...).Scan(&summary.Draft)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'archived'"+museumFilter, args...).Scan(&summary.Archived)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'moderation'"+museumFilter, args...).Scan(&summary.Moderation)

	catQuery := "SELECT category, COUNT(*) FROM artifacts WHERE 1=1" + museumFilter + " GROUP BY category"
	catRows, err := r.db.QueryContext(ctx, catQuery, args...)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cat string
			var cnt int
			if err := catRows.Scan(&cat, &cnt); err == nil {
				summary.ByCategory[cat] = cnt
			}
		}
	}
	return summary, nil
}

func (r *PostgresRepository) ListScreens(ctx context.Context, artifactID string) ([]Screen, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at FROM screens WHERE artifact_id = $1 ORDER BY position ASC`, artifactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScreens(rows)
}

func (r *PostgresRepository) CreateScreen(ctx context.Context, screen Screen) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO screens (id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		screen.ID, screen.ArtifactID, screen.Type, screen.Title, screen.Subtitle, screen.Payload, screen.Position, screen.IsSystem, screen.CreatedAt, screen.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetScreen(ctx context.Context, artifactID, screenID string) (Screen, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at FROM screens WHERE artifact_id = $1 AND id = $2`, artifactID, screenID)
	return scanScreenRow(row)
}

func (r *PostgresRepository) UpdateScreen(ctx context.Context, screen Screen) error {
	res, err := r.db.ExecContext(ctx, `UPDATE screens SET title = $1, subtitle = $2, payload = $3, position = $4, updated_at = $5 WHERE artifact_id = $6 AND id = $7`,
		screen.Title, screen.Subtitle, screen.Payload, screen.Position, screen.UpdatedAt, screen.ArtifactID, screen.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) DeleteScreen(ctx context.Context, artifactID, screenID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM screens WHERE artifact_id = $1 AND id = $2`, artifactID, screenID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) ReorderScreens(ctx context.Context, artifactID string, items []reorderScreenItem, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `UPDATE screens SET position = position + 1000000 WHERE artifact_id = $1`, artifactID); err != nil {
		return err
	}
	for _, item := range items {
		res, err := tx.ExecContext(ctx, `UPDATE screens SET position = $1, updated_at = $2 WHERE artifact_id = $3 AND id = $4`, item.Order, now, artifactID, item.ScreenID)
		if err != nil {
			return err
		}
		if err := ensureRows(res); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *PostgresRepository) ListDrafts(ctx context.Context, artifactID string) ([]Draft, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, artifact_id, name, content, status, version, created_at, updated_at FROM drafts WHERE artifact_id = $1 ORDER BY version DESC`, artifactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDrafts(rows)
}

func (r *PostgresRepository) CreateDraft(ctx context.Context, draft Draft) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO drafts (id, artifact_id, name, content, status, version, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		draft.ID, draft.ArtifactID, draft.Name, draft.Content, draft.Status, draft.Version, draft.CreatedAt, draft.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetDraft(ctx context.Context, artifactID, draftID string) (Draft, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, name, content, status, version, created_at, updated_at FROM drafts WHERE artifact_id = $1 AND id = $2`, artifactID, draftID)
	return scanDraftRow(row)
}

func (r *PostgresRepository) UpdateDraft(ctx context.Context, draft Draft) error {
	res, err := r.db.ExecContext(ctx, `UPDATE drafts SET name = $1, content = $2, status = $3, version = $4, updated_at = $5 WHERE artifact_id = $6 AND id = $7`,
		draft.Name, draft.Content, draft.Status, draft.Version, draft.UpdatedAt, draft.ArtifactID, draft.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) CreateMedia(ctx context.Context, media Media) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO media (id, artifact_id, file_name, mime_type, url, size_bytes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		media.ID, media.ArtifactID, media.FileName, media.MIMEType, media.URL, media.SizeBytes, media.CreatedAt)
	return err
}

func (r *PostgresRepository) GetMedia(ctx context.Context, mediaID string) (Media, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, file_name, mime_type, url, size_bytes, created_at FROM media WHERE id = $1`, mediaID)
	return scanMediaRow(row)
}

func (r *PostgresRepository) DeleteMedia(ctx context.Context, mediaID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM media WHERE id = $1`, mediaID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *PostgresRepository) CreateModel(ctx context.Context, model Model) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO models (id, artifact_id, file_name, format, storage_url, processing_status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		model.ID, model.ArtifactID, model.FileName, model.Format, model.StorageURL, model.ProcessingStatus, model.CreatedAt, model.UpdatedAt)
	return err
}

func (r *PostgresRepository) GetModel(ctx context.Context, modelID string) (Model, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, file_name, format, storage_url, processing_status, created_at, updated_at FROM models WHERE id = $1`, modelID)
	return scanModelRow(row)
}

func (r *PostgresRepository) UpdateModelStatus(ctx context.Context, modelID, status string, now time.Time) (Model, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE models SET processing_status = $1, updated_at = $2 WHERE id = $3`, status, now, modelID)
	if err != nil {
		return Model{}, err
	}
	if err := ensureRows(res); err != nil {
		return Model{}, err
	}
	return r.GetModel(ctx, modelID)
}

var artifactSelectColumnsPG = `SELECT id, museum_id, title, short_description, description, category,
	created_date, period, origin_place, tags, cover_url,
	status, visibility, route_access, show_views, allow_downloads,
		public_code, draft_revision, published_revision, published_at, archived_at, created_at, updated_at FROM artifacts`

func (r *PostgresRepository) MarkArtifactFound(ctx context.Context, visitorID, artifactID string, now time.Time) error {
	statusID := "avs_" + visitorID + "_" + artifactID
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO artifact_visitor_status (id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at)
		VALUES ($1, $2, $3, true, $4, false, NULL, $5, $6)
		ON CONFLICT(visitor_id, artifact_id) DO UPDATE SET found = true, found_at = $4, updated_at = $6
	`, statusID, visitorID, artifactID, now, now, now)
	return err
}

func (r *PostgresRepository) ToggleFavorite(ctx context.Context, visitorID, artifactID string, now time.Time) (ArtifactVisitorStatus, error) {
	statusID := "avs_" + visitorID + "_" + artifactID
	row := r.db.QueryRowContext(ctx, `SELECT is_favorite FROM artifact_visitor_status WHERE visitor_id = $1 AND artifact_id = $2`, visitorID, artifactID)
	var isFav bool
	err := row.Scan(&isFav)
	if err != nil && err != sql.ErrNoRows {
		return ArtifactVisitorStatus{}, err
	}

	newFav := !isFav
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO artifact_visitor_status (id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at)
		VALUES ($1, $2, $3, false, NULL, $4, $5, $6, $7)
		ON CONFLICT(visitor_id, artifact_id) DO UPDATE SET is_favorite = $4, favorited_at = $5, updated_at = $7
	`, statusID, visitorID, artifactID, newFav, now, now, now)
	if err != nil {
		return ArtifactVisitorStatus{}, err
	}

	return r.GetArtifactStatus(ctx, visitorID, artifactID)
}

func (r *PostgresRepository) GetArtifactStatus(ctx context.Context, visitorID, artifactID string) (ArtifactVisitorStatus, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at FROM artifact_visitor_status WHERE visitor_id = $1 AND artifact_id = $2`, visitorID, artifactID)
	return scanArtifactVisitorStatusRow(row)
}
