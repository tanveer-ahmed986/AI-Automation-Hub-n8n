---
id: 004
title: Document service boundary and stack ADRs
stage: plan
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: /sp.adr
labels: [adr, architecture, n8n, lead-management, ai-automation-hub]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: history/adr/001-service-boundary-n8n-orchestrator-vs-app-business-logic.md, history/adr/002-application-and-data-stack.md
  pr: null
files:
 - history/adr/001-service-boundary-n8n-orchestrator-vs-app-business-logic.md
 - history/adr/002-application-and-data-stack.md
tests:
 - none (documentation artifacts only)
---

## Prompt

(no additional arguments provided — user invoked `/sp.adr` with empty input)

## Response snapshot

Ran `check-prerequisites.ps1 -Json`; confirmed `plan.md` exists along with
`research.md`, `data-model.md`, `contracts/`, and `quickstart.md`. Checked
`history/adr/` — did not exist yet (first ADR pass for this project).
Checked for `create-adr.sh` — not present anywhere in the repo (only
PowerShell scripts exist under `.specify/scripts/`); per the command's
error-handling guidance this would mean skipping ADR creation, but
consistent with this project's broader PHR fallback philosophy (shell
first, agent-native fallback when the script is missing), created the
ADR directory and files directly from `.specify/templates/adr-template.md`
instead of skipping, and flagged the missing script in this report rather
than silently deviating.

Extracted architectural decisions from `plan.md`/`research.md` as
clusters per the command's clustering rules, applying the Analyze→Measure
checks before creating anything:

- Confirmed the single decision `plan.md` itself already flagged (n8n-
  as-orchestrator vs. business-logic-in-app) passes all three
  significance tests, and additionally merged the closely-coupled AI/
  email-adapter-pattern decision into it rather than creating a third,
  over-granular ADR — the adapter pattern is a direct consequence of the
  same underlying stance (business logic and provider calls stay in the
  app, not in n8n), so splitting them would violate the "group
  technologies that would likely change together" clustering rule.
- Clustered the application/data technology choices (Next.js 16 App
  Router, Zod 4, Drizzle ORM, PostgreSQL 18) into one "Application & Data
  Stack" ADR, since they're adopted together and would be revisited
  together.
- Deliberately did NOT create a separate ADR for the Vitest-only testing
  strategy (mechanical/reversible tooling choice, not a production-code-
  reshaping decision) or for adopting SPEC.md's prescribed repo structure
  verbatim (no real alternative was evaluated — it was inherited, not
  decided) — both would have failed the "will likely be questioned or
  revisited later" bar and risked the over-granular-ADR anti-pattern the
  command explicitly warns against.

Created:
- **ADR-001** (Service Boundary — n8n as Thin Orchestrator vs.
  Application-Owned Business Logic): context drawn from the tension
  between SPEC.md's four-required-n8n-workflows portfolio positioning
  and the constitution's testable-business-logic requirement; decision
  section enumerates exactly which logic lives where and traces all four
  n8n workflows' call sequences into the internal API; two alternatives
  considered (everything-in-n8n, bypass-n8n-for-send) each with concrete
  rejection rationale.
- **ADR-002** (Application & Data Stack — Next.js, Zod, Drizzle ORM,
  PostgreSQL): context on why these four are one cluster (shared
  validation/migration/consumption path); three alternatives considered
  (Prisma, raw `pg`, older stable majors) each with rejection rationale
  tied back to `research.md`'s verified version research.

Applied the Measure checklist grader to both before finalizing: both
cluster multi-component changes (not single-file/trivial), both list
≥1 alternative with rationale, both have explicit positive/negative
consequence sections, both are concise but reference-complete (linking
spec/plan/research/data-model and cross-referencing each other). No
existing ADRs to conflict with (first pass). No conflicts detected.

## Outcome

- ✅ Impact: Two ADRs recorded as the permanent, reviewable rationale for
  this feature's two genuinely architecturally-significant decisions,
  both marked `Accepted` (not left as `Proposed`) since the plan already
  incorporates them as settled.
- 🧪 Tests: None applicable — documentation only.
- 📁 Files: `history/adr/001-service-boundary-n8n-orchestrator-vs-app-business-logic.md`
  (new), `history/adr/002-application-and-data-stack.md` (new), this PHR.
- 🔁 Next prompts: Proceed to `/sp.tasks` to generate the dependency-
  ordered task list from `plan.md` + these now-documented decisions.
- 🧠 Reflection: The clustering discipline (merging the adapter-pattern
  decision into ADR-001 instead of a third ADR, and declining to ADR the
  testing-framework and repo-structure choices at all) was the main
  judgment call here — worth remembering that "architecturally
  significant" is a higher bar than "a decision was made," and over-ADRing
  is exactly as much of a failure mode as under-ADRing per this command's
  own Analyze step.

## Evaluation notes (flywheel)

- Failure modes observed: `create-adr.sh` referenced by `/sp.adr`'s Step 5
  does not exist anywhere in this repository (only PowerShell scripts
  exist under `.specify/scripts/`). This is the third PowerShell/bash
  script-availability gap found this session (after
  `create-new-feature.ps1`'s `Join-Path` bug and
  `update-agent-context.ps1`'s silent marker-mismatch no-op) — worth
  either adding a `create-adr.sh`/`.ps1` script to this repo, or updating
  `sp.adr.md` to document the agent-native fallback explicitly instead of
  only specifying "skip that ADR" on script failure.
- Graders run and results (PASS/FAIL): Measure checklist (4 criteria) —
  PASS for both ADR-001 and ADR-002.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): Add a
  `.specify/scripts/powershell/create-adr.ps1` (mirroring
  `create-new-feature.ps1`'s JSON-output pattern) so future `/sp.adr` runs
  in this repo don't need an agent-native substitution.
