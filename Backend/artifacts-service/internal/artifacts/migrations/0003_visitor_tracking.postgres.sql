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

CREATE INDEX IF NOT EXISTS artifact_visitor_status_visitor_idx
    ON artifact_visitor_status(visitor_id);
CREATE INDEX IF NOT EXISTS artifact_visitor_status_artifact_idx
    ON artifact_visitor_status(artifact_id);
