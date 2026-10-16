---
id: 001
title: Install n8n-skills plugin for Claude Code
stage: misc
date: 2026-10-15
surface: agent
model: claude-sonnet-5
feature: none
branch: 001-lead-management-hub
user: tanveer030402@gmail.com
command: none
labels: [tooling, n8n, skills, mcp, hooks]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - .claude/skills/ (15 skill folders: n8n-agents, n8n-binary-and-data, n8n-code-javascript, n8n-code-python, n8n-code-tool, n8n-error-handling, n8n-expression-syntax, n8n-mcp-tools-expert, n8n-multi-instance, n8n-node-configuration, n8n-self-hosting, n8n-subworkflows, n8n-validation-expert, n8n-workflow-patterns, using-n8n-mcp-skills)
 - .claude/n8n-mcp-skills/ (hooks/, LICENSE, NOTICES, NOTICES-APACHE-2.0.txt, README.md, docs/, .mcp.json.example)
 - .claude/settings.json (new — project hook wiring)
 - .mcp.json (new — project MCP server registration)
tests:
 - none (tooling/configuration install, no application code changed)
---

## Prompt

install the n8n skill from https://github.com/czlonkowski/n8n-skills.git

## Response snapshot

Verified the repo via `gh repo view` (public, MIT-licensed, authored by
Romuald Członkowski, the n8n-mcp maintainer) before touching anything, then
shallow-cloned it to the scratchpad to inspect contents rather than
installing blind. Found it is a full Claude Code **plugin** (not a single
skill): 14 n8n-specific skills + an always-on router skill
("using-n8n-mcp-skills"), a hooks enforcement layer (PreToolUse/PostToolUse
scripts keyed on n8n-mcp tool names), and an MCP server registration
("n8n-mcp", defaulting to a hosted `https://api.n8n-mcp.com/mcp` endpoint,
with a documented local-stdio alternative for a self-hosted n8n instance).

Read `docs/INSTALLATION.md`, `hooks/hooks.json`, and every hook script
(`get-node.sh`, `session-start.sh`, `post-tool-use/validate-workflow.sh`,
etc.) before deciding how to proceed — confirmed all hooks only inject
`additionalContext` text reminders (routing to the right specialist skill
based on node type or validated workflow JSON); none perform file writes,
network calls, or destructive actions, and all fail open (exit 0) if `jq`
is missing.

Because this spans multiple real decisions — install scope (this project
vs. globally for the user) and install depth (skills-only vs. full plugin
with hooks + a remote MCP endpoint) — asked the user via AskUserQuestion
rather than guessing. User chose: **this project only**, **full plugin
(skills + hooks + MCP server)**.

Installed accordingly:
- Copied all 15 skill folders into `.claude/skills/` (project-scoped,
  matches the repo's existing `.claude/commands/` convention).
- Copied `hooks/`, `LICENSE`, `NOTICES`, `NOTICES-APACHE-2.0.txt`,
  `README.md`, `docs/`, and `.mcp.json.example` into
  `.claude/n8n-mcp-skills/` (preserving MIT/Apache-2.0 attribution,
  `chmod +x` on all `.sh` files).
- Wrote `.claude/settings.json` with the same `SessionStart` /
  `PreToolUse` / `PostToolUse` hook wiring as upstream's `hooks/hooks.json`,
  substituting `$CLAUDE_PROJECT_DIR/.claude/n8n-mcp-skills/hooks/...` for
  the plugin-only `${CLAUDE_PLUGIN_ROOT}` variable (this is a manual
  install, not a marketplace plugin install, so that variable wouldn't
  resolve).
- Wrote project-level `.mcp.json` registering `n8n-mcp` as the hosted
  `streamable-http` endpoint (matching upstream's default `mcp.json`,
  since no live n8n instance/API key exists yet for this project — Docker
  Compose n8n is still a planned milestone per `SPEC.md`). Left
  `.mcp.json.example` in place as the documented path to switch to local
  stdio mode once a real n8n instance and API key exist.
- Discovered `jq` is not installed in this environment's Git Bash, so the
  hooks are wired but currently fail open silently (no warnings fire)
  until `jq` is available on PATH — flagged to the user rather than
  silently leaving this undiscovered.
- Cleaned up the scratch clone; confirmed via `git status` that
  everything landed as new untracked files/directories with nothing
  accidentally staged or committed.

## Outcome

- ✅ Impact: Project now has 15 n8n-specific Claude Code skills active
  for this repo, plus (currently inert pending `jq`) hook-based reminders
  and a live `n8n-mcp` MCP server connection for node search/validation
  during the upcoming `/sp.plan` and implementation phases.
- 🧪 Tests: None applicable — tooling/config install only.
- 📁 Files: `.claude/skills/*` (new), `.claude/n8n-mcp-skills/*` (new),
  `.claude/settings.json` (new), `.mcp.json` (new), this PHR.
- 🔁 Next prompts: Install `jq` if the hook reminders should actually
  fire (otherwise they're silently inert); once a self-hosted n8n
  instance exists (per `SPEC.md`'s Docker Compose milestone), consider
  switching `.mcp.json` to the local stdio mode in
  `.claude/n8n-mcp-skills/.mcp.json.example` with real
  `N8N_API_URL`/`N8N_API_KEY` to unlock live workflow create/update/test
  tools. Otherwise proceed to `/sp.plan`.
- 🧠 Reflection: Treating "install the n8n skill" as worth a scope/depth
  clarifying question (rather than guessing global-vs-project or
  skills-only-vs-full-plugin) was the right call here — the two options
  have materially different footprints (global environment mutation vs.
  project-scoped; static markdown vs. auto-firing hooks + a third-party
  network endpoint), and the user's actual answer (project-scoped, full
  plugin) wasn't the lower-footprint default I'd have picked if forced to
  guess silently.

## Evaluation notes (flywheel)

- Failure modes observed: `jq` is absent from this Git Bash environment,
  so every hook script's `command -v jq >/dev/null 2>&1 || exit 0` guard
  trips and the hooks are currently no-ops. Not a bug in the install,
  but worth surfacing since the user may expect the reminders to be
  active immediately.
- Graders run and results (PASS/FAIL): n/a — no automated validation
  exists for this kind of install; manually verified file placement via
  `ls`/`git status`.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): If `jq` gets installed later,
  verify at least one hook fires as expected (e.g., trigger a `get_node`
  MCP call and confirm the PreToolUse reminder appears) before relying on
  the enforcement layer during implementation.
