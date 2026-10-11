-- Canonical storage for the exhibit authoring flow.  This migration is
-- additive: it is safe to apply beside the current artifacts-service tables
-- and intentionally does not remove legacy columns or records.

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    museum_id TEXT,
    title TEXT NOT NULL,
    short_description TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'exhibit',
    created_date TEXT DEFAULT '',
    period TEXT DEFAULT '',
    origin_place TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    visibility TEXT DEFAULT 'public',
    route_access TEXT DEFAULT 'all',
    show_views BOOLEAN NOT NULL DEFAULT TRUE,
    allow_downloads BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS cover_asset_id TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS draft_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Existing installations can contain values outside this new bounded model,
-- hence NOT VALID: a later, reviewed cleanup migration may validate it after
-- data remediation. New writes are nevertheless checked immediately.
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_lifecycle_status_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_lifecycle_status_check
    CHECK (status IN ('draft', 'published', 'archived', 'moderation')) NOT VALID;

CREATE INDEX IF NOT EXISTS artifacts_museum_updated_idx
    ON artifacts (museum_id, updated_at DESC, id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS artifact_assets (
    id TEXT PRIMARY KEY,
    museum_id TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    sha256 BYTEA NOT NULL CHECK (octet_length(sha256) = 32),
    original_name TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
    kind TEXT NOT NULL CHECK (kind IN ('image', 'model', 'qr')),
    state TEXT NOT NULL CHECK (state IN ('staged', 'ready', 'failed', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (museum_id, sha256, byte_size)
);

CREATE INDEX IF NOT EXISTS artifact_assets_museum_state_idx
    ON artifact_assets (museum_id, state);

CREATE TABLE IF NOT EXISTS artifact_content_screens (
    id TEXT PRIMARY KEY,
    museum_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'model', 'test')),
    position INTEGER NOT NULL CHECK (position > 0),
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    content JSONB NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (artifact_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS artifact_content_screens_order_idx
    ON artifact_content_screens (museum_id, artifact_id, position)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS artifact_asset_links (
    id TEXT PRIMARY KEY,
    museum_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    screen_id TEXT REFERENCES artifact_content_screens(id) ON DELETE RESTRICT,
    asset_id TEXT NOT NULL REFERENCES artifact_assets(id) ON DELETE RESTRICT,
    role TEXT NOT NULL CHECK (role IN ('cover', 'screen_image', 'model', 'model_poster')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (artifact_id, screen_id, asset_id, role)
);

CREATE INDEX IF NOT EXISTS artifact_asset_links_asset_idx ON artifact_asset_links(asset_id);

CREATE TABLE IF NOT EXISTS artifact_public_codes (
    code TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    museum_id TEXT NOT NULL,
    code_type TEXT NOT NULL CHECK (code_type IN ('canonical', 'legacy_alias')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    CHECK ((active AND revoked_at IS NULL) OR NOT active)
);

CREATE UNIQUE INDEX IF NOT EXISTS artifact_one_canonical_public_code_idx
    ON artifact_public_codes (artifact_id)
    WHERE active AND code_type = 'canonical';
CREATE INDEX IF NOT EXISTS artifact_public_codes_artifact_idx
    ON artifact_public_codes (museum_id, artifact_id) WHERE active;

CREATE TABLE IF NOT EXISTS artifact_publications (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    museum_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    snapshot JSONB NOT NULL,
    snapshot_sha256 BYTEA NOT NULL CHECK (octet_length(snapshot_sha256) = 32),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (artifact_id, version)
);

CREATE INDEX IF NOT EXISTS artifact_publications_latest_idx
    ON artifact_publications (artifact_id, version DESC);
CREATE INDEX IF NOT EXISTS artifact_publications_museum_idx
    ON artifact_publications (museum_id, created_at DESC);

CREATE TABLE IF NOT EXISTS legacy_exhibit_import_map (
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    entity_kind TEXT NOT NULL CHECK (entity_kind IN ('artifact', 'screen', 'asset', 'publication', 'public_code')),
    source_checksum BYTEA NOT NULL CHECK (octet_length(source_checksum) = 32),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_system, entity_kind, source_id)
);

CREATE TABLE IF NOT EXISTS legacy_exhibit_import_runs (
    id TEXT PRIMARY KEY,
    source_system TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('import', 'check')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    source_artifacts INTEGER NOT NULL DEFAULT 0,
    imported_artifacts INTEGER NOT NULL DEFAULT 0,
    source_screens INTEGER NOT NULL DEFAULT 0,
    imported_screens INTEGER NOT NULL DEFAULT 0,
    source_publications INTEGER NOT NULL DEFAULT 0,
    imported_publications INTEGER NOT NULL DEFAULT 0,
    mismatch_count INTEGER NOT NULL DEFAULT 0,
    report JSONB NOT NULL DEFAULT '{}'::jsonb
);
