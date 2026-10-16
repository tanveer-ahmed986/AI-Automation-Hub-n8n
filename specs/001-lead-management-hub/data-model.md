# Data Model: AI Lead Management & Business Automation Hub

**Source**: [spec.md](./spec.md) Key Entities + Functional Requirements |
**ORM**: Drizzle (see [research.md](./research.md) §2)

All five entities map 1:1 to the spec's Key Entities. Enums are expressed
as Postgres `enum` types (or `varchar` + Zod enum validation at the
application boundary, decided at implementation time per entity — either
is acceptable; Drizzle supports both). Every table gets `id` (UUID,
default `gen_random_uuid()`), and timestamp columns are `timestamptz`.

## Lead

The normalized record of a single inbound inquiry.

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar(200) | NOT NULL |
| `email_normalized` | varchar(320) | NOT NULL — lowercased, trimmed (FR-003) |
| `company` | varchar(200) | nullable |
| `message` | varchar(5000) | NOT NULL — 5,000-char default limit (FR-003) |
| `service` | varchar(100) | nullable |
| `budget_original` | varchar(100) | nullable — original value preserved verbatim (`spec.md` FR-001) |
| `timeline` | varchar(100) | nullable |
| `source` | varchar(50) | nullable — constrained to a configured allow-list at the application layer |
| `consent_to_follow_up` | boolean | NOT NULL |
| `idempotency_key` | varchar(200) | nullable, UNIQUE when present (FR-005) |
| `message_fingerprint` | varchar(64) | NOT NULL — stable hash of normalized message, used for the fallback dedup rule |
| `status` | enum | `pending_review`, `approved`, `sent`, `closed`, `spam` — see state transitions below |
| `created_at` | timestamptz | NOT NULL, default now() |
| `updated_at` | timestamptz | NOT NULL, default now() |

