#!/usr/bin/env python3
"""Local bounded checks; log health only, never request/credential contents."""
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import time

errors = []
usage = shutil.disk_usage('/')
if usage.used / usage.total >= 0.85:
    errors.append('root disk usage >=85%')
filesystem = os.statvfs('/')
if filesystem.f_files and (1 - filesystem.f_favail/filesystem.f_files) >= 0.85:
    errors.append('root inode usage >=85%')
try:
    names = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'label=com.docker.compose.project=codelily', '--format', '{{.Names}}'], text=True, timeout=10).splitlines()
    expected = {'codelily-code-lily-1','codelily-postgres-1','codelily-caddy-1','codelily-tunnel-1'}
    if not expected.issubset(names):
        errors.append('required container missing')
    for name in names:
        state = json.loads(subprocess.check_output(['docker','inspect','--format','{{json .State}}',name], text=True, timeout=10))
        if not state.get('Running') or state.get('OOMKilled') or state.get('Health',{}).get('Status') == 'unhealthy':
            errors.append('container not healthy: '+name)
except Exception:
    errors.append('container status check failed')
try:
    with socket.create_connection(('172.30.0.3',443),timeout=5) as raw:
        with ssl.create_default_context().wrap_socket(raw,server_hostname='blog.codelily.kr') as conn:
            if ssl.cert_time_to_seconds(conn.getpeercert()['notAfter']) - time.time() < 14*86400:
                errors.append('origin certificate expires within 14 days')
            conn.sendall(b'GET /health/ready HTTP/1.1\r\nHost: blog.codelily.kr\r\nConnection: close\r\n\r\n')
            response = http.client.HTTPResponse(conn)
            response.begin()
            if response.status != 200:
                errors.append('origin readiness not 200')
except Exception:
    errors.append('verified origin TLS/readiness failed')
try:
    snapshots = [p.name for p in Path('/var/backups/codelily').iterdir() if re.fullmatch(r'\d{8}T\d{6}Z',p.name) and p.is_dir()]
    latest = datetime.strptime(max(snapshots),'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc)-latest).total_seconds() > 36*3600:
        errors.append('encrypted backup older than 36 hours')
except Exception:
    errors.append('complete encrypted backup missing')
if errors:
    print('; '.join(errors))
    raise SystemExit(1)
print('Host storage, containers, verified origin TLS/readiness and encrypted backup checks passed.')
