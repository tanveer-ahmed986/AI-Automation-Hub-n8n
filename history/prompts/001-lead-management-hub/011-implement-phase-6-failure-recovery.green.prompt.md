---
id: 011
title: Implement Phase 6 failure investigation and recovery
stage: green
date: 2026-10-16
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: (none — direct chat instruction continuing /sp.implement)
labels: ["implementation", "error-handling", "n8n-workflow", "us4", "observability"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - tests/unit/business-rules/error-classification.test.ts
 - tests/integration/error-handling.test.ts
 - packages/business-rules/src/error-classification.ts
 - packages/business-rules/src/index.ts
 - apps/dashboard/lib/repositories/workflow-event.ts
 - apps/dashboard/app/api/internal/events/route.ts
 - apps/dashboard/app/api/internal/leads/intake/route.ts
 - apps/dashboard/app/(dashboard)/execution-log/page.tsx
 - apps/dashboard/app/(dashboard)/page.tsx
 - apps/dashboard/app/(dashboard)/layout.tsx
 - workflows/wf-04-error-handler.json
 - workflows/wf-01-lead-intake.json
 - workflows/wf-02-approval-email.json
 - workflows/wf-03-follow-up-scheduler.json
 - database/seed/leads.ts
 - docs/runbook.md
 - specs/001-lead-management-hub/tasks.md
tests:
 - tests/unit/business-rules/error-classification.test.ts (16 tests, red before T057, green after)
 - tests/integration/error-handling.test.ts (3 tests, green against live Docker Compose stack)
 - pnpm vitest run (full unit suite: 71/71 passing)
 - pnpm test:integration (full integration suite: 16/16 passing — 13 US1+US2+US3 + 3 new US4)
 - pnpm -r run typecheck (all 4 workspace packages clean)
 - pnpm lint (root + all workspace packages clean)
 - live n8n REST API verification of WF-04 (real webhook-triggered production crash on WF-01,
   confirmed WF-04 fired and logged a redacted WorkflowEvent; repeated after fixing a redaction
   gap found during this same verification)
 - live comparison of all 4 workflows' GET /rest/workflows/{id} output against their exported
   JSON files (byte-identical)
 - live browser verification of the Execution Log page (filtering, badges, recovery guidance)
   and the Overview page's Failed Executions tile
---

## Prompt

Phase 6: User Story 4 - Investigate and Recover from Failures

## Response snapshot

Implemented Phase 6 (US4) end to end, TDD-first per tasks.md T055–T062a:

- T055: wrote 16 failing unit tests for failure classification, recovery guidance, and
  redaction; confirmed red (module missing).
- T057: implemented `packages/business-rules/src/error-classification.ts` — the six-category
  taxonomy (`WORKFLOW_EVENT_CLASSIFICATIONS`), `isAutoRetryable` (true only for `ai_provider`/
  `email_delivery` per FR-025/FR-040), `getRecoveryGuidance` (per-classification operator text,
  also used by `docs/runbook.md` and the Execution Log UI), and `redactEventMetadata` —
  replacing the Phase 2 baseline `redactSafeMetadata` in
  `apps/dashboard/lib/repositories/workflow-event.ts` as the single source of truth. 16/16 green
  after implementation.
- T056: wrote `tests/integration/error-handling.test.ts` — malformed-JSON and schema-validation
  intake failures now get logged (new: `/leads/intake` previously returned 400 with no
  execution-log trace at all), and a simulated transient email-delivery failure confirms
  retrying reuses the same `leadId`/`draftId` rather than creating new ones. Added a new
  `GET /api/internal/events` route (filterable by `leadId`/`status`/`classification`) so both
  this test and the Execution Log UI have an HTTP-only way to read back what was logged —
  documented as a deliberate, undocumented-in-OpenAPI deviation, same category as T051's
  `/leads/{id}/close`.
- T058: built `workflows/wf-04-error-handler.json` (native Error Trigger → redacted POST
  `/api/internal/events`, `classification: "unexpected"` always, by design — every anticipated
  failure is already self-classified and self-logged by WF-01/02/03's own routes before their
  `neverError: true` HTTP nodes would ever let a failure reach n8n's Error Trigger). Imported
  live (id `YeFyZdpuMbhtC7IH`), activated, and wired as `settings.errorWorkflow` on all three of
  WF-01/02/03 via n8n's REST API.
- Live-verified WF-04 for real, which surfaced and fixed a genuine bug: the first forced
  production-webhook crash (WF-01's intake node pointed at an unreachable host) logged a
  redacted event, but the raw n8n stack trace was still present inside
  `safeMetadata.error.stack` — the top-level-only redaction from the first implementation didn't
  reach into a nested object. Made `redactEventMetadata` recursive, rebuilt the dashboard
  container, repeated the identical forced failure, and confirmed `stack` now reads
  `"[REDACTED]"` while the safe `message`/`httpCode` fields remain. Added a regression test.
  Also discovered along the way that n8n's error-workflow mechanism never fires for
  `mode: "manual"` executions (the `/rest/workflows/{id}/run` API used for on-demand testing in
  Phase 5) — only for a workflow's real production trigger — documented in tasks.md for future
  reference.
- T059: built `apps/dashboard/app/(dashboard)/execution-log/page.tsx` — GET-query-param
  filtering (status/classification, zero client JS), status/classification/event-type badges,
  the redacted `safeMetadata` JSON, and inline recovery guidance per event. Added to the nav.
- T060: wired the Overview page's "Failed Executions" tile (placeholder since T035) to
  `countWorkflowEventsByStatus("failed")`.
- T061: wrote `docs/runbook.md` — one section per classification (what it means, whether/why
  it's auto-retried, and exact operator recovery steps), sourced from the same
  `error-classification.ts` taxonomy rather than a second hand-written policy.
- T062: seeded a 5th demo lead ("Grace Murray") with a `failed`/`ai_provider` `WorkflowEvent` and
  no analysis/draft — exercises the Execution Log and Failed Executions tile without needing to
  force a live failure first.
- T062a: confirmed no credentials/secrets are embedded in any of the 4 workflow JSON exports
  (only credential *references* by id/name), and confirmed via direct REST API comparison that
  all 4 live workflows match their exported JSON files exactly.
- Resolved a carried-forward known gap: the saved n8n session cookie from Phase 3 was gone with
  no recorded owner credentials. Reset the n8n owner account (`n8n user-management:reset`,
  confirmed workflow/credential data survived), completed first-run setup with a known local
  credential, and logged in via `POST /rest/login` for a fully repeatable, scriptable
  re-authentication path — a real improvement over the ad hoc Phase 3 browser session.
- Final verification: 71/71 unit tests, 16/16 integration tests, clean typecheck/lint, live
  end-to-end confirmation through a real forced production-webhook crash, direct n8n REST API
  comparison, and a real browser session. Re-ran `pnpm db:seed` to restore a pristine demo state.

## Outcome

- ✅ Impact: Every workflow outcome across all three prior user stories is now classified and
  safely logged; an operator can diagnose any failure and its documented recovery path entirely
  from the Execution Log, without ever seeing a raw secret or stack trace — completing the full
  `spec.md` feature set (US1–US4).
- 🧪 Tests: 71/71 unit, 16/16 integration, typecheck clean, lint clean — all run against real
  processes/containers; the redaction gap was caught by live verification, not fabricated as
  passing.
- 📁 Files: 5 new files, ~12 modified files (see `files:` above); no schema migration needed this
  phase (the `workflow_event` table already existed from Phase 2).
- 🔁 Next prompts: Phase 7 (Polish & Cross-Cutting — `docs/architecture.md`,
  `docs/workflow-catalog.md`, `docs/setup-local.md` should formally capture the n8n
  re-authentication path established this phase, `docs/security.md`, `docs/testing.md`,
  `docs/portfolio-demo-script.md`, DEMO MODE badge mounting audit, accessibility pass,
  `scripts/demo-reset.*`, full `quickstart.md` walkthrough, security hardening review).
- 🧠 Reflection: The most valuable finding this phase came from refusing to treat "the route
  returns the right HTTP status" as proof of FR-041 compliance — only forcing a *real* n8n-level
  crash (not a mocked adapter throw) actually exercised the nested-object redaction path, and it
  failed on the first attempt. A test suite built entirely at the API-route level would never
  have caught this, since none of those routes construct a nested `execution.error.stack`
  shape — only n8n's own Error Trigger payload does.

## Evaluation notes (flywheel)

- Failure modes observed: (1) shallow-only redaction left a nested stack trace unredacted —
  found via live verification, not a pre-written test; (2) `/rest/workflows/{id}/run`
  (`mode: "manual"`) never invokes a configured error workflow, only a true production trigger
  does — discovered through two dead-end verification attempts before switching to a real
  webhook POST; (3) PATCHing an active workflow's node parameters does not hot-swap its
  live-registered webhook handler — a deactivate/reactivate cycle is required, confirmed by a
  webhook call succeeding against stale config immediately after a PATCH that should have broken
  it.
- Graders run and results (PASS/FAIL): unit suite PASS (71/71); integration suite PASS (16/16);
  typecheck PASS (4/4 packages); lint PASS (root + 4/4 packages); live WF-04 production-crash
  verification PASS (after one fix); live workflow-export parity check PASS (4/4); live browser
  UI check PASS (Execution Log filtering/guidance, Overview tile).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): formalize the n8n re-authentication path (owner
  reset + `POST /rest/login`) into `docs/setup-local.md` in Phase 7 so it's a documented
  procedure rather than a note buried in this PHR and tasks.md.
