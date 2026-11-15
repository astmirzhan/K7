#!/usr/bin/env bash
# Apply supabase/migrations to the hosted project through the IPv4 pooler.
# Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD from .env.local.
# Usage: bash scripts/db-push.sh           (dry run: shows what would be applied)
#        bash scripts/db-push.sh --apply   (applies)
set -euo pipefail
cd "$(dirname "$0")/.."

val() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2-; }
REF=$(val NEXT_PUBLIC_SUPABASE_URL | sed -E 's#https://([a-z0-9]+)\.supabase\.co.*#\1#')
PASS=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$(val SUPABASE_DB_PASSWORD)")
REGION_HOST="${SUPABASE_POOLER_HOST:-aws-0-us-east-1.pooler.supabase.com}"
URL="postgresql://postgres.${REF}:${PASS}@${REGION_HOST}:5432/postgres?sslmode=require"

if [ "${1:-}" = "--apply" ]; then
  supabase db push --db-url "$URL" --yes
  psql "$URL" -q -c "notify pgrst, 'reload schema';"
  echo "applied; API schema cache reloaded"
else
  supabase db push --db-url "$URL" --dry-run
fi
