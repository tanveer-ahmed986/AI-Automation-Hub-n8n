# ADR-001: Service Boundary — n8n as Thin Orchestrator vs. Application-Owned Business Logic

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-15
- **Feature:** 001-lead-management-hub
- **Context:** `SPEC.md` names four required n8n workflows (Lead Intake,
  Approval + Email Delivery, Follow-up Scheduler, Error Handler) and
  explicitly positions n8n workflow exports as a core portfolio
  deliverable ("I build AI-powered business automations with n8n..."),
  while simultaneously requiring strict, versioned schema validation of
  AI output, exactly-once idempotent sending under retries, mock-first
  demo safety, and unit-testable validation/scoring/approval/follow-up
  logic (constitution Principles I-VI; `SPEC.md` §8: "Keep business rules
  in readable, testable code or clearly documented n8n nodes"). n8n Code
  nodes are not independently unit-testable in the same way as a
  version-controlled TypeScript package, and duplicating strict-schema
  validation or exactly-once state transitions across n8n node
  expressions risks silent drift between "what the workflow does" and
  "what the tests verify." The dashboard (Next.js app) additionally
  already requires its own server-side API layer regardless of this
  decision, because dashboard credentials and private execution payloads
  must never reach the browser (`SPEC.md` §12.5, FR-038) — so the
  question was specifically *where business logic callable from n8n
  should live*, not *whether an API layer should exist at all*.

<!-- Significance checklist (ALL must be true to justify this ADR)
     1) Impact: Long-term consequence for architecture/platform/security?
     2) Alternatives: Multiple viable options considered with tradeoffs?
     3) Scope: Cross-cutting concern (not an isolated detail)?
     If any are false, prefer capturing as a PHR note instead of an ADR. -->

## Decision

n8n stays a **thin orchestrator only**: it owns the public webhook
surface, scheduling/wait logic, step-level retries and backoff, and the
centralized error-routing workflow. It never implements validation,
deduplication, scoring-adjacent business rules, AI-provider calls, or
email-provider calls directly in node parameters or Code nodes.

All of that logic lives in version-controlled, framework-agnostic
TypeScript inside the Next.js app, reachable only through a non-public
**internal API** (`apps/dashboard/app/api/internal/*`, network-isolated
to the Docker Compose network plus a shared-secret header):

- **Validation & normalization**: `packages/schemas` (Zod 4) +
  `packages/business-rules` — length limits, email format, idempotency-
  key/dedup-window lookup (FR-002, FR-003, FR-005).
- **AI qualification**: `packages/adapters` implements
  `AiLeadAnalysisAdapter` with a deterministic `MockAiAdapter` as the
  *default* implementation (not a bypassed path) and one real-provider
  implementation gated behind `AI_PROVIDER`/`AI_API_KEY`; output always
  passes through the same Zod schema regardless of which implementation
  produced it (FR-008, FR-009, FR-045).
- **Email delivery**: the same adapter pattern —
  `EmailAdapter.send()` with `MockEmailAdapter` default and an SMTP
  implementation gated behind `EMAIL_PROVIDER`/`SMTP_*` (FR-022–FR-025).
- **Approval state machine**: draft versioning, stale-version rejection,
  and the exactly-once approve→send transition live in
  `packages/business-rules`, invoked by the internal API endpoint
  `/drafts/{id}/approve` (FR-016–FR-019, FR-023).
- **Follow-up eligibility**: consent/opt-out/reply/attempt-cap checks in
  `packages/business-rules`, exposed via `/followups/due` (FR-026–FR-029).

All four n8n workflows remain real and are each still responsible for a
genuine piece of orchestration (see
[contracts/n8n-webhooks.md](../../specs/001-lead-management-hub/contracts/n8n-webhooks.md)
for the exact call sequence each one makes into the internal API):

- **WF-01 (Intake)**: public Webhook Trigger → forwards to
  `/leads/intake` → `/leads/{id}/analyze` → returns a generic
  acknowledgment (never the analysis/score/draft) to the public caller.
- **WF-02 (Approval + Email)**: triggered by the dashboard's own
  approve/edit/reject action (an internal-only webhook, not public) →
  re-validates the draft version via `/drafts/{id}/approve` → only on a
  genuine `approved` result calls `/email/send`.
- **WF-03 (Follow-up Scheduler)**: Schedule Trigger → `/followups/due` →
  the same approval/email path as WF-02 per eligible follow-up.
