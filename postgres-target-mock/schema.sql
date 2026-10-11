-- ViraLabs target MVP PostgreSQL schema

CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS visitor;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS identity.museums (
  id uuid,
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  timezone text NOT NULL,
  locale text NOT NULL,
  address jsonb NOT NULL,
  logo_asset_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS identity.users (
  id uuid,
  email citext NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL,
  email_verified_at timestamptz,
  two_factor_enabled boolean NOT NULL,
  locale text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS identity.roles (
  id uuid,
  code text NOT NULL,
  name text NOT NULL,
  permissions jsonb NOT NULL,
  is_system boolean NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS identity.memberships (
  id uuid,
  museum_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL,
  invited_by uuid,
  joined_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (museum_id, user_id),
  FOREIGN KEY (museum_id) REFERENCES identity.museums(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity.membership_roles (
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL,
  PRIMARY KEY (membership_id, role_id),
  FOREIGN KEY (membership_id) REFERENCES identity.memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES identity.roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity.sessions (
  id uuid,
  user_id uuid NOT NULL,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity.auth_tokens (
  id uuid,
  user_id uuid NOT NULL,
  type text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity.audit_log (
  id uuid,
  museum_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id uuid NOT NULL,
  details jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS identity.staff_notifications (
  id uuid,
  user_id uuid NOT NULL,
  museum_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identity.identity_outbox_events (
  id uuid,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  attempts integer NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS content.artifacts (
  id uuid,
  museum_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  current_draft_version_id uuid,
  published_version_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (museum_id, slug)
);

CREATE TABLE IF NOT EXISTS content.artifact_versions (
  id uuid,
  artifact_id uuid NOT NULL,
  version integer NOT NULL,
  state text NOT NULL,
  metadata jsonb NOT NULL,
  cover_asset_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  validated_at timestamptz,
  published_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (artifact_id, version),
  FOREIGN KEY (artifact_id) REFERENCES content.artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content.screens (
  id uuid,
  version_id uuid NOT NULL,
  type text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL,
  subtitle text,
  payload jsonb NOT NULL,
  is_system boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (version_id, position),
  FOREIGN KEY (version_id) REFERENCES content.artifact_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content.assets (
  id uuid,
  museum_id uuid NOT NULL,
  artifact_id uuid,
  kind text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  checksum text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS content.routes (
  id uuid,
  museum_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  cover_asset_id uuid,
  estimated_minutes integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (museum_id, slug)
);

CREATE TABLE IF NOT EXISTS content.route_artifacts (
  route_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  position integer NOT NULL,
  required boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (route_id, artifact_id),
  UNIQUE (route_id, position),
  FOREIGN KEY (route_id) REFERENCES content.routes(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES content.artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content.publications (
  id uuid,
  museum_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  version_id uuid,
  status text NOT NULL,
  public_slug text NOT NULL,
  published_by uuid NOT NULL,
  published_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (id),
  UNIQUE (public_slug),
  FOREIGN KEY (version_id) REFERENCES content.artifact_versions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content.qr_codes (
  id uuid,
  publication_id uuid NOT NULL,
  token_hash text NOT NULL,
  target_path text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (token_hash),
  FOREIGN KEY (publication_id) REFERENCES content.publications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content.content_outbox_events (
  id uuid,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  attempts integer NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS visitor.visitors (
  id uuid,
  account_user_id uuid,
  display_name text,
  locale text NOT NULL,
  source text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  consent_version text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS visitor.visitor_sessions (
  id uuid,
  visitor_id uuid NOT NULL,
  museum_id uuid NOT NULL,
  route_id uuid,
  device jsonb NOT NULL,
  utm jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.scan_commands (
  id uuid,
  idempotency_key text NOT NULL,
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  museum_id uuid NOT NULL,
  route_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  result jsonb NOT NULL,
  processed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (idempotency_key),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES visitor.visitor_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.route_progress (
  id uuid,
  visitor_id uuid NOT NULL,
  route_id uuid NOT NULL,
  museum_id uuid NOT NULL,
  found_count integer NOT NULL,
  total_count integer NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (visitor_id, route_id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.collection_items (
  id uuid,
  visitor_id uuid NOT NULL,
  museum_id uuid NOT NULL,
  route_id uuid,
  artifact_id uuid NOT NULL,
  found_at timestamptz NOT NULL,
  is_favorite boolean NOT NULL,
  answer_correct boolean,
  ar_completed boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (visitor_id, artifact_id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.visitor_settings (
  visitor_id uuid,
  language text NOT NULL,
  sound_enabled boolean NOT NULL,
  ar_mode text NOT NULL,
  text_size text NOT NULL,
  analytics_consent boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (visitor_id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.achievements (
  id uuid,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  rule jsonb NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS visitor.visitor_achievements (
  id uuid,
  visitor_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  route_id uuid,
  unlocked_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (visitor_id, achievement_id, route_id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES visitor.achievements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.feedback (
  id uuid,
  museum_id uuid NOT NULL,
  visitor_id uuid,
  route_id uuid,
  artifact_id uuid,
  type text NOT NULL,
  rating integer,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (visitor_id) REFERENCES visitor.visitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.feedback_replies (
  id uuid,
  feedback_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (feedback_id) REFERENCES visitor.feedback(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visitor.visitor_outbox_events (
  id uuid,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  published_at timestamptz,
  attempts integer NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS analytics.analytics_events (
  id uuid,
  event_id text NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  museum_id uuid,
  visitor_id uuid,
  session_id uuid,
  route_id uuid,
  artifact_id uuid,
  payload jsonb NOT NULL,
  schema_version integer NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS analytics.daily_metrics (
  id uuid,
  metric_date date NOT NULL,
  museum_id uuid NOT NULL,
  metric_name text NOT NULL,
  dimensions jsonb NOT NULL,
  value numeric NOT NULL,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (metric_date, museum_id, metric_name, dimensions)
);

CREATE TABLE IF NOT EXISTS analytics.reports (
  id uuid,
  museum_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  parameters jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS analytics.export_jobs (
  id uuid,
  report_id uuid,
  museum_id uuid NOT NULL,
  format text NOT NULL,
  status text NOT NULL,
  storage_key text,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  error text,
  PRIMARY KEY (id),
  FOREIGN KEY (report_id) REFERENCES analytics.reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics.delivery_dead_letters (
  id uuid,
  source_service text NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL,
  last_error text NOT NULL,
  failed_at timestamptz NOT NULL,
  resolved_at timestamptz,
  PRIMARY KEY (id)
);

-- Version pointers are added after both tables exist (avoids a circular CREATE order).
ALTER TABLE content.artifacts
  DROP CONSTRAINT IF EXISTS artifacts_current_draft_fk,
  DROP CONSTRAINT IF EXISTS artifacts_published_version_fk;
ALTER TABLE content.artifacts
  ADD CONSTRAINT artifacts_current_draft_fk FOREIGN KEY (current_draft_version_id) REFERENCES content.artifact_versions(id),
  ADD CONSTRAINT artifacts_published_version_fk FOREIGN KEY (published_version_id) REFERENCES content.artifact_versions(id);
