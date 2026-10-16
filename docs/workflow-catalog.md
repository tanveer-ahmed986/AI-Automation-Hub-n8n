# Workflow Catalog

The four n8n workflows exported as JSON under [`workflows/`](../workflows/).
Each entry lists the real node names and types from the exported file (not
an idealized description) — see `docs/architecture.md` for why these
workflows stay thin orchestrators rather than containing business logic.

All four were built and verified against the pinned `n8nio/n8n:2.43.5`
image. Node parameter shapes are not assumed valid from documentation
alone — every workflow listed here has been imported into a running
instance of that exact image and exercised at least once (see each
workflow's Verification note below).

---

## WF-01 — Lead Intake and Qualification

**File**: `workflows/wf-01-lead-intake.json`
**Trigger**: public Webhook (`POST /webhook/lead-intake`)

| Node | Type | Purpose |
|---|---|---|
| Lead Intake Webhook | `n8n-nodes-base.webhook` | Public entry point; n8n's own payload-size cap (`N8N_PAYLOAD_SIZE_MAX`) applies before anything downstream runs |
| Call /leads/intake | `n8n-nodes-base.httpRequest` | Forwards the body to `POST /api/internal/leads/intake` (validation, normalization, dedup, persistence) |
| Intake Accepted? | `n8n-nodes-base.if` | Branches on the API's success/failure response |
| Call /leads/{id}/analyze | `n8n-nodes-base.httpRequest` | On success, triggers AI analysis + draft creation |
| Respond - Received | `n8n-nodes-base.respondToWebhook` | Generic `{"status":"received","reference":"<leadId>"}` — never the analysis, score, or draft (reviewer-only data) |
| Respond - Rejected | `n8n-nodes-base.respondToWebhook` | Safe validation-failure message, never the API's raw error detail |

**Error handling**: `settings.errorWorkflow` → WF-04. Each HTTP node uses
the shared "Internal API Secret" credential (HTTP Header Auth,
`X-Internal-Api-Secret`).

**Verification**: imported and activated live; a real webhook POST with a
deliberately broken intake-node URL was used to confirm WF-04 fires only
for genuine production-trigger executions (`mode: "webhook"`), not for
`/rest/workflows/{id}/run`-triggered manual test executions — see
`specs/001-lead-management-hub/tasks.md` Phase 6 notes for the full
discovery.

## WF-02 — Approval and Email Delivery

**File**: `workflows/wf-02-approval-email.json`
**Trigger**: internal-only Webhook (`POST /webhook/approval-action`),
called exclusively by the dashboard's own Server Actions
(`apps/dashboard/app/(dashboard)/approvals/actions.ts`) — never reachable
from a browser or third party directly.

| Node | Type | Purpose |
|---|---|---|
| Approval Action Webhook | `n8n-nodes-base.webhook` | Receives `{ action, draftId, draftVersion, reviewerIdentity }` |
| Is Reject? | `n8n-nodes-base.if` | Branches reject vs. approve |
| Call /drafts/{id}/reject | `n8n-nodes-base.httpRequest` | Terminal rejection (FR-019) |
| Respond - Reject Outcome | `n8n-nodes-base.respondToWebhook` | `{"result":"rejected","mock":...}` |
| Call /drafts/{id}/approve | `n8n-nodes-base.httpRequest` | Atomically re-validates the draft is still the current pending version |
| Approved? | `n8n-nodes-base.if` | Only a genuine `approved` result proceeds to send — `already_sent` / `stale_version_rejected` stop here (FR-017/FR-023) |
| Call /email/send | `n8n-nodes-base.httpRequest` | Mock or live `EmailAdapter`, exactly once |
| Respond - Send Outcome | `n8n-nodes-base.respondToWebhook` | `{"result":"sent"|"already_sent",...}` |
| Respond - Approval Outcome | `n8n-nodes-base.respondToWebhook` | Fallback response path |

**Note — where "edit and approve" actually happens**: this workflow only
ever receives `action: "approve"` or `action: "reject"`. An edit-then-
approve from the dashboard UI creates the new `ReplyDraft` version
*before* calling this webhook (a direct repository call from
`editAndApproveDraftAction`, same pattern as the Settings page's own
server action) — the webhook then approves that already-created version
like any other. This is a deliberate, documented deviation from
`contracts/n8n-webhooks.md`'s original sketch (which left the exact split
as an implementation-time decision); it keeps "create a new version" as
one non-duplicated code path regardless of which dashboard action
triggers it.

