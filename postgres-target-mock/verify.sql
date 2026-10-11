-- Every target table must contain exactly 30 rows.
SELECT table_schema, table_name, row_count FROM (
SELECT 'identity' AS table_schema, 'museums' AS table_name, count(*) AS row_count FROM identity.museums
UNION ALL
SELECT 'identity' AS table_schema, 'users' AS table_name, count(*) AS row_count FROM identity.users
UNION ALL
SELECT 'identity' AS table_schema, 'roles' AS table_name, count(*) AS row_count FROM identity.roles
UNION ALL
SELECT 'identity' AS table_schema, 'memberships' AS table_name, count(*) AS row_count FROM identity.memberships
UNION ALL
SELECT 'identity' AS table_schema, 'membership_roles' AS table_name, count(*) AS row_count FROM identity.membership_roles
UNION ALL
SELECT 'identity' AS table_schema, 'sessions' AS table_name, count(*) AS row_count FROM identity.sessions
UNION ALL
SELECT 'identity' AS table_schema, 'auth_tokens' AS table_name, count(*) AS row_count FROM identity.auth_tokens
UNION ALL
SELECT 'identity' AS table_schema, 'audit_log' AS table_name, count(*) AS row_count FROM identity.audit_log
UNION ALL
SELECT 'identity' AS table_schema, 'staff_notifications' AS table_name, count(*) AS row_count FROM identity.staff_notifications
UNION ALL
SELECT 'identity' AS table_schema, 'identity_outbox_events' AS table_name, count(*) AS row_count FROM identity.identity_outbox_events
UNION ALL
SELECT 'content' AS table_schema, 'artifacts' AS table_name, count(*) AS row_count FROM content.artifacts
UNION ALL
SELECT 'content' AS table_schema, 'artifact_versions' AS table_name, count(*) AS row_count FROM content.artifact_versions
UNION ALL
SELECT 'content' AS table_schema, 'screens' AS table_name, count(*) AS row_count FROM content.screens
UNION ALL
SELECT 'content' AS table_schema, 'assets' AS table_name, count(*) AS row_count FROM content.assets
UNION ALL
SELECT 'content' AS table_schema, 'routes' AS table_name, count(*) AS row_count FROM content.routes
UNION ALL
SELECT 'content' AS table_schema, 'route_artifacts' AS table_name, count(*) AS row_count FROM content.route_artifacts
UNION ALL
SELECT 'content' AS table_schema, 'publications' AS table_name, count(*) AS row_count FROM content.publications
UNION ALL
SELECT 'content' AS table_schema, 'qr_codes' AS table_name, count(*) AS row_count FROM content.qr_codes
UNION ALL
SELECT 'content' AS table_schema, 'content_outbox_events' AS table_name, count(*) AS row_count FROM content.content_outbox_events
UNION ALL
SELECT 'visitor' AS table_schema, 'visitors' AS table_name, count(*) AS row_count FROM visitor.visitors
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_sessions' AS table_name, count(*) AS row_count FROM visitor.visitor_sessions
UNION ALL
SELECT 'visitor' AS table_schema, 'scan_commands' AS table_name, count(*) AS row_count FROM visitor.scan_commands
UNION ALL
SELECT 'visitor' AS table_schema, 'route_progress' AS table_name, count(*) AS row_count FROM visitor.route_progress
UNION ALL
SELECT 'visitor' AS table_schema, 'collection_items' AS table_name, count(*) AS row_count FROM visitor.collection_items
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_settings' AS table_name, count(*) AS row_count FROM visitor.visitor_settings
UNION ALL
SELECT 'visitor' AS table_schema, 'achievements' AS table_name, count(*) AS row_count FROM visitor.achievements
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_achievements' AS table_name, count(*) AS row_count FROM visitor.visitor_achievements
UNION ALL
SELECT 'visitor' AS table_schema, 'feedback' AS table_name, count(*) AS row_count FROM visitor.feedback
UNION ALL
SELECT 'visitor' AS table_schema, 'feedback_replies' AS table_name, count(*) AS row_count FROM visitor.feedback_replies
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_outbox_events' AS table_name, count(*) AS row_count FROM visitor.visitor_outbox_events
UNION ALL
SELECT 'analytics' AS table_schema, 'analytics_events' AS table_name, count(*) AS row_count FROM analytics.analytics_events
UNION ALL
SELECT 'analytics' AS table_schema, 'daily_metrics' AS table_name, count(*) AS row_count FROM analytics.daily_metrics
UNION ALL
SELECT 'analytics' AS table_schema, 'reports' AS table_name, count(*) AS row_count FROM analytics.reports
UNION ALL
SELECT 'analytics' AS table_schema, 'export_jobs' AS table_name, count(*) AS row_count FROM analytics.export_jobs
UNION ALL
SELECT 'analytics' AS table_schema, 'delivery_dead_letters' AS table_name, count(*) AS row_count FROM analytics.delivery_dead_letters
) counts ORDER BY table_schema, table_name;

