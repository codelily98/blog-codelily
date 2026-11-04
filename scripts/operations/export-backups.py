#!/usr/bin/env python3
"""Forced SSH command: export only complete ciphertext snapshots, no arguments."""
from pathlib import Path
import re
import sys
import tarfile

root = Path('/var/backups/codelily')
with tarfile.open(fileobj=sys.stdout.buffer, mode='w|') as archive:
    for folder in sorted(root.iterdir()):
        if not re.fullmatch(r'\d{8}T\d{6}Z', folder.name) or not folder.is_dir() or folder.is_symlink():
            continue
        for name in ['database.dump.age', 'roles.sql.age', 'configuration.tar.gz.age', 'caddy-data.tar.gz.age', 'manifest.json']:
            path = folder / name
            if not path.is_file() or path.is_symlink() or path.resolve().parent != folder.resolve():
                raise SystemExit('Invalid snapshot')
            archive.add(path, arcname=folder.name+'/'+name, recursive=False)