- **WF-04 (Error Handler)**: n8n's native Error Trigger → `/events`,
  persisting a redacted `WorkflowEvent` for every failure across the
  other three workflows.

## Consequences

### Positive

- Every rule the constitution and `SPEC.md`'s testing section require
  unit tests for (validation, scoring-adjacent logic, idempotency,
  approval-state transitions, follow-up eligibility) is testable with
  Vitest in isolation, with no need to spin up n8n to exercise business
  logic.
- The mock-first guarantee (constitution Principle IV) is structural, not
  a convention to remember: both AI and email adapters share one
  interface and one post-call validation path regardless of mock vs.
  live, so "switch mock → real without changing validation guarantees"
  (FR-045) cannot silently regress.
- Exactly-once sending (FR-023) is enforced at one call site
  (`/drafts/{id}/approve` → `/email/send`), not duplicated across
  multiple n8n nodes or re-implemented per workflow.
- The dashboard's pre-existing requirement for a secure server-side API
  layer is reused rather than duplicated — this isn't "a second backend,"
  it's the one API layer serving two callers (the browser and n8n).
- All four named n8n workflows remain genuine, demo-able artifacts
  matching the stated portfolio positioning, rather than becoming
  thin/unused wrappers around in-app logic.

### Negative

- Every workflow step that needs business logic now costs an HTTP round
  trip from n8n into the internal API, instead of running inline in a
  Code node — slightly higher latency and one more network hop to reason
  about during debugging (mitigated by `WorkflowEvent` logging at each
  step and the n8n execution UI showing the HTTP Request node's
  response).
- The internal API becomes a second thing to keep running and healthy
  alongside n8n and Postgres in local dev — Docker Compose health checks
  must cover it, not just the database and n8n (already planned in
  `SPEC.md` §10's `scripts/health-check.*`).
- A developer unfamiliar with this split might instinctively reach for a
  Code node to "quickly" add a business rule; this ADR is the documented
  guardrail against that drift, but it requires someone to actually read
  it (mitigated by the n8n-skills pack's own `n8n-workflow-patterns` and
  `n8n-code-javascript` skill guidance, which independently warns against
  Code nodes absorbing service-layer responsibilities).

## Alternatives Considered

**Alternative A — Everything in n8n** (Code nodes re-implement
validation, deduplication, scoring-adjacent rules, and call the AI/email
providers directly, with n8n's own HTTP Request/Postgres nodes handling
persistence). *Why rejected*: duplicates logic that must be unit-tested
per the constitution and `SPEC.md`'s testing section into a form (n8n
node JSON) that is much harder to unit test, code-review as a diff, or
keep in sync with the Zod schemas the dashboard also needs; directly
contradicts `SPEC.md` §8's explicit preference for business rules living
in "readable, testable code."

**Alternative B — Bypass n8n for approval and email delivery entirely**
(the dashboard calls the email adapter in-process on approve, with no
n8n webhook round-trip for WF-02/WF-03). *Why rejected*: simpler and
marginally more robust (one fewer network hop on the most sensitive
action in the system), but turns the required WF-02 deliverable into dead
weight — never actually invoked — which undermines the explicit
portfolio goal of demonstrating a real n8n-driven approval-to-send flow,
and leaves WF-03's follow-up scheduling as the only n8n-triggered send
path, an inconsistent design. Revisit this specific sub-decision (not the
whole ADR) if the extra network hop causes concrete reliability problems
during implementation that outweigh the portfolio-fidelity argument.

## References

- Feature Spec: `specs/001-lead-management-hub/spec.md` (FR-002, FR-003,
  FR-005, FR-008, FR-009, FR-016–FR-029, FR-045)
- Implementation Plan: `specs/001-lead-management-hub/plan.md`
  ("Project Structure", "Architecturally significant decision")
- Research: `specs/001-lead-management-hub/research.md` §4, §5, §6
- Contracts: `specs/001-lead-management-hub/contracts/internal-api.openapi.yaml`,
  `specs/001-lead-management-hub/contracts/n8n-webhooks.md`
- Related ADRs: ADR-002 (Application & Data Stack) — this ADR defines
  *where* business logic lives; ADR-002 defines *what it's built with*.
- Evaluator Evidence: `history/prompts/001-lead-management-hub/003-plan-lead-hub-architecture.plan.prompt.md`
