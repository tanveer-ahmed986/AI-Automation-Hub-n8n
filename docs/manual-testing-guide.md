# Manual Testing Guide

A hands-on, click-through functional test of every major feature, written so you can follow it
step-by-step **and record your screen while doing it** to produce a short showcase video. Each
test states a goal, the exact steps, and the expected result — if a step doesn't match its
expected result, that's a real bug, not a video-editing problem to work around.

This is the "do it yourself, on camera" counterpart to:
- `docs/testing.md` — the automated Vitest suite (what's covered, how to run it without a camera)
- `docs/portfolio-demo-script.md` — a shorter, narration-focused script for an *edited* highlight
  reel, if you want something tighter than this full walkthrough

Total run time following every step at a normal pace: roughly 8–10 minutes.

## Before you start

1. Stack running and healthy:
   ```bash
   docker compose up -d
   ./scripts/health-check.sh
   ```
2. Clean, fictional demo data:
   ```bash
   ./scripts/demo-reset.sh        # or scripts/demo-reset.ps1 on Windows
   ```
3. Dashboard open in your browser at `http://localhost:3000` (or your `DASHBOARD_HOST_PORT`).
4. Have a terminal ready for the `curl` commands below.

If recording: start your recorder now, with the dashboard's **Overview** page as your first
frame.

---

## Test 1 — Overview tour

**Goal**: confirm the dashboard loads, shows live data, and is clearly marked as a demo.

1. Load `/` (Overview).

**Expected result**:
- The **DEMO MODE — Mock AI · Mock Email** badge is visible in the top-right corner.
- Four tiles show live counts: Total Leads, Pending Approvals, Sent Replies, Failed Executions.
- On a fresh `demo-reset`, these read **5 / 1 / 2 / 1**.

*If narrating*: "This entire demo runs with zero paid AI or email credentials — that badge means
mock AI and mock email are active, not a fallback state."

---

## Test 2 — Submit a new lead through the real n8n workflow

**Goal**: confirm the public intake webhook validates, stores, and triggers AI qualification —
through an actual n8n workflow, not a shortcut.

```bash
curl -X POST http://localhost:5678/webhook/lead-intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jordan Rivers",
    "email": "jordan.rivers@example.com",
    "message": "Looking for help automating our customer intake process.",
    "service": "ai_automation",
    "consent_to_follow_up": true
  }'
```

**Expected result**:
- Response: `{"status":"received","reference":"<uuid>"}` within a couple of seconds.
- The response contains **no** analysis, score, or draft content — that's reviewer-only.
- Reloading Overview shows **Total Leads** incremented by 1.

*Optional*: open `http://localhost:5678`, find WF-01 in **Executions**, and show the real
execution trace — proof this ran through an actual n8n workflow.

---

## Test 3 — Review the AI-generated qualification and draft

**Goal**: confirm the AI output is labeled advisory and never presented as a guaranteed fact.

1. Go to **Leads**, click **Jordan Rivers**.

**Expected result**:
- Submission details match exactly what you posted in Test 2.
- The **AI Analysis** card carries an **AI-generated, advisory** badge — category, intent,
  urgency, a 0–100 score explicitly labeled "advisory — never a guaranteed prediction."
- The **Draft Reply** card also carries the advisory badge, with a subject and body generated
  from the business profile (never a fabricated price, discount, or guarantee).

---

## Test 4 — Approve and send (mock)

**Goal**: confirm nothing sends without an explicit, confirmed human action.

1. Go to **Approvals**. Find Jordan Rivers' draft.
2. Check **Confirm send**, click **Approve & Send**.

**Expected result**:
- Banner reads "Reply sent (see Email: mock/live in Settings for delivery mode)."
- The draft disappears from the Approval Queue (nothing left pending on it).
- Overview's **Sent Replies** tile increments by 1.

---

## Test 5 — Duplicate-send safety (idempotency)

**Goal**: prove a retried or duplicated approval can never send twice.

The UI removes a sent draft from the queue, so there's no button left to double-click — the real
test is replaying the identical request directly. Get the `draftId` from the Execution Log (Test
6 shows you how to read these events), or run:

```bash
INTERNAL_SECRET=$(grep -E '^INTERNAL_API_SECRET=' .env | cut -d= -f2-)
curl -X POST http://localhost:5678/webhook/approval-action \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Secret: $INTERNAL_SECRET" \
  -d '{"action":"approve","draftId":"<the draftId from Test 4>","draftVersion":1}'
```

**Expected result**:
- Response: `{"result":"already_sent", ...}`.
- Overview's **Sent Replies** count does **not** increment again.
- The Execution Log (Test 6) shows exactly one `delivery` event for this lead, not two.

---

## Test 6 — Validation failure path

**Goal**: confirm a malformed submission is rejected safely, with no lead created and no raw
input leaked into logs.

```bash
curl -i -X POST http://localhost:5678/webhook/lead-intake \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Missing Email Lead",
    "message": "This submission is missing a required field.",
    "service": "website_development",
    "consent_to_follow_up": true
  }'
```

**Expected result**:
- `HTTP 400`, body `{"status":"rejected","message":"One or more fields failed validation."}`.
- Overview's **Total Leads** count does **not** change — no lead was created.
- The Execution Log (next test) shows a `validation`-classified event listing only the *names*
  of the fields that failed, never the raw submitted content.

---

## Test 7 — Execution Log and recovery guidance

**Goal**: confirm every outcome — success or failure — is classified, redacted, and paired with
concrete recovery guidance.

1. Go to **Execution Log**.

**Expected result**:
- You see events from Tests 2, 4, 5, and 6, each with a timestamp, status badge, classification
  badge, and the originating workflow name.
- The seeded failed-analysis lead ("Grace Murray") shows `classification: ai_provider` with
  **Recovery guidance** explaining it was auto-retried and how to manually re-trigger analysis.
- Filter by **Status: failed** and **Classification: validation** — only Test 6's event appears.
- No event anywhere on this page shows a raw stack trace, API key, or password.

---

## Test 8 — Consent-aware follow-up (seeded example)

**Goal**: confirm a follow-up only exists for a lead that explicitly consented, and is itself
subject to the same approval gate as an initial reply.

1. Go to **Leads**, open **Ada Lovelace** (seeded with a scheduled follow-up).

**Expected result**:
- Status shows `sent` with a note that a follow-up is scheduled for ~48 hours after the original
  send.
- The **Reply & Follow-up Status** card offers **Record reply / close** and **Record opt-out**
  buttons — both confirm-gated, both reachable only because this demo has no real inbound-email
  channel to detect a reply automatically.

*Optional, if you want to show cancellation live*: click **Record opt-out** (confirm first) and
reload — the scheduled follow-up is cancelled immediately.

---

## Test 9 — Business profile (Settings)

**Goal**: confirm draft replies are grounded in real, operator-configured business details —
never invented.

1. Go to **Settings**.

**Expected result**:
- **Demo mode**, **AI**, and **Email** badges all read their current mode (mock by default).
- The business profile form shows the actual values draft replies pull from (name, services,
  contact details, tone, signature) — this is *why* Test 3's draft never invented a price or
  guarantee: it has nowhere to invent one from.

---

## Wrap-up checklist

If every expected result above matched, you've exercised all four user stories end to end:

- [ ] Test 1 — Overview loads, DEMO MODE visible
- [ ] Test 2 — Intake webhook validates and creates a lead through real n8n orchestration
- [ ] Test 3 — AI output is labeled advisory, never asserted as fact
- [ ] Test 4 — Nothing sends without explicit, confirmed approval
- [ ] Test 5 — A duplicate approval cannot create a duplicate send
- [ ] Test 6 — A malformed submission is rejected safely, no lead created
- [ ] Test 7 — Every outcome is classified, redacted, and paired with recovery guidance
- [ ] Test 8 — Follow-ups are consent-gated and cancellable
- [ ] Test 9 — Drafts are grounded in configured business facts, not invented

Finish by running `./scripts/demo-reset.sh` to leave the stack in a clean state for the next
person (or the next recording).
