---
id: 003
title: Plan lead hub architecture and design
stage: plan
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: /sp.plan
labels: [plan, architecture, n8n, lead-management, ai-automation-hub]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-lead-management-hub/plan.md
 - specs/001-lead-management-hub/research.md
 - specs/001-lead-management-hub/data-model.md
 - specs/001-lead-management-hub/quickstart.md
 - specs/001-lead-management-hub/contracts/internal-api.openapi.yaml
 - specs/001-lead-management-hub/contracts/n8n-webhooks.md
 - CLAUDE.md (manually added Active Technologies / Recent Changes sections)
tests:
 - none (planning artifacts only; no code written yet)
---

## Prompt

(no additional arguments provided — user invoked `/sp.plan` with empty input)

## Response snapshot

Ran `setup-plan.ps1 -Json` to scaffold `plan.md` and resolve paths; loaded
`spec.md` (post-clarification, 45 functional requirements) and the
ratified constitution (`v1.0.0`) as the two primary inputs.

**Phase 0 (research.md)**: Rather than guessing version numbers from
training data (dated to a Jan 2026 cutoff, five months stale as of today
2026-10-15), ran live web searches to verify: n8n 2.43.x stable, Node.js
24.x Active LTS (26 only just entered LTS on 2026-10-28, too fresh to
depend on), Next.js 16.4.x (Cache Components on by default), PostgreSQL
18.x stable (19 still beta), Zod 4.6.x. This follows the constitution's
Authoritative Source Mandate directly. Also resolved three implementation-
level decisions SPEC.md left open: Drizzle ORM over Prisma (lighter,
better PostgreSQL array/JSON fit, no codegen step — verified current 2026
community consensus via search), Vitest-only testing (covers every
required unit+integration case per the constitution without adding
Playwright, which isn't required by any FR/SC), and a provider-adapter
pattern for both AI and email (mock implementation as the *default*, not
a bypassed path, so FR-045's "switch mock→real without changing
validation guarantees" is structurally true).

The one genuinely architecturally-significant decision: whether n8n or
the Next.js app owns validation/business-rules/AI-adapter/email-adapter
logic. Decided n8n stays a thin orchestrator (public webhook, scheduling,
retries, error-routing) while all business logic lives in testable
TypeScript behind a non-public internal API n8n calls — keeping all four
of SPEC.md's named n8n workflows real and meaningful (not quietly
replaced by in-app-only logic), which matters because the portfolio
positioning explicitly showcases n8n-driven automation as the deliverable.
Documented the rejected alternative (bypassing n8n for the approval→send
step, which would be simpler/more robust but turns WF-02 into an unused
artifact) with rationale.

**Phase 1**: Wrote `data-model.md` (Lead, LeadAnalysis, ReplyDraft,
WorkflowEvent, FollowUp — columns, indexes/constraints enforcing FR-005's
24h dedup window and FR-018's version-based draft immutability at the
schema level, not just in application code, plus explicit state-transition
notes per entity). Wrote two contract files instead of one: 
`contracts/internal-api.openapi.yaml` (the real OpenAPI 3.0 contract for
the seven internal endpoints n8n calls) and `contracts/n8n-webhooks.md`
(the two externally-facing n8n webhook contracts — public lead intake and
the dashboard-only approval-action trigger — including the exact stale-
version/already-sent short-circuit logic that makes exactly-once sending
concrete rather than aspirational). Wrote `quickstart.md` as the target
reviewer experience (docker compose up → seed → submit a demo lead via
curl → approve in the dashboard → confirm idempotent re-approval → check
the execution log → run tests → optional live-provider switch → teardown).

Ran `update-agent-context.ps1 -AgentType claude`; it reported success but
actually no-opped, because this project's `CLAUDE.md` was authored
directly during `/sp` init (not generated from
`.specify/templates/agent-file-template.md`) and has no
`## Active Technologies` / `## Recent Changes` markers for the script to
target. Added both sections to `CLAUDE.md` by hand instead, with a note
flagging the script/template mismatch for whoever next touches that
script.

Filled the plan's Constitution Check as a table against all seven Core
Principles plus the Technology & Architecture Constraints — all PASS, no
Complexity Tracking entries needed. Re-confirmed post-design (the
internal-API/adapter design doesn't introduce anything the pre-design
check didn't already anticipate).

Per CLAUDE.md's ADR-suggestion rule, flagged the n8n-orchestrator-vs-
business-logic-in-app split as meeting all three significance criteria
(long-term impact, genuine alternatives considered, cross-cutting across
all four workflows) and surfaced the `/sp.adr` suggestion at the end of
`plan.md` — did not auto-create it.

## Outcome

- ✅ Impact: Complete Phase 0+1 planning artifacts for
  `001-lead-management-hub`, ready for `/sp.tasks`. Constitution Check
  passes with zero violations/justifications needed.
- 🧪 Tests: None run — planning only, no implementation code exists yet.
- 📁 Files: `plan.md`, `research.md`, `data-model.md`, `quickstart.md`,
  `contracts/internal-api.openapi.yaml`, `contracts/n8n-webhooks.md`
  (all new), `CLAUDE.md` (manually patched), this PHR.
- 🔁 Next prompts: Optionally run
  `/sp.adr n8n-as-orchestrator-vs-business-logic-in-app` to document the
  flagged decision before `/sp.tasks`; otherwise proceed straight to
  `/sp.tasks` to generate the dependency-ordered task list from these
  artifacts.
- 🧠 Reflection: Treating "verify current versions via web search" as a
  mandatory Phase-0 step (rather than asserting training-data versions)
  mattered concretely here — several assertions from memory alone
  (e.g., "Node 22 is current LTS," a plausible but five-months-stale
  belief) would have been wrong as of the actual session date.

## Evaluation notes (flywheel)

- Failure modes observed: `update-agent-context.ps1` silently no-ops
  (reports "✓ Updated" with a false-positive "Summary of changes" block)
  when the target `CLAUDE.md` lacks the markers
  `agent-file-template.md` assumes. Worth fixing the script to detect and
  warn on a missing-marker condition rather than reporting success,
  since this is the second PowerShell-script discrepancy found this
  session (the other being `create-new-feature.ps1`'s multi-segment
  `Join-Path` failure on Windows PowerShell 5.1, recorded in PHR 001 of
  this feature).
- Graders run and results (PASS/FAIL): Constitution Check — PASS (7/7
  principles + tech constraints, see table in `plan.md`). Plan-file
  placeholder scan — PASS (no unresolved `[...]` tokens via grep).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): Patch
  `update-agent-context.ps1` to fail loudly (or fall back to appending a
  clearly-marked new section) when its expected markers aren't found,
  instead of reporting a no-op as success.
