# Authentication and approved documents

The public authentication screen uses the three supplied documents only. There are no User Agreement or Service Rules links. Personal-data consent is required; advertising consent is optional and initially unchecked. Both statuses, immutable document version, user ID and server confirmation time are saved in `user_consents` in the same transaction as the new account.

`GET /api/v1/auth/legal-documents` is public. The source is `internal/auth/legal_documents/`, embedded into the service executable. The frontend imports these same JSON editions into its build, so public legal dialogs and pages do not depend on authentication API availability. Rebuild frontend and backend together when publishing a new edition; the backend checks the submitted consent version. JSON preserves all source paragraphs and table cells. Original Word files are retained for comparison. To import a new approved edition, run `scripts/import_legal_documents.py <source-directory>` with python-docx installed; update the edition date in the importer before publishing a different dated edition. Keep old editions when introducing a new revision so existing consent evidence remains available.

Public frontend routes under the configured Vite base are `/forgot-password`, `/reset-password?token=...` and `/legal/{privacy|personal_data|marketing}`. Existing Caddy SPA fallback supports these routes.

## Mail delivery

Set the following environment variables for auth-service (never put credentials in frontend variables):

- `AUTH_SMTP_ADDR`: SMTP submission host and port, e.g. `smtp.example.com:587`.
- `AUTH_SMTP_USER` and `AUTH_SMTP_PASSWORD`: SMTP account credentials.
- `AUTH_MAIL_FROM`: verified sending address.
- `AUTH_PUBLIC_URL`: HTTPS frontend base URL, including `/methodist` for the current production build, e.g. `https://example.com/methodist`.
- `AUTH_TRUSTED_PROXY_CIDRS`: only the networks of trusted reverse proxies. For the Windows Caddy deployment use `127.0.0.1/32,::1/128`. Leave unset for direct connections. Caddy must overwrite untrusted forwarded headers.

SMTP requires encryption and certificate validation: port 465 uses implicit TLS from connection start; other ports require STARTTLS (typically 587). Both password recovery and email confirmation use the same transport. AUTH_SMTP_TLS_MAX_VERSION may be set to 1.2 for networks where TLS 1.3 handshakes stall; certificate verification and TLS 1.2 minimum remain mandatory. The configured Timeweb connection on this machine uses this compatibility setting (smtpTLSMaxVersion in Windows runtime config). Windows deployment loads smtpAddress, smtpUser, smtpPasswordProtected (Windows DPAPI; smtpPassword is a legacy fallback), mailFrom and authPublicUrl from the ignored .runtime/config.json. Without mail configuration, the recovery endpoint returns a service-unavailable response for every address. No email delivery has been verified against an external SMTP provider in this workspace.

Requests for known and unknown addresses have the same response and are queued identically. A persistent queue performs account lookup and mail delivery in a separate worker, leases jobs across instances and retries failures up to five attempts at one-minute intervals. Requests expire after 30 minutes, including queue time. Raw reset tokens are never stored in the queue or returned by the public API; only cryptographic hashes reach the token table. Successful use consumes the token and revokes active sessions atomically. Delivery failures are logged without recipient or token content.

Limits are shared in the database: three requests per normalized email per 30 minutes and 30 requests per client IP per 30 minutes. Token submissions have an independent IP limit. Forwarded IPs are trusted only from configured proxy networks.

The existing bearer-token flow is retained. Session credentials are kept in sessionStorage rather than localStorage; old localStorage credentials are cleared. “Запомнить меня” remembers the email only; the session ends when the browser session is closed. Passwords and reset tokens are never persisted by the frontend.

## Verification

Run `go test ./...` in auth-service and `npm run check` plus `npm test` in Frontend/MetodistPanel. Auth tests cover required consent, stale revisions, separate optional advertising status, registration rollback, password replacement, 30-minute expiry, token replay, session revocation, persistent quotas and mail retry. Browser checks cover registration without advertising consent, all dialogs, Escape/focus return, public pages, recovery flow and 375px / landscape layouts.

Real SMTP delivery and PostgreSQL integration require the corresponding configured services; unit/integration tests here use SQLite and a local mail-capture callback.

