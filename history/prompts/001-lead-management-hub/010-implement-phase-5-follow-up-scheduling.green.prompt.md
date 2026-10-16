---
id: 010
title: Implement Phase 5 consent-aware follow-up scheduling
stage: green
date: 2026-10-16
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: (none — direct chat instruction continuing /sp.implement)
labels: ["implementation", "follow-up-scheduling", "n8n-workflow", "us3"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - tests/unit/business-rules/follow-up-eligibility.test.ts
 - tests/integration/follow-up.test.ts
 - packages/business-rules/src/follow-up.ts
 - packages/business-rules/src/index.ts
 - packages/schemas/src/index.ts
 - database/schema/follow-up.ts
 - database/migrations/0001_worried_the_hood.sql
 - database/seed/leads.ts
 - apps/dashboard/lib/repositories/follow-up.ts
 - apps/dashboard/lib/repositories/reply-draft.ts
 - apps/dashboard/lib/close-lead.ts
 - apps/dashboard/app/api/internal/followups/due/route.ts
 - apps/dashboard/app/api/internal/leads/[id]/close/route.ts
 - apps/dashboard/app/api/internal/drafts/[id]/approve/route.ts
 - apps/dashboard/app/api/internal/drafts/[id]/reject/route.ts
 - apps/dashboard/app/api/internal/email/send/route.ts
 - apps/dashboard/app/(dashboard)/approvals/page.tsx
 - apps/dashboard/app/(dashboard)/leads/[id]/page.tsx
 - apps/dashboard/app/(dashboard)/leads/[id]/actions.ts
 - workflows/wf-03-follow-up-scheduler.json
 - specs/001-lead-management-hub/tasks.md
 - .env
tests:
 - tests/unit/business-rules/follow-up-eligibility.test.ts (16 tests, red before T050, green after)
 - tests/integration/follow-up.test.ts (4 tests, green against live Docker Compose stack)
 - pnpm vitest run (full unit suite: 55/55 passing)
 - pnpm test:integration (full integration suite: 13/13 passing — 9 US1+US2 + 4 new US3)
 - pnpm -r typecheck (all 4 workspace packages clean)
 - pnpm lint (root + all workspace packages clean)
 - live curl/n8n-REST-API verification of WF-03 (manual Schedule Trigger run, Split Out → /events chain confirmed via persisted workflow_event rows)
 - live browser verification of lead-detail close/opt-out buttons and the Approval Queue's "Follow-up attempt N" badge
---

## Prompt

continue with Phase 5 (User Story 3 — Consent-Aware Follow-ups)

## Response snapshot

Implemented Phase 5 (US3) end to end, TDD-first per tasks.md T048–T054:

- Read tasks.md/data-model.md/research.md §4/contracts (n8n-webhooks.md, internal-api.openapi.yaml)
  to confirm the follow-up architecture before writing code. Found `FollowUpEligible`'s `draftId`
  field has no backing column on `FollowUp` in data-model.md — resolved by adding a nullable
  `draft_id` FK column via a new migration.
- T048: wrote 16 failing unit tests for follow-up eligibility rules; confirmed red (module missing).
- T050: implemented four pure functions in `packages/business-rules/src/follow-up.ts` —
  `evaluateNextFollowUpSchedule` (consent + max-attempts, called right after any successful send),
  `evaluateFollowUpDue` (delay-elapsed + lead-still-eligible), `isFollowUpCancellable`, and
  `buildFollowUpMessage` (deterministic templated content, never fabricates business details).
  16/16 green after implementation.
- Designed the state machine so a `FollowUp` row is created in `scheduled` status immediately
  after any successful send (initial or follow-up) rather than by the due-scan itself, matching
  data-model.md's documented `scheduled → pending_approval` transition literally: `/email/send`
  now looks up whether the just-sent draft was itself a follow-up (via the new `draft_id` link),
  marks that attempt `sent`, and calls `evaluateNextFollowUpSchedule` to decide whether/at which
  attempt number to schedule the next one.
- T051: implemented `GET /api/internal/followups/due` — a cancellation sweep (FR-027, any
  non-terminal follow-up whose lead has since closed/spam'd) followed by a due-scan that creates
  the next reviewable `ReplyDraft` (follow-up content) and flips the `FollowUp` row to
  `pending_approval`. Added a test-only `?asOf=<ISO8601>` override (never sent by n8n in
  production) so delay-elapsed scenarios are testable without a real 48h wait. Also added
  `POST /api/internal/leads/{id}/close` (reason: replied|opted_out|manual) — necessary because
  this demo has no inbound-email-reply-detection channel, so FR-027's "a reply ... is recorded"
  trigger is only satisfiable by a human recording it; backed by a shared `lib/close-lead.ts`
  helper also used by a new dashboard server action.
- T052: built `workflows/wf-03-follow-up-scheduler.json` (Schedule Trigger → GET /followups/due →
  Split Out → POST /events) and imported+activated it live (id `p0vzm5yYKFhi9hkK`). Deliberately
  does NOT call /drafts/{id}/approve or /email/send itself — FR-029 requires a follow-up's first
  version to get its own human approval, which happens through the dashboard's existing (already
  generic) Approval Queue, reusing WF-02 unchanged. Verified live via n8n's REST API: manually ran
  the workflow from its Schedule Trigger against real due data and confirmed via persisted
  `workflow_event` rows that Split Out correctly unwrapped the response array into per-item
  `$json` fields for the downstream HTTP node's expressions.
- T053: found that T045's dashboard actions and WF-02's workflow JSON needed **no changes** —
  both were already generic over `draftId`/`draftVersion`. What did need wiring: `/drafts/{id}
  /approve`, `/drafts/{id}/reject`, and `/email/send` now advance a linked `FollowUp` row's status
  in lockstep with the `ReplyDraft` row. Added a UI badge ("Follow-up attempt N") to the Approval
  Queue and close/opt-out buttons to the lead detail page (both confirmation-gated per FR-036).
  Re-ran T039's US2 integration test: all 4 still green, no regression.
- T054: seeded "Ada Lovelace" — an already-sent lead with one `scheduled` (not yet due) follow-up.
- Infra: generated and applied migration `0001_worried_the_hood.sql`; rebuilt/restarted the
  dashboard container; temporarily set `FOLLOWUP_DELAY_HOURS=0` to force a real due follow-up
  through the live WF-03 workflow for verification, then reverted and restarted again.
- Final verification: 55/55 unit tests, 13/13 integration tests, clean typecheck/lint, live
  end-to-end confirmation through curl, the n8n REST API, and a real browser session. Re-ran
  `pnpm db:seed` at the end to restore a pristine demo state (see Reflection).

## Outcome

- ✅ Impact: Leads that consent to follow-up and don't reply now get a bounded, human-approved
  sequence of follow-up messages, automatically cancelled on reply/close/opt-out — completing the
  three-story "intake → approve/send → follow-up" loop `spec.md` describes for US1–US3.
- 🧪 Tests: 55/55 unit, 13/13 integration, typecheck clean, lint clean — all run against real
  processes/containers, no fabricated results.
- 📁 Files: 6 new files, ~14 modified files (see `files:` above); one schema migration
  (`follow_up.draft_id`), applied live.
- 🔁 Next prompts: Phase 6 (US4 — failure investigation/recovery), Phase 7 (polish —
  `docs/security.md`/`docs/setup-local.md` still don't exist; the n8n re-authentication gap from
  Phase 4 is still open).
- 🧠 Reflection: The test-only `asOf` override on `/followups/due` is global (it evaluates every
  non-terminal follow-up against the simulated time, not just the one under test) — running
  `pnpm test:integration` against this same dev stack fast-forwarded the seeded demo fixture's own
  follow-up into `pending_approval` early. Not a logic defect (the route is correctly comparing
  `scheduled_at` against whatever `now` it's given); it's an expected interaction between a shared
  test-only hook and a shared dev database, now documented in tasks.md with the fix being "re-seed
  before a demo," not a code change.

## Evaluation notes (flywheel)

- Failure modes observed: data-model.md's `FollowUp` table had no column backing the documented
  `FollowUpEligible.draftId` field — required a schema addition, not just an implementation
  choice. The test-only `asOf` override's global scope (see Reflection) silently consumed a seed
  fixture partway through this session, caught only by directly inspecting the DB rather than
  trusting the UI render at face value.
- Graders run and results (PASS/FAIL): unit suite PASS (55/55); integration suite PASS (13/13);
  typecheck PASS (4/4 packages); lint PASS (root + 4/4 packages); live WF-03 n8n REST API
  verification PASS; live browser UI check PASS (follow-up badge, close/opt-out buttons).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): if a future session needs integration tests that
  don't disturb seeded demo data, scope the `asOf` override to a specific `leadId`/`followUpId`
  rather than evaluating the whole table — not done here since it would add parameters no real
  caller (n8n) ever needs, for a problem fully solved today by re-seeding.
