# ADR-002: Application & Data Stack — Next.js, Zod, Drizzle ORM, and PostgreSQL

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-15
- **Feature:** 001-lead-management-hub
- **Context:** `SPEC.md` §9 and the constitution's Technology &
  Architecture Constraints already fix the top-level choices — Next.js +
  TypeScript for the dashboard, PostgreSQL for persistence, Zod (or
  equivalent) for validation — but leave the data-access layer (ORM vs.
  query builder vs. raw SQL) and exact version pins unspecified. These
  four pieces work together as one integrated application/data stack:
  Zod schemas shape what the API accepts and what Drizzle persists;
  Drizzle's migration files are the only path PostgreSQL's schema
  changes; and all three are consumed exclusively by the one Next.js app
  (no separate backend service — see ADR-001). They would be revisited
  together, not independently, if any one of them changed.

<!-- Significance checklist (ALL must be true to justify this ADR)
     1) Impact: Long-term consequence for architecture/platform/security?
     2) Alternatives: Multiple viable options considered with tradeoffs?
     3) Scope: Cross-cutting concern (not an isolated detail)?
     If any are false, prefer capturing as a PHR note instead of an ADR. -->

## Decision

- **Framework**: Next.js 16.4.x, App Router, with Cache Components
  enabled (current stable default as of this project's start).
- **Language**: TypeScript 5.x on Node.js 24.x (Active LTS).
- **Validation**: Zod 4.x (`^4.6`) — the single schema layer for both
  inbound lead-intake payloads and AI-adapter output validation
  (`packages/schemas`), shared between the internal API and
  `packages/business-rules`.
- **Data access**: Drizzle ORM + `drizzle-kit`, wrapped behind a thin
  repository module per entity so the "repository/data-access boundary"
  the constitution requires is explicit in code structure, not just
  incidental.
- **Database**: PostgreSQL 18.x, run via Docker Compose for local/demo
  use; schema and migrations live under `database/migrations`, generated
  by `drizzle-kit`, never hand-edited in production.
- **Styling/UI**: Tailwind CSS + shadcn/ui (already adopted per the
  project's installed `ui-ux-pro-max`/`ui-styling` skill content; not
  independently re-litigated here since it doesn't affect the data/API
  layer this ADR covers).

## Consequences

### Positive

- One validation source of truth (Zod) spans the HTTP boundary and the
  persistence boundary, so a schema change is made once and both layers
  stay consistent by construction — directly supports constitution
  Principle II (validate everything) and FR-009.
- Drizzle's lack of a separate binary query engine (unlike Prisma's
  ~800KB Rust engine) means faster container cold-starts in the Next.js
  app and one less moving part in the Docker Compose stack.
- SQL-level control in Drizzle's query API makes the "parameterized
  queries, validated identifiers" security requirement (constitution
  Principle VI) visually auditable in code review — queries read close
  to the SQL they execute, rather than being hidden behind a heavier
  abstraction.
- Drizzle's native support for array columns (`score_factors`,
  `missing_information`) and JSON columns (`safe_metadata`) maps directly
  onto the data model in `data-model.md` without workarounds.
- Cache Components in Next.js 16 give the dashboard's read-heavy views
  (Overview, Leads list, Execution log) an explicit, reviewable caching
  boundary (`use cache`) rather than ad hoc `fetch` cache configuration.

### Negative

- Drizzle has a smaller ecosystem and fewer extremely-high-level
  conveniences (e.g., Prisma's nested-write API) than Prisma — nested
  create/update patterns (e.g., "create a Lead and its first
  ReplyDraft together") need to be written as explicit multi-statement
  transactions rather than one generated call.
- Pinning to current-stable majors (Next.js 16, PostgreSQL 18, Zod 4)
  means this project inherits whatever rough edges exist in those
  recent releases (e.g., Cache Components being a newer default
  behavior) rather than the longer production track record of one
  major version back; mitigated by this being a portfolio/demo project
  where catching current-generation issues early is acceptable risk.
- Node.js 24 (not the brand-new Node 26, which entered LTS on
  2026-10-28) means this project will need a deliberate future upgrade
  once the ecosystem catches up to Node 26, rather than starting on the
  newest LTS line.

## Alternatives Considered

**Alternative A — Prisma instead of Drizzle.** Concise schema language,
generated client, strong nested-write support, and a larger ecosystem of
examples. *Why rejected*: heavier runtime (bundled query engine) adds
cold-start overhead in a project already running three containers
(Next.js, n8n, Postgres) on a single demo machine; current (2026)
community consensus for greenfield Next.js + PostgreSQL projects favors
Drizzle for exactly this kind of lightweight, SQL-adjacent, migration-
transparent use case (see `research.md` §2 for the verified sources).

**Alternative B — Raw `pg` client with hand-written SQL, no ORM.**
Maximum control, zero abstraction overhead. *Why rejected*: loses
migration tooling and compile-time type safety for the query layer,
which matters more here than the marginal performance gain, given the
number of entities (five) and the constitution's explicit requirement
for a clear repository/data-access boundary — hand-rolling that
boundary with raw SQL is strictly more code for the same guarantee
Drizzle already provides.

**Alternative C — An older, more battle-tested major version of each
component** (e.g., Next.js 15, PostgreSQL 17, Zod 3). *Why rejected*: no
specific functional requirement needs an older major, all four current
majors verified stable (not beta) as of this project's start (see
`research.md` §1), and the constitution calls for deliberate, current
dependency choices rather than defaulting to "whatever's familiar."

## References

- Feature Spec: `specs/001-lead-management-hub/spec.md`
- Implementation Plan: `specs/001-lead-management-hub/plan.md`
  ("Technical Context", "Project Structure")
- Research: `specs/001-lead-management-hub/research.md` §1, §2
- Data Model: `specs/001-lead-management-hub/data-model.md`
- Related ADRs: ADR-001 (Service Boundary) — this ADR defines what the
  application/data layer ADR-001 describes is built with.
- Evaluator Evidence: `history/prompts/001-lead-management-hub/003-plan-lead-hub-architecture.plan.prompt.md`
