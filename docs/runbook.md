# Operator Runbook — Investigating and Recovering from Failures

This runbook covers what to do when the **Execution Log** (`/execution-log` in the
dashboard) shows a `failed` or `retrying` event. Every workflow outcome — lead
intake, AI analysis, approval, delivery, and follow-up — is classified into
exactly one of six categories (FR-039). The classification taxonomy, the
auto-retry rule, and the recovery guidance below all come from a single
source of truth: `packages/business-rules/src/error-classification.ts`
(unit-tested in `tests/unit/business-rules/error-classification.test.ts`) —
this document narrates the same policy for a human reader, it does not
define a second one.

**Before anything else**: the Execution Log never shows raw secrets, tokens,
or stack traces (FR-041) — only a redacted summary (reason, relevant IDs,
safe error message). If you need more detail than the log shows, that detail
is deliberately not persisted; use the `executionReference` shown on the
event to look up the corresponding execution in n8n's own editor
(`http://localhost:5678` → **Executions**) instead.

## How to tell if a failure needs your attention at all

Open `/execution-log` and filter by **Status: failed**. For each event, the
**Classification** badge tells you which section below applies. The
**Recovery guidance** line under each event (also reproduced here) tells you
the next step without needing this document open at all — this runbook adds
the "why" and the exact click-path.

---

## `validation`

**What it means**: a submission was rejected before any lead was created —
malformed JSON, or a field that failed schema validation (missing message,
invalid email, etc.). FR-040: **never retried automatically.**

**Why it's never retried**: there is nothing to retry — no lead, draft, or
event identifier exists yet. Retrying the exact same request would just
fail the same way again.

**Recovery steps**:
1. Read the event's `safeMetadata.fields` — the list of field names that
   failed, never the raw submitted content (FR-006).
2. Ask the submitter to correct and resubmit through the normal public
   intake form/webhook. This creates a brand-new lead; there is no
   "resume" concept for a submission that never became a lead.
3. No dashboard action is needed or possible for this event.

---

## `ai_provider`

**What it means**: the AI adapter threw (provider unreachable/erroring) or
its output failed schema validation. Per spec.md's documented edge case,
**the lead is still stored** and routed to manual review — it is never shown
with a fabricated analysis.

**Auto-retry**: yes, bounded (FR-025) — n8n's own HTTP-node retry/backoff on
`POST /api/internal/leads/{id}/analyze` covers transient provider errors.

**Recovery steps**:
1. Open the lead from the event (**View lead →** link in the Execution Log,
   or search it under **Leads**). It has no AI Analysis or Draft Reply yet —
   the page says so explicitly.
2. If `AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL` are misconfigured (only relevant
   once `MOCK_AI=false` — see `docs/security.md`), fix the configuration and
   restart the dashboard container.
3. Re-trigger analysis for the same lead: call
   `POST /api/internal/leads/{id}/analyze` again (same `leadId`, no new
   lead is created) — either by re-running WF-01 in n8n for that execution,
   or with a direct `curl` using the lead's existing id.
4. If it succeeds, the lead now has an analysis and draft like any other —
   proceed through the normal Approval Queue flow.

---

## `persistence`

**What it means**: a database-layer operation failed (connection issue,
constraint violation, migration drift).

**Auto-retry**: no — a database problem needs attention before a retry can
possibly help.

**Recovery steps**:
1. Check the dashboard and Postgres containers are both healthy:
   `docker compose ps`.
2. Check migrations are up to date: `pnpm db:migrate` (see
   `docs/setup-local.md` for the host-vs-container `DATABASE_URL` note —
   scripts run from the host must point at `localhost:${POSTGRES_HOST_PORT}`,
   not the Docker service name `postgres`).
3. Once the underlying issue is fixed, retry the exact same operation that
   failed (re-submit the intake, re-approve the draft, etc.) — it is safe
   to repeat; nothing was partially committed (every write path here uses a
   single atomic insert/update, never a multi-step transaction left open
   across the failure).

---

## `approval`

