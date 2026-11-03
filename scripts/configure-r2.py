#!/usr/bin/env python3
"""Interactive, first-time R2 setup; never prints credentials or restarts services."""
import getpass
import json
import os
import re
import sys
import tempfile
import warnings
from pathlib import Path
from urllib.parse import urlsplit


class SetupError(Exception):
    """A safe operator-facing message; never include an input value."""


def validate_account_id(value):
    if not re.fullmatch(r'[A-Fa-f0-9]{32}', value):
        raise SetupError('R2_ACCOUNT_ID: enter the 32-character account ID, not a token or URL.')
    return value.lower()


def validate_bucket(value):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', value):
        raise SetupError('Bucket name: use 3-63 lowercase letters, numbers or hyphens; do not enter a domain.')
    return value


def validate_public_bucket(value, private_bucket):
    validate_bucket(value)
    if value == private_bucket:
        raise SetupError('R2_PUBLIC_BUCKET: public images and private files need different buckets.')
    return value


def validate_public_url(value):
    try:
        url = urlsplit(value)
        valid = (url.scheme == 'https' and bool(url.hostname) and not url.username and
                 not url.password and url.path in ('', '/') and not url.query and
                 not url.fragment and url.port in (None, 443) and
                 not any(character.isspace() for character in value))
    except ValueError:
        valid = False
    if not valid:
        raise SetupError('R2_PUBLIC_BASE_URL: use an HTTPS domain only, without a path, query or credentials.')
    if url.hostname.endswith('.r2.cloudflarestorage.com') or url.hostname.endswith('.r2.dev'):
        raise SetupError('R2_PUBLIC_BASE_URL: use the public custom domain, not the S3 endpoint or r2.dev.')
    return value.rstrip('/')


def validate_credential(value):
    if not re.fullmatch(r'[A-Za-z0-9_+/=-]{16,256}', value):
        raise SetupError('Credential format is invalid. Paste only the S3 credential value; it will stay hidden.')
    return value


def ask(prompt, validator, default=None, hidden=False):
    while True:
        if hidden:
            with warnings.catch_warnings():
                warnings.simplefilter('error', getpass.GetPassWarning)
                value = getpass.getpass(prompt)
        else:
            value = input(prompt).strip()
        if not value and default is not None:
            value = default
        try:
            return validator(value)
        except SetupError as error:
            print(str(error), file=sys.stderr)


def existing_account_id(root):
    try:
        state = json.loads((root / '.local/cloudflare-baseline.json').read_text())
        return validate_account_id(state['accountId'])
    except (OSError, ValueError, KeyError, TypeError, SetupError):
        return None


def main():
    if not sys.stdin.isatty():
        raise SetupError('Run interactively with ssh -t. Do not pass credentials as arguments.')
    if len(sys.argv) != 1:
        raise SetupError('Do not pass credentials as command arguments.')
    root = Path(__file__).resolve().parent.parent
    env_file = root / 'infra/env/code-lily.env'
    if env_file.is_symlink():
        raise SetupError('Refusing to replace a symbolic-link environment file.')
    original = env_file.read_text()
    keys = ['R2_ACCOUNT_ID', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET', 'R2_PUBLIC_BASE_URL',
            'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    for line in original.splitlines():
        key, separator, value = line.partition('=')
        if separator and key in keys and value.strip():
            raise SetupError('Existing R2 settings detected; preserved. Rotate them explicitly using the protected environment file.')
    account_default = existing_account_id(root)
    account_prompt = ('R2 account ID [Enter: existing Cloudflare account]: '
                      if account_default else 'R2 account ID: ')
    values = {'R2_ACCOUNT_ID': ask(account_prompt, validate_account_id, account_default)}
    values['R2_PRIVATE_BUCKET'] = ask('Private bucket [blog-storage]: ', validate_bucket, 'blog-storage')
    values['R2_PUBLIC_BUCKET'] = ask('Public image bucket [public-blog-storage]: ',
                                     lambda value: validate_public_bucket(value, values['R2_PRIVATE_BUCKET']),
                                     'public-blog-storage')
    values['R2_PUBLIC_BASE_URL'] = ask('Public HTTPS domain [https://public-blog-r2.codelily.kr]: ',
                                       validate_public_url, 'https://public-blog-r2.codelily.kr')
    for key in ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']:
        values[key] = ask(key + ' (hidden): ', validate_credential, hidden=True)
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
    except SetupError as error:
        print('R2 setup stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
    except getpass.GetPassWarning:
        print('Hidden key input is unavailable. Reconnect with ssh -t; no key was requested in echo mode.', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('\nR2 setup interrupted; credentials were not displayed.', file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, EOFError):
        # Keep exceptions generic: provider credentials must never reach logs.
        print('R2 setup stopped. Check account/bucket/domain/credential inputs and existing settings; no credentials displayed.', file=sys.stderr)
        sys.exit(1)
