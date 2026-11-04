#!/usr/bin/env bash
set -euo pipefail

release_id="${1:?release id required}"
revision="${2:?revision required}"
[[ "$release_id" =~ ^[0-9]+-[0-9]+$ ]] || { echo 'Invalid release id' >&2; exit 1; }
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid revision' >&2; exit 1; }

exec 9>/opt/vitrineapp/deploy.lock
flock -n 9 || { echo 'A deployment is already running' >&2; exit 1; }

archive="/opt/vitrineapp/incoming/${release_id}.tgz"
release="/opt/vitrineapp/releases/${release_id}"
test -s "$archive"
test -f /opt/vitrineapp/.env
mkdir -p "$release"
tar -xzf "$archive" -C "$release"
rm -f -- "$archive"

test -f "$release/docker-compose.yml"
test -f "$release/Landing/dist/send-lead.php"
test -f "$release/Landing/dist/404.html"
test -f "$release/Landing/dist/admin/index.html"
test -f "$release/Frontend/MetodistPanel/dist/index.html"
test -f "$release/Frontend/Visitor/dist/index.html"
test -f "$release/Frontend/Visitor/dist/embed.html"
python3 "$release/deploy/install-embed-nginx.py" --revision "$revision"

compose=(docker compose -p vitrineapp --env-file /opt/vitrineapp/.env -f "$release/docker-compose.yml" -f "$release/deploy/compose.selectel.yml")
services=(auth-service artifacts-service visitor-service analytics-service route-service feedback-service notification-service dashboard-service)
"${compose[@]}" config --quiet
COMPOSE_PARALLEL_LIMIT=1 "${compose[@]}" build "${services[@]}"
"${compose[@]}" up -d --no-deps --no-build "${services[@]}"

rsync -a --delete --exclude='/.well-known/' --exclude='/config.js' --chmod=D755,F644 "$release/Landing/dist/" /var/www/vitrina/public_html/
rsync -a --delete --chmod=D755,F644 "$release/Frontend/MetodistPanel/dist/" /var/www/vitrina/methodist/
rsync -a --delete --chmod=D755,F644 "$release/Frontend/Visitor/dist/" /var/www/vitrina/visitor/
chmod 755 /var/www/vitrina/public_html /var/www/vitrina/methodist /var/www/vitrina/visitor

for url in \
  https://vitrineapp.ru/ \
  https://vitrineapp.ru/methodist/ \
  https://vitrineapp.ru/visitor/ \
  https://vitrineapp.ru/stats \
  https://vitrineapp.ru/admin/ \
  https://vitrineapp.ru/api/analytics/api/v1/public/stats \
  https://vitrineapp.ru/embed/exhibits/00000 \
  https://vitrineapp.ru/api/auth/api/v1/auth/legal-documents \
  https://vitrineapp.ru/api/artifacts/api/v1/public/museums \
  https://vitrineapp.ru/api/visitor/healthz; do
  curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused --retry-all-errors -o /dev/null "$url"
done

error_page="$(mktemp)"
trap 'rm -f -- "$error_page"' EXIT
test "$(curl --silent --show-error --output "$error_page" --write-out '%{http_code}' "https://vitrineapp.ru/vitrine-release-missing-$revision")" = 404
cmp -s "$error_page" "$release/Landing/dist/404.html"

test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' https://vitrineapp.ru/api/auth/api/v1/auth/admin/museums)" = 401
test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' http://127.0.0.1:8081/api/v1/internal/admin/museums)" = 403
admin_email="$("${compose[@]}" exec -T postgres psql -U viralabs -d viralabs_auth -Atc "SELECT email FROM users WHERE role = 'platform_admin' AND email IN ('hello@vitrine.app', 'hello@vitrineapp.ru')")"
test "$admin_email" = hello@vitrineapp.ru
admin_status="$("${compose[@]}" exec -T postgres psql -U viralabs -d viralabs_auth -Atc "SELECT status FROM users WHERE role = 'platform_admin' AND email = 'hello@vitrineapp.ru'")"
case "$admin_status" in
  ACTIVE|ADMIN_PENDING) printf 'Platform administrator status: %s\n' "$admin_status" ;;
  *) echo 'Platform administrator is unavailable' >&2 ;;
esac

python3 "$release/deploy/verify-embed-release.py" --release "$release"

printf '%s\n' "$revision" > /opt/vitrineapp/deployed-revision
ln -sfn "$release" /opt/vitrineapp/current
echo "Deployed $revision"
