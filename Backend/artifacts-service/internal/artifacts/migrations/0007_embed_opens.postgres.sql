CREATE TABLE IF NOT EXISTS artifact_embed_opens (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    day TEXT NOT NULL,
    opens BIGINT NOT NULL DEFAULT 0 CHECK (opens >= 0),
    PRIMARY KEY (artifact_id, day)
);
