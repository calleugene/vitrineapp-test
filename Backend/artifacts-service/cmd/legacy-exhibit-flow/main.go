// Command legacy-exhibit-flow imports or checks legacy exhibit-flow-service
// data. It is intentionally additive: it never deletes or updates a legacy
// row and it preserves source UUIDs and public tokens.
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const sourceSystem = "exhibit-flow-service"

type report struct {
	RunID                string   `json:"run_id"`
	Mode                 string   `json:"mode"`
	SourceArtifacts      int      `json:"source_artifacts"`
	ImportedArtifacts    int      `json:"imported_artifacts"`
	SourceScreens        int      `json:"source_screens"`
	ImportedScreens      int      `json:"imported_screens"`
	SourcePublications   int      `json:"source_publications"`
	ImportedPublications int      `json:"imported_publications"`
	Mismatches           []string `json:"mismatches"`
	StagedAssetFiles     int      `json:"staged_asset_files"`
}

type sourceExhibit struct {
	ID, MuseumID, Title, Description, Token, Status string
	Cover                                           []byte
	CoverMIME                                       string
	CreatedAt, UpdatedAt                            time.Time
}

type sourceScreen struct {
	ID, ExhibitID, Kind, Title, Body, ImageMIME string
	Image                                       []byte
	Position                                    int
	CreatedAt, UpdatedAt                        time.Time
}

