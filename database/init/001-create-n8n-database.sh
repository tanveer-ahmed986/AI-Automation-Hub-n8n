#!/bin/sh
# Runs once, automatically, via postgres's docker-entrypoint-initdb.d
# mechanism on first container start (empty data volume only).
#
# n8n's own operational tables (credentials, workflow/execution history)
# must not live in the same logical database as this project's business
# tables (Lead, LeadAnalysis, ReplyDraft, ...) — keeps `drizzle-kit`
# migrations scoped to only the tables this app owns.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    SELECT 'CREATE DATABASE ${N8N_DB_NAME}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${N8N_DB_NAME}')\gexec
SQL
