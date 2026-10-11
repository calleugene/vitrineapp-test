package artifacts

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(db *sql.DB) *SQLiteRepository {
	return &SQLiteRepository{db: db}
}

func (r *SQLiteRepository) GetMuseumProfile(ctx context.Context, museumID string) (MuseumProfile, error) {
	var item MuseumProfile
	err := r.db.QueryRowContext(ctx, `SELECT museum_id, code, name, short_description, description, website, address, logo_url, created_at, updated_at FROM museum_profiles WHERE museum_id = ?`, museumID).Scan(&item.MuseumID, &item.Code, &item.Name, &item.ShortDescription, &item.Description, &item.Website, &item.Address, &item.LogoURL, &item.CreatedAt, &item.UpdatedAt)
	if err == sql.ErrNoRows {
		return MuseumProfile{}, ErrNotFound
	}
	return item, err
}

func (r *SQLiteRepository) CreateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM museum_profiles`).Scan(&total); err != nil {
		return MuseumProfile{}, err
	}
	profile.Code = fmt.Sprintf("GIM-%04d", total+1)
	_, err := r.db.ExecContext(ctx, `INSERT INTO museum_profiles (museum_id, code, name, short_description, description, website, address, logo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, profile.MuseumID, profile.Code, profile.Name, profile.ShortDescription, profile.Description, profile.Website, profile.Address, profile.LogoURL, profile.CreatedAt.Format(time.RFC3339), profile.UpdatedAt.Format(time.RFC3339))
	return profile, err
}

