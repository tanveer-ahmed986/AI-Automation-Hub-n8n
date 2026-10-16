# Implementation Plan: AI Lead Management & Business Automation Hub

**Branch**: `001-lead-management-hub` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-lead-management-hub/spec.md`

## Summary

Build an n8n-orchestrated, human-approved AI lead-qualification and
email-automation hub. A public n8n webhook accepts business inquiries;
testable TypeScript in a Next.js app (not n8n node parameters) validates,
deduplicates, runs a pluggable AI adapter (deterministic mock by default)
against a strict Zod schema, and drafts a reply. A reviewer approves,
edits, or rejects in the dashboard; only an approved draft is ever sent,
through a mock-by-default email adapter, exactly once. Opt-in follow-ups
and a centralized error-handling workflow round out the four n8n
workflows named in `SPEC.md`. Everything works end-to-end with zero paid
credentials (constitution Principle IV), with PostgreSQL as the system of
record and the whole stack running locally via Docker Compose.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x (Active LTS; see
[research.md](./research.md) §1 for why not Node 26)
**Primary Dependencies**: Next.js 16.4.x (App Router), Zod 4.x, Drizzle
ORM + drizzle-kit, Tailwind CSS, shadcn/ui, n8n 2.43.x (self-hosted,
Docker), nodemailer (SMTP email adapter, behind the mock default)
**Storage**: PostgreSQL 18.x, via Docker Compose; Drizzle migrations under
`database/migrations`
**Testing**: Vitest for unit tests (`packages/business-rules`,
`packages/schemas`) and integration tests (HTTP calls against the running
Docker Compose stack) — see [research.md](./research.md) §3 for why no
separate browser-automation framework is added for MVP
**Target Platform**: Linux containers (Docker Compose) for local/demo use;
Linux server for the optional later public-demo phase (`SPEC.md` Phase B)
**Project Type**: Web application — one Next.js app (dashboard UI +
internal API) + one self-hosted n8n instance + one PostgreSQL instance,
plus shared TypeScript packages consumed only by the Next.js app
**Performance Goals**: No hard SLA (spec Assumptions: "a few seconds"
under normal conditions is the informal target; not a contractual budget
for this feature)
**Constraints**: Zero paid credentials required for the full demo path
(FR-043); 60 req/min per source IP default rate limit on the public
webhook (FR-007); 5,000-char default message length cap (FR-003); 24-hour
default dedup window (FR-005); indefinite retention with a documented
manual deletion path in this version (FR-034); single operator role, no
RBAC (Clarifications, 2026-10-15)
**Scale/Scope**: Portfolio/demo scale — a single small business's inbound
inquiries (tens to low hundreds of leads), one operator account, not
multi-tenant (`SPEC.md` §18 Out of Scope)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Human Approval Non-Negotiable | Approval lives only in the Next.js dashboard (the single documented "secured review interface"); every send requires an `approved` draft-version transition recorded with timestamp/action/version/reviewer; no config path auto-sends a first-time draft; dashboard is local/demo-only in this version and documented as such (no public exposure without the auth hardening noted below) | PASS |
| II. Validate Everything, Trust Nothing | Zod schemas at the internal-API boundary for both inbound lead data and AI adapter output; lead message content never executed, only ever passed as data to the AI adapter and into the draft template; n8n Code nodes carry no business-rule logic per [research.md](./research.md) §4 | PASS |
| III. Idempotency and Duplicate Prevention | `idempotency_key` unique index + `(email_normalized, message_fingerprint, created_at)` indexed dedup window at the data layer, not just n8n's execution semantics; `ReplyDraft.version` + atomic approve-transition prevents double-send independent of lead dedup (see [data-model.md](./data-model.md)) | PASS |
| IV. Mock-First, Demo-Safe by Default | `MOCK_AI`/`MOCK_EMAIL`/`DEMO_MODE` default `true`; adapter interfaces make mock the default implementation, not a bypassed code path; visible DEMO MODE indicator is an explicit dashboard requirement (FR-044) | PASS |
| V. Observable Failures, Bounded Recovery | `WorkflowEvent` table + WF-04 error-handler workflow classify every failure; validation failures never auto-retried (FR-040); dead-letter/manual-review path is the `manual_review`/`failed` states already in the data model | PASS |
| VI. Least Privilege, Data Minimization | Internal API is network-isolated plus a shared-secret header; AI adapter receives only the minimum lead fields (FR-012); Drizzle enforces parameterized queries by construction; secrets only in server-side env, never client bundles | PASS |
| VII. Honest Representation | AI-generated content labeling is a dashboard requirement (FR-036); README limitations section is a deliverable in a later milestone, not an architectural concern for this plan | PASS (deferred to docs milestone) |
| Tech constraints (n8n/Postgres/Next.js/Zod/testing/version control) | All satisfied by the stack chosen in [research.md](./research.md) | PASS |

No violations identified. **Complexity Tracking table is not applicable**
(left empty below, per template instructions).

One decision is flagged for an ADR even though it passes the gate — see
"Architecturally significant decision" at the end of this plan.

## Project Structure

### Documentation (this feature)

```text
specs/001-lead-management-hub/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── internal-api.openapi.yaml
│   └── n8n-webhooks.md
└── tasks.md              # Phase 2 output (/sp.tasks — not created by /sp.plan)
```

### Source Code (repository root)

Adopting `SPEC.md` §10's repository structure directly — it already
matches a "web application" layout (one frontend+backend app, shared
packages, separate workflow/database/test trees) with no changes needed:

```text
ai-automation-hub-n8n/
├── docker-compose.yml
├── .env.example
├── workflows/
│   ├── wf-01-lead-intake.json
│   ├── wf-02-approval-email.json
│   ├── wf-03-follow-up-scheduler.json
│   └── wf-04-error-handler.json
├── database/
│   ├── migrations/        # drizzle-kit generated SQL migrations
│   └── seed/               # fictional demo data (Section 4 of quickstart.md)
├── apps/
│   └── dashboard/          # Next.js 16 App Router app: UI + /api/internal/* route handlers
│       ├── app/
│       │   ├── (dashboard)/        # Overview, Leads, Lead detail, Approval queue, Execution log, Settings
│       │   └── api/internal/       # leads/intake, leads/[id]/analyze, drafts/[id]/approve, email/send, followups/due, events
│       └── tests/                  # colocated component/unit tests
├── packages/
│   ├── schemas/             # Zod schemas: lead intake, AI analysis result, draft, events
│   ├── business-rules/      # validation, normalization, dedup, scoring-adjacent rules, approval state machine, follow-up eligibility
│   └── adapters/            # AiLeadAnalysisAdapter (mock + real), EmailAdapter (mock + SMTP)
├── tests/
│   ├── unit/                 # Vitest unit specs for packages/*
│   ├── integration/          # Vitest specs hitting the docker-composed stack end-to-end
│   └── fixtures/              # shared fictional lead payloads
├── docs/
│   ├── architecture.md
│   ├── workflow-catalog.md
│   ├── setup-local.md
│   ├── deployment.md
│   ├── security.md
│   ├── testing.md
│   └── portfolio-demo-script.md
└── scripts/
    ├── health-check.*
    └── demo-reset.*
