-- Deterministic mock seed: exactly 30 rows per table.

CREATE OR REPLACE FUNCTION public.mock_uuid(namespace text, n integer) RETURNS uuid LANGUAGE SQL IMMUTABLE AS $$ SELECT md5(namespace || ':' || n::text)::uuid $$;

CREATE OR REPLACE FUNCTION public.mock_ts(n integer) RETURNS timestamptz LANGUAGE SQL IMMUTABLE AS $$ SELECT timestamptz '2026-01-01 10:00:00+03' + (n || ' days')::interval $$;



INSERT INTO identity.museums SELECT mock_uuid('museum',i), 'MUS-'||lpad(i::text,3,'0'), 'Museum '||i, 'active', 'Europe/Moscow', 'ru-RU', jsonb_build_object('city','Moscow','street','Museum street '||i), NULL, mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.users SELECT mock_uuid('user',i), 'methodist'||i||'@example.test', 'mock-password-hash-'||i, 'Methodist '||i, 'active', mock_ts(i), (i%4=0), 'ru-RU', mock_ts(i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.roles SELECT mock_uuid('role',i), 'role-'||i, 'Role '||i, jsonb_build_array('content.read','content.write'), true FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.memberships SELECT mock_uuid('membership',i), mock_uuid('museum',i), mock_uuid('user',i), 'active', NULL, mock_ts(i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.membership_roles SELECT mock_uuid('membership',i), mock_uuid('role',((i-1)%30)+1), mock_uuid('user',i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.sessions SELECT mock_uuid('session',i), mock_uuid('user',i), 'refresh-hash-'||i, mock_ts(i+30), NULL, 'ip-hash-'||i, 'Mozilla/5.0 Mock Browser', mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.auth_tokens SELECT mock_uuid('auth-token',i), mock_uuid('user',i), CASE WHEN i%2=0 THEN 'reset' ELSE 'verify' END, 'token-hash-'||i, mock_ts(i+7), NULL, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.audit_log SELECT mock_uuid('audit',i), mock_uuid('museum',i), mock_uuid('user',i), 'content.updated', 'artifact', mock_uuid('artifact',i), mock_uuid('request',i), jsonb_build_object('source','seed','sequence',i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.staff_notifications SELECT mock_uuid('staff-notification',i), mock_uuid('user',i), mock_uuid('museum',i), CASE WHEN i%2=0 THEN 'info' ELSE 'warning' END, 'Notification '||i, jsonb_build_object('sequence',i), CASE WHEN i%3=0 THEN mock_ts(i+1) ELSE NULL END, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO identity.identity_outbox_events SELECT mock_uuid('identity-outbox',i), 'membership', mock_uuid('membership',i), 'membership.created', jsonb_build_object('membership_id',mock_uuid('membership',i)), mock_ts(i), NULL, 0 FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.artifacts SELECT mock_uuid('artifact',i), mock_uuid('museum',i), 'artifact-'||i, 'Artifact '||i, CASE WHEN i%3=0 THEN 'sculpture' ELSE 'painting' END, 'draft', NULL, NULL, mock_uuid('user',i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.artifact_versions SELECT mock_uuid('artifact-version',i), mock_uuid('artifact',i), 1, CASE WHEN i%4=0 THEN 'published' ELSE 'draft' END, jsonb_build_object('description','Mock artifact version '||i), NULL, mock_uuid('user',i), mock_ts(i), CASE WHEN i%4=0 THEN mock_ts(i+1) ELSE NULL END, CASE WHEN i%4=0 THEN mock_ts(i+2) ELSE NULL END FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

UPDATE content.artifacts a SET current_draft_version_id=mock_uuid('artifact-version',i), published_version_id=CASE WHEN i%4=0 THEN mock_uuid('artifact-version',i) ELSE NULL END FROM generate_series(1,30) g(i) WHERE a.id=mock_uuid('artifact',i);

INSERT INTO content.screens SELECT mock_uuid('screen',i), mock_uuid('artifact-version',((i-1)%30)+1), (i%4)+1, i%5, 'Screen '||i, 'Subtitle '||i, jsonb_build_object('body','Mock story content '||i), (i%7=0), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.assets SELECT mock_uuid('asset',i), mock_uuid('museum',i), mock_uuid('artifact',i), CASE WHEN i%2=0 THEN 'model' ELSE 'image' END, 'asset-'||i||'.bin', CASE WHEN i%2=0 THEN 'model/gltf-binary' ELSE 'image/jpeg' END, 1024*i, 'mock/assets/'||i, md5('asset-'||i), 'ready', mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.routes SELECT mock_uuid('route',i), mock_uuid('museum',i), 'route-'||i, 'Route '||i, 'Mock route description '||i, CASE WHEN i%4=0 THEN 'published' ELSE 'draft' END, NULL, 15+i, mock_uuid('user',i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.route_artifacts SELECT mock_uuid('route',i), mock_uuid('artifact',i), 1, true, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.publications SELECT mock_uuid('publication',i), mock_uuid('museum',i), 'artifact', mock_uuid('artifact',i), mock_uuid('artifact-version',i), 'published', 'public-artifact-'||i, mock_uuid('user',i), mock_ts(i+2), NULL FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.qr_codes SELECT mock_uuid('qr',i), mock_uuid('publication',i), md5('qr-token-'||i), '/a/public-artifact-'||i, NULL, NULL, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO content.content_outbox_events SELECT mock_uuid('content-outbox',i), 'artifact', mock_uuid('artifact',i), 'artifact.published', jsonb_build_object('artifact_id',mock_uuid('artifact',i)), mock_ts(i), NULL, 0 FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.visitors SELECT mock_uuid('visitor',i), NULL, 'Visitor '||i, CASE WHEN i%2=0 THEN 'ru-RU' ELSE 'en-US' END, CASE WHEN i%3=0 THEN 'direct' ELSE 'qr' END, mock_ts(i), mock_ts(i+5), 'v1', NULL, mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.visitor_sessions SELECT mock_uuid('visitor-session',i), mock_uuid('visitor',i), mock_uuid('museum',i), mock_uuid('route',i), jsonb_build_object('device','mobile','browser','Chrome'), jsonb_build_object('utm_source','qr'), mock_ts(i), NULL, mock_ts(i+1) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.scan_commands SELECT mock_uuid('scan',i), 'scan-key-'||i, mock_uuid('visitor',i), mock_uuid('visitor-session',i), mock_uuid('museum',i), mock_uuid('route',i), mock_uuid('artifact',i), jsonb_build_object('accepted',true,'sequence',i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.route_progress SELECT mock_uuid('progress',i), mock_uuid('visitor',i), mock_uuid('route',i), mock_uuid('museum',i), i%6, 6, CASE WHEN i%6=0 THEN 'completed' ELSE 'started' END, mock_ts(i), CASE WHEN i%6=0 THEN mock_ts(i+3) ELSE NULL END, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.collection_items SELECT mock_uuid('collection',i), mock_uuid('visitor',i), mock_uuid('museum',i), mock_uuid('route',i), mock_uuid('artifact',i), mock_ts(i+1), (i%3=0), (i%2=0), (i%2=0), mock_ts(i+1) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.visitor_settings SELECT mock_uuid('visitor',i), CASE WHEN i%2=0 THEN 'ru' ELSE 'en' END, (i%4<>0), CASE WHEN i%3=0 THEN 'always' ELSE 'adaptive' END, 'normal', true, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.achievements SELECT mock_uuid('achievement',i), 'achievement-'||i, 'Achievement '||i, 'Mock achievement '||i, jsonb_build_object('min_found',i%6), true, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.visitor_achievements SELECT mock_uuid('visitor-achievement',i), mock_uuid('visitor',i), mock_uuid('achievement',i), mock_uuid('route',i), mock_ts(i+4) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.feedback SELECT mock_uuid('feedback',i), mock_uuid('museum',i), mock_uuid('visitor',i), mock_uuid('route',i), mock_uuid('artifact',i), CASE WHEN i%3=0 THEN 'bug' ELSE 'review' END, (i%5)+1, 'Feedback '||i, 'Mock feedback body '||i, CASE WHEN i%4=0 THEN 'answered' ELSE 'new' END, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.feedback_replies SELECT mock_uuid('feedback-reply',i), mock_uuid('feedback',i), mock_uuid('user',i), 'Mock reply '||i, 'internal', mock_ts(i+1) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO visitor.visitor_outbox_events SELECT mock_uuid('visitor-outbox',i), 'scan', mock_uuid('scan',i), 'scan.accepted', jsonb_build_object('scan_id',mock_uuid('scan',i)), mock_ts(i), NULL, 0 FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO analytics.analytics_events SELECT mock_uuid('event',i), 'event-'||i, (ARRAY['scan','scene_view','quiz_answer','scene_complete','route_complete'])[((i-1)%5)+1], mock_ts(i), mock_ts(i), mock_uuid('museum',i), mock_uuid('visitor',i), mock_uuid('visitor-session',i), mock_uuid('route',i), mock_uuid('artifact',i), jsonb_build_object('sequence',i), 1 FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO analytics.daily_metrics SELECT mock_uuid('metric',i), date '2026-01-01'+i, mock_uuid('museum',i), 'unique_visitors', jsonb_build_object('channel','qr'), 10+i, mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO analytics.reports SELECT mock_uuid('report',i), mock_uuid('museum',i), 'Report '||i, CASE WHEN i%2=0 THEN 'engagement' ELSE 'route_completion' END, jsonb_build_object('period','month'), mock_uuid('user',i), mock_ts(i), mock_ts(i) FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO analytics.export_jobs SELECT mock_uuid('export',i), mock_uuid('report',i), mock_uuid('museum',i), CASE WHEN i%2=0 THEN 'xlsx' ELSE 'csv' END, CASE WHEN i%3=0 THEN 'completed' ELSE 'queued' END, CASE WHEN i%3=0 THEN 'exports/report-'||i||'.csv' ELSE NULL END, mock_uuid('user',i), mock_ts(i), CASE WHEN i%3=0 THEN mock_ts(i+1) ELSE NULL END, NULL FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;

INSERT INTO analytics.delivery_dead_letters SELECT mock_uuid('dead-letter',i), CASE WHEN i%2=0 THEN 'visitor' ELSE 'content' END, mock_uuid('event',i), 'event.delivery.failed', jsonb_build_object('event_id',mock_uuid('event',i)), (i%4)+1, 'mock delivery error', mock_ts(i), NULL FROM generate_series(1,30) g(i) ON CONFLICT DO NOTHING;