func (r *SQLiteRepository) UpdateMuseumProfile(ctx context.Context, profile MuseumProfile) (MuseumProfile, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE museum_profiles SET name=?, short_description=?, description=?, website=?, address=?, logo_url=?, updated_at=? WHERE museum_id=?`, profile.Name, profile.ShortDescription, profile.Description, profile.Website, profile.Address, profile.LogoURL, profile.UpdatedAt.Format(time.RFC3339), profile.MuseumID)
	if err != nil {
		return MuseumProfile{}, err
	}
	if err := ensureRows(res); err != nil {
		return MuseumProfile{}, err
	}
	return r.GetMuseumProfile(ctx, profile.MuseumID)
}

func (r *SQLiteRepository) ListArtifacts(ctx context.Context, status, category, sort string, page, limit int, museumID *string) ([]Artifact, int, error) {
	where := "WHERE 1=1"
	var args []any

	if status != "" && status != "all" {
		where += " AND status = ?"
		args = append(args, status)
	}
	if category != "" && category != "all" {
		where += " AND category = ?"
		args = append(args, category)
	}
	if museumID != nil && *museumID != "" {
		where += " AND museum_id = ?"
		args = append(args, *museumID)
	}

	var countQuery string
	if strings.Contains(where, "?") {
		// SQLite doesn't support $1, use ?
		countQuery = "SELECT COUNT(*) FROM artifacts " + where
	} else {
		countQuery = "SELECT COUNT(*) FROM artifacts"
	}

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

	offset := (page - 1) * limit
	query := fmt.Sprintf(`SELECT id, museum_id, title, short_description, description, category,
		created_date, period, origin_place, tags, cover_url,
		status, visibility, route_access, show_views, allow_downloads, public_code, draft_revision, published_revision,
		published_at, archived_at, created_at, updated_at
		FROM artifacts %s %s LIMIT ? OFFSET ?`, where, orderBy)

	queryArgs := append(args, limit, offset)
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

func (r *SQLiteRepository) CreateArtifact(ctx context.Context, artifact Artifact) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO artifacts (id, museum_id, title, short_description, description, category,
		created_date, period, origin_place, tags, cover_url,
		status, public_code, draft_revision, published_revision, visibility, route_access, show_views, allow_downloads,
		published_at, archived_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		artifact.ID, artifact.MuseumID, artifact.Title, artifact.ShortDescription, artifact.Description,
		artifact.Category, ns(artifact.CreatedDate), ns(artifact.Period), ns(artifact.OriginPlace),
		ns(artifact.Tags), ns(artifact.CoverURL),
		artifact.Status, ns(artifact.PublicCode), artifact.DraftRevision, artifact.PublishedRevision, ns(artifact.Visibility), ns(artifact.RouteAccess),
		artifact.ShowViews, artifact.AllowDownloads,
		nullableTime(artifact.PublishedAt), nullableTime(artifact.ArchivedAt),
		artifact.CreatedAt.Format(time.RFC3339), artifact.UpdatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetArtifact(ctx context.Context, artifactID string) (Artifact, error) {
	row := r.db.QueryRowContext(ctx, artifactSelectColumns+" WHERE id = ?", artifactID)
	return scanArtifactRow(row)
}

func (r *SQLiteRepository) GetArtifactByPublicCode(ctx context.Context, publicCode string) (Artifact, error) {
	row := r.db.QueryRowContext(ctx, artifactSelectColumns+" WHERE public_code = ?", publicCode)
	return scanArtifactRow(row)
}

func (r *SQLiteRepository) CreatePublication(ctx context.Context, publication Publication) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO artifact_publications(artifact_id, version, snapshot_json, published_at) VALUES (?, ?, ?, ?)`, publication.ArtifactID, publication.Version, publication.SnapshotJSON, publication.PublishedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetLatestPublication(ctx context.Context, publicCode string) (Publication, error) {
	var publication Publication
	var publishedAt any
	err := r.db.QueryRowContext(ctx, `SELECT p.artifact_id, p.version, p.snapshot_json, p.published_at FROM artifact_publications p JOIN artifacts a ON a.id = p.artifact_id WHERE a.public_code = ? ORDER BY p.version DESC LIMIT 1`, publicCode).Scan(&publication.ArtifactID, &publication.Version, &publication.SnapshotJSON, &publishedAt)
	if err == sql.ErrNoRows {
		return Publication{}, ErrNotFound
	}
	if err == nil {
		publication.PublishedAt = mustParseTime(publishedAt)
	}
	return publication, err
}

func (r *SQLiteRepository) UpdateArtifact(ctx context.Context, artifact Artifact) error {
	res, err := r.db.ExecContext(ctx, `UPDATE artifacts SET title = ?, short_description = ?, description = ?,
		category = ?, created_date = ?, period = ?, origin_place = ?, tags = ?, cover_url = ?,
		status = ?, public_code = ?, draft_revision = ?, published_revision = ?, visibility = ?, route_access = ?, show_views = ?, allow_downloads = ?,
		published_at = ?, archived_at = ?, updated_at = ?
		WHERE id = ?`,
		artifact.Title, artifact.ShortDescription, artifact.Description,
		artifact.Category, ns(artifact.CreatedDate), ns(artifact.Period), ns(artifact.OriginPlace),
		ns(artifact.Tags), ns(artifact.CoverURL),
		artifact.Status, ns(artifact.PublicCode), artifact.DraftRevision, artifact.PublishedRevision, ns(artifact.Visibility), ns(artifact.RouteAccess),
		artifact.ShowViews, artifact.AllowDownloads,
		nullableTime(artifact.PublishedAt), nullableTime(artifact.ArchivedAt),
		artifact.UpdatedAt.Format(time.RFC3339), artifact.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) DeleteArtifact(ctx context.Context, artifactID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM artifacts WHERE id = ?`, artifactID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) UpdateArtifactCover(ctx context.Context, artifactID, coverURL string, now time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE artifacts SET cover_url = ?, updated_at = ? WHERE id = ?`, coverURL, now.Format(time.RFC3339), artifactID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) GetSummary(ctx context.Context, museumID *string) (summaryResponse, error) {
	summary := summaryResponse{ByCategory: make(map[string]int)}
	where := ""
	var args []any
	if museumID != nil && *museumID != "" {
		where = " WHERE museum_id = ?"
		args = append(args, *museumID)
	}

	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts"+where, args...).Scan(&summary.Total)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'published'"+andMuseum(where), args...).Scan(&summary.Published)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'draft'"+andMuseum(where), args...).Scan(&summary.Draft)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'archived'"+andMuseum(where), args...).Scan(&summary.Archived)
	r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM artifacts WHERE status = 'moderation'"+andMuseum(where), args...).Scan(&summary.Moderation)

	catRows, err := r.db.QueryContext(ctx, "SELECT category, COUNT(*) FROM artifacts"+catsWhere(where)+" GROUP BY category", args...)
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

func andMuseum(where string) string {
	if where != "" {
		return " AND museum_id = ?"
	}
	return ""
}

func catsWhere(where string) string {
	if where != "" {
		return " WHERE museum_id = ?"
	}
	return ""
}

func (r *SQLiteRepository) ListScreens(ctx context.Context, artifactID string) ([]Screen, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at FROM screens WHERE artifact_id = ? ORDER BY position ASC`, artifactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScreens(rows)
}

func (r *SQLiteRepository) CreateScreen(ctx context.Context, screen Screen) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO screens (id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		screen.ID, screen.ArtifactID, screen.Type, screen.Title, screen.Subtitle, screen.Payload, screen.Position, screen.IsSystem, screen.CreatedAt.Format(time.RFC3339), screen.UpdatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetScreen(ctx context.Context, artifactID, screenID string) (Screen, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, type, title, subtitle, payload, position, is_system, created_at, updated_at FROM screens WHERE artifact_id = ? AND id = ?`, artifactID, screenID)
	return scanScreenRow(row)
}

