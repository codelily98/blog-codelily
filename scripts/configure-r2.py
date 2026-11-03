#!/usr/bin/env python3
"""Interactive, first-time R2 setup; never prints credentials or restarts services."""
import getpass
import os
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit


def main():
    if not sys.stdin.isatty():
        raise ValueError('Run interactively with ssh -t. Do not pass credentials as arguments.')
    root = Path(__file__).resolve().parent.parent
    env_file = root / 'infra/env/code-lily.env'
    if env_file.is_symlink():
        raise ValueError('Refusing to replace a symbolic-link environment file.')
    original = env_file.read_text()
    keys = ['R2_ACCOUNT_ID', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET', 'R2_PUBLIC_BASE_URL',
            'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    for line in original.splitlines():
        key, separator, value = line.partition('=')
        if separator and key in keys and value.strip():
            raise ValueError('Existing R2 settings detected; preserved. Rotate them explicitly using the protected environment file.')
    values = {
        'R2_ACCOUNT_ID': input('R2 account ID: ').strip(),
        'R2_PRIVATE_BUCKET': input('Private bucket [blog-storage]: ').strip() or 'blog-storage',
        'R2_PUBLIC_BUCKET': input('Public image bucket [public-blog-storage]: ').strip() or 'public-blog-storage',
        'R2_PUBLIC_BASE_URL': input('Public HTTPS domain [https://public-blog-r2.codelily.kr]: ').strip() or 'https://public-blog-r2.codelily.kr',
    }
    if not re.fullmatch(r'[A-Fa-f0-9]{32}', values['R2_ACCOUNT_ID']):
        raise ValueError('Expected a 32-character Cloudflare account ID, not an API token.')
    for key in ['R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET']:
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', values[key]):
            raise ValueError('Bucket names must contain 3-63 lowercase letters, numbers or hyphens; do not enter a domain.')
    if values['R2_PRIVATE_BUCKET'] == values['R2_PUBLIC_BUCKET']:
        raise ValueError('Public images and private files require different buckets.')
    url = urlsplit(values['R2_PUBLIC_BASE_URL'])
    if (url.scheme != 'https' or not url.hostname or url.username or url.password or
            url.path not in ('', '/') or url.query or url.fragment or url.port not in (None, 443)):
        raise ValueError('Expected an HTTPS custom domain without a path, query or credentials.')
    if url.hostname.endswith('.r2.cloudflarestorage.com') or url.hostname.endswith('.r2.dev'):
        raise ValueError('Use the production custom domain, not the S3 endpoint or r2.dev.')
    values['R2_PUBLIC_BASE_URL'] = values['R2_PUBLIC_BASE_URL'].rstrip('/')
    for key in ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']:
        values[key] = getpass.getpass(key + ' (hidden): ')
        if not re.fullmatch(r'[A-Za-z0-9_+/=-]{16,256}', values[key]):
            raise ValueError('Invalid credential format; no settings saved. Paste only the S3 credential value.')
    lines = []
    seen = set()
    for line in original.splitlines():
        key = line.partition('=')[0]
        if key in values:
            if key not in seen:
                lines.append(key + '=' + values[key])
                seen.add(key)
        else:
            lines.append(line)
    for key in keys:
        if key not in seen:
            lines.append(key + '=' + values[key])
    env_file.parent.chmod(0o700)
    backup = env_file.with_name('code-lily.env.before-r2')
    try:
        descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, 'w') as stream:
            stream.write(original)
    descriptor, temporary = tempfile.mkstemp(prefix='.r2-env-', dir=env_file.parent)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write('\n'.join(lines) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('R2 settings saved (credentials omitted); existing application settings preserved.')
    print('No containers restarted. Verify buckets/CORS/custom domain, then recreate the app and test actual uploads.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, EOFError):
        # Keep exceptions generic: provider credentials must never reach logs.
        print('R2 setup stopped. Check account/bucket/domain/credential inputs and existing settings; no credentials displayed.', file=sys.stderr)
        sys.exit(1)
