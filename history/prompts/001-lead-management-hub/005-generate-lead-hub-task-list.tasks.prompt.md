---
id: 005
title: Generate lead hub task list
stage: tasks
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: /sp.tasks
labels: [tasks, implementation-plan, n8n, lead-management, ai-automation-hub]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: history/adr/001-service-boundary-n8n-orchestrator-vs-app-business-logic.md, history/adr/002-application-and-data-stack.md
  pr: null
files:
 - specs/001-lead-management-hub/tasks.md
tests:
 - none (task-list generation only; no code written yet)
---

## Prompt

(no additional arguments provided — user invoked `/sp.tasks` with empty input)

## Response snapshot

Ran `check-prerequisites.ps1 -Json`; confirmed `plan.md` present along with
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md`. Loaded
all five as inputs, plus the two now-accepted ADRs for architectural
context.

Determined tests must be included (not optional) because the constitution
(`.specify/memory/constitution.md` §Testing) explicitly mandates unit
tests for validation/scoring/idempotency/approval-state-machine/follow-up
-eligibility logic and integration tests for the end-to-end lead
workflow — this is a hard project gate, not a discretionary choice left
to this command.

Organized 70 tasks (T001–T070) across 7 phases:
- Phase 1 Setup (T001–T010): repo skeleton per `plan.md`'s Project
  Structure, pnpm workspace, Next.js 16/Tailwind/shadcn scaffold, the
  three `packages/*` initializations, `docker-compose.yml`/`.env.example`,
  lint/format, dual Vitest configs (unit + integration, per
  `research.md` §3).
- Phase 2 Foundational (T011–T022): Drizzle client + all five entity
  tables from `data-model.md` (Lead, LeadAnalysis, ReplyDraft,
  WorkflowEvent, FollowUp) with their documented indexes/constraints,
  initial migration, the internal-API secret-header auth guard, the
  shared Zod schemas mirrored from `contracts/internal-api.openapi.yaml`,
  and the `WorkflowEvent` repository + `/events` endpoint — flagged as
  foundational rather than US4-only because every later story's workflow
  logs through it from US1 onward.
- Phase 3 US1 (P1, T023–T036): validation/dedup/AI-adapter unit tests,
  an intake-to-analysis integration test, then the `Lead`/`LeadAnalysis`/
  `ReplyDraft` repositories, `MockAiAdapter`, the two intake/analyze
  route handlers, WF-01's workflow JSON, the Leads list/detail views, and
  seed data (clean + spam-classified leads).
- Phase 4 US2 (P2, T037–T047): approval-state-machine and email-adapter
  unit tests, an approve/edit/reject/duplicate-approval integration test,
  then the approval business rules, the `/drafts/{id}/approve` and
  `/email/send` endpoints, `MockEmailAdapter`+SMTP adapter, WF-02's
  workflow JSON, the dashboard's server-side approval action, the
  Approval queue UI, and an already-sent seed scenario (exercising
  `quickstart.md` step 6's idempotency check).
- Phase 5 US3 (P3, T048–T054): follow-up-eligibility unit tests, a
  scheduling/cancellation integration test, then the eligibility rules,
  `/followups/due`, WF-03's workflow JSON, extending the WF-02/approval-
  action path to version-track follow-up drafts, and a scheduled-follow-
  up seed scenario.
- Phase 6 US4 (P4, T055–T062): failure-classification unit tests, a
  validation-failure + delivery-failure integration test, then the
  classification/redaction rules, WF-04's error-handler workflow JSON,
  the Execution log UI, wiring the Overview page's failed-executions
  tile (deferred from US1), a recovery-steps runbook doc, and a failed-
  analysis seed scenario.
- Phase 7 Polish (T063–T070): docs (architecture/workflow-catalog/setup/
  testing/security/demo-script), the shared DEMO MODE indicator
  component, an accessibility/responsive pass, `demo-reset` script,
  full manual `quickstart.md` execution, a security-hardening review
  (no secrets in the browser bundle, parameterized queries, auth guard
  coverage), and an honest-representation audit (FR-010/FR-036,
  constitution Principle VII).

Documented phase/story dependencies explicitly: US2 depends on US1 (needs
a pending draft to approve); US3 depends on US2 (reuses its approval/
email send path for follow-ups); US4 depends only on Foundational's
`WorkflowEvent` table and is additive/non-blocking to US1–US3. Called out
every [P]-parallelizable task and gave a concrete parallel-team staffing
suggestion (Developer A on US1→US2 sequentially, Developer B starting
US4's classification rules early since they only need Foundational).

## Outcome

- ✅ Impact: Complete, dependency-ordered, independently-testable task
  breakdown for all 4 user stories plus setup/foundational/polish phases,
  ready for implementation to begin.
- 🧪 Tests: None run — this is planning output; the task list itself
  specifies 11 test-writing tasks (T023–T026, T037–T039, T048–T049,
  T055–T056) to be executed first within their respective story phases.
- 📁 Files: `specs/001-lead-management-hub/tasks.md` (new), this PHR.
- 🔁 Next prompts: Begin implementation starting with Phase 1 (Setup) and
  Phase 2 (Foundational), or hand off `tasks.md` for team review first.
- 🧠 Reflection: The one real judgment call was where `WorkflowEvent`
  belongs — it's conceptually "US4's" entity per the spec's Key Entities
  section, but every other story's workflow needs to log through it
  starting with WF-01, so it had to move into Foundational (T015, T020)
  rather than US4's own phase, with US4 only adding the classification
  *logic*, the error-handler workflow, and the log's UI surface on top of
  an already-functional logging pipe.

## Evaluation notes (flywheel)

- Failure modes observed: none new this run — no script gaps encountered
  since `/sp.tasks` has no script dependency (unlike `/sp.adr`'s missing
  `create-adr.sh` or `/sp.plan`'s silently-no-oping
  `update-agent-context.ps1`, both already logged in prior PHRs).
- Graders run and results (PASS/FAIL): Manual task-completeness check —
  PASS (all 4 user stories have test + implementation tasks, explicit
  independent-test criteria, and a checkpoint; checklist format validated
  — every task has a checkbox, sequential ID, correct [P]/[Story]
  markers, and an exact file path).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): When implementation begins,
  verify the `WorkflowEvent`-in-Foundational call was right in practice —
  if US1's intake/analyze handlers end up needing event types or fields
  US4 hasn't designed yet, that's a signal the split should have waited
  until US1 needed it, not been preemptively generalized in Phase 2.
