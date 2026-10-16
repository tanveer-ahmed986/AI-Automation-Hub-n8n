# Testing

## Commands

```bash
pnpm test              # unit tests (Vitest, vitest.config.ts)
pnpm test:integration   # integration tests, against the running Docker Compose stack
pnpm typecheck          # tsc --noEmit across all workspace packages
pnpm lint               # ESLint, root + per-package
```

Integration tests expect `docker compose up -d` to already be running
(Postgres, n8n, and the dashboard all healthy — `./scripts/health-check.sh`)
and, when run from the host rather than inside a container, the same
`DATABASE_URL` host-port override documented in `docs/setup-local.md` §6.

## Current results (re-run for this doc, not carried forward from memory)

| Suite | Files | Tests | Result |
|---|---|---|---|
| `pnpm test` | 7 | 71 | 71 passed |
| `pnpm test:integration` | 4 | 16 | 16 passed |
| `pnpm typecheck` | 4 packages | — | clean |
| `pnpm lint` | root + 4 packages | — | see below |

Re-run these commands yourself before trusting this table for anything
beyond "this is what passed as of the last doc update" — per the
constitution's Honest Representation principle, this file is updated
alongside the code, not treated as a standing guarantee.

## What's unit-tested (`tests/unit/`)

| File | Covers |
|---|---|
| `business-rules/lead-validation.test.ts` | Intake schema validation, normalization (email lowercasing/trim, message length cap) |
| `business-rules/dedup.test.ts` | Idempotency-key matching, the `(email_normalized, message_fingerprint, created_at)` fallback dedup window |
| `business-rules/approval-state-machine.test.ts` | Draft version transitions — approve/reject/edit, exactly-once-sent invariant |
| `business-rules/follow-up-eligibility.test.ts` | Consent, opt-out/closed cancellation, attempt-cap enforcement |
| `business-rules/error-classification.test.ts` | The six-category failure taxonomy, auto-retry eligibility, recovery guidance text, and — critically — **recursive** redaction (including a regression case for a stack trace nested inside another object) |
| `adapters/ai-adapter.test.ts` | `MockAiAdapter` determinism (same input → same output, for reproducible demos) and schema-shape guarantees |
| `adapters/email-adapter.test.ts` | `MockEmailAdapter` simulated-send recording, and the test-only forced-failure hook used by the integration error-handling test |

## What's integration-tested (`tests/integration/`)

Real HTTP calls against the actual running stack — no mocked Next.js
internals, no mocked Postgres.

| File | Covers |
|---|---|
| `lead-intake.test.ts` | End-to-end intake → analysis → draft creation; duplicate submission (idempotency key and fallback window) returns the existing lead rather than creating a second one |
| `approval-flow.test.ts` | Approve / reject / edit-and-approve through the real WF-02 n8n webhook; a repeated approve on an already-sent draft returns `already_sent` with no second delivery event |
| `follow-up.test.ts` | Consent-gated follow-up scheduling, cancellation on reply/close/opt-out, attempt-cap enforcement, via a test-only `?asOf=` override on `/followups/due` (see the "known interaction" note in `specs/001-lead-management-hub/tasks.md` Phase 5 — this override is global across all non-terminal follow-ups in the table, so re-seed after running this suite if a pristine demo state is needed) |
| `error-handling.test.ts` | Malformed-JSON and schema-validation intake failures are logged to the Execution Log; a simulated transient email-delivery failure confirms a retry reuses the same `leadId`/`draftId` rather than duplicating |

## What's deliberately *not* automated

- **n8n's own Error Trigger firing for a genuine production-trigger
  crash** (WF-04) — this was verified live, manually, against the real
  Docker Compose stack, specifically because `/rest/workflows/{id}/run`
  executions never invoke it (`mode: "manual"` is excluded by n8n's own
  logic). An automated test would need to POST to a real public webhook
  with a deliberately broken node — judged not worth the fragility this
  session for a one-time structural verification; re-verify manually per
  `docs/workflow-catalog.md`'s WF-04 entry if that wiring is ever touched
  again.
- **Browser-based UI/visual regression testing** (e.g. Playwright) — a
  deliberate scope decision from `research.md` §3: the constitution's
  testing requirement is satisfied by unit + integration coverage of
  validation/scoring/idempotency/approval/follow-up logic and the
  end-to-end workflow paths; no functional requirement or success
  criterion calls for literal browser automation. Dashboard UI
  correctness (labels, badges, filtering, responsive layout) has instead
  been verified manually in a real browser each phase — see each phase's
  entry in `specs/001-lead-management-hub/tasks.md` and the accessibility
  note in that file's Phase 7 section.

## Adding a test for a new failure mode

If you add a new classification-worthy failure path, follow the existing
pattern: a unit test for the pure classification/redaction logic in
`packages/business-rules`, and an integration test that drives the real
route and asserts on the resulting `WorkflowEvent` row via
`GET /api/internal/events` — see `error-handling.test.ts` for the shape.
