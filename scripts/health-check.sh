#!/bin/sh
# Verifies Postgres, n8n, and the dashboard app are all reachable, per
# docker-compose.yml's own healthcheck definitions. Run after
# `docker compose up -d`. Exits non-zero if any service is unhealthy.
set -eu

cd "$(dirname "$0")/.."

compose_project() {
  docker compose ps --format '{{.Service}} {{.Health}}' 2>/dev/null
}

echo "Checking ai-automation-hub service health..."

missing=0
for service in postgres n8n dashboard; do
  health=$(compose_project | awk -v s="$service" '$1 == s { print $2 }')
  if [ -z "$health" ]; then
    echo "  [MISSING] $service — not running (docker compose up -d first)"
    missing=1
  elif [ "$health" = "healthy" ]; then
    echo "  [OK]      $service"
  else
    echo "  [$health] $service"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo
  echo "One or more services are not healthy yet. If you just ran"
  echo "'docker compose up -d', wait a few seconds and re-run this script —"
  echo "startup (especially n8n) can take longer than the first check."
  exit 1
fi

echo
echo "All services healthy."
