---
id: 015
title: Record an actual demo GIF via browser automation
stage: misc
date: 2026-10-16
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: main
user: tanveer030402@gmail.com
command: (none — direct chat instruction)
labels: ["demo", "showcase", "browser-automation"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - docs/demo/zt-automation-hub-demo.gif
 - README.md
 - docs/project-documentation.md
 - docs/portfolio-demo-script.md
tests:
 - every action in the recorded sequence executed live against the running Docker Compose stack
   (real clicks, real navigation, real approval) — not staged or simulated
 - ./scripts/demo-reset.sh run both before and after recording to bracket the session with a
   clean, documented fictional seed state
---

## Prompt

can you record a demo video ?

## Response snapshot

Clarified capability honestly before proceeding: no narrated/edited MP4 with voiceover is
possible, but the browser-automation toolset includes a genuine screen-recording capability
(`gif_creator`) that captures real clicks/navigation as an animated GIF with click indicators and
action labels — a literal, usable "small video" rather than a simulation.

Reset demo data to a clean, fictional seed state, then recorded an 11-frame walkthrough covering
the core loop end to end: Overview (live counts) → Leads (table) → Grace Hopper's lead detail
(AI Analysis card, labeled advisory) → Approvals (the draft, confirm checkbox, Approve & Send) →
the resulting "Reply sent" confirmation with the queue empty → Execution Log showing the real
`delivery` event with `mock: true`. Every click was a genuine interaction against the live stack,
not a staged/pre-rendered sequence — the lead, its AI analysis, and the delivery event are real
output, not mocked for the recording.

Exported and downloaded the GIF, moved it from the browser's download folder into
`docs/demo/zt-automation-hub-demo.gif`, re-ran `scripts/demo-reset.sh` afterward (the recording
itself changed real demo state — Grace Hopper's draft is genuinely `sent` now — so ended by
restoring a pristine state same as any other phase of work), and cross-referenced the new
recording from three existing docs: embedded at the top of `README.md`, given its own numbered
section in `docs/project-documentation.md` (renumbering every subsequent section to keep the
document's table of contents sequential), and noted at the top of `docs/portfolio-demo-script.md`
(which is the *narration* script for a longer video — this GIF is the silent, click-level
version of roughly its §3–§5).

## Outcome

- ✅ Impact: the project now has an actual recorded showcase artifact, not just scripts/guides
  describing how one could be made — closing the gap between "a video could be generated from
  this" (prior session) and "here is one."
- 🧪 Tests: n/a in the Vitest sense — the "test" here was that every frame of the recording is a
  real interaction against the live stack; verified by watching the resulting delivery event
  appear in the Execution Log within the same recorded sequence.
- 📁 Files: 1 new GIF (~1.3MB), 3 docs updated with cross-references (README, project
  documentation, demo script).
- 🔁 Next prompts: none requested. A natural follow-up, if wanted, is a longer narrated version
  following the full `docs/portfolio-demo-script.md` script (intake webhook, duplicate-send
  safety, a validation failure) — this GIF intentionally covers only the browser-visible core
  loop, since `gif_creator` only captures browser tab actions, not terminal `curl` commands.
- 🧠 Reflection: the honest-capability framing up front (what I can and can't produce) mattered
  more than usual here — "record a demo video" has an obvious literal reading (narrated MP4) that
  this toolset cannot satisfy, and silently producing something lesser without naming the gap
  would have been a worse outcome than naming it and then actually delivering what was possible.

## Evaluation notes (flywheel)

- Failure modes observed: none — the recording flow (clear → start_recording → screenshot →
  interact → stop_recording → export) worked as documented on the first attempt.
- Graders run and results (PASS/FAIL): live walkthrough PASS (lead approved, delivery event
  logged, visible in the same recorded sequence); demo-reset PASS (both before and after).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): if a longer narrated video is wanted next, the
  `curl`-based steps from `docs/manual-testing-guide.md` (intake, duplicate-approval idempotency,
  validation failure) would need to run in a terminal visible within the recorded browser tab
  group (or be narrated over a cut) since `gif_creator` cannot capture an external terminal.
