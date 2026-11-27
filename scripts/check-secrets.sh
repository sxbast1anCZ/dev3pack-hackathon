#!/usr/bin/env bash
# Fails if a tracked file looks like a secret. The repository is public.
# Run it before a push: bash scripts/check-secrets.sh
set -u

fail=0
self="scripts/check-secrets.sh"

report() {
  echo "SECRET CHECK: $1"
  fail=1
}

# 1. Files that must never be tracked.
while IFS= read -r file; do
  case "$file" in
    .env.example|*/.env.example) ;;
    .env|.env.*|*/.env|*/.env.*) report "env file is tracked: $file" ;;
    *keypair*.json|id.json|*/id.json) report "keypair file is tracked: $file" ;;
  esac
done < <(git ls-files)

# 2. Content that looks like a key, in tracked files.
check_pattern() {
  local label="$1" pattern="$2" hits
  hits=$(git grep -lIE -e "$pattern" -- . ":!$self" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    report "$label in: $(echo "$hits" | tr '\n' ' ')"
  fi
}

check_pattern "private key block" '-----BEGIN [A-Z ]*PRIVATE KEY-----'
check_pattern "Solana keypair (array of 64 bytes)" '\[([[:space:]]*[0-9]{1,3}[[:space:]]*,){63}[[:space:]]*[0-9]{1,3}[[:space:]]*\]'
check_pattern "JWT (Supabase key?)" 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
check_pattern "Firecrawl API key" 'fc-[a-f0-9]{32}'
check_pattern "API key with sk_ prefix" 'sk_[a-zA-Z0-9]{32,}'

if [ "$fail" -ne 0 ]; then
  echo "Remove the secret, and rotate the key if it was ever pushed."
  exit 1
fi
echo "Secret check passed."
