#!/usr/bin/env bash
set -euo pipefail
if [[ ! -t 0 ]]; then
  printf 'Run interactively with ssh -t; tokens must not be command arguments.\n' >&2
  exit 1
fi
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
secret_directory="$project_root/infra/secrets"
[[ -d "$secret_directory" ]] || { printf 'Run setup-production.mjs first.\n' >&2; exit 1; }
chmod 0700 "$secret_directory"
umask 077
temporary_file=''
trap '[[ -z "$temporary_file" ]] || rm -f -- "$temporary_file"' EXIT
for name in cloudflare-tunnel-token cloudflare-dns-token; do
  target_file="$secret_directory/$name.txt"
  if [[ -s "$target_file" ]]; then
    printf '%s: already configured; preserved.\n' "$name"
    continue
  fi
  printf '%s (token only; input hidden): ' "$name"
  IFS= read -r -s token_value
  printf '\n'
  if [[ -z "$token_value" || "$token_value" == *[[:space:]]* ]]; then
    printf 'Empty token or whitespace detected; nothing saved for this field.\n' >&2
    exit 1
  fi
  if [[ "$name" == cloudflare-dns-token && ! "$token_value" =~ ^[A-Za-z0-9_-]{35,50}$ && ! "$token_value" =~ ^cf(ut|at)_[A-Za-z0-9_-]{32,256}$ ]]; then
    printf 'Unsupported Cloudflare API token format; value was not saved.\n' >&2
    exit 1
  fi
  temporary_file="$(mktemp "$secret_directory/.token.XXXXXX")"
  printf '%s' "$token_value" > "$temporary_file"
  unset token_value
  chmod 0444 "$temporary_file"
  mv -f -- "$temporary_file" "$target_file"
  temporary_file=''
  printf '%s: saved (value omitted).\n' "$name"
done