func (r *SQLiteRepository) UpdateScreen(ctx context.Context, screen Screen) error {
	res, err := r.db.ExecContext(ctx, `UPDATE screens SET title = ?, subtitle = ?, payload = ?, position = ?, updated_at = ? WHERE artifact_id = ? AND id = ?`,
		screen.Title, screen.Subtitle, screen.Payload, screen.Position, screen.UpdatedAt.Format(time.RFC3339), screen.ArtifactID, screen.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) DeleteScreen(ctx context.Context, artifactID, screenID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM screens WHERE artifact_id = ? AND id = ?`, artifactID, screenID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) ReorderScreens(ctx context.Context, artifactID string, items []reorderScreenItem, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `UPDATE screens SET position = position + 1000000 WHERE artifact_id = ?`, artifactID); err != nil {
		return err
	}
	for _, item := range items {
		res, err := tx.ExecContext(ctx, `UPDATE screens SET position = ?, updated_at = ? WHERE artifact_id = ? AND id = ?`, item.Order, now.Format(time.RFC3339), artifactID, item.ScreenID)
		if err != nil {
			return err
		}
		if err := ensureRows(res); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *SQLiteRepository) ListDrafts(ctx context.Context, artifactID string) ([]Draft, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, artifact_id, name, content, status, version, created_at, updated_at FROM drafts WHERE artifact_id = ? ORDER BY version DESC`, artifactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDrafts(rows)
}

func (r *SQLiteRepository) CreateDraft(ctx context.Context, draft Draft) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO drafts (id, artifact_id, name, content, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		draft.ID, draft.ArtifactID, draft.Name, draft.Content, draft.Status, draft.Version, draft.CreatedAt.Format(time.RFC3339), draft.UpdatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetDraft(ctx context.Context, artifactID, draftID string) (Draft, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, name, content, status, version, created_at, updated_at FROM drafts WHERE artifact_id = ? AND id = ?`, artifactID, draftID)
	return scanDraftRow(row)
}

func (r *SQLiteRepository) UpdateDraft(ctx context.Context, draft Draft) error {
	res, err := r.db.ExecContext(ctx, `UPDATE drafts SET name = ?, content = ?, status = ?, version = ?, updated_at = ? WHERE artifact_id = ? AND id = ?`,
		draft.Name, draft.Content, draft.Status, draft.Version, draft.UpdatedAt.Format(time.RFC3339), draft.ArtifactID, draft.ID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) CreateMedia(ctx context.Context, media Media) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO media (id, artifact_id, file_name, mime_type, url, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		media.ID, media.ArtifactID, media.FileName, media.MIMEType, media.URL, media.SizeBytes, media.CreatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetMedia(ctx context.Context, mediaID string) (Media, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, file_name, mime_type, url, size_bytes, created_at FROM media WHERE id = ?`, mediaID)
	return scanMediaRow(row)
}

func (r *SQLiteRepository) DeleteMedia(ctx context.Context, mediaID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM media WHERE id = ?`, mediaID)
	if err != nil {
		return err
	}
	return ensureRows(res)
}

func (r *SQLiteRepository) CreateModel(ctx context.Context, model Model) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO models (id, artifact_id, file_name, format, storage_url, processing_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		model.ID, model.ArtifactID, model.FileName, model.Format, model.StorageURL, model.ProcessingStatus, model.CreatedAt.Format(time.RFC3339), model.UpdatedAt.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) GetModel(ctx context.Context, modelID string) (Model, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, artifact_id, file_name, format, storage_url, processing_status, created_at, updated_at FROM models WHERE id = ?`, modelID)
	return scanModelRow(row)
}

