# Demo Video — Narration Script

The script behind `docs/demo/zt-automation-hub-demo-narrated.mp4`. Five scenes, matched exactly
to what's on screen at that moment — nothing here describes a screen that isn't actually shown.

**How this was produced** (fully offline, no third-party uploads, no account signups):
1. Recorded a real click-through of the dashboard via browser automation (the same footage as
   `docs/demo/zt-automation-hub-demo.gif`), against the live stack with fictional seed data.
2. Extracted the key frames with `ffmpeg`.
3. Narration below synthesized locally with Windows' built-in offline text-to-speech
   (`System.Speech.Synthesis`, via PowerShell — no internet connection, no API key).
4. Each narration clip's real spoken duration was measured, then `ffmpeg` built one video clip
   per scene (still frame held for exactly that duration, audio muxed in) and concatenated them.

This path was chosen over uploading the recording to an unknown "free" web converter: no account
creation (not something this assistant does anyway), no risk of a free-tier watermark/paywall,
and the footage never leaves the local machine.

---

## Scene 1 — Leads

*On screen: the Leads table, five fictional seeded leads with status/category/score columns.*

> This is the Leads view in the Z and T Automation Hub. Every inbound inquiry is automatically
> captured, deduplicated, and queued for AI qualification. Notice the Score column is explicitly
> marked advisory — never treated as a guaranteed prediction.

## Scene 2 — Lead detail & AI Analysis

*On screen: Grace Hopper's lead detail page, Submission card, AI Analysis card labeled
"AI-generated, advisory."*

> Opening a lead shows the full picture: the original submission, and an AI Analysis card clearly
> labeled AI-generated, advisory. Category, intent, urgency, and a zero to one hundred score — all
> produced by a pluggable AI adapter, validated against a strict schema before a human ever sees
> it.

## Scene 3 — Approval Queue

*On screen: the Approval Queue, Grace Hopper's drafted reply, Approve & Send / Reject buttons.*

> Nothing gets sent automatically. Every AI-drafted reply lands in the Approval Queue, where a
> human reviewer can approve, edit, or reject it. The subject and body come straight from the
> business's own configured profile — never an invented price or promise.

## Scene 4 — Confirm and send

*On screen: the "Confirm send" checkbox ticked, the Approve & Send button in its pressed state.*

> Approving requires an explicit confirmation checkbox before the Approve and Send button does
> anything — a deliberate, auditable gate. This isn't just a UI toggle: it calls a real n8n
> workflow, which re-validates the draft is still current before sending, so even a duplicate
> click can never send twice.

## Scene 5 — Execution Log

*On screen: the Execution Log, showing the real `delivery` event this approval just created.*

> Every outcome — success or failure — lands in the Execution Log, classified and redacted.
> Here's the delivery event this approval just created, running in mock mode with zero paid
> credentials. That's the Z and T Automation Hub: AI qualifies, a human decides, and every step
> is logged and recoverable.

---

For a longer, more complete narrated walkthrough (including the intake webhook, duplicate-send
safety, and a validation failure — none of which fit in this 5-scene cut), see
`docs/portfolio-demo-script.md`.
