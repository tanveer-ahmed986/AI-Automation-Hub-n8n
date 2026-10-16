---
id: 013
title: Redesign dashboard to dark premium SaaS UI
stage: misc
date: 2026-10-16
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: main
user: tanveer030402@gmail.com
command: (none — direct chat instruction)
labels: ["ui", "design", "theming", "accessibility"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - apps/dashboard/app/globals.css
 - apps/dashboard/app/layout.tsx
 - apps/dashboard/app/(dashboard)/layout.tsx
 - apps/dashboard/app/(dashboard)/page.tsx
 - apps/dashboard/components/nav-links.tsx
 - docs/setup-local.md
tests:
 - pnpm test (71/71 unit tests passing, re-run after redesign)
 - pnpm test:integration (16/16 integration tests passing, re-run after redesign)
 - pnpm typecheck (clean, all 4 workspace packages)
 - pnpm lint (clean, root + all workspace packages)
 - live verification of every dashboard page (Overview, Leads, Lead Detail, Approvals,
   Execution Log, Settings) via a real browser session against the rebuilt Docker Compose stack
 - live keyboard-navigation and focus-visible check
---

## Prompt

improve this UI of this project, see images folder and make ui just like this

## Response snapshot

Reviewed all 10 reference screenshots in `images/` (dark-theme SaaS/CRM dashboard mockups —
n8n, several fictional CRM products — collected as style inspiration, not a literal single
design to clone). Extracted the common visual language: dark navy background, left sidebar nav
with icons, card-based stat tiles with icon badges, vibrant accent color for primary actions,
subtle card borders.

Implemented as a token-level theme change plus a layout restructure, not a per-page rewrite —
the codebase already used shadcn's semantic Tailwind classes consistently everywhere (`bg-muted`,
`text-muted-foreground`, `border`, component variants), so most pages inherited the new look
automatically once the CSS custom properties changed:

- `app/globals.css`: replaced the default shadcn light theme with a dark-navy/indigo palette
  (oklch tokens) as the single default theme (no light/dark toggle — this is an internal
  reviewer tool, not a public site). Fixed a pre-existing, unrelated bug found along the way:
  `--font-sans` inside `@theme inline` was circularly self-referential with no concrete value
  ever defined, so the app was silently falling back to the browser's default serif font the
  entire time — not something my redesign introduced, but something that undercut the "premium"
  look until fixed.
- `app/layout.tsx`: apply `dark` class unconditionally on `<html>` so shadcn components' own
  `dark:` utility variants activate.
- `app/(dashboard)/layout.tsx`: replaced the horizontal top nav with a left sidebar (desktop,
  `md:flex`) containing a brand mark, icon+label nav items, matching every reference screenshot's
  layout — with a `md:hidden` horizontal-nav fallback for mobile (zero-JS responsive split, no
  hamburger/client state needed) to preserve the FR-037/SC-009 responsive guarantee from Phase 7.
- `components/nav-links.tsx`: new client component (justified "use client" — purely cosmetic
  active-nav-item highlighting via `usePathname`, no business logic) shared by both the sidebar
  and mobile nav.
- `app/(dashboard)/page.tsx`: Overview tiles redesigned with icon badges (Users/Clock3/Send/
  AlertTriangle from lucide-react) matching the reference stat-card style — deliberately did
  **not** add fabricated trend percentages ("+12%" etc.) like the reference mockups show, since
  this app has no historical baseline to compute real deltas from and the constitution prohibits
  fabricated data.
- Leads, Lead Detail, Approvals, Execution Log, and Settings pages needed **no changes** — they
  already consumed only semantic color tokens, confirmed by live re-verification of every page
  after the token swap.

Hit a genuine, time-consuming Docker build issue along the way: after several rapid rebuilds,
`docker compose up -d --build dashboard` kept shipping CSS that didn't reflect my source edits,
even with `--no-cache`. Diagnosed by comparing compiled CSS chunk hashes across a Docker build
vs. a local `pnpm --filter=dashboard run build` (the local build picked up changes correctly,
proving the issue was Docker-side, not a source/syntax error) — root-caused to a stale BuildKit
build-cache store that `--no-cache` alone didn't clear; `docker builder prune -af` fixed it.
Documented this as a troubleshooting entry in `docs/setup-local.md` since it's a real gotcha for
future rapid-iteration sessions, not a one-off.

Also caught and fixed, mid-investigation, an unrelated verification gap from Phase 7: the T069
security check and an earlier font-debugging attempt were both silently checking a nonexistent
container path (`/app/apps/dashboard/.next/static`, suppressed via `2>/dev/null`) instead of the
Dockerfile's real runtime path (`/repo/apps/dashboard/.next/static`, since the runner stage's
WORKDIR is `/repo`). Re-ran the T069 secret-leak check against the correct path — still zero
matches, so the conclusion holds, but now for the right reason.

## Outcome

- ✅ Impact: the dashboard now matches the requested dark, premium SaaS aesthetic across every
  page, achieved almost entirely through the design-token layer rather than per-page rewrites —
  evidence the existing component architecture was built correctly in prior phases.
- 🧪 Tests: 71/71 unit, 16/16 integration, typecheck clean, lint clean, re-run after the redesign;
  every dashboard page live-verified in a real browser against the rebuilt stack.
- 📁 Files: 2 core files changed (globals.css, root layout.tsx), 2 new/changed for the sidebar
  (dashboard layout, nav-links component), 1 page redesigned (Overview tiles), 1 doc updated with
  a new troubleshooting entry.
- 🔁 Next prompts: none requested. If asked to extend the theme further, the four Table/Card/
  Badge/Button primitives in `components/ui/` are the next layer to touch for deeper density/
  spacing changes — not yet needed since token-level theming already achieved the visual target.
- 🧠 Reflection: the Docker CSS-staleness issue cost significant turns, but the diagnostic
  approach (compare a fast local build against the slow Docker build to isolate which side owns
  the bug, rather than guessing at Tailwind semantics) was the right instinct and is worth
  reusing — Docker rebuild loops are too slow to be the primary feedback loop for CSS iteration.

## Evaluation notes (flywheel)

- Failure modes observed: (1) a stale Docker BuildKit cache silently shipped old CSS across
  multiple `--build` and even `--no-cache` rebuilds — only `docker builder prune -af` resolved
  it; (2) an earlier Phase 7 verification command's error output was suppressed with `2>/dev/null`
  masking a wrong path, which could have let a real secret-leak check silently no-op — re-verified
  against the correct path this session; (3) browser-automation `resize_window` still does not
  change the rendered viewport in this environment (third occurrence across sessions), so mobile
  responsiveness for the new sidebar's `md:hidden` fallback was verified by code review/pattern
  consistency, not a live mobile screenshot.
- Graders run and results (PASS/FAIL): unit suite PASS (71/71); integration suite PASS (16/16);
  typecheck PASS (4/4); lint PASS; live full-page visual verification PASS (6/6 dashboard pages).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): when a Docker-built artifact doesn't reflect a source
  change and `--no-cache` doesn't fix it, go straight to `docker builder prune -af` rather than
  re-attempting `--no-cache` rebuilds or re-reading the source for a syntax bug that isn't there.