func (r *SQLiteRepository) UpdateModelStatus(ctx context.Context, modelID, status string, now time.Time) (Model, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE models SET processing_status = ?, updated_at = ? WHERE id = ?`, status, now.Format(time.RFC3339), modelID)
	if err != nil {
		return Model{}, err
	}
	if err := ensureRows(res); err != nil {
		return Model{}, err
	}
	return r.GetModel(ctx, modelID)
}

func nullableTime(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.Format(time.RFC3339)
}

func ns(s string) any {
	if s == "" {
		return nil
	}
	return s
}

var artifactSelectColumns = `SELECT id, museum_id, title, short_description, description, category,
	created_date, period, origin_place, tags, cover_url,
	status, visibility, route_access, show_views, allow_downloads,
		public_code, draft_revision, published_revision, published_at, archived_at, created_at, updated_at FROM artifacts`

func (r *SQLiteRepository) MarkArtifactFound(ctx context.Context, visitorID, artifactID string, now time.Time) error {
	statusID := "avs_" + visitorID + "_" + artifactID
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO artifact_visitor_status (id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at)
		VALUES (?, ?, ?, 1, ?, 0, NULL, ?, ?)
		ON CONFLICT(visitor_id, artifact_id) DO UPDATE SET found = 1, found_at = ?, updated_at = ?
	`, statusID, visitorID, artifactID, now.Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339))
	return err
}

func (r *SQLiteRepository) ToggleFavorite(ctx context.Context, visitorID, artifactID string, now time.Time) (ArtifactVisitorStatus, error) {
	statusID := "avs_" + visitorID + "_" + artifactID
	row := r.db.QueryRowContext(ctx, `SELECT is_favorite FROM artifact_visitor_status WHERE visitor_id = ? AND artifact_id = ?`, visitorID, artifactID)
	var isFav int
	err := row.Scan(&isFav)
	if err != nil && err != sql.ErrNoRows {
		return ArtifactVisitorStatus{}, err
	}

	newFav := isFav == 0
	favStr := 0
	if newFav {
		favStr = 1
	}

	_, err = r.db.ExecContext(ctx, `
		INSERT INTO artifact_visitor_status (id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at)
		VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?)
		ON CONFLICT(visitor_id, artifact_id) DO UPDATE SET is_favorite = ?, favorited_at = ?, updated_at = ?
	`, statusID, visitorID, artifactID, favStr, now.Format(time.RFC3339), now.Format(time.RFC3339), now.Format(time.RFC3339), favStr, now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		return ArtifactVisitorStatus{}, err
	}

	return r.GetArtifactStatus(ctx, visitorID, artifactID)
}

func (r *SQLiteRepository) GetArtifactStatus(ctx context.Context, visitorID, artifactID string) (ArtifactVisitorStatus, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, visitor_id, artifact_id, found, found_at, is_favorite, favorited_at, created_at, updated_at FROM artifact_visitor_status WHERE visitor_id = ? AND artifact_id = ?`, visitorID, artifactID)
	return scanArtifactVisitorStatusRow(row)
}
