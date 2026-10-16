---
id: 001
title: Ratify AI Automation Hub constitution
stage: constitution
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: none
branch: master
user: tanveer030402@gmail.com
command: /sp.constitution
labels: [constitution, governance, n8n, ai-automation-hub]
links:
  spec: SPEC.md
  ticket: null
  adr: null
  pr: null
files:
 - .specify/memory/constitution.md
 - history/prompts/constitution/001-ratify-automation-hub-constitution.constitution.prompt.md
tests:
 - none (documentation-only change)
---

## Prompt

i want to create a projuct 'ai automation hub usin n8n' workflow, read SPEC.md file carefully and then write comprehencise constitution for this automation project

## Response snapshot

Read `SPEC.md` (Z&T AI Automation Hub — n8n-based AI lead management and
business automation demo) in full, then read the existing constitution
template and the dependent templates (plan, spec, tasks, PHR) to check for
required propagation.

Filled `.specify/memory/constitution.md` from the bracketed template into a
concrete v1.0.0 constitution with seven Core Principles derived directly
from SPEC.md's non-negotiable requirements:

1. Human Approval Is Non-Negotiable (NON-NEGOTIABLE) — no send/commitment
   without an auditable human approval gate, versioned drafts, secure
   approval tokens.
2. Validate Everything, Trust Nothing — untrusted input/AI-output handling,
   strict JSON schema validation, fail-closed to manual review.
3. Idempotency and Duplicate Prevention by Design — dedup at lead, send,
   and follow-up layers independently.
4. Mock-First, Demo-Safe by Default — DEMO_MODE/MOCK_AI/MOCK_EMAIL defaults,
   visible demo indicator, fictional seed data only.
5. Observable Failures, Bounded Recovery — classified errors, bounded
   retries, dead-letter path, honest test reporting.
6. Least Privilege and Data Minimization — minimal AI payloads, scoped
   credentials, no secrets in browser/logs, public webhook hardening.
7. Honest Representation — no overclaiming integrations/readiness, AI
   output labeled advisory, no fabricated pricing/guarantees.

Added a "Technology & Architecture Constraints" section (n8n/Docker Compose,
PostgreSQL, Next.js+Tailwind dashboard, provider adapters, Zod validation,
required test coverage, version control hygiene) and a "Development
Workflow & Quality Gates" section (milestone discipline, PHR/ADR rules,
required test/lint/build reporting, no weakening approval/security to pass
a demo) — both directly sourced from SPEC.md sections 6–16.

Completed the Governance section with an amendment procedure, semantic
versioning policy (MAJOR/MINOR/PATCH defined in terms of principle
strength), and a compliance-review checkpoint tied to milestone completion.
Ratified as version 1.0.0 (initial adoption), ratification and last-amended
date set to 2026-10-15.

Checked `.specify/templates/plan-template.md`, `spec-template.md`,
`tasks-template.md`, and the PHR template for constitution-specific
references requiring updates — all are generic/parameterized and required
no edits; this was recorded in the Sync Impact Report prepended as an HTML
comment at the top of the constitution file. Noted
`.specify/templates/commands/*.md` does not exist in this repo (no action
possible/needed).

## Outcome

- ✅ Impact: `.specify/memory/constitution.md` fully ratified at v1.0.0 with
  project-specific, testable principles; no placeholder tokens remain.
- 🧪 Tests: none applicable (governance document); dependent templates
  reviewed for consistency, no changes required.
- 📁 Files: `.specify/memory/constitution.md` (rewritten), this PHR.
- 🔁 Next prompts: run `/sp.specify` for the first feature slice (likely
  WF-01 lead intake) to begin spec-driven implementation against this
  constitution.
- 🧠 Reflection: SPEC.md already reads like a de facto constitution in
  places (security/approval guardrails), so principles were extracted
  rather than invented, keeping the constitution traceable to source
  requirements.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): n/a — no automated grader configured
  for constitution documents.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a
