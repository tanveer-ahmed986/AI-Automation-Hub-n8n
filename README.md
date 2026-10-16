# Z&T AI Automation Hub

A portfolio-grade **AI Lead Management & Business Automation Hub**: a
public webhook receives a business inquiry, a pluggable AI adapter
qualifies it against a strict schema, a reviewer approves or edits the
drafted reply before anything is sent, and every workflow outcome is
logged with a safe, redacted summary and recovery guidance. Built with
n8n (orchestration), a Next.js internal API + dashboard (business logic
and review UI), and PostgreSQL — see [`SPEC.md`](./SPEC.md) for the full
original specification this implements.

**Status**: all four user stories from
[`specs/001-lead-management-hub/spec.md`](./specs/001-lead-management-hub/spec.md)
are implemented and independently verified — intake/qualification,
approval/send, consent-aware follow-ups, and failure investigation/
recovery. This is a demo/portfolio build, not a production deployment —
see **Known limitations** below before treating it as one.

## Quick start

```bash
cp .env.example .env
docker compose up -d
```

Then complete n8n's one-time first-run setup (owner account, credential,
workflow import/activation — genuinely manual the first time, not
automated) — see [`docs/setup-local.md`](./docs/setup-local.md) for the
exact, verified steps. After that:

```bash
pnpm db:migrate
pnpm db:seed
```

Full command list in [`docs/setup-local.md`](./docs/setup-local.md); a
demo-only walkthrough script in
[`docs/portfolio-demo-script.md`](./docs/portfolio-demo-script.md).

No paid AI or email credentials are required for any of the above —
`DEMO_MODE`, `MOCK_AI`, and `MOCK_EMAIL` all default to `true`, and a
visible **DEMO MODE** indicator is shown in the dashboard whenever they're
active.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/project-documentation.md`](./docs/project-documentation.md) | The complete project document — overview, features, architecture, stack, screenshots, and a links to everything else below |
| [`docs/architecture.md`](./docs/architecture.md) | System diagram, the n8n-orchestrator/Next.js-business-logic split and why, request flow per workflow |
| [`docs/workflow-catalog.md`](./docs/workflow-catalog.md) | Node-by-node detail for each of the four n8n workflows |
| [`docs/setup-local.md`](./docs/setup-local.md) | The real, verified steps to bring the stack up from zero, including n8n's manual first-run setup |
| [`docs/testing.md`](./docs/testing.md) | What's unit/integration-tested, current pass/fail counts, how to run it |
| [`docs/manual-testing-guide.md`](./docs/manual-testing-guide.md) | A hands-on, click-through functional walkthrough you can follow and record for a showcase video |
| [`docs/security.md`](./docs/security.md) | Network isolation, secret handling, data minimization, the manual data-deletion procedure, and this version's documented approval-surface limitation |
| [`docs/runbook.md`](./docs/runbook.md) | Operator guide: what each Execution Log failure classification means and how to recover |
| [`docs/portfolio-demo-script.md`](./docs/portfolio-demo-script.md) | A scripted walkthrough for a recorded demo, using only fictional data |

## Known limitations

Documented here deliberately, per this project's own honesty principle
(see `SPEC.md` and the project constitution's Principle VII) — these are
known, intentional scope boundaries for a demo build, not oversights:

- **The reviewer/approval surface has no authentication of its own.** It
  relies entirely on the dashboard being reachable only at `127.0.0.1`.
  `reviewerIdentity` on an approval is a free-text, optional,
  self-reported field — not a verified login. This must be hardened
  before the dashboard is exposed beyond a single trusted machine. See
  `docs/security.md`.
- **No inbound-email-reply detection.** There's no channel for the system
  to notice a prospect actually replied; recording a reply or an opt-out
  (to stop scheduled follow-ups) is a manual action an operator takes on
  the lead's detail page.
- **Retention is indefinite by default.** Lead/analysis/draft/event/
  follow-up records are kept forever unless manually deleted via a
  documented SQL procedure (`docs/security.md`) — there is no automated
  retention/expiry policy yet. One is required before this system
  processes any real client data.
- **Single operator, no roles/RBAC.** There is one reviewer role; the
  system is not multi-tenant.
- **AI output is advisory only.** Lead scores, categories, and summaries
  are clearly labeled "AI-generated, advisory" everywhere they appear in
  the dashboard and are never used to trigger a send or any commitment by
  themselves — a human approval is always required.
- **No browser-based UI/visual regression testing.** Dashboard UI
  correctness is covered by manual verification each phase, not an
  automated E2E suite — see `docs/testing.md` for why, and what unit/
  integration coverage exists instead.

## Test status

As of the last update to this file: **71/71 unit tests**, **16/16
integration tests**, clean `tsc --noEmit` across all workspace packages,
and clean `eslint`. Re-run `pnpm test`, `pnpm test:integration`,
`pnpm typecheck`, and `pnpm lint` yourself before relying on this — see
`docs/testing.md` for the full breakdown of what each suite covers.

## Teardown

```bash
docker compose down -v
```

`-v` removes the seeded Postgres and n8n data volumes — intended for a
demo reset. To restore a clean demo state without a full teardown, use
`scripts/demo-reset.sh` (or `.ps1`).

## Repository structure

See [`docs/architecture.md`](./docs/architecture.md)'s repository-layout
table, or [`specs/001-lead-management-hub/plan.md`](./specs/001-lead-management-hub/plan.md)
for the original planned structure this follows.
