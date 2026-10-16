# n8n Webhook Contracts

These are the two externally-reachable n8n endpoints (the only parts of
the system a browser or a third-party form ever talks to directly). Both
sit in front of the internal API described in
[internal-api.openapi.yaml](./internal-api.openapi.yaml) — see
[research.md](../research.md) §4 for why the split exists.

## `POST /webhook/lead-intake` (public — WF-01 trigger)

**Who calls it**: a website form, or any external system submitting a
business inquiry.

**Request body**: same shape as `LeadIntakeRequest` in
`internal-api.openapi.yaml` (n8n forwards it close to unmodified; any
shape-level rejection — malformed JSON, wrong content type — happens in
n8n's own Webhook node before the internal API is ever called, per FR-002
and FR-007).

**Behavior**:
1. Reject non-JSON / oversized payloads at the webhook boundary (FR-007:
   60 req/min per source IP default, request-size cap).
2. Forward the body to `POST /api/internal/leads/intake`.
3. If the API returns `400`, respond to the caller with a clear, safe
   validation message (never the API's internal error detail verbatim —
   re-shape it) and status 400. No `WorkflowEvent` with `event_type:
   analysis` is created; a `validation`-classified event MAY be logged.
4. If the API returns `200`, call
   `POST /api/internal/leads/{leadId}/analyze`.
5. Respond to the caller with a generic "received" acknowledgment —
   **never** the AI analysis, score, or draft content (those are
   reviewer-only, surfaced in the dashboard, not in the public webhook
   response).
6. On any unexpected failure in steps 2-4, route to the WF-04 error
   handler (`POST /api/internal/events` with `classification:
   unexpected`), still returning a safe generic response to the caller —
   never a stack trace (FR-002, constitution Principle II).

**Response (success)**:
```json
{ "status": "received", "reference": "<leadId, for the submitter's own records only>" }
```

**Response (validation failure)**:
```json
{ "status": "rejected", "message": "<safe, human-readable reason>" }
```

## `POST /webhook/approval-action` (internal-only — WF-02 trigger)

**Who calls it**: the Next.js dashboard's server-side approve/edit-
approve/reject handler — never the browser directly, never a third
party. Treat this the same as the internal API from a trust perspective:
network-isolated plus the same shared internal secret header.

**Request body**:
```json
{
  "action": "approve | edit_and_approve | reject",
  "draftId": "<uuid>",
  "draftVersion": 1,
  "reviewerIdentity": "<string, optional>",
  "editedSubject": "<string, required only if action=edit_and_approve>",
  "editedBody": "<string, required only if action=edit_and_approve>"
}
```

**Behavior**:
- `reject`: calls nothing but the internal API's reject path (not shown
  in the OpenAPI doc above as a separate endpoint — implementation detail:
  may be folded into `/drafts/{id}/approve` as a third `result`, or a
  sibling `/drafts/{id}/reject` endpoint; decide at implementation time,
  keep it as trivial as the contract implies). Always terminal (FR-019).
- `edit_and_approve`: creates a **new** `ReplyDraft` version first (via
  the internal API), then approves that new version. The prior version
  becomes permanently unsendable (FR-018).
- `approve` / the newly-created version from `edit_and_approve`: calls
  `POST /api/internal/drafts/{id}/approve`. If the result is
  `stale_version_rejected` or `already_sent`, this workflow MUST stop
  and must NOT call `/email/send` — this is the concrete mechanism behind
  FR-017/FR-023 (exactly-once sending under retries or duplicate approval
  clicks).
- Only on a genuine `approved` result does this workflow call
  `POST /api/internal/email/send`.
- Every path (including early stops) logs a `WorkflowEvent` via
  `POST /api/internal/events` with `event_type: approval` or `delivery`.

**Response**:
```json
{ "result": "sent | already_sent | rejected | stale_version_rejected", "mock": true }
```
