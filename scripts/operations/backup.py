#!/usr/bin/env python3
"""Root-only encrypted backup. Recipient file contains PUBLIC keys only."""
import argparse
from datetime import datetime, timezone, timedelta
import fcntl
import grp
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

ROOT = Path('/var/backups/codelily')
APP = Path('/opt/codelily')
PG = 'codelily-postgres-1'
DB = 'codelily_production'
APP_CONFIG = ['infra/.env', 'infra/env', 'infra/secrets', 'infra/compose.production.yml',
              'infra/caddy', 'infra/postgres', 'infra/releases', 'infra/security', 'scripts/operations']
HOST_CONFIG = ['etc/ssh/sshd_config.d/00-codelily-security.conf',
               'etc/apt/apt.conf.d/99-codelily-security',
               'etc/systemd/journald.conf.d/codelily.conf',
               'etc/systemd/system/apt-daily-upgrade.timer.d/codelily.conf',
               'etc/codelily-host-firewall.nft', 'etc/codelily-backup.recipients',
               'usr/local/sbin/codelily-host-firewall', 'usr/local/sbin/codelily-export-backups']
HOST_CONFIG += ['etc/systemd/system/codelily-' + name + suffix
                for name in ['health', 'backup', 'maintenance'] for suffix in ['.service', '.timer']]
HOST_CONFIG += ['etc/systemd/system/codelily-host-firewall.service']


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def encrypted(args, target):
    with target.open('xb') as output:
        producer = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            cipher = subprocess.run(['age', '-R', '/etc/codelily-backup.recipients'],
                                    stdin=producer.stdout, stdout=output, stderr=subprocess.DEVNULL)
            producer.stdout.close()
            if cipher.returncode or producer.wait():
                raise RuntimeError('Encrypted backup pipeline failed')
        finally:
            if producer.poll() is None:
                producer.kill()
                producer.wait()


def counts(container, database):
    base = ['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1', '-c']
    sql = "SELECT format('SELECT %L, count(*) FROM %I.%I;',table_name,table_schema,table_name) FROM information_schema.tables WHERE table_schema='blog_schema' AND table_type='BASE TABLE' ORDER BY table_name"
    statements = run(base + [sql], capture_output=True, text=True).stdout
    return run(base + [statements], capture_output=True, text=True).stdout


def verify(snapshot, identity):
    image = run(['docker', 'inspect', '--format', '{{.Image}}', PG], capture_output=True, text=True).stdout.strip()
    name = 'codelily-backup-restore-check'
    # No host ports, no network, no persistent restore volume, bounded resources.
    cid = run(['docker', 'run', '-d', '--rm', '--name', name, '--network', 'none',
               '--memory', '512m', '--pids-limit', '128',
               '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m',
               '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=restore', image],
              capture_output=True, text=True).stdout.strip()
    try:
        for _ in range(40):
            ready = subprocess.run(['docker', 'exec', cid, 'pg_isready', '-U', 'postgres', '-d', 'restore'], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('Isolated restore did not become ready')
        decrypt = subprocess.Popen(['age', '-d', '-i', str(identity), str(snapshot/'database.dump.age')], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            restored = subprocess.run(['docker', 'exec', '-i', cid, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', 'restore'], stdin=decrypt.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            decrypt.stdout.close()
            if restored.returncode or decrypt.wait():
                raise RuntimeError('Decrypt or isolated PostgreSQL restore failed')
        finally:
            if decrypt.poll() is None:
                decrypt.kill()
                decrypt.wait()
        if counts(PG, DB) != counts(cid, 'restore'):
            raise RuntimeError('Restored table counts differ from current source')
        for filename in ['roles.sql.age', 'configuration.tar.gz.age', 'caddy-data.tar.gz.age']:
            decrypt = subprocess.Popen(['age', '-d', '-i', str(identity), str(snapshot/filename)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            # Drain the roles stream too; never emit hashes or configuration contents.
            if filename == 'roles.sql.age':
                while decrypt.stdout.read(65536):
                    pass
                code = 0
            else:
                code = subprocess.run(['tar', '-tzf', '-'], stdin=decrypt.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
            decrypt.stdout.close()
            if code or decrypt.wait():
                raise RuntimeError('Encrypted recovery material validation failed')
        print('Encrypted DB restore and all application table counts passed; encrypted roles/configuration readable.')
    finally:
        run(['docker', 'rm', '-f', cid], stdout=subprocess.DEVNULL)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-with-identity', type=Path)
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    os.umask(0o077)
    gid = grp.getgrnam('codelily-backup').gr_gid
    ROOT.mkdir(parents=True, exist_ok=True)
    ROOT.chmod(0o750)
    os.chown(ROOT, 0, gid)
    lock = Path('/run/lock/codelily-backup.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    pending, final = ROOT / (stamp+'.partial'), ROOT / stamp
    pending.mkdir()
    try:
        encrypted(['docker', 'exec', PG, 'pg_dump', '-U', 'postgres', '-d', DB, '-Fc'], pending/'database.dump.age')
        encrypted(['docker', 'exec', PG, 'pg_dumpall', '-U', 'postgres', '--globals-only'], pending/'roles.sql.age')
        encrypted(['tar', '-C', str(APP), '-czf', '-', *APP_CONFIG, '-C', '/', *HOST_CONFIG], pending/'configuration.tar.gz.age')
        encrypted(['docker', 'exec', 'codelily-caddy-1', 'tar', '-C', '/data', '-czf', '-', '.'], pending/'caddy-data.tar.gz.age')
        if args.verify_with_identity:
            verify(pending, args.verify_with_identity)
        manifest = {'created_at': stamp, 'database': DB, 'restore_verified': bool(args.verify_with_identity),
                    'files': {p.name: {'sha256': digest(p), 'bytes': p.stat().st_size} for p in pending.iterdir()}}
        (pending/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        for path in pending.iterdir():
            path.chmod(0o640)
            os.chown(path, 0, gid)
        pending.chmod(0o750)
        os.chown(pending, 0, gid)
        pending.rename(final)
        # Rotate only this tool's complete timestamp directories under the fixed root.
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        for old in ROOT.iterdir():
            if re.fullmatch(r'\d{8}T\d{6}Z', old.name) and old.is_dir() and not old.is_symlink():
                if datetime.strptime(old.name, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc) < cutoff:
                    assert old.resolve().parent == ROOT.resolve()
                    shutil.rmtree(old)
        print(f'Encrypted backup ready: {stamp}; retention 7 days.')
    except Exception:
        if pending.exists():
            assert pending.resolve().parent == ROOT.resolve()
            shutil.rmtree(pending)
        raise


if __name__ == '__main__':
    main()
