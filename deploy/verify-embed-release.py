#!/usr/bin/env python3
"""Verify existing publications and nginx without publishing museum content."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release', type=Path, required=True)
    args = parser.parse_args()
    compose = ['docker', 'compose', '-p', 'vitrineapp', '--env-file', '/opt/vitrineapp/.env', '-f', str(args.release / 'docker-compose.yml'), '-f', str(args.release / 'deploy/compose.selectel.yml')]

    def sql(statement):
        return subprocess.check_output(compose + ['exec', '-T', 'postgres', 'psql', '-X', '-U', 'viralabs', '-d', 'viralabs_artifacts', '-v', 'ON_ERROR_STOP=1', '-At', '-c', statement], text=True).strip()

    counts = json.loads(sql("""SELECT json_build_object(
        'published', COUNT(*) FILTER (WHERE a.status='published' AND a.deleted_at IS NULL),
        'legacy_codes', COUNT(*) FILTER (WHERE length(a.public_code)=10 AND a.published_revision>0 AND a.status<>'archived' AND a.deleted_at IS NULL),
        'missing_snapshots', COUNT(*) FILTER (WHERE a.status='published' AND a.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM artifact_publications p WHERE p.artifact_id=a.id))
    ) FROM artifacts a"""))
    print('Existing-publication metadata:', json.dumps(counts))
    # Exercise the actual PostgreSQL UPSERT in a rolled-back transaction.
    sql("""BEGIN;
      INSERT INTO artifact_embed_opens (artifact_id, day, opens)
      SELECT id, TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'), 1 FROM artifacts
      WHERE deleted_at IS NULL AND status <> 'archived' AND published_revision > 0
      ORDER BY id LIMIT 1
      ON CONFLICT (artifact_id, day) DO UPDATE SET opens=artifact_embed_opens.opens+1;
      ROLLBACK;""")
    print('PostgreSQL embed aggregate migration and UPSERT: PASS (transaction rolled back)')
    codes = sql("""SELECT a.public_code FROM artifacts a WHERE a.deleted_at IS NULL
      AND a.status <> 'archived' AND a.published_revision>0
      AND EXISTS(SELECT 1 FROM artifact_publications p WHERE p.artifact_id=a.id)
      ORDER BY length(a.public_code) DESC, a.id LIMIT 10""").splitlines()
    checked = 0
    for code in codes:
        if not re.fullmatch(r'(?:[A-Z0-9]{5}|[A-F0-9]{10})', code):
            raise RuntimeError('Unexpected stored public-code format; no records modified')
        with urllib.request.urlopen('http://127.0.0.1:8081/api/v1/public/artifacts/' + code, timeout=15) as response:
            snapshot = json.load(response)
            if response.headers.get('Cache-Control') != 'no-store' or not snapshot.get('artifact', {}).get('id'):
                raise RuntimeError('Public snapshot contract check failed')
        rendered = subprocess.check_output(['curl', '--silent', '--show-error', '--fail', '--max-time', '20', '--resolve', 'vitrineapp.ru:443:127.0.0.1', '-D', '-', 'https://vitrineapp.ru/embed/exhibits/' + code], text=True)
        if 'frame-ancestors *' not in rendered or not re.search(r'src="/visitor/assets/embed-[^" ]+\.js"', rendered):
            raise RuntimeError('nginx embed document or framing headers are missing')
        checked += 1
    print(f'Existing public snapshots and HTTPS embed documents verified: {checked}; no republishing performed')
    panel = subprocess.check_output(['curl', '--silent', '--show-error', '--fail', '--max-time', '20', '--resolve', 'vitrineapp.ru:443:127.0.0.1', '-D', '-', 'https://vitrineapp.ru/methodist/'], text=True)
    if "frame-ancestors 'self'" not in panel:
        raise RuntimeError('Authenticated UI framing protection is missing')
    print('Authenticated UI framing protection: PASS')


if __name__ == '__main__':
    main()
