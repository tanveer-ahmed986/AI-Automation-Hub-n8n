# Restores a clean, fictional demo state without tearing down the stack:
# re-runs migrations and re-seeds leads/analyses/drafts/events/follow-ups
# (database/seed truncates and re-inserts - see database/seed/index.ts).
# Use this before a demo/recording, or after running integration tests
# (tests/integration/follow-up.test.ts's time-travel override can
# fast-forward a seeded follow-up - see docs/testing.md).
#
# Requires: docker compose stack already running and healthy
# (./scripts/health-check.sh), pnpm installed on the host.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env")) {
    Write-Error "No .env found - copy .env.example to .env first."
    exit 1
}

function Get-EnvValue($name) {
    $line = Get-Content ".env" | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
    if ($null -eq $line) { return "" }
    return ($line -split "=", 2)[1]
}

# Host-run scripts must reach Postgres via the host-mapped port, not the
# Docker-internal service name "postgres" (see docs/setup-local.md §6).
$pgUser = Get-EnvValue "POSTGRES_USER"
$pgPassword = Get-EnvValue "POSTGRES_PASSWORD"
$pgDb = Get-EnvValue "POSTGRES_DB"
$pgHostPort = Get-EnvValue "POSTGRES_HOST_PORT"
if ([string]::IsNullOrEmpty($pgHostPort)) { $pgHostPort = "5432" }

if ([string]::IsNullOrEmpty($pgUser) -or [string]::IsNullOrEmpty($pgPassword) -or [string]::IsNullOrEmpty($pgDb)) {
    Write-Error "POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB missing from .env."
    exit 1
}

$env:DATABASE_URL = "postgresql://${pgUser}:${pgPassword}@localhost:${pgHostPort}/${pgDb}"

$health = (docker compose ps --format '{{.Service}} {{.Health}}' 2>$null) -split "`n" |
    Where-Object { $_ -match '^postgres\s' } |
    ForEach-Object { ($_ -split '\s+')[1] }

if ($health -ne "healthy") {
    Write-Error "Postgres is not healthy (docker compose up -d first; see ./scripts/health-check.sh)."
    exit 1
}

Write-Host "Running migrations..."
pnpm db:migrate

Write-Host "Re-seeding fictional demo data..."
pnpm db:seed

Write-Host ""
Write-Host "Demo state reset. All data is fictional (database/seed/leads.ts)."
