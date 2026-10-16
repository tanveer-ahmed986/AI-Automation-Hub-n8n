---
id: 009
title: Implement Phase 4 approval and email delivery
stage: green
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: (none — direct chat instruction continuing /sp.implement)
labels: ["implementation", "approval-flow", "email-delivery", "n8n-workflow", "us2"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - tests/unit/business-rules/approval-state-machine.test.ts
 - tests/unit/adapters/email-adapter.test.ts
 - tests/integration/approval-flow.test.ts
 - packages/business-rules/src/approval.ts
 - packages/business-rules/src/index.ts
 - packages/adapters/src/email-adapter.ts
 - packages/adapters/src/index.ts
 - packages/schemas/src/index.ts
 - apps/dashboard/lib/email-adapter-factory.ts
 - apps/dashboard/lib/n8n-client.ts
 - apps/dashboard/lib/config.ts
 - apps/dashboard/lib/repositories/reply-draft.ts
 - apps/dashboard/app/api/internal/drafts/[id]/approve/route.ts
 - apps/dashboard/app/api/internal/drafts/[id]/reject/route.ts
 - apps/dashboard/app/api/internal/drafts/[id]/versions/route.ts
 - apps/dashboard/app/api/internal/email/send/route.ts
 - apps/dashboard/app/(dashboard)/approvals/actions.ts
 - apps/dashboard/app/(dashboard)/approvals/page.tsx
 - apps/dashboard/app/(dashboard)/layout.tsx
 - apps/dashboard/app/(dashboard)/page.tsx
 - apps/dashboard/app/(dashboard)/leads/[id]/page.tsx
 - workflows/wf-02-approval-email.json
 - database/seed/leads.ts
 - docker-compose.yml
 - specs/001-lead-management-hub/tasks.md
tests:
 - tests/unit/business-rules/approval-state-machine.test.ts (10 tests, red before T040, green after)
 - tests/unit/adapters/email-adapter.test.ts (4 tests, red before T042, green after)
 - tests/integration/approval-flow.test.ts (4 tests, green against live Docker Compose stack)
 - tests/integration/lead-intake.test.ts (5 tests, re-run — still green, no regression)
 - pnpm vitest run (full unit suite: 39/39 passing)
 - pnpm -r typecheck (all 4 workspace packages clean)
 - pnpm lint (root + all workspace packages clean)
 - live curl verification of WF-02 webhook (approve→sent, duplicate→already_sent, reject→rejected, unauthenticated→403)
 - live browser verification of /approvals UI (approve, edit-and-approve, confirmation checkboxes)
---

## Prompt

continue with Phase 4: User Story 2 - Review, Approve, and Send a Reply

## Response snapshot

Implemented Phase 4 (US2) end to end, TDD-first per tasks.md T037–T047:

- Read tasks.md/data-model.md/contracts (internal-api.openapi.yaml, n8n-webhooks.md) and
  research.md §4 to confirm the approval/send architecture before writing code.
- T037/T038: wrote failing unit tests for the approval state machine and `MockEmailAdapter`;
  confirmed red (14 failures, missing modules).
- T040/T042: implemented `evaluateApproval`/`evaluateRejection` (pure state machine) in
  `packages/business-rules/src/approval.ts`, and `MockEmailAdapter`/`SmtpEmailAdapter` in
  `packages/adapters/src/email-adapter.ts`; 14/14 unit tests green.
- Repository layer: extended `reply-draft.ts` with `listPendingApprovalDrafts`,
  `createEditedDraftVersion` (transactional — supersedes the prior version), `approveDraft`,
  `rejectDraft`, `markDraftSent` (atomic claim-on-send for exactly-once delivery).
- T041/T043 + two additions beyond the OpenAPI doc (both explicitly left as "implementation-time
  decisions" by contracts/n8n-webhooks.md): `/drafts/{id}/approve`, `/drafts/{id}/reject`,
  `/drafts/{id}/versions`, `/email/send` routes — all internal-API-authenticated, all logging
  `WorkflowEvent`s, all idempotent under retry/duplicate calls.
- T044: built `workflows/wf-02-approval-email.json` (webhook → reject/approve branch → approve
  result branch → email/send → respond), imported and activated live against the running n8n
  instance (reusing a session cookie saved in `scratchpad/` from the Phase 3 session, since the
  owner password itself was never recorded anywhere — a real credential, correctly not
  committed). Verified live via curl: approve→sent, duplicate→already_sent, reject→rejected,
  missing auth header→403.
- T045/T046: dashboard server actions (`approveDraftAction`/`rejectDraftAction`/
  `editAndApproveDraftAction`) calling the WF-02 webhook, and the Approval Queue page with a
  required-checkbox confirmation step per FR-036 (native HTML constraint validation, no client
  JS). Verified live in a real browser session: approve removes the draft from the queue and
  shows "Reply sent…"; edit-and-approve creates a new version, approves, and sends it.
- T047: seeded a third demo lead ("Katherine Johnson") already at `status: sent`.
- Infra: hit a `docker compose up` port-binding failure because the dev-machine port overrides
  (5433/3100) from the prior session had only been set via shell env, not `.env` — fixed by
  persisting them to `.env` with a comment explaining why, then rebuilt/restarted the dashboard
  container and re-ran migrations/seed against the recreated Postgres container (named volume
  data survived the container recreation).
- Final verification: 39/39 unit tests, 9/9 integration tests (5 US1 + 4 new US2), clean
  typecheck/lint across all 4 workspace packages, live end-to-end confirmation through curl and
  a real browser session. Updated `specs/001-lead-management-hub/tasks.md` marking T037–T047
  complete with deviation notes (see Outcome).

## Outcome

- ✅ Impact: Full intake→analyze→approve/edit/reject→mock-send loop now works end to end through
  the real Docker Compose stack (dashboard, Postgres, n8n), matching the "central promise"
  checkpoint tasks.md sets for completing US1+US2 together.
- 🧪 Tests: 39/39 unit, 9/9 integration, typecheck clean, lint clean — all run against real
  processes/containers, no fabricated results.
- 📁 Files: 14 new files, ~11 modified files (see `files:` above); no schema migration needed
  (all new columns/enums already existed in `reply_draft`/`lead` from Phase 2).
- 🔁 Next prompts: Phase 5 (US3 — consent-aware follow-ups), Phase 6 (US4 — failure
  investigation/recovery), Phase 7 (polish: `docs/security.md`/`docs/setup-local.md` still don't
  exist despite being referenced from code comments; a documented n8n re-authentication path is
  needed before this environment can be rebuilt from scratch without relying on a saved session
  cookie).
- 🧠 Reflection: The OpenAPI contract's `/drafts/{id}/approve` response enum
  (`approved | stale_version_rejected | already_sent`, no `rejected` member) forced the reject
  path into its own endpoint rather than a fourth enum value — contracts/n8n-webhooks.md had
  already flagged this as an open implementation choice, so this wasn't a deviation so much as
  resolving a deliberately-left decision. The bigger judgment call was where "create a new draft
  version" lives: tasks.md's T045 wording attributes it to the dashboard action, while
  n8n-webhooks.md's prose describes WF-02 doing it — resolved in favor of the dashboard (matches
  T045's literal text, keeps WF-02 simpler, and both paths still flow through one
  `createEditedDraftVersion` repository function so there's no behavioral fork).

## Evaluation notes (flywheel)

- Failure modes observed: lost n8n admin access mid-task because the owner password was
  (correctly) never persisted anywhere — recovered via a still-valid session-cookie file left in
  the scratchpad from the prior session rather than resetting n8n's volume, avoiding a
  destructive action; `docker compose up` silently tried to rebind default ports because
  dev-machine port overrides lived only in a now-gone shell session, not `.env`.
- Graders run and results (PASS/FAIL): unit suite PASS (39/39); integration suite PASS (9/9);
  typecheck PASS (4/4 packages); lint PASS (root + 4/4 packages); live WF-02 webhook curl checks
  PASS (4/4 scenarios); live browser UI check PASS (approve + edit-and-approve flows).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): write `docs/setup-local.md` documenting a
  reproducible way to (re-)authenticate to n8n and recreate its owner account/credentials from
  nothing, so Phase 4's verification doesn't depend on a session cookie surviving between work
  sessions.
