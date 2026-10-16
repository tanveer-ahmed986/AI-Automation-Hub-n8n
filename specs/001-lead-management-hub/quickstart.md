# Quickstart: AI Lead Management & Business Automation Hub

This describes the intended local developer/reviewer experience once this
plan is implemented. It is a design target for `/sp.tasks` and
implementation, not a claim that these commands exist yet.

## 1. Prerequisites

- Docker + Docker Compose
- Node.js 24.x (for running tests/lint outside containers, if desired)
- No paid API keys required for the full demo path

## 2. Configure environment

```bash
cp .env.example .env
```

Defaults in `.env.example` MUST already set `DEMO_MODE=true`,
`MOCK_AI=true`, `MOCK_EMAIL=true` — the demo path works with zero edits
(constitution Principle IV).

## 3. Start the stack

```bash
docker compose up -d
```

Brings up PostgreSQL 18, n8n 2.43.x, and the Next.js dashboard app.
**The four workflows are not auto-imported** — n8n's stock image has no
mechanism for that, and this stack doesn't add one. Complete n8n's
first-run owner setup and import/activate the four workflows manually —
see [`docs/setup-local.md`](../../docs/setup-local.md) §4 for the exact,
verified steps (including a credential-reassignment gotcha after import).

## 4. Run migrations and seed data

```bash
pnpm db:migrate
pnpm db:seed
```

Running these from the host (not inside a container) requires overriding
`DATABASE_URL` to the host-mapped Postgres port — see
[`docs/setup-local.md`](../../docs/setup-local.md) §6.

Seeds fictional leads covering: a clean pending-review lead, an already-
approved-and-sent lead, a spam-classified lead, a lead with a scheduled
follow-up, and a failed-analysis lead routed to manual review — enough to
exercise every dashboard screen without submitting anything manually.

## 5. Submit a demo lead

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

Expect: `{"status":"received","reference":"<uuid>"}` within a few seconds
(no hard SLA per spec Assumptions, but this should feel instant in
practice).

## 6. Review and approve

1. Open the dashboard at `http://localhost:3000`.
2. Find the new lead in the **Approval queue** — it should show a
   DEMO MODE indicator, the AI-generated (mock) summary/score/draft,
   clearly labeled as AI-generated.
3. Approve it. Confirm the execution log shows a `delivery` event with
   `mock: true` and the draft's status moves to `sent` — the draft also
   disappears from the Approval Queue, since there's nothing left pending
   on it.
4. Confirm a repeat approval is safe: the UI no longer offers a button
   for an already-sent draft, so this specifically means replaying the
   identical approval request (e.g. `pnpm test:integration`'s
   `approval-flow.test.ts`, or a direct repeat POST to n8n's
   `/webhook/approval-action` with the same `draftId`/`draftVersion`) and
   confirming it reports `already_sent` with **no** second `delivery`
   event in the execution log.

## 7. Exercise a failure path

Submit a malformed payload (missing `email`) to the same webhook and
confirm: a clear validation response, no lead created, and a safe
validation-failure summary visible in the dashboard's **Execution log**
screen. `/api/internal/events` *is* reachable from the host (it's bound to
`127.0.0.1`, same as the dashboard itself) but requires the
`X-Internal-Api-Secret` header on every request — see `docs/security.md`.

## 8. Run tests

```bash
pnpm test              # Vitest unit tests
pnpm test:integration   # Vitest integration tests against the running stack
```

## 9. Switch to a live AI or email provider (optional, later milestone)

Edit `.env`: set `AI_PROVIDER` / `AI_API_KEY` and/or `EMAIL_PROVIDER` /
`SMTP_*`, then restart. `MOCK_AI` / `MOCK_EMAIL` must be explicitly set to
`false` — there is no partial/implicit live mode (constitution Principle
IV: a present-but-unused key must not flip the system into a half-live
state).

## 10. Tear down

```bash
docker compose down -v
```

`-v` removes the seeded Postgres volume — intentional for a demo reset;
never run this against a real deployment with real client data.
