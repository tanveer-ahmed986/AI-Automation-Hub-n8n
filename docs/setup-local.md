# Local Setup

This documents the **actual** steps to bring this stack up from zero,
including the manual n8n first-run steps that `quickstart.md` originally
described as fully automatic but are not, as built (see the note in step 4
below) — corrected here per `docs/testing.md`'s T068 end-to-end walkthrough
and the constitution's Honest Representation principle (no silently
optimistic setup docs).

## 1. Prerequisites

- Docker + Docker Compose
- Node.js 24.x and pnpm (for running tests/lint/seed scripts outside
  containers)
- No paid API keys required for the full demo path

## 2. Configure environment

```bash
cp .env.example .env
```

Defaults in `.env.example` already set `DEMO_MODE=true`, `MOCK_AI=true`,
`MOCK_EMAIL=true` — the demo path works with zero further edits
(constitution Principle IV).

**Port conflicts**: if `5432`, `5678`, or `3000` are already in use on your
machine (common for `5432`/`3000` on a dev workstation), set
`POSTGRES_HOST_PORT` / `N8N_HOST_PORT` / `DASHBOARD_HOST_PORT` in `.env` to
free alternatives before starting — the containers always talk to each
other on the standard ports *inside* the Docker network regardless of
these values, so nothing else needs to change. Every command below that
references a host port assumes the defaults; substitute your overrides if
you set any.

## 3. Start the stack

```bash
docker compose up -d
```

Brings up PostgreSQL 18, n8n 2.43.5, and the Next.js dashboard. Wait for
all three to report healthy:

```bash
./scripts/health-check.sh
```

## 4. Complete n8n first-run setup (manual — not automated)

