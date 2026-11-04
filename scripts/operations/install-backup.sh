#!/bin/sh
# Inputs are PUBLIC recipient keys and a PUBLIC SSH export key, never secrets.
set -eu
test "$(id -u)" -eq 0
test "$#" -eq 2 || { echo 'Usage: install-backup.sh RECIPIENTS_FILE EXPORT_PUBLIC_KEY_FILE' >&2; exit 2; }
recipients=$1
export_key=$2
test -f "$recipients"
test -f "$export_key"
test "$(awk 'NF && $1 !~ /^#/ {n++} END {print n+0}' "$export_key")" -eq 1
grep -q '^ssh-ed25519 [A-Za-z0-9+/=]*' "$export_key"
ssh-keygen -l -f "$export_key" >/dev/null
printf '' | age -R "$recipients" >/dev/null
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
if ! id codelily-backup >/dev/null 2>&1; then
    useradd --system --create-home --home-dir /var/lib/codelily-backup --shell /bin/sh codelily-backup
fi
test "$(getent passwd codelily-backup | cut -d: -f6)" = /var/lib/codelily-backup
test "$(id -Gn codelily-backup)" = codelily-backup
install -d -m 0750 -o root -g codelily-backup /var/lib/codelily-backup
install -d -m 0755 -o root -g root /var/lib/codelily-backup/.ssh
key=$(awk '{print $1 " " $2}' "$export_key")
printf 'restrict,command="/usr/local/sbin/codelily-export-backups" %s codelily-backup-readonly\n' "$key" > /var/lib/codelily-backup/.ssh/authorized_keys
chmod 0644 /var/lib/codelily-backup/.ssh/authorized_keys
install -m 0644 "$recipients" /etc/codelily-backup.recipients
install -m 0755 "$root/scripts/operations/export-backups.py" /usr/local/sbin/codelily-export-backups
install -m 0644 "$root/infra/security/codelily-backup.service" "$root/infra/security/codelily-backup.timer" /etc/systemd/system/
sshd -t
systemctl daemon-reload
systemctl enable --now codelily-backup.timer
echo 'Encrypted backup timer and forced-command read-only export configured.'
