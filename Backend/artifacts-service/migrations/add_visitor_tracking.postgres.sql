-- Add visitor tracking columns to artifacts table
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS order_in_route INTEGER DEFAULT 0;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS story_id TEXT DEFAULT '';
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS found_count INTEGER DEFAULT 0;

-- Create artifact_visitor_status table
CREATE TABLE IF NOT EXISTS artifact_visitor_status (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    found BOOLEAN NOT NULL DEFAULT FALSE,
    found_at TIMESTAMPTZ,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    favorited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
    UNIQUE(visitor_id, artifact_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_visitor_id ON artifact_visitor_status(visitor_id);
CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_artifact_id ON artifact_visitor_status(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_visitor_status_found ON artifact_visitor_status(found);