**Correction to an earlier design assumption**: the `./workflows` folder is
mounted into the n8n container read-only (`/workflows`) so the JSON files
are *available* for import, but nothing in this stack auto-imports or
auto-activates them on startup, and n8n ships its own user-management
system rather than accepting `N8N_BASIC_AUTH_*` (verified live against the
pinned image — see `docker-compose.yml`'s own comment). The steps below
are genuinely manual the first time a fresh `n8n-data` volume is created.

1. Open `http://localhost:5678`. On a fresh volume this shows the owner
   account setup wizard. Complete it with a local, non-sensitive
   credential — this demo instance uses email `admin@automation-hub.local`,
   password `DemoOwner123` (not a secret worth protecting further: this
   instance only ever binds to `127.0.0.1`, and `DEMO_MODE`/`MOCK_AI`/
   `MOCK_EMAIL` keep it demo-only regardless — see `docs/security.md`).
   Use a real secret instead if you ever point this setup at anything
   beyond `127.0.0.1`.
2. Create the shared internal-API credential: **Credentials → New → HTTP
   Header Auth**, name it exactly `Internal API Secret`, header name
   `X-Internal-Api-Secret`, value = this deployment's `INTERNAL_API_SECRET`
   from `.env`.
3. Import all four workflows: **Workflows → Import from File**, one at a
   time, for each of `workflows/wf-01-lead-intake.json` through
   `wf-04-error-handler.json`.
   **Known gotcha**: each workflow's HTTP Request nodes reference the
   "Internal API Secret" credential *by the id it had at export time*. A
   freshly created credential on your instance will have a different id,
   so after import, open each HTTP Request node showing a broken
   credential reference and reselect **Internal API Secret** from the
   dropdown (it resolves by name in the UI even though the JSON stores an
   id) — then save the workflow.
4. Wire error handling: for each of WF-01, WF-02, and WF-03 — **Settings**
   (⋯ menu) → **Error Workflow** → select "WF-04 - Error Handler". (WF-04
   itself needs no error workflow set.) Verify this stuck per
   `docs/runbook.md`'s closing section.
5. Activate all four workflows (the toggle in each workflow's top bar).

## 5. Re-authenticating to n8n from a script (no saved browser session)

A one-off browser login works for manual use, but for scripted/CLI access
(curl, CI, a future automation), log in via n8n's REST API instead of
relying on an exported browser cookie — this is fully repeatable and
doesn't expire the way a copied browser session eventually does:

```bash
curl -c cookiejar.txt -X POST http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"admin@automation-hub.local","password":"DemoOwner123"}'

# Subsequent calls reuse the session cookie:
curl -b cookiejar.txt http://localhost:5678/rest/workflows
```

**If you lose access entirely** (no saved cookie, credentials forgotten):
reset the instance's user accounts without losing workflow/credential data
(both live in the same Postgres database, but the reset only touches the
`n8n` logical database's user table):

```bash
docker compose exec n8n n8n user-management:reset
```

Then repeat step 4's owner setup with a credential you'll remember (or the
documented demo one above) — your imported workflows, the "Internal API
Secret" credential, and all execution history survive this reset
unaffected (confirmed live: a full reset during this project's Phase 6
development left all three existing workflows and the shared credential
intact).

## 6. Run migrations and seed data

```bash
pnpm db:migrate
pnpm db:seed
```

Seeds five fictional leads covering: a clean pending-review lead, an
already-approved-and-sent lead, a spam-classified lead, a lead with a
scheduled follow-up, and a failed-analysis lead routed to manual review —
enough to exercise every dashboard screen without submitting anything
manually.

**Running these from the host, not inside a container**: the shell's
`DATABASE_URL` (from `.env`) points at the Docker-internal hostname
`postgres`, which the host machine cannot resolve. Override it to the
host-mapped port for any script run outside Docker:

```bash
DATABASE_URL="postgresql://automation_user:<your POSTGRES_PASSWORD>@localhost:${POSTGRES_HOST_PORT:-5432}/automation_hub" pnpm db:seed
```

(PowerShell: `$env:DATABASE_URL = "..."; pnpm db:seed`.)

## 7. Submit a demo lead

```bash
curl -X POST http://localhost:5678/webhook/lead-intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "message": "We need a new business website with online booking.",
    "service": "website_development",
    "consent_to_follow_up": true
  }'
```

Expect `{"status":"received","reference":"<uuid>"}` within a few seconds.

## 8. Review and approve

1. Open the dashboard at `http://localhost:3000` (or your
   `DASHBOARD_HOST_PORT` override).
2. Find the new lead in the **Approval Queue** — it shows the DEMO MODE
   indicator and the AI-generated (mock) draft, clearly labeled as
   AI-generated and advisory.
3. Approve it. The Execution Log shows a `delivery` event, and the draft's
   status moves to `sent`.
4. Try approving the same draft again — confirm it reports `already_sent`
   and does **not** create a second delivery event.

## 9. Run tests

```bash
pnpm test              # Vitest unit tests
pnpm test:integration   # Vitest integration tests against the running stack
pnpm typecheck
pnpm lint
```

## 10. Switch to a live AI or email provider (optional)

Edit `.env`: set `AI_PROVIDER` / `AI_API_KEY` and/or `EMAIL_PROVIDER` /
`SMTP_*`, then restart (`docker compose up -d --build dashboard`).
`MOCK_AI` / `MOCK_EMAIL` must be explicitly set to `false` — there is no
partial/implicit live mode (constitution Principle IV: a present-but-unused
key must not flip the system into a half-live state). See
`docs/security.md` for the credential-handling requirements this implies.

## 11. Tear down

```bash
docker compose down -v
```

`-v` removes the seeded Postgres volume (and n8n's own data volume) —
intentional for a demo reset; never run this against a real deployment
with real client data. For a reset that keeps the containers running and
just restores a clean demo state, use `scripts/demo-reset.sh` /
`demo-reset.ps1` instead.

## Troubleshooting

- **A dashboard container rebuild is needed, not just a restart**, after
  any change under `apps/dashboard` or `packages/*` — the image is a
  built standalone Next.js output, not a volume-mounted dev server:
  `docker compose up -d --build dashboard`.
- **`getaddrinfo ENOTFOUND postgres`** running a script from the host: see
  step 6's `DATABASE_URL` override.
- **A workflow's HTTP node shows a broken credential after import**: see
  step 4's gotcha.
- **WF-04 never fires during testing**: if you're triggering executions
  via `POST /rest/workflows/{id}/run`, that always runs with
  `mode: "manual"`, which n8n's error-workflow mechanism does not invoke —
  use a real call to the workflow's actual trigger (a genuine webhook
  POST, or let the Schedule Trigger fire) instead. See
  `docs/workflow-catalog.md`'s WF-04 entry.
