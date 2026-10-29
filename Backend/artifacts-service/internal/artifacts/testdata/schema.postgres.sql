CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    museum_id TEXT,
    title TEXT NOT NULL,
    short_description TEXT DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    created_date TEXT DEFAULT '',
    period TEXT DEFAULT '',
    origin_place TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    public_code TEXT,
    draft_revision BIGINT NOT NULL DEFAULT 1,
    published_revision BIGINT NOT NULL DEFAULT 0,
    visibility TEXT DEFAULT 'public',
    route_access TEXT DEFAULT 'all',
    show_views BOOLEAN NOT NULL DEFAULT TRUE,
    allow_downloads BOOLEAN NOT NULL DEFAULT FALSE,
    order_in_route INTEGER DEFAULT 0,
    story_id TEXT DEFAULT '',
    found_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ NULL,
    deleted_at TIMESTAMPTZ NULL,
    archived_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    payload TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    url TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_publications (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    version BIGINT NOT NULL,
    snapshot_json JSONB NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (artifact_id, version)
);

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    format TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_visitor_status (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    found BOOLEAN NOT NULL DEFAULT FALSE,
    found_at TIMESTAMPTZ,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    favorited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(visitor_id, artifact_id)
);

CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_visitor_id ON artifact_visitor_status(visitor_id);
CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_artifact_id ON artifact_visitor_status(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_found ON artifact_visitor_status(found);

CREATE TABLE IF NOT EXISTS museum_profiles (
    museum_id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_description TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_embed_opens (
 artifact_id TEXT NOT NULL REFERENCES artifacts(id), day TEXT NOT NULL,
 opens BIGINT NOT NULL DEFAULT 0 CHECK (opens >= 0), PRIMARY KEY (artifact_id, day)
);