**What it means**: an approve/reject request targeted a draft version that
is no longer current — already sent, already rejected, or superseded by a
newer edit (FR-017/FR-018/FR-023). **This is the system working correctly,
not a bug** — it is logged as `status: success` with the outcome in
`safeMetadata`, not as a `failed` event. It is listed here because the
*attempted* action still needs the operator to understand what happened.

**Auto-retry**: not applicable — retrying the identical stale request
produces the identical stale result.

**Recovery steps**:
1. Open the lead and look at its current **Draft Reply** card — that is
   always the authoritative latest version.
2. If it's still `pending_approval`, act on it from the Approval Queue as
   normal.
3. If it's already `sent`, no action is needed — the reviewer's intent was
   already fulfilled by an earlier action (most often a concurrent
   double-click, which this classification exists specifically to make
   safe).

---

## `email_delivery`

**What it means**: the email adapter threw while sending an approved draft
(SMTP timeout, provider error in live mode; the mock adapter only does this
when a test explicitly forces it).

**Auto-retry**: yes, bounded (FR-025) — configured on WF-02's
`Call /email/send` HTTP node (`retryOnFail`, `maxTries: 3`,
`waitBetweenTries: 2000`).

**Why retrying is always safe**: `POST /api/internal/email/send` never
marks a draft `sent` until the adapter call itself succeeds (see
`apps/dashboard/app/api/internal/email/send/route.ts`) — a failed attempt
leaves the draft at `approved`, so calling the exact same route again with
the same `draftId`/`draftVersion` can never produce a duplicate send. This
is also covered by `tests/integration/error-handling.test.ts`.

**Recovery steps**:
1. If `MOCK_EMAIL=false`, check `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/
   `SMTP_PASSWORD`/`EMAIL_FROM` are correct (see `docs/security.md`) and
   that the SMTP provider itself is reachable.
2. Re-run `POST /api/internal/email/send` with the same `draftId` and
   `draftVersion` shown in the event's `safeMetadata` — via n8n (re-run the
   WF-02 execution) or a direct call. It is always safe to repeat.
3. If it keeps failing, check the lead's **Draft Reply** card — it will
   still show `approved`, not `sent`, confirming no partial/duplicate
   delivery happened.

---

## `unexpected`

**What it means**: a failure that escaped every other classification —
always logged by **WF-04 (Error Handler)**, n8n's native Error Trigger
workflow, which is wired to WF-01/WF-02/WF-03 via each workflow's
Settings → Error Workflow. By construction, anything reaching WF-04 was
*not* already caught and classified by the originating `/api/internal/*`
route — if it had been, that route would have logged its own specific
classification and WF-04 would never have been invoked for it.

**Auto-retry**: no — by definition the cause isn't understood yet.

**Recovery steps**:
1. Read `safeMetadata.lastNodeExecuted` and `safeMetadata.error.message` —
   redacted (no stack trace, no secrets), but usually enough to identify
   what broke (e.g. `getaddrinfo ENOTFOUND` means a host is unreachable).
2. Open n8n (`http://localhost:5678` → **Executions**) and look up
   `safeMetadata.executionId` for the full (unredacted, operator-only)
   execution detail — node-by-node input/output and the real stack trace
   live there, not in the dashboard.
3. Once the cause is understood and fixed (commonly: a misconfigured node
   URL, or a dependent service being down), retry the originating action
   the same way you would for its "real" classification above — e.g. if a
   webhook delivery crashed WF-01 before intake, have the submitter
   resubmit; if WF-02's send step crashed, re-run `/email/send` for that
   draft.

---

## Verifying WF-04 itself is wired up

`workflows/wf-01-lead-intake.json`, `wf-02-approval-email.json`, and
`wf-03-follow-up-scheduler.json` all set `settings.errorWorkflow` to
`wf-04-error-handler.json`'s imported id. To confirm this live on a given
n8n instance: open each workflow → **Settings** (⋯ menu) → **Error
Workflow** should show "WF-04 - Error Handler". If it shows "None", WF-04
was imported but not wired — re-import following `docs/setup-local.md` and
set this field for each of the three workflows.
