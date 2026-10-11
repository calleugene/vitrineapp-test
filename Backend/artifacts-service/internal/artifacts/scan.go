package artifacts

import (
	"database/sql"
	"errors"
	"time"
)

func scanArtifacts(rows *sql.Rows) ([]Artifact, error) {
	var items []Artifact
	for rows.Next() {
		item, err := scanArtifactRows(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanArtifactRow(row *sql.Row) (Artifact, error) {
	var item Artifact
	var museumID, createdDate, period, originPlace, tags, coverURL, visibility, routeAccess any
	var publicCode any
	var archivedAt, publishedAt, createdAt, updatedAt any
	if err := row.Scan(&item.ID, &museumID, &item.Title, &item.ShortDescription, &item.Description,
		&item.Category, &createdDate, &period, &originPlace, &tags, &coverURL,
		&item.Status, &visibility, &routeAccess, &item.ShowViews, &item.AllowDownloads, &publicCode, &item.DraftRevision, &item.PublishedRevision,
		&publishedAt, &archivedAt, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Artifact{}, ErrNotFound
		}
		return Artifact{}, err
	}
	item.MuseumID = mustParseStringPtr(museumID)
	item.CreatedDate = mustParseString(createdDate)
	item.Period = mustParseString(period)
	item.OriginPlace = mustParseString(originPlace)
	item.Tags = mustParseString(tags)
	item.CoverURL = mustParseString(coverURL)
	item.Visibility = mustParseString(visibility)
	item.RouteAccess = mustParseString(routeAccess)
	item.PublicCode = mustParseString(publicCode)
	item.HasUnpublishedChanges = item.DraftRevision != item.PublishedRevision
	item.PublishedAt = mustParseTimePtr(publishedAt)
	item.ArchivedAt = mustParseTimePtr(archivedAt)
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}

func scanArtifactRows(scanner interface{ Scan(dest ...any) error }) (Artifact, error) {
	var item Artifact
	var museumID, createdDate, period, originPlace, tags, coverURL, visibility, routeAccess any
	var publicCode any
	var archivedAt, publishedAt, createdAt, updatedAt any
	if err := scanner.Scan(&item.ID, &museumID, &item.Title, &item.ShortDescription, &item.Description,
		&item.Category, &createdDate, &period, &originPlace, &tags, &coverURL,
		&item.Status, &visibility, &routeAccess, &item.ShowViews, &item.AllowDownloads, &publicCode, &item.DraftRevision, &item.PublishedRevision,
		&publishedAt, &archivedAt, &createdAt, &updatedAt); err != nil {
		return Artifact{}, err
	}
	item.MuseumID = mustParseStringPtr(museumID)
	item.CreatedDate = mustParseString(createdDate)
	item.Period = mustParseString(period)
	item.OriginPlace = mustParseString(originPlace)
	item.Tags = mustParseString(tags)
	item.CoverURL = mustParseString(coverURL)
	item.Visibility = mustParseString(visibility)
	item.RouteAccess = mustParseString(routeAccess)
	item.PublicCode = mustParseString(publicCode)
	item.HasUnpublishedChanges = item.DraftRevision != item.PublishedRevision
	item.PublishedAt = mustParseTimePtr(publishedAt)
	item.ArchivedAt = mustParseTimePtr(archivedAt)
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}

func scanScreens(rows *sql.Rows) ([]Screen, error) {
	var items []Screen
	for rows.Next() {
		item, err := scanScreenRows(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanScreenRow(row *sql.Row) (Screen, error) {
	item, err := scanScreenRows(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Screen{}, ErrNotFound
		}
		return Screen{}, err
	}
	return item, nil
}

func scanScreenRows(scanner interface{ Scan(dest ...any) error }) (Screen, error) {
	var item Screen
	var createdAt, updatedAt any
	if err := scanner.Scan(&item.ID, &item.ArtifactID, &item.Type, &item.Title, &item.Subtitle, &item.Payload, &item.Position, &item.IsSystem, &createdAt, &updatedAt); err != nil {
		return Screen{}, err
	}
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}

func scanDrafts(rows *sql.Rows) ([]Draft, error) {
	var items []Draft
	for rows.Next() {
		item, err := scanDraftRows(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanDraftRow(row *sql.Row) (Draft, error) {
	item, err := scanDraftRows(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Draft{}, ErrNotFound
		}
		return Draft{}, err
	}
	return item, nil
}

func scanDraftRows(scanner interface{ Scan(dest ...any) error }) (Draft, error) {
	var item Draft
	var createdAt, updatedAt any
	if err := scanner.Scan(&item.ID, &item.ArtifactID, &item.Name, &item.Content, &item.Status, &item.Version, &createdAt, &updatedAt); err != nil {
		return Draft{}, err
	}
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}

func scanMediaRow(row *sql.Row) (Media, error) {
	var item Media
	var artifactID, createdAt any
	if err := row.Scan(&item.ID, &artifactID, &item.FileName, &item.MIMEType, &item.URL, &item.SizeBytes, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Media{}, ErrNotFound
		}
		return Media{}, err
	}
	item.ArtifactID = mustParseStringPtr(artifactID)
	item.CreatedAt = mustParseTime(createdAt)
	return item, nil
}

func scanModelRow(row *sql.Row) (Model, error) {
	var item Model
	var artifactID, createdAt, updatedAt any
	if err := row.Scan(&item.ID, &artifactID, &item.FileName, &item.Format, &item.StorageURL, &item.ProcessingStatus, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Model{}, ErrNotFound
		}
		return Model{}, err
	}
	item.ArtifactID = mustParseStringPtr(artifactID)
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}

func ensureRows(res sql.Result) error {
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func mustParseTime(value any) time.Time {
	switch v := value.(type) {
	case time.Time:
		return v.UTC()
	case *time.Time:
		if v == nil {
			return time.Time{}
		}
		return v.UTC()
	case string:
		ts, _ := time.Parse(time.RFC3339, v)
		return ts
	case []byte:
		ts, _ := time.Parse(time.RFC3339, string(v))
		return ts
	case nil:
		return time.Time{}
	default:
		return time.Time{}
	}
}

func mustParseTimePtr(value any) *time.Time {
	switch v := value.(type) {
	case nil:
		return nil
	case time.Time:
		ts := v.UTC()
		return &ts
	case *time.Time:
		if v == nil {
			return nil
		}
		ts := v.UTC()
		return &ts
	case string:
		if v == "" {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, v)
		return &ts
	case []byte:
		if len(v) == 0 {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, string(v))
		return &ts
	case sql.NullString:
		if !v.Valid {
			return nil
		}
		ts, _ := time.Parse(time.RFC3339, v.String)
		return &ts
	default:
		return nil
	}
}

func mustParseStringPtr(value any) *string {
	switch v := value.(type) {
	case nil:
		return nil
	case string:
		if v == "" {
			return nil
		}
		return &v
	case []byte:
		if len(v) == 0 {
			return nil
		}
		s := string(v)
		return &s
	case sql.NullString:
		if !v.Valid {
			return nil
		}
		return &v.String
	default:
		return nil
	}
}

func mustParseString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case []byte:
		return string(v)
	case sql.NullString:
		if v.Valid {
			return v.String
		}
		return ""
	default:
		return ""
	}
}

func scanArtifactVisitorStatusRow(row *sql.Row) (ArtifactVisitorStatus, error) {
	item, err := scanArtifactVisitorStatusRows(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ArtifactVisitorStatus{}, ErrNotFound
		}
		return ArtifactVisitorStatus{}, err
	}
	return item, nil
}

func scanArtifactVisitorStatusRows(scanner interface{ Scan(dest ...any) error }) (ArtifactVisitorStatus, error) {
	var item ArtifactVisitorStatus
	var foundAt, favoritedAt, createdAt, updatedAt any
	if err := scanner.Scan(&item.ID, &item.VisitorID, &item.ArtifactID, &item.Found, &foundAt, &item.IsFavorite, &favoritedAt, &createdAt, &updatedAt); err != nil {
		return ArtifactVisitorStatus{}, err
	}
	item.FoundAt = mustParseTimePtr(foundAt)
	item.FavoritedAt = mustParseTimePtr(favoritedAt)
	item.CreatedAt = mustParseTime(createdAt)
	item.UpdatedAt = mustParseTime(updatedAt)
	return item, nil
}
