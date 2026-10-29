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
    draft_revision INTEGER NOT NULL DEFAULT 1,
    published_revision INTEGER NOT NULL DEFAULT 0,
    visibility TEXT DEFAULT 'public',
    route_access TEXT DEFAULT 'all',
    show_views INTEGER NOT NULL DEFAULT 1,
    allow_downloads INTEGER NOT NULL DEFAULT 0,
    order_in_route INTEGER DEFAULT 0,
    story_id TEXT DEFAULT '',
    found_count INTEGER DEFAULT 0,
    published_at TEXT,
    deleted_at TEXT NULL,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    payload TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    artifact_id TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    url TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artifact_publications (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    published_at TEXT NOT NULL,
    PRIMARY KEY (artifact_id, version)
);

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    artifact_id TEXT,
    file_name TEXT NOT NULL,
    format TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS artifact_visitor_status (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    found INTEGER NOT NULL DEFAULT 0,
    found_at TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    favorited_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_embed_opens (
 artifact_id TEXT NOT NULL REFERENCES artifacts(id), day TEXT NOT NULL,
 opens BIGINT NOT NULL DEFAULT 0 CHECK (opens >= 0), PRIMARY KEY (artifact_id, day)
);
