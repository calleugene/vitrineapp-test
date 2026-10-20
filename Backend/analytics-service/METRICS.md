# MP-007 · Analytics v1

## Ownership and identity

`analytics-service` owns `analytics_events` in `viralabs_analytics`. Published artifact IDs, screen IDs and museum IDs are resolved from `artifacts-service` on every public event. `museum_id` and `visitor_id` supplied by a browser do not grant access or determine scope. A public event is accepted only for a currently resolvable published code. Methodist reads use the signed auth-service Bearer claim `museum_id`; caller supplied `museum_id` may only equal that claim. This public ingestion context is deliberately restricted to published artifact activity. The browser's `visitor_key` is an installation pseudonym, not a verified person or an account ID. It can change after storage is cleared and must not be presented as a physical-person count.

Existing `visitor-service` guest and account records are not copied into analytics. `artifact_collected` is accepted only after a matching `(visitor_key, artifact_id)` collection is found through a read-only query to the artifacts database; its count comes directly from persisted `artifact_visitor_status` rows, rather than browser clicks. `route_start` and `route_complete` are not accepted as browser analytics events. Route sessions and confirmed completions are owned by route-service; route statistics are now read from that source. Visitor uses the same pseudonym for public collect and analytics events. The public collect endpoint currently trusts that pseudonym, so a collection is a confirmed saved record, not a verified physical person.

## Time and calculations

- All event timestamps are stored as UTC Unix milliseconds. `occurred_at` may be up to five minutes in the future and up to seven days old. Aggregates use event time. A late accepted event may therefore revise an older range immediately. `received_at` records when it reached the service.
- The range is `[from,to)`. Supplying `period` together with `from` and `to`, or only one endpoint, returns `400 invalid_range`. Periods align with calendar days, ISO Monday weeks, months and years in the requested IANA timezone. UTC is the default until a museum timezone catalogue is available. Buckets use local calendar boundaries, including 23 and 25 hour DST days. Explicit ranges may start at any instant.
- `total_visitors` is the count of distinct browser `visitor_key` values with any accepted event in the selected range. `new_visitors` counts those whose earliest accepted event in this museum falls in the range. Reinstallation and cleared storage create another pseudonym.
- `avg_session_minutes` is the sum of accepted `engagement.active_ms` divided by distinct session IDs with an event in the range, then by 60,000. It is active story time, not wall-clock elapsed time. A single heartbeat is capped at 15 seconds. Visitor emits heartbeats only while the story is visible; the browser rotates a session after 30 minutes of inactivity.
- Summary deltas are percentage change against the preceding calendar period in the same timezone, or the immediately preceding equally long interval for explicit ranges. A zero preceding value gives `null`, since percentage change has no denominator.
- `scene_view` denotes one visible **screen** of a published artifact. It is unique by museum, session, artifact and screen. A story is an artifact in this version. `scene_complete` denotes reaching its final screen and is unique by museum, session and artifact. Neither is a route completion.
- The visitor dynamics series counts distinct keys per bucket. `newVisitors` uses each key's first accepted event in that museum. A person can appear in several visitor buckets if they revisit. Summary counts distinct keys over the entire selected range, so summing buckets can exceed the summary.
- Source is the limited code `qr`, `direct`, `route` or `unknown` on the first `visit_start` in range. Newly generated exhibit QR images add `?source=qr`; the public story emits `scan` after that published URL resolves. An unmarked direct URL uses `direct`. Older QR images lack the marker and appear as direct. A source is a client hint, not proof of physical QR scanning. `unknown` remains visible rather than being redistributed.
- `collected_artifacts` in the visitor list and the artifacts summary count confirmed artifact collection rows whose original `found_at` lies in the selected range. Recollecting preserves the first timestamp. Collection totals are distinct by `(visitor_key, artifact_id)`. If the artifacts database is unavailable, reads that require these numbers return `503 collection_source_unavailable`.
- All supported reads query the same event table on demand; there is no cache. A committed event is visible to subsequent reads immediately. `generated_at` and `data_through` record query time. No numerical value is fabricated for a missing source.

