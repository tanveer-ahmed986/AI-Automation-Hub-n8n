<!--
Sync Impact Report
==================
Version change: TEMPLATE (unratified) → 1.0.0
Rationale: Initial ratification. All placeholder tokens replaced with concrete,
project-specific principles derived from SPEC.md (Z&T AI Automation Hub).
Bump type: MAJOR (first ratified version establishes the governance baseline).

Modified principles: n/a (initial fill from template placeholders)

Added sections:
- Core Principles I–VII (Human Approval, Validate/Trust Nothing, Idempotency,
  Mock-First Demo Safety, Observable Failures & Bounded Recovery,
  Least Privilege & Data Minimization, Honest Representation)
- Technology & Architecture Constraints
- Development Workflow & Quality Gates
- Governance (versioning policy, amendment procedure, compliance review)

Removed sections: none (template section slots were filled, not deleted)

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — "Constitution Check" gate section is
  generic ("[Gates determined based on constitution file]") and remains
  compatible; no edit required, gates should be derived from this file at
  /sp.plan time.
- ✅ .specify/templates/spec-template.md — generic feature-spec template,
  no constitution-specific references to update.
- ✅ .specify/templates/tasks-template.md — generic task template, no
  constitution-specific references to update.
- ✅ .specify/templates/phr-template.prompt.md — no constitution references.
- ⚠ .specify/templates/commands/*.md — directory not present in this
  repository at ratification time; no action taken. Re-check if/when command
  templates are added.

Follow-up TODOs:
- TODO(RATIFICATION_DATE): Confirmed as 2026-10-15 (date of initial adoption
  by the project owner during this session). Update if an earlier internal
  adoption date is later documented.
-->

# Z&T AI Automation Hub Constitution

## Core Principles

### I. Human Approval Is Non-Negotiable (NON-NEGOTIABLE)

No outbound communication (email, follow-up, or any external message) and no
financial, contractual, or availability commitment MAY be sent or implied by
the system without an explicit, auditable human approval action. Approval
MUST reference an exact lead and an exact draft version; editing a draft
MUST create a new version requiring its own approval; rejection MUST be
final and MUST prevent sending. A high AI lead score or AI-recommended
action MUST NEVER itself trigger a send or a commitment. Approval
records MUST capture timestamp, action, draft version, and reviewer
identity where available. Any approval channel (UI or link-based) MUST be
protected by unguessable, expiring, single-use tokens verified server-side;
if secure reviewer identity cannot be implemented yet, the approval surface
MUST be local/demo-only and this limitation MUST be documented, not hidden.

**Rationale**: This project automates business communication on behalf of a
real company. Removing or weakening the human gate — even temporarily to
pass a demo — converts a reviewable assistant into an unsupervised agent
capable of making promises the business cannot keep.

### II. Validate Everything, Trust Nothing

All external input — webhook payloads, form submissions, lead message text,
and AI model output — MUST be treated as untrusted data, never as
instructions. Every inbound payload MUST be validated and normalized at the
workflow boundary (content type, required fields, length limits, email
format) independent of any client-side validation. AI output MUST be
checked against a strict, versioned JSON schema (enumerated categories,
intent, urgency, budget band, 0–100 integer score, required fields) before
it is used anywhere downstream; malformed, incomplete, or out-of-schema
output MUST fail closed into a manual-review state, never be silently
accepted or fabricated as successful. Lead message content MUST NOT be able
to override system rules, approval requirements, or workflow logic
(prompt-injection resistance is a hard requirement, not an enhancement).
The system MUST NOT execute user-supplied code, expressions, URLs, or SQL
derived from untrusted input.

**Rationale**: Every input to this system originates outside the
organization's control. Treating AI output and lead content as trusted is
the single most likely path to a fabricated commitment, a broken workflow,
or an injected instruction reaching production.

### III. Idempotency and Duplicate Prevention by Design

Every state-changing operation that can be retried or redelivered — lead
intake, AI analysis, draft creation, approval, email send, and follow-up
delivery — MUST be idempotent. An idempotency key MUST be honored when
supplied by the client; otherwise a documented deduplication rule
(normalized email + time window + message fingerprint, or equivalent) MUST
be applied. A repeated webhook delivery MUST return the existing
lead/event result rather than create a new record. Sending a reply or
follow-up MUST carry its own idempotency guard independent of lead
deduplication — an n8n execution ID alone MUST NOT be assumed to prevent a
business-level duplicate (duplicate lead, duplicate email, duplicate
follow-up). Retrying a failed step MUST reuse existing identifiers.

**Rationale**: Webhooks and schedulers redeliver. Without an explicit
idempotency contract at each state transition, the system will eventually
double-email a real prospect or double-create a lead — a credibility
failure in a tool meant to demonstrate operational rigor.

### IV. Mock-First, Demo-Safe by Default

The complete happy path (intake → AI analysis → draft → approval → send →
log) MUST work with zero paid credentials and zero real email delivery,
using deterministic mock AI output and a mock email adapter. `DEMO_MODE`,
`MOCK_AI`, and `MOCK_EMAIL` MUST default to enabled in every local/demo
configuration, and this default MUST NOT be silently overridable by
partial configuration (e.g., a present but invalid AI key must not flip the
system into a half-live state). A visible `DEMO MODE` indicator MUST be
shown in the UI whenever mocks are active, and mock delivery MUST NEVER be
represented to a user as a real send. Switching to a live AI provider or
live email provider MUST require an explicit, intentional configuration
change, documented in `.env.example` and setup docs. Seed/demo data MUST be
fictional; real prospect data MUST NEVER appear in screenshots, seed data,
or portfolio materials.

**Rationale**: This is a portfolio demonstration project built to be run by
reviewers and prospective clients without onboarding friction or cost, and
without risk of an accidental real send during a demo.

### V. Observable Failures, Bounded Recovery

Every workflow MUST route errors through a central error-handling path that
records a correlation/lead ID, an execution reference, and a classification
(validation, AI provider, persistence, approval, email delivery,
unexpected). Transient failures MAY be retried with bounded attempts and
backoff; validation errors MUST NEVER be retried automatically. Failures
that cannot be recovered automatically MUST land in a dead-letter/manual-
review state rather than be dropped or retried indefinitely. Logs and
stored error summaries MUST be concise and MUST redact secrets, tokens,
authorization headers, approval tokens, and unnecessary personal data.
Every milestone's acceptance check MUST include running the available
tests, linters, and type/build checks, and the report MUST distinguish
checks that passed from checks that were not run — fabricated or assumed
results are prohibited.

**Rationale**: A system that fails silently or retries blindly is worse
than one that fails loudly once. A portfolio piece additionally lives or
dies on the honesty of its reported test results.

### VI. Least Privilege and Data Minimization

Only the minimum lead information necessary MUST be sent to any AI
provider. Credentials for n8n, the database, AI providers, and SMTP MUST
use least-privilege scopes, MUST be distinct between development/demo and
live environments, and MUST NEVER be exposed to frontend bundles, browser
code, logs, or webhook responses. Database access MUST use parameterized
queries with validated identifiers. Public webhooks MUST apply rate limits
and request-size limits; browser-facing forms MUST restrict CORS to known
origins. The n8n editor and the database MUST NOT be exposed directly to
the public internet without documented access controls. Personal data
retained MUST be the minimum necessary for the stated workflow purpose,
and a retention/deletion approach MUST be defined before any real client
data is processed.

**Rationale**: The project explicitly targets eventual use with real client
inquiries; security posture established loosely during the demo phase
tends to persist unexamined into real use, so it must be correct from the
start.

### VII. Honest Representation

The project, its documentation, and its portfolio materials MUST only
claim integrations, capabilities, or production readiness that have
actually been configured and tested. Claims of "production-ready," "fully
autonomous," or third-party integration status MUST NOT be made until that
specific integration has been exercised successfully. AI-generated content
(scores, summaries, drafts) MUST be visibly labeled as AI-generated and
described as advisory, never as a guaranteed prediction. The system MUST
NOT invent prices, discounts, timelines, case studies, guarantees, or
availability in any drafted communication; unknown information MUST be
marked unknown rather than fabricated. Known limitations MUST be
documented in the README rather than omitted.

**Rationale**: The project's stated purpose is to win client trust by
demonstrating real, verifiable capability. Overclaiming — by the system to
a lead, or by the project to a reviewer — directly undermines that
purpose.

## Technology & Architecture Constraints

- **Orchestration**: n8n, self-hosted via Docker Compose for local/demo use.
  Workflow JSON exports MUST be version-controlled, MUST exclude secrets,
  and MUST be validated against the actual installed n8n version — node
  parameters MUST NOT be assumed valid without verification against current
  n8n documentation or the running instance.
- **Persistence**: PostgreSQL MUST be used where practical; if a lighter
  local prototype store is used instead, a repository/data-access boundary
  MUST exist so PostgreSQL can be introduced later without rewriting
  business logic. Migrations (or an equivalently documented initialization
  method) are required, with indexes/uniqueness constraints on normalized
  email and idempotency fields. API keys and secrets MUST NEVER be stored
  in these tables.
- **Dashboard**: Next.js + TypeScript (or a materially simpler alternative
  if justified) with Tailwind CSS or an equivalent consistent component
  system. All server-side calls MUST keep credentials and private
  execution payloads out of the browser. The dashboard MUST be responsive
  (desktop/tablet/mobile) and accessible (labels, keyboard navigation,
  loading/empty/error states).
- **AI provider**: A provider adapter abstraction MUST support both a
  configured real provider and a deterministic mock mode; a local Ollama
  adapter MAY be added if hardware supports it. Model choice and schema
  MUST be documented.
- **Email provider**: A provider adapter MUST support SMTP or a supported
  n8n email integration behind a mock adapter default.
- **Validation**: Zod or an equivalent schema validator MUST be used in
  application code; workflow-boundary validation is required in addition to
  (not instead of) application-level validation.
- **Testing**: Unit tests are required for validation rules, scoring/
  business rules, idempotency, approval state transitions, and follow-up
  eligibility. Integration tests are required for the end-to-end lead
  workflow (intake → approval → mock send) and for duplicate-delivery and
  malformed-AI-output paths.
- **Version control**: Git, with `.env.example` containing placeholder
  values only, sanitized workflow exports, and setup documentation kept
  current with the actual repository structure.

## Development Workflow & Quality Gates

- Work proceeds in small, verifiable milestones as defined in SPEC.md
  (repository/spec → infrastructure/data → core workflows → dashboard →
  follow-ups/hardening → portfolio packaging). Do not begin later
  milestones, or optional enhancements listed as "later" in SPEC.md, before
  the current milestone's acceptance criteria are met.
- Before each milestone, the intended files and acceptance criteria MUST be
  listed; the existing repository state MUST be inspected before creating
  or overwriting files.
- A major architecture change, or introduction of any paid service, MUST be
  confirmed with the project owner before implementation — this includes
  switching a mock adapter to live, adding a new external dependency not
  already named in SPEC.md, or deviating from the documented repository
  structure.
- A Prompt History Record (PHR) MUST be created for every user prompt,
  routed under `history/prompts/` per the project's PHR routing rules, with
  the verbatim prompt preserved.
- When a decision meets the architectural-significance test (long-term
  impact, genuine alternatives considered, cross-cutting scope), an ADR
  MUST be suggested to the user and MUST NOT be auto-created without
  consent.
- After each milestone, available tests, linting, type checks, and build
  checks MUST be run, and the exact commands run MUST be reported,
  distinguishing passing checks from checks not run.
- If a requirement is blocked, the blocker MUST be explained and the
  smallest safe alternative proposed — approval or security requirements
  MUST NOT be weakened to make a demo pass.

## Governance

This constitution supersedes conflicting ad-hoc practices for this project.
All plans, specs, and tasks produced via `/sp.plan`, `/sp.specify`, and
`/sp.tasks` MUST be checked against the Core Principles above as a gate;
violations MUST be either resolved or explicitly justified in the plan's
Complexity Tracking section before implementation proceeds.

**Amendment procedure**: Amendments are proposed by editing this file,
describing the change and rationale, and presenting it to the project
owner for explicit approval before being committed. Each amendment MUST
update the Sync Impact Report at the top of this file and MUST re-check
the dependent templates listed there (`plan-template.md`,
`spec-template.md`, `tasks-template.md`, PHR template, and any command
templates) for consistency.

**Versioning policy** (semantic versioning for governance):
- **MAJOR**: Backward-incompatible removal or redefinition of a Core
  Principle, or a change that removes a previously non-negotiable
  guarantee (e.g., weakening the human-approval gate).
- **MINOR**: A new principle or section is added, or existing guidance is
  materially expanded in scope.
- **PATCH**: Wording clarifications, typo fixes, or non-semantic
  refinements that do not change what is required or prohibited.

**Compliance review**: Every milestone completion (Section "Development
Workflow & Quality Gates" above) is itself a compliance checkpoint against
these principles. Any reviewer or future agent picking up this project
MUST re-read this constitution and `SPEC.md` before modifying workflows,
schemas, approval logic, or security-relevant configuration.

**Version**: 1.0.0 | **Ratified**: 2026-10-15 | **Last Amended**: 2026-10-15
