# Portfolio Demo Script

A ~4-minute walkthrough script for a recorded demo video or a live
screen-share, showing the full intake → AI analysis → approval → mock
send → event log loop. Uses only fictional data (constitution Principle
IV: "real prospect data MUST NEVER appear in screenshots, seed data, or
portfolio materials") — every name/email/message below is invented for
this demo and does not correspond to a real person or business.

**Before recording**: run `scripts/demo-reset.sh` (or `.ps1`) to start
from a known, clean seeded state, and confirm all three containers are
healthy (`./scripts/health-check.sh`).

## 1. Open on the Overview page (~20s)

`http://localhost:3000` — point out:
- The **DEMO MODE — Mock AI · Mock Email** badge in the header. Say
  explicitly: *"This entire demo runs with zero paid AI or email
  credentials — mock AI and mock email are the default, not a fallback."*
- The four tiles (Total Leads, Pending Approvals, Sent Replies, Failed
  Executions) — these reflect the seeded demo data, not a live system
  with real traffic.

## 2. Submit a new lead through the real n8n workflow (~45s)

In a terminal (or a prepared `curl` command on screen):

```bash
curl -X POST http://localhost:5678/webhook/lead-intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jordan Rivers",
    "email": "jordan.rivers@example.com",
    "message": "Looking for help automating our customer intake process — we get about 50 inquiries a week by email right now and it is unmanageable.",
    "service": "ai_automation",
    "consent_to_follow_up": true
  }'
```

Point out the response: `{"status":"received","reference":"<uuid>"}` —
*"The public-facing response never includes the AI's analysis or the
draft reply — those are reviewer-only, inside the dashboard."*

Optionally, switch to the n8n editor (`http://localhost:5678`) and show
WF-01's execution list — *"this ran through a real, exported n8n
workflow, not a hidden backend shortcut."*

## 3. Show the AI analysis and labeled-as-advisory draft (~45s)

Back in the dashboard, open the new lead from **Leads** or the
**Approval Queue**. Point out:
- The **AI-generated, advisory** badge next to the analysis and the draft
  — *"nothing here is presented as a guaranteed prediction or a
  commitment the system made on its own."*
- The lead score, category, intent, and missing-information list.
- The draft reply itself, generated from the business profile configured
  in **Settings** — *"it never invents a price, timeline, or guarantee it
  wasn't given — if the business profile doesn't have an answer, the
  draft says so rather than fabricating one."*

## 4. Approve and send (mock), then show it can't double-send (~45s)

In the **Approval Queue**:
- Click **Approve & Send** (after checking the confirm box) — show the
  confirmation message and the draft moving out of the queue.
- *"Nothing is ever sent without this explicit, confirmed human action —
  not the AI score, not any automated rule."*
- Reload the page and attempt to approve the same draft again (or show a
  prepared second click) — point out the `already_sent` result and that
  the Execution Log gained **no second delivery event** — *"this is
  enforced by an atomic version check in the workflow, not just a UI
  disable — a duplicate click or a retried request can't double-send."*

## 5. Show the Execution Log, including a real failure (~45s)

Open **Execution Log**. Point out:
- The `delivery` event just created, with `mock: true`.
- The seeded failed-analysis lead ("Grace Murray") — filter by
  **Classification: ai_provider** — *"every failure is classified into one
  of six categories, logged with a redacted summary, and paired with
  concrete recovery guidance — never a raw stack trace or secret."*
- Click through to `docs/runbook.md`'s matching section if narrating live.

## 6. Close on the architecture, briefly (~30s)

*"Under the hood, n8n stays a thin orchestrator — the public webhook,
scheduling, and error-routing — while every validation rule, the AI and
email adapters, and the approval state machine live in unit-tested
TypeScript behind an internal API. That split is documented in
`docs/architecture.md`, along with the tradeoffs considered."*

## Known limitations to state out loud (not to omit)

Say these plainly rather than letting the demo imply otherwise — per
constitution Principle VII:
- *"The reviewer/approval surface has no login of its own in this
  version — it's local-only by design, documented in `docs/security.md`,
  and would need real authentication before being exposed beyond this
  machine."*
- *"There's no inbound-email-reply detection — recording a reply or
  opt-out to stop a follow-up is a manual action in this version, not
  automatic."*
- *"Retention is indefinite by default right now — there's a documented
  manual SQL deletion path for an operator, but no automated policy yet;
  that's required before this would touch real client data."*

## Fictional data used in this script

`Jordan Rivers` / `jordan.rivers@example.com` and all seeded demo leads
(`database/seed/leads.ts`) are invented for this project. If recording a
new video, invent new fictional names rather than reusing a real
inquiry — never paste in an actual client's details to "make the demo
realistic."
