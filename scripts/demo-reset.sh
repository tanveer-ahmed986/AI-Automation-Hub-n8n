#!/bin/sh
# Restores a clean, fictional demo state without tearing down the stack:
# re-runs migrations and re-seeds leads/analyses/drafts/events/follow-ups
# (database/seed truncates and re-inserts — see database/seed/index.ts).
# Use this before a demo/recording, or after running integration tests
# (tests/integration/follow-up.test.ts's time-travel override can
# fast-forward a seeded follow-up — see docs/testing.md).
#
# Requires: docker compose stack already running and healthy
# (./scripts/health-check.sh), pnpm installed on the host.
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env found — copy .env.example to .env first." >&2
  exit 1
fi

# Host-run scripts must reach Postgres via the host-mapped port, not the
# Docker-internal service name "postgres" (see docs/setup-local.md §6).
POSTGRES_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)
POSTGRES_HOST_PORT=$(grep -E '^POSTGRES_HOST_PORT=' .env | cut -d= -f2-)
POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT:-5432}

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
  echo "POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB missing from .env." >&2
  exit 1
fi

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_HOST_PORT}/${POSTGRES_DB}"

health=$(docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1 == "postgres" { print $2 }')
if [ "$health" != "healthy" ]; then
  echo "Postgres is not healthy (docker compose up -d first; see ./scripts/health-check.sh)." >&2
  exit 1
fi

echo "Running migrations..."
pnpm db:migrate

echo "Re-seeding fictional demo data..."
pnpm db:seed

echo
echo "Demo state reset. All data is fictional (database/seed/leads.ts)."
