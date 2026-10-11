CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    museum_id TEXT NOT NULL,
    title TEXT NOT NULL,
    short_description TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
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
    order_in_route INTEGER DEFAULT 0,
    story_id TEXT DEFAULT '',
    found_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ NULL,
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

CREATE INDEX IF NOT EXISTS artifacts_museum_updated_idx ON artifacts(museum_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS screens_artifact_position_idx ON screens(artifact_id, position);