DO $$ DECLARE bad integer; BEGIN SELECT count(*) INTO bad FROM (
SELECT * FROM (
SELECT 'identity' AS table_schema, 'museums' AS table_name, count(*) AS row_count FROM identity.museums
UNION ALL
SELECT 'identity' AS table_schema, 'users' AS table_name, count(*) AS row_count FROM identity.users
UNION ALL
SELECT 'identity' AS table_schema, 'roles' AS table_name, count(*) AS row_count FROM identity.roles
UNION ALL
SELECT 'identity' AS table_schema, 'memberships' AS table_name, count(*) AS row_count FROM identity.memberships
UNION ALL
SELECT 'identity' AS table_schema, 'membership_roles' AS table_name, count(*) AS row_count FROM identity.membership_roles
UNION ALL
SELECT 'identity' AS table_schema, 'sessions' AS table_name, count(*) AS row_count FROM identity.sessions
UNION ALL
SELECT 'identity' AS table_schema, 'auth_tokens' AS table_name, count(*) AS row_count FROM identity.auth_tokens
UNION ALL
SELECT 'identity' AS table_schema, 'audit_log' AS table_name, count(*) AS row_count FROM identity.audit_log
UNION ALL
SELECT 'identity' AS table_schema, 'staff_notifications' AS table_name, count(*) AS row_count FROM identity.staff_notifications
UNION ALL
SELECT 'identity' AS table_schema, 'identity_outbox_events' AS table_name, count(*) AS row_count FROM identity.identity_outbox_events
UNION ALL
SELECT 'content' AS table_schema, 'artifacts' AS table_name, count(*) AS row_count FROM content.artifacts
UNION ALL
SELECT 'content' AS table_schema, 'artifact_versions' AS table_name, count(*) AS row_count FROM content.artifact_versions
UNION ALL
SELECT 'content' AS table_schema, 'screens' AS table_name, count(*) AS row_count FROM content.screens
UNION ALL
SELECT 'content' AS table_schema, 'assets' AS table_name, count(*) AS row_count FROM content.assets
UNION ALL
SELECT 'content' AS table_schema, 'routes' AS table_name, count(*) AS row_count FROM content.routes
UNION ALL
SELECT 'content' AS table_schema, 'route_artifacts' AS table_name, count(*) AS row_count FROM content.route_artifacts
UNION ALL
SELECT 'content' AS table_schema, 'publications' AS table_name, count(*) AS row_count FROM content.publications
UNION ALL
SELECT 'content' AS table_schema, 'qr_codes' AS table_name, count(*) AS row_count FROM content.qr_codes
UNION ALL
SELECT 'content' AS table_schema, 'content_outbox_events' AS table_name, count(*) AS row_count FROM content.content_outbox_events
UNION ALL
SELECT 'visitor' AS table_schema, 'visitors' AS table_name, count(*) AS row_count FROM visitor.visitors
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_sessions' AS table_name, count(*) AS row_count FROM visitor.visitor_sessions
UNION ALL
SELECT 'visitor' AS table_schema, 'scan_commands' AS table_name, count(*) AS row_count FROM visitor.scan_commands
UNION ALL
SELECT 'visitor' AS table_schema, 'route_progress' AS table_name, count(*) AS row_count FROM visitor.route_progress
UNION ALL
SELECT 'visitor' AS table_schema, 'collection_items' AS table_name, count(*) AS row_count FROM visitor.collection_items
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_settings' AS table_name, count(*) AS row_count FROM visitor.visitor_settings
UNION ALL
SELECT 'visitor' AS table_schema, 'achievements' AS table_name, count(*) AS row_count FROM visitor.achievements
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_achievements' AS table_name, count(*) AS row_count FROM visitor.visitor_achievements
UNION ALL
SELECT 'visitor' AS table_schema, 'feedback' AS table_name, count(*) AS row_count FROM visitor.feedback
UNION ALL
SELECT 'visitor' AS table_schema, 'feedback_replies' AS table_name, count(*) AS row_count FROM visitor.feedback_replies
UNION ALL
SELECT 'visitor' AS table_schema, 'visitor_outbox_events' AS table_name, count(*) AS row_count FROM visitor.visitor_outbox_events
UNION ALL
SELECT 'analytics' AS table_schema, 'analytics_events' AS table_name, count(*) AS row_count FROM analytics.analytics_events
UNION ALL
SELECT 'analytics' AS table_schema, 'daily_metrics' AS table_name, count(*) AS row_count FROM analytics.daily_metrics
UNION ALL
SELECT 'analytics' AS table_schema, 'reports' AS table_name, count(*) AS row_count FROM analytics.reports
UNION ALL
SELECT 'analytics' AS table_schema, 'export_jobs' AS table_name, count(*) AS row_count FROM analytics.export_jobs
UNION ALL
SELECT 'analytics' AS table_schema, 'delivery_dead_letters' AS table_name, count(*) AS row_count FROM analytics.delivery_dead_letters
) counts WHERE row_count <> 30) q;
IF bad <> 0 THEN RAISE EXCEPTION 'Seed validation failed: % tables are not at 30 rows', bad; END IF;
END $$;
SELECT 'mock seed validation passed' AS status;
