# Architecture: Z&T AI Automation Hub

This describes the system as actually built (not as originally planned) —
cross-check against [`specs/001-lead-management-hub/plan.md`](../specs/001-lead-management-hub/plan.md)
and [`research.md`](../specs/001-lead-management-hub/research.md) §4 for
the design rationale behind the split described here.

## System diagram

```text
                         ┌─────────────────────────────┐
  public website form ──▶│  n8n (Docker, port 5678)    │
  or any HTTP client     │  ─ public webhook surface   │
                         │  ─ scheduling (follow-ups)  │
                         │  ─ retries / backoff        │
                         │  ─ error routing (WF-04)    │
                         └──────────────┬──────────────┘
                                        │ HTTP, same Docker network,
                                        │ X-Internal-Api-Secret header
                                        ▼
                         ┌─────────────────────────────┐
  reviewer (browser) ───▶│  Next.js dashboard           │
  http://localhost:3000  │  (Docker, port 3000)         │
                         │  ─ (dashboard)/* UI pages    │
                         │  ─ /api/internal/* route     │
                         │    handlers (business logic) │
                         │  ─ packages/schemas          │
                         │  ─ packages/business-rules   │
                         │  ─ packages/adapters         │
                         └──────────────┬──────────────┘
                                        │ Drizzle (parameterized SQL)
                                        ▼
                         ┌─────────────────────────────┐
                         │  PostgreSQL (Docker, 5432)   │
                         │  ─ app tables (this feature) │
                         │  ─ a separate n8n database   │
                         │    on the same instance      │
                         └─────────────────────────────┘
```

All three services run under one `docker compose up -d` (see
[`docker-compose.yml`](../docker-compose.yml)) on a single bridge network
(`automation-hub`); only the host-mapped ports are reachable from outside
Docker, and those are bound to `127.0.0.1` (see `docs/security.md`).

## Why business logic lives in the Next.js app, not in n8n

n8n stays a thin **orchestrator**: it owns the public webhook surface,
scheduling, step-level retries/backoff, and error routing. Validation,
scoring-adjacent business rules, AI-adapter calls, email-adapter calls, and
persistence all live in testable TypeScript inside `apps/dashboard` and
`packages/*`, reachable from n8n only through a small, non-public
**internal API** under `/api/internal/*`. This is the one decision in the
plan flagged as architecturally significant — see
[`research.md`](../specs/001-lead-management-hub/research.md) §4 for the
full alternatives analysis (an ADR was offered and declined; this doc is
the durable record of the decision instead).

Concretely, this means:
- Every `/api/internal/*` route handler is unit/integration-testable with
  Vitest, without spinning up n8n at all.
- n8n workflow JSON (`workflows/*.json`) never contains business-rule
  logic in a Code node — only HTTP calls, conditionals on the API's
  response, and n8n's own trigger/schedule/error-routing primitives.
- Switching the AI or email adapter from mock to live (`docs/setup-local.md`
  §9) never requires touching a workflow — the adapter interface boundary
  is entirely inside `packages/adapters`.

## Request flow: a lead's path through the system

1. **Intake** (WF-01): an external POST to `http://localhost:5678/webhook/lead-intake`
   hits n8n's Webhook node, which forwards the body almost unmodified to
   `POST /api/internal/leads/intake`. That route validates/normalizes the
   payload (Zod, `packages/schemas`), checks the idempotency key / dedup
   window (`packages/business-rules`), and persists a `Lead` row.
2. **Analysis**: WF-01 then calls `POST /api/internal/leads/{id}/analyze`,
   which invokes the configured `AiLeadAnalysisAdapter` (mock by default),
   validates its output against a strict Zod schema, and persists a
   `LeadAnalysis` + a first `ReplyDraft` version — or, on a schema failure,
   leaves the lead at `pending_review` with no fabricated analysis and
   logs a `WorkflowEvent` (classification `ai_provider`).
3. **Review**: the reviewer opens the dashboard's Approval Queue
   (`apps/dashboard/app/(dashboard)/approvals/page.tsx`), which reads
   pending drafts directly from Postgres (no n8n round-trip to display
   data — n8n is only ever involved in the *send* path, not reads).
4. **Approval + send** (WF-02): approving, editing-then-approving, or
   rejecting calls a Next.js Server Action
   (`apps/dashboard/app/(dashboard)/approvals/actions.ts`), which — for an
   edit — first creates a new `ReplyDraft` version directly via the
   repository layer, then always calls n8n's
   `POST /webhook/approval-action` webhook. WF-02 re-validates the draft
   is still the current pending version (`POST /api/internal/drafts/{id}/approve`,
   atomic transition — this is what makes a duplicate click or retry safe),
   and only on a genuine `approved` result calls
   `POST /api/internal/email/send` (mock or live `EmailAdapter`).
5. **Follow-up** (WF-03): a Schedule Trigger periodically calls
   `POST /api/internal/followups/due`, which re-checks consent, opt-out,
   and reply status (`packages/business-rules`) before returning eligible
   follow-ups; each one goes through the same approval/email path as step 4.
6. **Failure handling** (WF-04): any of WF-01/02/03's own routes that
   detect a failure classify and log it themselves via
   `POST /api/internal/events` (e.g. `validation`, `ai_provider`,
   `email_delivery`). Anything that crashes a workflow *before* it reaches
   that logging — a genuinely unexpected failure — is caught by n8n's
   native Error Trigger (WF-04), wired via each workflow's
   `settings.errorWorkflow`, and logged with `classification: "unexpected"`.
   See `docs/runbook.md` for the full per-classification recovery guide.

## Why the dashboard calls n8n for approval+send instead of sending directly

The simpler implementation would have the dashboard's Server Action call
the `EmailAdapter` in-process and skip the webhook round-trip entirely.
This was considered and rejected for this project specifically because
WF-02 is a named, portfolio-relevant deliverable (`SPEC.md` §17: "Sanitized
n8n workflow exports," a demo video showing "approval → mock send → event
log") — bypassing it would leave a real workflow file in the repo that the
system never actually uses. See `research.md` §4 for the full tradeoff.

## Repository layout reference

| Path | Responsibility |
|---|---|
| `apps/dashboard/app/(dashboard)/*` | Reviewer-facing UI pages (Overview, Leads, Approvals, Execution Log, Settings) |
| `apps/dashboard/app/api/internal/*` | The internal API n8n and the dashboard's own Server Actions call |
| `apps/dashboard/lib/repositories/*` | Drizzle data-access functions, one module per entity |
| `apps/dashboard/lib/internal-api-auth.ts` | Shared-secret header verification for every internal route |
| `packages/schemas` | Zod schemas: lead intake, AI analysis result |
| `packages/business-rules` | Validation, normalization, dedup, approval state machine, follow-up eligibility, error classification |
| `packages/adapters` | `AiLeadAnalysisAdapter` (mock + real) and `EmailAdapter` (mock + SMTP) |
| `workflows/*.json` | The four real, exported n8n workflows — see `docs/workflow-catalog.md` |
| `database/` | Drizzle schema, migrations, and fictional seed data |

## Related docs

- `docs/workflow-catalog.md` — node-by-node detail for each of the four n8n workflows
- `docs/setup-local.md` — how to actually bring this stack up from zero
- `docs/security.md` — network isolation, secret handling, data minimization
- `docs/testing.md` — what's tested and how to run it
- `docs/runbook.md` — operator recovery guide for the Execution Log