**Error handling**: `settings.errorWorkflow` → WF-04.

**Verification**: exercised end-to-end via the dashboard UI (approve,
reject, edit-and-approve, and a repeated approve-click confirming
`already_sent` with no second delivery event) and via
`tests/integration/*.test.ts`.

## WF-03 — Follow-up Scheduler

**File**: `workflows/wf-03-follow-up-scheduler.json`
**Trigger**: Schedule Trigger (interval configured on import; see
`docs/setup-local.md`)

| Node | Type | Purpose |
|---|---|---|
| Schedule Trigger | `n8n-nodes-base.scheduleTrigger` | Periodic tick — no payload |
| Call /followups/due | `n8n-nodes-base.httpRequest` | Returns eligible follow-ups (consent, opt-out, reply status, attempt cap all checked in `packages/business-rules`, not here) |
| Split Out Due Follow-ups | `n8n-nodes-base.splitOut` | Fans out one item per eligible follow-up |
| Call /events (log follow-up created) | `n8n-nodes-base.httpRequest` | Logs the scheduling outcome; the actual send reuses WF-02's approval/email path, not a separate send step in this workflow |

**Error handling**: `settings.errorWorkflow` → WF-04.

**Verification**: exercised via the manual-run REST API against seeded
due/not-due follow-ups, and via `tests/integration/*.test.ts` covering
consent/opt-out/attempt-cap eligibility.

## WF-04 — Error Handler

**File**: `workflows/wf-04-error-handler.json`
**Trigger**: n8n's native Error Trigger (`n8n-nodes-base.errorTrigger`) —
not a webhook; n8n invokes this workflow automatically whenever a
*production-trigger* execution of any workflow whose
`settings.errorWorkflow` points here fails unexpectedly.

| Node | Type | Purpose |
|---|---|---|
| Error Trigger | `n8n-nodes-base.errorTrigger` | Receives n8n's own execution/error payload (`$json.workflow`, `$json.execution.error`, etc.) |
| Call /events (log unexpected failure) | `n8n-nodes-base.httpRequest` | `POST /api/internal/events` with `classification: "unexpected"` always, `leadId: null` (this workflow has no reliable way to recover which lead was involved), and a **recursively redacted** `safeMetadata` (see `packages/business-rules/src/error-classification.ts`) |

This workflow is deliberately the *only* place `classification: "unexpected"`
is ever logged — every other classification is self-logged by the
originating `/api/internal/*` route before a failure would ever reach
n8n's Error Trigger. If WF-04 fires for something that turns out to be a
recurring, nameable failure mode, the fix is to add explicit handling (and
a more specific classification) to the originating route, not to add logic
here.

**Not wired to anything itself** — `settings.errorWorkflow` is unset on
this workflow; an error handler erroring into itself would be a silent
failure trap.

**Verification**: fired live via a genuine production webhook POST against
a deliberately broken WF-01 node — the only way to actually exercise n8n's
Error Trigger mechanism, since `/rest/workflows/{id}/run` executions never
invoke it (`mode: "manual"` is excluded by n8n's own error-workflow logic;
verified empirically, not assumed from documentation). This same live
check caught and led to fixing a real nested-redaction gap — see
`specs/001-lead-management-hub/tasks.md` Phase 6 notes.

## Verifying error-workflow wiring on a given instance

See `docs/runbook.md`'s closing section — open each of WF-01/02/03 →
Settings (⋯ menu) → **Error Workflow** should show "WF-04 - Error Handler".
