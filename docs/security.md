# Security

This documents what's actually configured and enforced in this codebase —
cross-checked against the running stack, not aspirational. See the
constitution's Principle VI (Least Privilege and Data Minimization) and
Principle I (Human Approval) for the governing requirements.

## Network isolation

- Every container port is bound to `127.0.0.1` only
  (`docker-compose.yml` — `"127.0.0.1:${...}:..."` on all three services).
  Nothing in this stack is reachable from another machine on the network
  by default; exposing it further (a reverse proxy, a public demo host)
  is a deliberate, separate decision requiring its own access controls,
  not a side effect of this compose file.
- The internal API (`/api/internal/*`) and the approval-action webhook
  (`/webhook/approval-action`) are reachable only from inside the Docker
  Compose network (`automation-hub` bridge) plus whatever is on
  `127.0.0.1` on the host — there is no public route to either.
- n8n's public surface is exactly one route: `/webhook/lead-intake`. Every
  other n8n workflow trigger (the approval-action webhook, the follow-up
  Schedule Trigger) is either internal-only by construction (never linked
  from anything public) or has no externally reachable trigger at all.

## Internal-API authentication

Every route under `/api/internal/*` requires the `X-Internal-Api-Secret`
header to exactly match `INTERNAL_API_SECRET` (`.env`), verified with a
**constant-time comparison**
(`apps/dashboard/lib/internal-api-auth.ts` — `timingSafeEqual`, not `===`,
specifically to avoid leaking the secret's length/contents through
response-timing side channels). A missing, wrong, or mismatched-length
header is rejected uniformly; n8n authenticates via a stored "Internal API
Secret" HTTP Header Auth credential (`docs/setup-local.md` step 4), never
a literal value in workflow JSON — workflow expressions on this installed
n8n version cannot read `$env` at all (verified live), so there's no
accidental path for the secret to leak into a committed workflow export
even by mistake.

**Verify this holds** (re-run whenever a new internal route is added):

```bash
curl -i http://localhost:3000/api/internal/events        # expect 401, no header
curl -i -H "X-Internal-Api-Secret: wrong" http://localhost:3000/api/internal/events   # expect 401
```

## Secrets never reach the browser

All credential/secret env vars (`INTERNAL_API_SECRET`, `AI_API_KEY`,
`SMTP_PASSWORD`, `N8N_ENCRYPTION_KEY`, `DATABASE_URL`) are read only in
server-side code — Route Handlers, repository modules, Server Actions —
never in a Client Component, and the dashboard has no public environment
variables (`NEXT_PUBLIC_*`) defined at all. `docs/testing.md`'s T069
hardening pass greps the built client bundle to confirm none of these
values appear in it; see that check's exact command there.

## Data minimization (FR-012)

The AI adapter interface
(`AiLeadAnalysisInput` in `packages/adapters/src/ai-adapter.ts`) accepts
only `name`, `message`, `service`, `budget`, `timeline` — never the lead's
email address, company name, internal lead id, or any other field not
needed to produce an analysis. This is enforced by the TypeScript
interface itself, not by convention: a caller cannot accidentally pass
more because the type doesn't accept it.

## Parameterized queries

All database access goes through Drizzle ORM
(`apps/dashboard/lib/repositories/*`), which parameterizes every query by
construction — there is no raw string-concatenated SQL anywhere in the
application code. The one exception is `database/seed/index.ts`'s
`TRUNCATE TABLE "${table}"`, which interpolates from a fixed, hardcoded
`SEEDED_TABLES` array (never user input) and only runs in the local
seed script, never in request-handling code.

## Public-webhook limits (FR-007)

- `WEBHOOK_RATE_LIMIT_PER_MINUTE` (default 60/min per source IP) and
  `WEBHOOK_MAX_BODY_BYTES` (default 20,000 bytes) are enforced at the
  internal API, which is the precise, configurable, byte-level cap.
- n8n's `N8N_PAYLOAD_SIZE_MAX=1` (1 MB) is a coarse, instance-wide
  defense-in-depth ceiling in front of that — the Webhook node has no
  per-request byte limit of its own (verified live), so this env var is
  what stops a truly oversized request from ever reaching the internal
  API's own, more precise check.

## No credentials in these tables (FR-033)

None of `lead`, `lead_analysis`, `reply_draft`, `workflow_event`, or
`follow_up` have any column intended to hold a credential, API key, or
secret — confirmed against `database/schema/*.ts`. Provider credentials
live only in environment configuration.

## Retention and manual deletion (FR-034)

This version retains lead/analysis/draft/event/follow-up records
indefinitely by default — there is no automated retention/expiry job.
**Before this system processes any real client data**, an automated
retention policy must be designed and implemented; this is explicitly out
of scope for the current portfolio/demo version.

In the meantime, an operator can manually delete a lead and every record
that references it with the following SQL, run against the app database
(`docker compose exec postgres psql -U automation_user -d automation_hub`,
or via `psql "$DATABASE_URL"` from the host with the port override from
`docs/setup-local.md` §6). Foreign keys here are **not** `ON DELETE CASCADE` by design (an accidental
cascade is a worse failure mode than a blocked delete for this kind of
data) — child rows must be deleted first,
in this order:

```sql
-- Replace :lead_id with the target lead's UUID.
DELETE FROM workflow_event WHERE lead_id = :lead_id;
DELETE FROM follow_up WHERE lead_id = :lead_id;
DELETE FROM reply_draft WHERE lead_id = :lead_id;
DELETE FROM lead_analysis WHERE lead_id = :lead_id;
DELETE FROM lead WHERE id = :lead_id;
```

There is no dashboard UI or API route for this today — it is a documented
operator procedure, not a self-service feature, consistent with "manual
deletion path" in FR-034's own wording. Building a guarded deletion
endpoint is reasonable future scope once a retention policy exists to
define when it should run.

## The approval surface is local/demo-only (constitution Principle I)

The Approval Queue has no authentication of its own — it relies entirely
on the dashboard being reachable only at `127.0.0.1`. There is no
reviewer login, no per-reviewer session, and `reviewerIdentity` on an
approval/rejection is a free-text, optional, self-reported field, not a
verified identity. This is a known, intentional limitation of this
version, not an oversight: the constitution requires that if secure
reviewer identity cannot yet be implemented, the approval surface **must**
be documented as local/demo-only rather than hidden — this is that
documentation. Before this dashboard is exposed beyond `127.0.0.1` (a
public portfolio demo, a real deployment), it needs real
authentication/authorization in front of the approval actions
specifically — approving/rejecting/sending are the one class of action in
this system with real external consequences.

## n8n editor access

The n8n editor itself (`http://localhost:5678`) has no additional access
control beyond its own owner-account login and the `127.0.0.1` binding.
Anyone with access to this host can reach it. See `docs/setup-local.md`
for first-run owner setup and the re-authentication path.

## Related docs

- `docs/setup-local.md` — credential setup, first-run n8n configuration
- `docs/architecture.md` — the internal-API boundary this document assumes
- `docs/runbook.md` — what a redacted Execution Log entry does and doesn't expose
