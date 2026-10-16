---
id: 002
title: Install ui-ux-pro-max design skill
stage: misc
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: none
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: none
labels: [tooling, design, ui-ux, skills]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - .claude/skills/ (7 skill folders added: banner-design, brand, design, design-system, slides, ui-styling, ui-ux-pro-max)
 - .claude/ui-ux-pro-max-skill/LICENSE (new)
 - .claude/ui-ux-pro-max-skill/README.md (new)
tests:
 - none (tooling/configuration install, no application code changed)
---

## Prompt

also install ui ux pro max from https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git

## Response snapshot

Verified the repo via `gh repo view` (public, MIT-licensed, author
nextlevelbuilder) before cloning, then shallow-cloned to the scratchpad to
inspect before installing — consistent with the approach used for the
earlier n8n-skills install.

Found this is a much larger pack than the n8n one: 7 skill folders under
`.claude/skills/` (banner-design, brand, design, design-system, slides,
ui-styling, ui-ux-pro-max — the last being the flagship/entry skill with a
local BM25 search engine over design data: 79 styles, 192 palettes, 74
font pairings, 25 chart types, 22 stacks). No hooks, no MCP server
registration this time — just skill content plus local Python search
scripts and ~11MB of bundled OFL-licensed font binaries
(`ui-styling/canvas-fonts/`) used for local logo/banner/icon rendering.

Flagged two things to the user before installing: (1) the README pitches
a paid "Premium" tier for brand/logo/banner/slides/CIP features, yet those
skill folders are physically present and MIT-licensed in this public free
repo — treated everything in the repo as installable since the license
covers it, but surfaced the discrepancy rather than silently glossing over
it; (2) unlike the n8n skill, this one adds real repo weight (~11MB of
binary font files), which the earlier project-scoped default didn't need
to weigh. Asked a single scope question (project vs. global) given that
weight difference; user chose project-scoped again.

Verified the Prerequisites section: Python 3.x stdlib-only, "the scripts
install nothing and make no network calls" — confirmed by reading
`ui-ux-pro-max/SKILL.md`, which already instructs trying `python`, then
`python3`, then `py -3` as fallbacks. Checked this machine: the `python3`
shim resolves to the broken Windows Store app-execution alias, but `python`
resolves to a real Python 3.12.10 install — the skill's own fallback order
already handles this correctly, so no fix was needed.

Installed: copied all 7 skill folders into `.claude/skills/` (alongside
the previously-installed n8n skills), and copied `LICENSE` + `README.md`
into `.claude/ui-ux-pro-max-skill/` for attribution/reference. Did not
install the `ui-ux-pro-max-cli` (`uipro`) npm package globally — the
README's "Recommended" method — since directly copying the already-cloned
`.claude/skills/` content produces the same project-scoped result without
adding a new global third-party CLI dependency; noted this as an optional
follow-up if the user wants `uipro update` convenience later. Cleaned up
the scratch clone; confirmed via `git status` that everything landed as
new untracked files only.

## Outcome

- ✅ Impact: Project now has 7 additional design-intelligence skills
  (UI/UX styles, palettes, typography, charts, stack guidance, brand/logo/
  banner/slide design references) active for this repo, on top of the
  n8n skill pack installed earlier this session.
- 🧪 Tests: None applicable — tooling/config install only.
- 📁 Files: `.claude/skills/{banner-design,brand,design,design-system,
  slides,ui-styling,ui-ux-pro-max}/` (new), `.claude/ui-ux-pro-max-skill/
  {LICENSE,README.md}` (new), this PHR.
- 🔁 Next prompts: None required — skill activates automatically based on
  its description. Optional: install `ui-ux-pro-max-cli` globally
  (`npm install -g ui-ux-pro-max-cli`) later only if ongoing `uipro update`
  convenience is wanted; not needed for the skill to work as installed.
- 🧠 Reflection: The Basic/Premium README framing vs. the actual bundled
  skill folders being a mismatch is worth remembering generally when
  installing third-party skill packs — "what the marketing page says is
  gated" and "what the OSS license actually covers in the repo you cloned"
  can diverge, and it's worth surfacing that gap rather than either
  blocking on it or silently assuming the marketing copy is authoritative.

## Evaluation notes (flywheel)

- Failure modes observed: None — install went cleanly. Worth noting for
  future reference: this machine's `python3` command is a non-functional
  Windows Store alias stub; any future skill or script assuming `python3`
  works everywhere should be checked against `python` as a fallback on
  this machine specifically.
- Graders run and results (PASS/FAIL): n/a — no automated validation
  exists for this kind of install; manually verified file placement via
  `ls`/`du`/`git status`.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): When a skill's own search/
  generation scripts are first invoked (e.g., `ui-ux-pro-max/scripts/
  search.py`), confirm they resolve correctly relative to this project's
  `.claude/skills/ui-ux-pro-max/` path rather than the plugin-only
  `${CLAUDE_PLUGIN_ROOT}` variable shown in the skill's own example
  commands (that variable is unset in a manual, non-marketplace install).