```

**Structure Decision**: Single Next.js app (`apps/dashboard`) serves both
the reviewer-facing UI and the internal API n8n calls — there is no
separate backend service, because the dashboard's own security
requirements (server-side-only credential handling) already justify an
API layer, and n8n only ever needs to reach that same layer (see
[research.md](./research.md) §4). `packages/*` hold all business logic
as framework-agnostic TypeScript so it's unit-testable without spinning up
Next.js or n8n. `workflows/*.json` are the four real, exported n8n
workflows — none of their responsibilities are secretly reimplemented
in-app instead of in n8n.

## Complexity Tracking

*No entries — the Constitution Check above found no violations requiring
justification.*

## Architecturally significant decision (flag for `/sp.adr`)

📋 **Architectural decision detected**: splitting responsibility so that
n8n stays a thin orchestrator (public webhook, scheduling, retries,
error-routing) while all validation/business-rules/AI-adapter/email-
adapter logic lives in testable TypeScript behind an internal API that
n8n calls — rather than implementing that logic inside n8n Code nodes, or
alternatively bypassing n8n entirely for the approval→send step. This has
long-term consequences for how every future workflow in this project gets
built, genuine alternatives were evaluated (see
[research.md](./research.md) §4), and it's cross-cutting across all four
n8n workflows.

Document reasoning and tradeoffs? Run `/sp.adr n8n-as-orchestrator-vs-business-logic-in-app`.

*(Waiting for your consent — this is not auto-created.)*