## Idempotency and failures

The event `id` is unique. A replay of the same ID returns `duplicate: true`; a different public code with the same ID returns `409 event_id_conflict`. Natural unique keys also prevent refreshes and repeated effects from double counting visits, screen views and completions within a session, and collections across sessions. The Visitor queue stores at most 100 events for seven days, retries the same ID with capped exponential delay for the retention window (temporary failures do not discard the event after a fixed attempt count), and drops permanent 4xx failures so later events can proceed. Requests time out after ten seconds. `sendBeacon` is only an extra delivery attempt; it does not remove an event from the queue. Ingestion limits JSON to 4 KiB and 120 requests per browser key per minute. The browser key can be rotated, so these are load controls rather than abuse proof.

`400` means invalid input or unavailable requested filter, `401` invalid or absent session, `403` wrong role or museum, `409` conflicting ID, `429` rate limit, and `503` a dependency or metric source is unavailable. All errors use `{"error":{"code":"...","message":"..."}}`. A valid zero count is `0`, an empty result is `[]`, and a missing numeric source is `null` with an availability reason when embedded in a successful summary.

## Source availability

| Metric or control | Source | Current state |
| --- | --- | --- |
| Visitors, first visits, screen views, active minutes, story completions | `analytics_events` | Available for published public artifacts |
| Artifact titles and museum/screen validation | `artifacts-service` publication | Available; publication resolution failure returns 503 |
| Routes and route completion | route-service catalogue, session snapshot and confirmed collection | Route stats and dashboard available; filtering generic visitor screen events by route is still unavailable |
| Teams | Team catalogue | Unavailable; team filter returns 400 |
| Collections | `artifacts-service` persisted collect fact | Available when `ANALYTICS_ARTIFACTS_DB_DSN` is configured; list and artifacts summary use server rows |
| Museum rating and feedback | feedback-service authenticated submissions and moderation | Available; public rating uses published reviews, no reviews gives null |
| Visitor names and account linkage | Verified visitor/account context | Unavailable; list uses anonymous labels |

Dashboard summary's `visitors_per_month` always requests the current museum-local calendar month (UTC until a museum timezone is supplied). `meta` describes the requested dashboard range; `visitors_per_month_meta` describes the monthly card range. Route metrics and museum rating are read from route-service and feedback-service over all time; unavailable dependencies remain explicit and empty rating/duration is null. Attendance and recent activity are projections of the same event table. Popular routes and feedback now read their dedicated sources after authentication; source errors remain explicit. The `stats` content, stories and artifacts tabs all use the published artifact screen events; they do not imply distinct server story and artifact entities. Breakdown counts event types; bars show each artifact's share of screen views.

## Running locally

Set `AUTH_TOKEN_SECRET` and `ARTIFACTS_PUBLIC_BASE_URL`, then run the repository compose stack. `analytics-service` uses `viralabs_analytics`, reads `viralabs_artifacts` via `ANALYTICS_ARTIFACTS_DB_DSN`, and exposes `/healthz` and `/readyz`; `dashboard-service` reads analytics and exposes the same probes. Visitor posts to the same-origin `/api/analytics/api/v1/analytics/events` proxy. For Vite development, the proxy targets `127.0.0.1:8085`, overridable by `VITE_ANALYTICS_DEV_TARGET`. Windows Build.ps1 builds analytics-service and dashboard-service. Start.ps1 creates vitrine_analytics for existing installations and starts both services on 18085/18084. Status.ps1 and Check.ps1 probe readiness through Caddy and the service ports; Backup.ps1 includes the analytics database.


Route and feedback statistics now proxy to their dedicated services with the resolved [from,to) range and timezone. See ../SERVICES.md for current contracts and verification.

