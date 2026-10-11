CREATE TABLE IF NOT EXISTS exhibits (
    id TEXT PRIMARY KEY,
    museum_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
    short_description TEXT NOT NULL DEFAULT '' CHECK (char_length(short_description) <= 250),
    cover_data BYTEA,
    cover_mime TEXT NOT NULL DEFAULT '',
    public_token TEXT NOT NULL UNIQUE,
    public_code TEXT NOT NULL UNIQUE CHECK (public_code ~ '^[A-Z0-9]{5}$'),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS screens (
    id TEXT PRIMARY KEY,
    exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type = 'TEXT'),
    title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
    text TEXT NOT NULL DEFAULT '',
    image_data BYTEA,
    image_mime TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL CHECK (position > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE(exhibit_id, position)
);

CREATE TABLE IF NOT EXISTS publications (
    id TEXT PRIMARY KEY,
    exhibit_id TEXT NOT NULL REFERENCES exhibits(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE(exhibit_id, version)
);

CREATE INDEX IF NOT EXISTS screens_exhibit_position_idx ON screens(exhibit_id, position);
CREATE INDEX IF NOT EXISTS exhibits_museum_updated_idx ON exhibits(museum_id, updated_at DESC);
