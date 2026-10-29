#!/usr/bin/env python3
"""Install the iframe locations into the existing Vitrina vhost, with rollback."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


def patch_vhost(text):
    include = 'include /etc/nginx/snippets/vitrina-embed.conf;'
    root = re.compile(r'(?m)^(\s*)root\s+/var/www/vitrina/public_html\s*;')
    matches = list(root.finditer(text))
    if len(matches) != 1 or not re.search(r'listen\s+443\b', text):
        raise ValueError('Expected exactly one Vitrina HTTPS document root; refusing to guess')
    if include not in text:
        text = root.sub(lambda m: m.group(0) + '\n' + m.group(1) + include, text, count=1)
    panel = re.compile(r'(location\s+(?:\^~\s+)?/methodist/\s*\{)')
    if len(panel.findall(text)) != 1:
        raise ValueError('Expected exactly one methodist location; refusing to guess')
    marker = '# S-011: authenticated UI cannot be framed externally'
    if marker not in text:
        text = panel.sub(lambda m: m.group(0) + '\n        ' + marker + '\n        add_header Content-Security-Policy "frame-ancestors \'self\'" always;\n        add_header X-Frame-Options SAMEORIGIN always;', text, count=1)
    return text


def atomic_write(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.vitrina-embed-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(content)
        os.chmod(name, mode)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}', args.revision):
        raise SystemExit('Invalid release revision')
    candidates = {}
    for link in Path('/etc/nginx/sites-enabled').iterdir():
        if not link.is_file():
            continue
        path = link.resolve()
        text = path.read_text()
        if re.search(r'server_name\s+[^;]*\bvitrineapp\.ru\b', text) and '/var/www/vitrina/public_html' in text:
            candidates[path] = text
    if len(candidates) != 1:
        raise SystemExit('Cannot uniquely identify the active Vitrina vhost; no configuration changed')
    vhost, old = next(iter(candidates.items()))
    patched = patch_vhost(old)
    snippet = Path('/etc/nginx/snippets/vitrina-embed.conf')
    snippet_body = Path(__file__).with_name('nginx-embed.locations.conf').read_bytes()
    old_snippet = snippet.read_bytes() if snippet.exists() else None
    if patched == old and old_snippet == snippet_body:
        subprocess.run(['nginx', '-t'], check=True)
        print('S-011 nginx locations already current')
        return
    subprocess.run(['nginx', '-t'], check=True)
    backup = Path('/opt/vitrineapp/nginx-backups') / args.revision
    backup.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not (backup / 'vhost.conf').exists():
        shutil.copy2(vhost, backup / 'vhost.conf')
        if old_snippet is not None:
            atomic_write(backup / 'embed.conf', old_snippet, 0o600)
    mode = vhost.stat().st_mode & 0o777
    try:
        atomic_write(snippet, snippet_body)
        atomic_write(vhost, patched.encode(), mode)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except BaseException:
        atomic_write(vhost, old.encode(), mode)
        if old_snippet is None:
            snippet.unlink(missing_ok=True)
        else:
            atomic_write(snippet, old_snippet)
        if subprocess.run(['nginx', '-t']).returncode == 0:
            subprocess.run(['systemctl', 'reload', 'nginx'])
        raise
    print(f'S-011 nginx locations installed; prior config backed up in {backup}')


if __name__ == '__main__':
    main()
