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
  https://vitrineapp.ru/embed/exhibits/00000 \
  https://vitrineapp.ru/api/auth/api/v1/auth/legal-documents \
  https://vitrineapp.ru/api/artifacts/api/v1/public/museums \
  https://vitrineapp.ru/api/visitor/healthz; do
  curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused --retry-all-errors -o /dev/null "$url"
done

python3 "$release/deploy/verify-embed-release.py" --release "$release"

printf '%s\n' "$revision" > /opt/vitrineapp/deployed-revision
ln -sfn "$release" /opt/vitrineapp/current
echo "Deployed $revision"
