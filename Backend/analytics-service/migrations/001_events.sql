CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  museum_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  artifact_title TEXT NOT NULL DEFAULT '',
  public_code TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  screen_id TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'unknown',
  active_ms INTEGER NOT NULL DEFAULT 0,
  quiz_correct BOOLEAN,
  occurred_at BIGINT NOT NULL,
  received_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_museum_time ON analytics_events (museum_id, occurred_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor ON analytics_events (museum_id, visitor_key, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_visit_once ON analytics_events (museum_id, session_id) WHERE type = 'visit_start';
CREATE UNIQUE INDEX IF NOT EXISTS analytics_screen_once ON analytics_events (museum_id, session_id, artifact_id, screen_id) WHERE type = 'scene_view';
CREATE UNIQUE INDEX IF NOT EXISTS analytics_completion_once ON analytics_events (museum_id, session_id, artifact_id) WHERE type = 'scene_complete';
CREATE UNIQUE INDEX IF NOT EXISTS analytics_collect_once ON analytics_events (museum_id, visitor_key, artifact_id) WHERE type = 'artifact_collected';
