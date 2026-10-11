ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS public_code TEXT;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS draft_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_revision BIGINT NOT NULL DEFAULT 0;

UPDATE artifacts
SET public_code = UPPER(SUBSTRING(MD5(id) FROM 1 FOR 10))
WHERE public_code IS NULL OR public_code = '';

CREATE UNIQUE INDEX IF NOT EXISTS artifacts_public_code_unique_idx ON artifacts(public_code);

CREATE TABLE IF NOT EXISTS artifact_publications (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    version BIGINT NOT NULL,
    snapshot_json JSONB NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (artifact_id, version)
);

CREATE INDEX IF NOT EXISTS artifact_publications_latest_idx ON artifact_publications(artifact_id, version DESC);
