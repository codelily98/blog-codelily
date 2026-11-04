#!/usr/bin/env python3
"""First-time production Google OAuth setup. Run on the host, with hidden input."""
import getpass
import os
from pathlib import Path
import re
import sys
import tempfile
import warnings


class SetupError(Exception):
    """Safe operator message containing no input values."""


ORIGIN = 'https://blog.codelily.kr'
KEYS = ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')


def validate_client_id(value):
    if not re.fullmatch(r'[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', value):
        raise SetupError('GOOGLE_CLIENT_ID: paste the Web application client ID only.')
    return value


def validate_secret(value):
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,256}', value):
        raise SetupError('GOOGLE_CLIENT_SECRET: paste the client secret only, without quotes or whitespace.')
    return value


def ask_hidden(key, validator):
    while True:
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            value = getpass.getpass(key + ' (hidden): ')
        try:
            return validator(value)
        except SetupError as error:
            print(str(error), file=sys.stderr)


def read_settings(original):
    settings = {}
    for line in original.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator or not re.fullmatch(r'[A-Z][A-Z0-9_]*', key):
            raise SetupError('Environment format is unsupported; review it privately before setup.')
        if key in settings:
            raise SetupError('Duplicate environment keys detected; review them privately before setup.')
        settings[key] = value.strip()
    for key in KEYS:
        if settings.get(key, '').strip('\"\''):
            raise SetupError('Existing Google settings preserved. This tool does not rotate credentials.')
    for key in ('APP_URL', 'BETTER_AUTH_URL'):
        if settings.get(key) != ORIGIN:
            raise SetupError('APP_URL and BETTER_AUTH_URL must match the production HTTPS origin.')
    for key in ('BETTER_AUTH_SECRET', 'DATABASE_URL', 'OWNER_EMAILS'):
        if not settings.get(key, '').strip('\"\''):
            raise SetupError('Required application settings are missing; no changes made.')
    return settings


def configure(env_file):
    if env_file.is_symlink() or env_file.parent.is_symlink():
        raise SetupError('Refusing a symbolic-link environment path.')
    original = env_file.read_text(encoding='utf-8')
    read_settings(original)
    backup = env_file.with_name('code-lily.env.before-google')
    if backup.exists() or backup.is_symlink():
        raise SetupError('A Google setup backup already exists; review it privately before retrying.')
    values = {
        KEYS[0]: ask_hidden(KEYS[0], validate_client_id),
        KEYS[1]: ask_hidden(KEYS[1], validate_secret),
    }
    # Do not replace edits made while the operator was entering credentials.
    if env_file.is_symlink() or env_file.read_text(encoding='utf-8') != original:
        raise SetupError('Environment changed during input; no changes made. Retry after review.')
    lines = []
    seen = set()
    for line in original.splitlines():
        key = line.partition('=')[0]
        if key in values:
            lines.append(key + '=' + values[key])
            seen.add(key)
        else:
            lines.append(line)
    lines.extend(key + '=' + values[key] for key in KEYS if key not in seen)
    env_file.parent.chmod(0o700)
    descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
        stream.write(original)
        stream.flush()
        os.fsync(stream.fileno())
    descriptor, temporary = tempfile.mkstemp(prefix='.google-env-', dir=env_file.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write('\n'.join(lines) + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('Google settings saved; values omitted. Other application settings preserved.')
    print('No services restarted. Recreate only code-lily, then verify actual Google login/logout and editor uploads.')


def main():
    if len(sys.argv) != 1:
        raise SetupError('Do not pass credentials as command arguments.')
    if os.name != 'posix' or not sys.stdin.isatty():
        raise SetupError('Run on the Linux host in an interactive SSH terminal (ssh -t).')
    configure(Path(__file__).resolve().parent.parent / 'infra/env/code-lily.env')


if __name__ == '__main__':
    try:
        main()
    except SetupError as error:
        print('Google setup stopped: ' + str(error), file=sys.stderr)
        sys.exit(1)
    except getpass.GetPassWarning:
        print('Hidden input unavailable. Reconnect with ssh -t; do not enter keys in echo mode.', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('\nGoogle setup interrupted; values omitted. Check setup status before retrying.', file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, EOFError):
        print('Google setup stopped. Check protected env/backup permissions and retry after review; values omitted.', file=sys.stderr)
        sys.exit(1)
