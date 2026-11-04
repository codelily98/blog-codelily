#!/usr/bin/env python3
"""Install host-only security controls; never flush Docker firewall tables.

Run as root from a prepared checkout AFTER a separate ubuntu SSH/sudo login.
The operator must cancel the rollback timer only after another new login works.
"""
import argparse
import ipaddress
import os
from pathlib import Path
import shutil
import subprocess


def firewall(sources):
    addresses = sorted({str(ipaddress.IPv4Address(value)) for value in sources})
    if not addresses:
        raise ValueError('At least one explicit SSH source is required')
    return '''flush table inet codelily_host
table inet codelily_host {
  chain input {
    type filter hook input priority 0; policy drop;
    iifname "lo" accept
    ct state established,related accept
    ct state invalid drop
    meta l4proto { icmp, ipv6-icmp } accept
    udp sport 67 udp dport 68 accept
    ip6 saddr fe80::/10 udp sport 547 udp dport 546 accept
    ip saddr { %s } tcp dport 22 accept
  }
}
''' % ', '.join(addresses)


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ssh-source', action='append', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rules = firewall(args.ssh_source)
    if not args.apply:
        print('Validated host INPUT policy; pass --apply after admin login verification.')
        return
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    root = Path(__file__).resolve().parents[2]
    source = root / 'infra/security'
    backup = Path('/var/lib/codelily-security/before-20261104')
    if backup.exists():
        raise SystemExit('Existing rollback snapshot found; review before reapplying')
    backup.mkdir(parents=True, mode=0o700)
    os.chmod(backup.parent, 0o700)
    files = {
        Path('/etc/ssh/sshd_config.d/00-codelily-security.conf'): (source/'sshd.conf').read_text(),
        Path('/etc/apt/apt.conf.d/99-codelily-security'): (source/'apt-periodic.conf').read_text(),
        Path('/etc/systemd/journald.conf.d/codelily.conf'): (source/'journald.conf').read_text(),
        Path('/etc/systemd/system/apt-daily-upgrade.timer.d/codelily.conf'): (source/'apt-upgrade.timer.conf').read_text(),
        Path('/etc/codelily-host-firewall.nft'): rules,
        Path('/usr/local/sbin/codelily-host-firewall'): '''#!/bin/sh
set -eu
/usr/sbin/nft list table inet codelily_host >/dev/null 2>&1 || /usr/sbin/nft add table inet codelily_host
exec /usr/sbin/nft -f /etc/codelily-host-firewall.nft
''',
        Path('/etc/systemd/system/codelily-host-firewall.service'): '''[Unit]
Description=Codelily host INPUT firewall (Docker forwarding unchanged)
After=network-pre.target
Before=network.target docker.service ssh.service
Wants=network-pre.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/codelily-host-firewall
ExecReload=/usr/local/sbin/codelily-host-firewall
[Install]
WantedBy=multi-user.target
''',
    }
    restore = ['#!/bin/sh', 'set -eu']
    for index, path in enumerate(files):
        if path.exists():
            saved = backup / str(index)
            shutil.copy2(path, saved)
            restore.append(f'cp -p {saved} {path}')
        else:
            restore.append(f'rm -f {path}')
    restore += ['systemctl disable codelily-host-firewall.service || true',
                'nft delete table inet codelily_host || true',
                'systemctl daemon-reload', 'sshd -t', 'systemctl reload ssh.service']
    rollback = backup / 'rollback.sh'
    rollback.write_text('\n'.join(restore) + '\n')
    rollback.chmod(0o700)
    run('systemd-run', '--unit=codelily-security-rollback', '--on-active=10m', str(rollback))
    try:
        for path, content in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
            path.chmod(0o755 if path.name == 'codelily-host-firewall' else 0o644)
        run('sshd', '-t')
        run('nft', 'add', 'table', 'inet', 'codelily_host')
        run('nft', '-c', '-f', '/etc/codelily-host-firewall.nft')
        run('systemctl', 'daemon-reload')
        run('systemctl', 'enable', '--now', 'codelily-host-firewall.service')
        run('systemctl', 'reload', 'ssh.service')
        run('systemctl', 'restart', 'systemd-journald.service')
        run('systemctl', 'enable', '--now', 'apt-daily.timer', 'apt-daily-upgrade.timer')
        run('systemctl', 'restart', 'apt-daily-upgrade.timer')
        print('Applied. Verify a NEW ubuntu SSH/sudo connection, then stop codelily-security-rollback.timer.')
    except Exception:
        run(str(rollback))
        raise


if __name__ == '__main__':
    main()