func main() {
	var (
		sourceDSN = flag.String("source-dsn", os.Getenv("LEGACY_EXHIBIT_FLOW_DSN"), "legacy exhibit-flow PostgreSQL DSN")
		targetDSN = flag.String("target-dsn", os.Getenv("ARTIFACTS_DB_DSN"), "target artifacts PostgreSQL DSN")
		mode      = flag.String("mode", "check", "check or import")
		assetDir  = flag.String("asset-export-dir", "", "directory for verified staged media; required for import when source has binary media")
	)
	flag.Parse()
	if *mode != "check" && *mode != "import" {
		log.Fatal("-mode must be check or import")
	}
	if !isPostgresDSN(*sourceDSN) || !isPostgresDSN(*targetDSN) {
		log.Fatal("source-dsn and target-dsn must be PostgreSQL DSNs")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	source, err := sql.Open("pgx", *sourceDSN)
	if err != nil {
		log.Fatal(err)
	}
	defer source.Close()
	target, err := sql.Open("pgx", *targetDSN)
	if err != nil {
		log.Fatal(err)
	}
	defer target.Close()
	if err := source.PingContext(ctx); err != nil {
		log.Fatalf("connect source: %v", err)
	}
	if err := target.PingContext(ctx); err != nil {
		log.Fatalf("connect target: %v", err)
	}
	if err := requireTargetSchema(ctx, target); err != nil {
		log.Fatal(err)
	}

	r := report{RunID: randomID(), Mode: *mode}
	if err := preflight(ctx, source, *mode, *assetDir); err != nil {
		log.Fatal(err)
	}
	if *mode == "import" {
		if err := beginRun(ctx, target, r); err != nil {
			log.Fatal(err)
		}
	}
	err = walk(ctx, source, target, *mode, *assetDir, &r)
	if *mode == "import" {
		if finishErr := finishRun(ctx, target, r); finishErr != nil && err == nil {
			err = finishErr
		}
	}
	if err != nil {
		log.Fatal(err)
	}
	encoded, _ := json.MarshalIndent(r, "", "  ")
	fmt.Println(string(encoded))
	if len(r.Mismatches) > 0 {
		os.Exit(2)
	}
}

func preflight(ctx context.Context, source *sql.DB, mode, assetDir string) error {
	var binaryCount int
	if err := source.QueryRowContext(ctx, `SELECT (SELECT count(*) FROM exhibits WHERE cover_data IS NOT NULL) + (SELECT count(*) FROM screens WHERE image_data IS NOT NULL)`).Scan(&binaryCount); err != nil {
		return fmt.Errorf("legacy schema preflight: %w", err)
	}
	if mode == "import" && binaryCount > 0 && strings.TrimSpace(assetDir) == "" {
		return errors.New("-asset-export-dir is required: refusing a partial import that would lose binary media")
	}
	return nil
}

func requireTargetSchema(ctx context.Context, target *sql.DB) error {
	var found bool
	err := target.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artifact_publications')`).Scan(&found)
	if err != nil || !found {
		return errors.New("canonical target schema is missing; run cmd/dbmigrate first")
	}
	return nil
}

func walk(ctx context.Context, source, target *sql.DB, mode, assetDir string, r *report) error {
	rows, err := source.QueryContext(ctx, `SELECT id, museum_id, title, short_description, cover_data, cover_mime, public_token, status, created_at, updated_at FROM exhibits ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var x sourceExhibit
		if err := rows.Scan(&x.ID, &x.MuseumID, &x.Title, &x.Description, &x.Cover, &x.CoverMIME, &x.Token, &x.Status, &x.CreatedAt, &x.UpdatedAt); err != nil {
			return err
		}
		r.SourceArtifacts++
		if mode == "import" {
			if err := importExhibit(ctx, target, x, assetDir, r); err != nil {
				return err
			}
		} else if err := checkExhibit(ctx, target, x, r); err != nil {
			return err
		}
		if err := walkScreens(ctx, source, target, mode, assetDir, x, r); err != nil {
			return err
		}
		if err := walkPublications(ctx, source, target, mode, x, r); err != nil {
			return err
		}
	}
	return rows.Err()
}

func importExhibit(ctx context.Context, target *sql.DB, x sourceExhibit, assetDir string, r *report) error {
	tx, err := target.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := lockArtifact(ctx, tx, x.ID); err != nil {
		return err
	}
	if err := rejectArtifactConflict(ctx, tx, x); err != nil {
		return err
	}
	if err := rejectCodeConflict(ctx, tx, x); err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `INSERT INTO artifacts (id, museum_id, title, short_description, description, category, status, visibility, route_access, show_views, allow_downloads, created_at, updated_at) VALUES ($1,$2,$3,$4,'','exhibit',$5,'public','all',true,false,$6,$7) ON CONFLICT (id) DO NOTHING`, x.ID, x.MuseumID, x.Title, x.Description, x.Status, x.CreatedAt, x.UpdatedAt)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		r.ImportedArtifacts++
	}
	if err := compareArtifact(ctx, tx, x, r); err != nil {
		return err
	}
	if len(x.Cover) > 0 {
		assetID, err := stageAsset(ctx, tx, x.MuseumID, x.ID, "cover", x.Cover, x.CoverMIME, assetDir, r)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE artifacts SET cover_asset_id = $1 WHERE id = $2 AND museum_id = $3`, assetID, x.ID, x.MuseumID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO artifact_asset_links(id,museum_id,artifact_id,asset_id,role) VALUES ($1,$2,$3,$4,'cover') ON CONFLICT DO NOTHING`, randomID(), x.MuseumID, x.ID, assetID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO artifact_public_codes(code,artifact_id,museum_id,code_type) VALUES ($1,$2,$3,'legacy_alias') ON CONFLICT (code) DO NOTHING`, x.Token, x.ID, x.MuseumID); err != nil {
		return err
	}
	if err := compareCode(ctx, tx, x, r); err != nil {
		return err
	}
	return tx.Commit()
}

func checkExhibit(ctx context.Context, target *sql.DB, x sourceExhibit, r *report) error {
	return compareArtifact(ctx, target, x, r)
}

func rejectArtifactConflict(ctx context.Context, q rowQuerier, x sourceExhibit) error {
	var museum, title string
	err := q.QueryRowContext(ctx, `SELECT museum_id,title FROM artifacts WHERE id=$1`, x.ID).Scan(&museum, &title)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if museum != x.MuseumID || title != x.Title {
		return fmt.Errorf("refusing import: artifact %s already belongs to incompatible target data", x.ID)
	}
	return nil
}

func rejectCodeConflict(ctx context.Context, q rowQuerier, x sourceExhibit) error {
	var artifactID string
	err := q.QueryRowContext(ctx, `SELECT artifact_id FROM artifact_public_codes WHERE code=$1`, x.Token).Scan(&artifactID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if artifactID != x.ID {
		return fmt.Errorf("refusing import: public code %s is already assigned to another artifact", x.Token)
	}
	return nil
}

type rowQuerier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func compareArtifact(ctx context.Context, q rowQuerier, x sourceExhibit, r *report) error {
	var museum, title string
	err := q.QueryRowContext(ctx, `SELECT museum_id,title FROM artifacts WHERE id=$1`, x.ID).Scan(&museum, &title)
	if errors.Is(err, sql.ErrNoRows) {
		r.Mismatches = append(r.Mismatches, "artifact missing: "+x.ID)
		return nil
	}
	if err != nil {
		return err
	}
	if museum != x.MuseumID || title != x.Title {
		r.Mismatches = append(r.Mismatches, "artifact differs: "+x.ID)
	}
	return nil
}
func compareCode(ctx context.Context, q rowQuerier, x sourceExhibit, r *report) error {
	var id string
	err := q.QueryRowContext(ctx, `SELECT artifact_id FROM artifact_public_codes WHERE code=$1`, x.Token).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		r.Mismatches = append(r.Mismatches, "public code missing: "+x.Token)
		return nil
	}
	if err != nil {
		return err
	}
	if id != x.ID {
		r.Mismatches = append(r.Mismatches, "public code points to another artifact: "+x.Token)
	}
	return nil
}

func walkScreens(ctx context.Context, source, target *sql.DB, mode, assetDir string, x sourceExhibit, r *report) error {
	rows, err := source.QueryContext(ctx, `SELECT id, exhibit_id, type, title, text, image_data, image_mime, position, created_at, updated_at FROM screens WHERE exhibit_id=$1 ORDER BY position,id`, x.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var s sourceScreen
		if err := rows.Scan(&s.ID, &s.ExhibitID, &s.Kind, &s.Title, &s.Body, &s.Image, &s.ImageMIME, &s.Position, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return err
		}
		r.SourceScreens++
		if mode == "import" {
			if err := importScreen(ctx, target, x, s, assetDir, r); err != nil {
				return err
			}
		} else if err := checkScreen(ctx, target, s, r); err != nil {
			return err
		}
	}
	return rows.Err()
}

func importScreen(ctx context.Context, target *sql.DB, x sourceExhibit, s sourceScreen, assetDir string, r *report) error {
	tx, err := target.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := lockArtifact(ctx, tx, x.ID); err != nil {
		return err
	}
	if err := rejectScreenConflict(ctx, tx, s); err != nil {
		return err
	}
	content := map[string]any{"body": s.Body}
	var imageAssetID string
	if len(s.Image) > 0 {
		assetID, err := stageAsset(ctx, tx, x.MuseumID, x.ID, s.ID, s.Image, s.ImageMIME, assetDir, r)
		if err != nil {
			return err
		}
		content["image_asset_id"] = assetID
		imageAssetID = assetID
	}
	payload, err := json.Marshal(content)
	if err != nil {
		return err
	}
	res, err := tx.ExecContext(ctx, `INSERT INTO artifact_content_screens(id,museum_id,artifact_id,kind,position,title,content,created_at,updated_at) VALUES ($1,$2,$3,'text',$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`, s.ID, x.MuseumID, x.ID, s.Position, s.Title, string(payload), s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		r.ImportedScreens++
	}
	if imageAssetID != "" {
		if _, err := tx.ExecContext(ctx, `INSERT INTO artifact_asset_links(id,museum_id,artifact_id,screen_id,asset_id,role) VALUES ($1,$2,$3,$4,$5,'screen_image') ON CONFLICT DO NOTHING`, randomID(), x.MuseumID, x.ID, s.ID, imageAssetID); err != nil {
			return err
		}
	}
	if err := checkScreen(ctx, tx, s, r); err != nil {
		return err
	}
	return tx.Commit()
}
func checkScreen(ctx context.Context, q rowQuerier, s sourceScreen, r *report) error {
	var artifactID, title string
	err := q.QueryRowContext(ctx, `SELECT artifact_id,title FROM artifact_content_screens WHERE id=$1`, s.ID).Scan(&artifactID, &title)
	if errors.Is(err, sql.ErrNoRows) {
		r.Mismatches = append(r.Mismatches, "screen missing: "+s.ID)
		return nil
	}
	if err != nil {
		return err
	}
	if artifactID != s.ExhibitID || title != s.Title {
		r.Mismatches = append(r.Mismatches, "screen differs: "+s.ID)
	}
	return nil
}

func rejectScreenConflict(ctx context.Context, q rowQuerier, s sourceScreen) error {
	var artifactID, title string
	err := q.QueryRowContext(ctx, `SELECT artifact_id,title FROM artifact_content_screens WHERE id=$1`, s.ID).Scan(&artifactID, &title)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if artifactID != s.ExhibitID || title != s.Title {
		return fmt.Errorf("refusing import: screen %s already belongs to incompatible target data", s.ID)
	}
	return nil
}

func walkPublications(ctx context.Context, source, target *sql.DB, mode string, x sourceExhibit, r *report) error {
	rows, err := source.QueryContext(ctx, `SELECT id, exhibit_id, version, snapshot_json, created_at FROM publications WHERE exhibit_id=$1 ORDER BY version`, x.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, exhibitID string
		var version int
		var raw []byte
		var created time.Time
		if err := rows.Scan(&id, &exhibitID, &version, &raw, &created); err != nil {
			return err
		}
		r.SourcePublications++
		canonical, err := canonicalJSON(raw)
		if err != nil {
			return fmt.Errorf("publication %s invalid JSON: %w", id, err)
		}
		sum := sha256.Sum256(canonical)
		if mode == "import" {
			if err := rejectPublicationConflict(ctx, target, id, x.ID, sum[:]); err != nil {
				return err
			}
			res, err := target.ExecContext(ctx, `INSERT INTO artifact_publications(id,artifact_id,museum_id,version,snapshot,snapshot_sha256,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`, id, x.ID, x.MuseumID, version, string(canonical), sum[:], created)
			if err != nil {
				return err
			}
			if n, _ := res.RowsAffected(); n == 1 {
				r.ImportedPublications++
			}
			_, err = target.ExecContext(ctx, `UPDATE artifacts SET published_version=GREATEST(published_version,$1),status='published' WHERE id=$2 AND museum_id=$3`, version, x.ID, x.MuseumID)
			if err != nil {
				return err
			}
		}
		var targetArtifactID string
		var targetSum []byte
		err = target.QueryRowContext(ctx, `SELECT artifact_id,snapshot_sha256 FROM artifact_publications WHERE id=$1`, id).Scan(&targetArtifactID, &targetSum)
		if errors.Is(err, sql.ErrNoRows) {
			r.Mismatches = append(r.Mismatches, "publication missing: "+id)
		} else if err != nil {
			return err
		} else if targetArtifactID != x.ID || !equalBytes(targetSum, sum[:]) {
			r.Mismatches = append(r.Mismatches, "publication snapshot differs: "+id)
		}
	}
	return rows.Err()
}

func rejectPublicationConflict(ctx context.Context, q rowQuerier, publicationID, artifactID string, checksum []byte) error {
	var currentArtifactID string
	var currentChecksum []byte
	err := q.QueryRowContext(ctx, `SELECT artifact_id,snapshot_sha256 FROM artifact_publications WHERE id=$1`, publicationID).Scan(&currentArtifactID, &currentChecksum)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if currentArtifactID != artifactID || !equalBytes(currentChecksum, checksum) {
		return fmt.Errorf("refusing import: publication %s already has incompatible target data", publicationID)
	}
	return nil
}

func stageAsset(ctx context.Context, tx *sql.Tx, museumID, artifactID, role string, data []byte, mime, dir string, r *report) (string, error) {
	sum := sha256.Sum256(data)
	hexSum := hex.EncodeToString(sum[:])
	key := "legacy/exhibit-flow/" + hexSum
	path := filepath.Join(dir, hexSum+".bin")
	if err := writeVerified(path, data, sum[:]); err != nil {
		return "", err
	}
	r.StagedAssetFiles++
	var id string
	err := tx.QueryRowContext(ctx, `SELECT id FROM artifact_assets WHERE museum_id=$1 AND sha256=$2 AND byte_size=$3`, museumID, sum[:], len(data)).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		id = randomID()
		_, err = tx.ExecContext(ctx, `INSERT INTO artifact_assets(id,museum_id,storage_key,sha256,original_name,mime_type,byte_size,kind,state) VALUES ($1,$2,$3,$4,$5,$6,$7,'image','staged')`, id, museumID, key, sum[:], role, mime, len(data))
		if err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	}
	return id, nil
}
func writeVerified(path string, data, expected []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	if existing, err := os.ReadFile(path); err == nil {
		sum := sha256.Sum256(existing)
		if !equalBytes(sum[:], expected) {
			return fmt.Errorf("refusing to overwrite different staged asset %s", path)
		}
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
func lockArtifact(ctx context.Context, tx *sql.Tx, id string) error {
	_, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, id)
	return err
}
func canonicalJSON(raw []byte) ([]byte, error) {
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return json.Marshal(value)
}
func equalBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
func beginRun(ctx context.Context, target *sql.DB, r report) error {
	_, err := target.ExecContext(ctx, `INSERT INTO legacy_exhibit_import_runs(id,source_system,mode) VALUES ($1,$2,$3)`, r.RunID, sourceSystem, r.Mode)
	return err
}
func finishRun(ctx context.Context, target *sql.DB, r report) error {
	payload, _ := json.Marshal(r)
	_, err := target.ExecContext(ctx, `UPDATE legacy_exhibit_import_runs SET completed_at=now(),source_artifacts=$1,imported_artifacts=$2,source_screens=$3,imported_screens=$4,source_publications=$5,imported_publications=$6,mismatch_count=$7,report=$8 WHERE id=$9`, r.SourceArtifacts, r.ImportedArtifacts, r.SourceScreens, r.ImportedScreens, r.SourcePublications, r.ImportedPublications, len(r.Mismatches), string(payload), r.RunID)
	return err
}
func randomID() string {
	var data [16]byte
	if _, err := rand.Read(data[:]); err != nil {
		panic(err)
	}
	return "mig_" + hex.EncodeToString(data[:])
}
func isPostgresDSN(dsn string) bool {
	v := strings.ToLower(strings.TrimSpace(dsn))
	return strings.HasPrefix(v, "postgres://") || strings.HasPrefix(v, "postgresql://") || strings.Contains(v, "host=")
}