**Indexes / constraints**:
- Unique index on `idempotency_key` (where not null).
- Composite index on `(email_normalized, message_fingerprint, created_at)`
  to make the 24-hour fallback dedup lookup
  (`FR-005`: "normalized email plus message fingerprint within a
  configurable time window defaulting to 24 hours") an indexed range
  query, not a full scan.

**State transitions** (`status`):
`pending_review → approved` (an analysis + draft exists and the first
draft version is approved) · `pending_review → spam` (AI classification,
FR-011; never auto-deletes) · `approved → sent` (email delivered, mock or
live) · `sent → closed` (reply received or manually closed — stops
follow-ups per FR-027) · any status `→ closed` via opt-out. No transition
ever skips `pending_review` for a first-time send (enforces FR-016 at the
data level, not just in application code).

## LeadAnalysis

The AI-produced qualification result. Exactly one per Lead (1:1 in MVP;
modeled as its own table rather than columns on `Lead` so a future
re-analysis / versioned-analysis enhancement doesn't require a schema
migration).

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `lead_id` | uuid | FK → `lead.id`, NOT NULL, UNIQUE (enforces 1:1 for MVP) |
| `model_provider` | varchar(50) | NOT NULL — `"mock"` or the real provider's identifier |
| `model_name` | varchar(100) | nullable |
| `category` | enum | `website_development`, `ai_automation`, `consulting`, `other`, `unknown` (`SPEC.md` FR-04) |
| `intent` | enum | `new_project`, `support`, `partnership`, `spam`, `other`, `unknown` |
| `urgency` | enum | `low`, `medium`, `high`, `unknown` |
| `budget_band` | enum | `unknown`, `under_100`, `100_499`, `500_999`, `1000_plus` |
| `lead_score` | smallint | NOT NULL, CHECK (`lead_score BETWEEN 0 AND 100`) — FR-008 |
| `score_factors` | text[] | NOT NULL default `'{}'` |
| `missing_information` | text[] | NOT NULL default `'{}'` |
| `recommended_next_action` | enum | `approve_reply`, `request_clarification`, `manual_review`, `mark_spam` |
| `summary` | varchar(500) | NOT NULL |
| `created_at` | timestamptz | NOT NULL, default now() |

**Validation rule**: this row is only ever written after the adapter's
raw output has passed the shared Zod schema (`packages/schemas`) in full
— a `LeadAnalysis` row existing is itself the proof that validation
passed (FR-009). A failed/malformed analysis produces a `WorkflowEvent`
instead, never a partial `LeadAnalysis` row.

## ReplyDraft

A versioned outbound message. Multiple rows per Lead (one per version).

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `lead_id` | uuid | FK → `lead.id`, NOT NULL |
| `version` | smallint | NOT NULL — starts at 1, increments per edit (FR-018) |
| `subject` | varchar(200) | NOT NULL |
| `body` | text | NOT NULL |
| `status` | enum | `pending_approval`, `approved`, `rejected`, `sent` |
| `approved_by` | varchar(200) | nullable — reviewer identity where available (FR-020) |
| `approved_at` | timestamptz | nullable |
| `sent_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now() |

**Indexes / constraints**:
- Unique index on `(lead_id, version)`.
- Application-level invariant (not a single SQL constraint, enforced in
  `packages/business-rules` and covered by unit tests): at most one row
  per `lead_id` may ever reach `status = 'sent'`; approving a new version
  must transition the previous version out of `pending_approval` so it
  can never be approved later (FR-018/FR-019).

**State transitions** (`status`):
`pending_approval → approved → sent` · `pending_approval → rejected`
(terminal — FR-019) · a new edit creates a **new row** at
`version + 1, status = pending_approval`; it never mutates a previous
version's row (preserves the audit trail FR-020 requires).

## WorkflowEvent

One row per workflow outcome (success or failure), across intake,
analysis, approval, delivery, follow-up, and error paths. Populates the
execution log (FR-035) and backs safe-retry guidance (FR-042).

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `lead_id` | uuid | FK → `lead.id`, nullable (intake-validation failures may have no lead yet) |
| `workflow_name` | varchar(100) | NOT NULL — e.g. `wf-01-lead-intake` |
| `execution_reference` | varchar(200) | nullable — n8n execution id, for cross-referencing the n8n UI |
| `event_type` | enum | `intake`, `analysis`, `approval`, `delivery`, `follow_up`, `error` |
| `status` | enum | `success`, `failed`, `retrying` |
| `classification` | enum | `validation`, `ai_provider`, `persistence`, `approval`, `email_delivery`, `unexpected`, nullable (only set when `status != success`) — FR-039 |
| `safe_metadata` | jsonb | NOT NULL default `'{}'` — redacted summary only; never raw secrets/tokens/stack traces (FR-041) |
| `created_at` | timestamptz | NOT NULL, default now() |

**Indexes**: index on `(lead_id, created_at)` for the lead-detail event
timeline; index on `(status, classification)` for the execution-log
filter/overview counts (FR-035's "failed executions" tile).

## FollowUp

A scheduled or sent follow-up message, governed by the Lead's consent and
reply/opt-out status.

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `lead_id` | uuid | FK → `lead.id`, NOT NULL |
| `scheduled_at` | timestamptz | NOT NULL |
| `attempt_number` | smallint | NOT NULL — 1-based, CHECK (`attempt_number >= 1`) |
| `status` | enum | `scheduled`, `pending_approval`, `approved`, `sent`, `cancelled` |
| `sent_at` | timestamptz | nullable |
| `cancelled_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, default now() |

**Indexes / constraints**:
- Unique index on `(lead_id, attempt_number)`.
- Index on `(status, scheduled_at)` for the scheduler's "due follow-ups"
  query (`POST /api/internal/followups/due` in
  [research.md](./research.md) §4).

**State transitions** (`status`):
`scheduled → pending_approval` (delay elapsed, eligibility re-checked) →
`approved → sent`, OR → `cancelled` from any non-terminal state the
moment a reply, closed status, or opt-out is recorded for the Lead
(FR-027). `attempt_number` is capped by the configured maximum (default
2, FR-028) — the scheduler simply does not create a row past the cap.

## BusinessProfile

Singleton configuration row read by draft generation (FR-013/FR-013a). Not
tied to any Lead — exactly one row exists in this version (single-tenant).

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PK |
| `business_name` | varchar(200) | NOT NULL |
| `services_offered` | text[] | NOT NULL default `'{}'` |
| `contact_details` | text | NOT NULL |
| `reply_tone` | varchar(50) | NOT NULL default `'professional'` |
| `signature` | text | NOT NULL |
| `updated_at` | timestamptz | NOT NULL, default now() |

**Validation rule**: draft generation (`/leads/{id}/analyze`) MUST read this
row and fail closed (route the lead to manual review, per FR-009's existing
fail-closed pattern) rather than draft with fabricated business details if
no profile row exists yet.

## Entity relationship summary

```text
Lead 1───1 LeadAnalysis
Lead 1───* ReplyDraft      (one row per version; ≤1 ever "sent")
Lead 1───* WorkflowEvent   (nullable lead_id for pre-lead intake failures)
Lead 1───* FollowUp        (one row per attempt, capped by configured max)
```

No entity stores credentials, API keys, or secrets (constitution
Principle VI / FR-033) — provider credentials live only in environment
configuration, never in these tables.
