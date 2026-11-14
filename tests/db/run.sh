#!/usr/bin/env bash
# Fresh DB -> Supabase stub -> all migrations -> scenario tests.
# Usage: DATABASE_URL=postgres://user:pass@localhost:5432/postgres tests/db/run.sh
# (needs a plain local Postgres 15+; does NOT need Supabase or Docker)
set -euo pipefail
cd "$(dirname "$0")/../.."

ADMIN_URL="${DATABASE_URL:-postgres://${PGUSER:-$(whoami)}@localhost:5432/postgres}"
DB="k7_test_$$"
psql "$ADMIN_URL" -q -c "drop database if exists $DB" -c "create database $DB"
trap 'psql "$ADMIN_URL" -q -c "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT
TEST_URL="${ADMIN_URL%/*}/$DB"

psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f tests/db/testkit.sql
psql "$TEST_URL" -q -t -A -v ON_ERROR_STOP=1 -f tests/db/scenarios.sql | grep -E 'PASSED' || exit 1
bash tests/db/concurrency.sh "$TEST_URL"
