# Research: AI Lead Management & Business Automation Hub

**Date**: 2026-10-15
**Feature**: [spec.md](./spec.md) | **Constitution**: [constitution.md](../../.specify/memory/constitution.md)

This file resolves every `NEEDS CLARIFICATION` in the plan's Technical
Context and records the architectural decisions needed before Phase 1
design. `SPEC.md` and the constitution already fix most technology choices
(n8n, PostgreSQL, Next.js, Tailwind, Zod, Docker Compose) — the open
questions here are specific version pins (verified externally rather than
assumed, per the constitution's Authoritative Source Mandate) and the
handful of architectural decisions `SPEC.md` left to implementation.

## 1. Version pins

All versions below were verified via web search on 2026-10-15 (today),
not assumed from training data, because the constitution requires
external verification over internal assumption for anything that drifts
over time.

| Component | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| n8n | `2.43.x` (Docker tag `n8nio/n8n:2.43.5` at plan time; pin exact patch at setup, re-verify against Docker Hub/release notes before first `docker compose up`) | Current stable release line as of October 2026; beta (`2.44.x`) is explicitly excluded by the constitution's "validate against the actual installed n8n version" rule — don't build against a beta. | Pinning `latest` (rejected: non-reproducible builds; constitution requires deliberate, pinned dependency updates). |
| Node.js | `24.x` (Active LTS) | Node 24 is Active LTS as of October 2026 with the long support window; Node 26 only entered Active LTS on 2026-10-28, too recent for a portfolio project to depend on for ecosystem/package compatibility. | Node 26 (rejected: just became LTS, higher risk of third-party package incompatibility); Node 22 (rejected: Maintenance LTS only, shorter remaining support window). |
| Next.js | `16.4.x` (App Router) | Current stable release (16.4.0 shipped 2026-10-06) with React 19.3 support and Cache Components enabled by default in `create-next-app` — aligns with the dashboard's read-heavy views (lead list, execution log) benefiting from Cache Components' explicit `use cache` boundaries. | Pages Router (rejected: legacy pattern, no reason to choose it for a greenfield app); Next.js 15 (rejected: no reason to pin an older major when 16 is stable and current). |
| PostgreSQL | `18.x` (Docker tag `postgres:18`) | Current stable major as of October 2026 (18.6 latest minor); PostgreSQL 19 is still in beta and unsuitable for even a demo project per the constitution's "do not blindly install" / deliberate-versioning principle. | PostgreSQL 19 beta (rejected: not stable); PostgreSQL 17 (rejected: no reason to pin an older major when 18 is stable). |
| Zod | `4.x` (`^4.6`) | Zod 4 is the current stable major (4.6.7 latest as of October 2026); the whole schema-validation story (lead intake validation, AI-output schema validation) is built on it per the constitution's explicit "Zod or equivalent" requirement. | Valibot/ArkType (rejected: smaller bundle size is irrelevant server-side here; Zod is the constitution-named default and has the deepest ecosystem support for this use case). |

## 2. ORM / data-access layer

**Decision**: Drizzle ORM + `drizzle-kit` for schema definition and
migrations, wrapped behind a small repository module per entity
(`packages/business-rules` or a dedicated `packages/data-access`) so the
constitution's "repository/data-access boundary" requirement is met
explicitly, not just incidentally.

**Rationale**: For a greenfield Next.js + PostgreSQL project in 2026,
Drizzle is the current default recommendation — TypeScript-native schema,
SQL-level control (helps the "parameterized queries, validated
identifiers" security requirement be visually auditable in review), a
~33KB footprint with no separate binary query engine (faster cold starts,
no Rust engine to containerize separately), and first-class support for
the custom types/array columns/JSON operators this schema needs
(`score_factors`, `missing_information` as arrays; `safe_metadata` as
JSON on `WorkflowEvent`).

**Alternatives considered**: Prisma (rejected — heavier runtime engine,
less natural fit for the array/JSON-heavy columns here, and its codegen
step adds a build dependency this project doesn't need); raw `pg` with
hand-written SQL (rejected — loses migration tooling and type safety for
very little benefit at this scale).

## 3. Testing framework

**Decision**: Vitest for both unit tests (`packages/business-rules`,
`packages/schemas` validation logic, scoring/idempotency/approval-
state-machine/follow-up-eligibility rules) and integration tests (HTTP
calls against the Docker Compose-started stack: Next.js app + Postgres +
n8n). No separate browser-automation framework for MVP.

**Rationale**: The constitution's testing requirement is explicit about
*what* must be tested (validation, scoring, idempotency, approval,
follow-up eligibility at the unit level; the end-to-end lead workflow,
duplicate-delivery, and malformed-AI-output paths at the integration
level) but does not require literal browser automation — SPEC.md's own
testing section (unit + integration) never asks for a UI E2E suite for
the MVP. Vitest alone (unit config + a separate integration config hitting
real HTTP endpoints) covers every required case with one dependency
instead of two, which is the smallest viable choice per the constitution's
Development Workflow guidance.

**Alternatives considered**: Jest (rejected — Vitest has better native
ESM/TypeScript support with less configuration for a Next.js 16 project,
and is the more common modern default); adding Playwright now (deferred,
not rejected outright — revisit once the dashboard exists, if visual/
accessibility regression testing becomes valuable; not required to meet
any current functional requirement or success criterion).

## 4. Architecture: how n8n and the Next.js app divide responsibility

This is the one decision in this feature with genuine, materially
different alternatives and long-term structural consequences — flagged
as an ADR candidate in the plan's final report.

**Decision**: n8n stays a thin **orchestrator**: it owns the public
webhook surface, scheduling, retries/backoff at the workflow-step level,
and the error-routing workflow. All validation, scoring-adjacent business
rules, AI-provider-adapter calls, email-adapter calls, and persistence
happen in **testable TypeScript** inside the Next.js app
(`packages/schemas`, `packages/business-rules`, `packages/adapters`),
exposed to n8n only through a small, non-public **internal API**
(Next.js Route Handlers under `/api/internal/*`, reachable only from
inside the Docker Compose network, additionally protected by a shared
internal secret header). All four named workflows from `SPEC.md` §7
(Intake, Approval+Email, Follow-up Scheduler, Error Handler) remain real,
exported n8n workflow JSON files — none of them are quietly replaced by
in-app-only logic — because the portfolio positioning explicitly
showcases n8n competency (`SPEC.md` §17: "Sanitized n8n workflow exports"
as a deliverable, demo video shows "intake → AI analysis → approval →
mock send → event log").

Concretely:
- **WF-01 (Intake)**: n8n Webhook Trigger receives the public payload,
  forwards it almost unmodified to `POST /api/internal/leads/intake`
  (validation, normalization, dedup, persistence happen here), then
  forwards the result to `POST /api/internal/leads/{id}/analyze` (AI
  adapter call + schema validation + draft creation), then returns n8n's
  webhook response from the API's result.
- **WF-02 (Approval + Email)**: the reviewer's approve/edit/reject action
  happens in the Next.js dashboard itself (it is the "secured review
  interface" `SPEC.md` names), which calls an n8n webhook
  (`POST /webhook/approval-action`) to perform the actual send — n8n
  re-validates the draft is still the current, pending version via the
  internal API (atomic state transition), then calls
  `POST /api/internal/email/send` (mock or live adapter) and logs the
  outcome. Keeping the send step in n8n (rather than having the dashboard
  call the email adapter directly, in-process) is the one place this
  decision trades a small amount of implementation simplicity for
  fidelity to the stated n8n-centric portfolio deliverable.
- **WF-03 (Follow-up Scheduler)**: n8n Schedule Trigger calls
  `POST /api/internal/followups/due` (eligibility checks: consent,
  opt-out, reply status, attempt count all live in
  `packages/business-rules`), then for each eligible follow-up calls the
  same approval/email path as WF-02.
- **WF-04 (Error Handler)**: n8n's Error Trigger workflow catches failures
  from the other three workflows and calls
  `POST /api/internal/events` to persist a redacted `WorkflowEvent`,
  satisfying the constitution's observability principle without n8n
  needing its own persistence logic.

**Rationale**: Business rules living in version-controlled, unit-testable
TypeScript (not n8n node parameter expressions) is what the constitution's
Principle V (Observable Failures, honest test reporting) and `SPEC.md` §8
("Keep business rules in readable, testable code... avoid building a
large custom backend unless the dashboard or security requirements
justify it") both call for — and the dashboard's own security
requirements (no secrets in the browser, server-side calls only) already
justify the API surface existing, so reusing it from n8n is free, not an
extra backend.

**Alternatives considered**:
- *Everything in n8n* (Code nodes re-implementing validation/scoring/
  dedup logic in node-local JavaScript): rejected — duplicates logic that
  needs unit tests, harder to code-review, and the n8n-skills pack's own
  guidance (`n8n-code-javascript`, `n8n-workflow-patterns`) warns against
  Code nodes absorbing responsibilities a proper service layer should own.
- *Bypass n8n for approval+send* (dashboard calls the email adapter
  in-process, no n8n webhook round-trip): rejected for MVP — simpler and
  more robust, but turns the required `WF-02` deliverable into an unused
  artifact, undermining the explicit portfolio goal of demonstrating a
  real n8n-driven approval-to-send flow. Revisit if reliability problems
  with the extra network hop appear during implementation.

## 5. AI provider adapter shape

**Decision**: A single TypeScript interface
(`AiLeadAnalysisAdapter.analyze(input): Promise<LeadAnalysisResult>`) in
`packages/adapters`, with a `MockAiAdapter` (deterministic, seeded by
input hash so demo runs are reproducible) as the default implementation
and one real adapter (configurable HTTP-based provider call) gated behind
`AI_PROVIDER` / `AI_API_KEY` env vars. The adapter's output is always
passed through the shared Zod schema (`packages/schemas`) before use,
regardless of which adapter produced it — this is what makes FR-009/
FR-045 ("switch mock → real without changing validation guarantees")
structurally true rather than a policy to remember.

**Rationale**: Matches the constitution's Mock-First principle exactly
and keeps the schema validation boundary identical for both code paths,
so there is no "the real adapter skips a check the mock adapter had" class
of bug.

**Alternatives considered**: Calling the AI provider directly from an n8n
AI Agent / LangChain node (rejected — would need the strict schema
validation and mock-mode switching duplicated inside n8n node config
rather than living once in testable TypeScript, contradicting decision
§4 above).

## 6. Email provider adapter shape

**Decision**: Same adapter-interface pattern as §5
(`EmailAdapter.send(message): Promise<DeliveryResult>`), with a
`MockEmailAdapter` (logs a structured "simulated send" record) as default
and an SMTP-based adapter (e.g., via `nodemailer`) gated behind
`EMAIL_PROVIDER` / `SMTP_*` env vars, matching `SPEC.md` §9's "mock
adapter by default; SMTP or a supported n8n integration for real
delivery."

**Rationale**: Consistent adapter shape across AI and email keeps
`packages/adapters` easy to reason about and test uniformly.

**Alternatives considered**: Using n8n's native Email/SMTP node directly
instead of an app-level adapter (rejected — would split the "exactly
once, mock-by-default" guarantee across two different implementations
depending on mode, instead of one adapter interface with two
implementations).
