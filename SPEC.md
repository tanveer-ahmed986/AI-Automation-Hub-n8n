# SPEC.md — Z&T AI Automation Hub

**Project type:** Portfolio-grade AI workflow automation system  
**Owner:** Z&T Technologies  
**Primary use:** Demonstration project for Upwork and Fiverr clients  
**Build approach:** Spec-driven development with Claude Code  
**Version:** 1.0  
**Status:** Ready for implementation

---

## 1. Project Summary

Build a practical, demonstrable **AI Lead Management & Business Automation Hub** using n8n. It receives business inquiries, validates and stores them, uses an AI model to structure and qualify the lead, drafts a tailored reply, routes the draft for human approval, sends approved emails, schedules rule-based follow-ups, and records workflow outcomes.

The project must demonstrate real business value—not just a collection of connected nodes. It must include validation, duplicate handling, structured AI output, human-in-the-loop controls, safe retries, logs, a demo dataset, test scenarios, and clear setup instructions.

### Portfolio positioning

> I build AI-powered business automations with n8n, connecting forms, AI models, CRMs, email, and reporting—with validation, human approval, and error handling built in.

Do not claim the system is production-ready, fully autonomous, or integrated with a third-party service until that integration has actually been configured and tested.

---

## 2. Goals and Success Criteria

### Primary goals

1. Demonstrate an end-to-end n8n workflow for handling inbound leads.
2. Show AI-based information extraction, classification, lead scoring, and response drafting.
3. Keep a human in control of outbound messages and business commitments.
4. Persist lead data and execution history.
5. Provide a small, responsive dashboard for reviewing leads and workflow status.
6. Make the project easy for a client or reviewer to run locally using documented setup steps.
7. Keep the first version inexpensive, using local/self-hosted tools and free tiers where practical.

### Definition of done

- A lead can be submitted through a form or webhook.
- Invalid submissions receive a clear validation response and are not processed further.
- Valid leads are normalized, deduplicated, and saved.
- The AI step returns validated structured data that follows a defined schema.
- AI failure, malformed output, or timeout follows a safe fallback path.
- No external reply is sent before approval in the default configuration.
- Approving a draft sends it once; rejecting it prevents sending.
- Duplicate webhook deliveries do not create duplicate leads or send duplicate replies.
- Follow-up logic respects opt-out, reply status, and configured limits.
- Failures are logged and surfaced for review.
- The repository includes example data, workflow exports, setup instructions, and test cases.
- The portfolio demo works with mock mode and does not require a paid AI provider.

---

## 3. Scope

### MVP — must have

- n8n workflow orchestration.
- Lead intake through a webhook; optional simple website form.
- Input validation and normalization.
- Lead deduplication.
- AI classification and scoring with a strict JSON schema.
- Suggested reply generation.
- Human approval before sending.
- Email integration behind configuration; mock-email mode for local demos.
- Persistent lead and event records.
- Basic dashboard or review interface.
- Error workflow, logs, and manual recovery instructions.
- Docker Compose local setup.
- Seed data and automated tests for core business rules.
- README, architecture diagram, and portfolio walkthrough.

### Later enhancements — not required for MVP

- WhatsApp Business integration.
- HubSpot, Airtable, or other CRM connectors.
- Slack or Telegram approval notifications.
- Multi-user authentication and role-based access control.
- Multi-tenant client workspaces.
- Advanced analytics, billing, and audit exports.
- Retrieval-augmented generation from company knowledge documents.
- Multi-agent orchestration.

Do not build all enhancements before the core workflow is reliable.

---

## 4. Target Users and Example Use Case

**Primary users:** Small agencies, consultants, web-development businesses, and service companies receiving website or email inquiries.

**Example:** A prospective customer submits a form requesting a website. The system extracts the requested service, budget range, timeline, and urgency; assigns a score; drafts a relevant response; and creates an approval task for the business owner.

The AI must not invent pricing, guarantees, availability, company credentials, or contractual commitments. When information is missing, it should mark it as unknown and ask a clarifying question.

---

## 5. User Stories

1. As a business owner, I can capture a lead from a website form or webhook.
2. As a business owner, I can see a normalized lead record and its processing status.
3. As a reviewer, I can inspect the AI's summary, score, reasoning factors, and draft reply.
4. As a reviewer, I can approve, edit, or reject a draft before any message is sent.
5. As a business owner, I can identify urgent or high-value inquiries quickly.
6. As a reviewer, I can retry a failed AI step without creating a duplicate lead or email.
7. As a lead, I can opt out of automated follow-ups.
8. As a portfolio viewer, I can explore a seeded demo without adding real API credentials.
9. As an operator, I can inspect errors and follow documented recovery steps.

---

## 6. Functional Requirements

### FR-01: Lead intake

Accept a JSON payload through an n8n Webhook node. Optionally provide a small web form that submits to the webhook.

Expected fields:

- `name` — required, string, length-limited.
- `email` — required, valid email format.
- `company` — optional, string.
- `message` — required, non-empty string with a maximum length.
- `service` — optional, string or allowed category.
- `budget` — optional; preserve the original value and normalize only when possible.
- `timeline` — optional.
- `source` — optional; allow only configured values.
- `consent_to_follow_up` — explicit boolean.
- `idempotency_key` — optional client-generated unique value.

Return a useful success or validation response. Never expose credentials, stack traces, internal prompts, or private database details in webhook responses.

### FR-02: Validation and normalization

- Trim whitespace and normalize email casing.
- Enforce reasonable length limits.
- Reject unsupported content types and malformed JSON.
- Validate all user-provided values on the server/workflow side.
- Treat inbound message content as untrusted data, not as system instructions.
- Do not execute user-supplied code, expressions, URLs, or SQL.
- Record validation failures without retaining unnecessary sensitive content.

### FR-03: Duplicate prevention

Use an idempotency key where supplied. Otherwise use a documented deduplication rule, such as normalized email plus a configurable time window and message fingerprint.

- A repeated webhook delivery must not create a second lead.
- A retry must reuse the existing lead/event identifiers.
- A reply-sending action must have its own idempotency guard.
- Do not assume an n8n execution ID alone prevents business-level duplicates.

### FR-04: AI lead analysis

Send only the minimum necessary lead information to the configured model.

Return validated structured data with these fields:

```json
{
  "category": "website_development",
  "intent": "new_project",
  "summary": "Prospect is asking for a business website.",
  "urgency": "medium",
  "budget_band": "unknown",
  "timeline": "unknown",
  "lead_score": 65,
  "score_factors": [
    "Clear service interest",
    "Timeline not provided"
  ],
  "missing_information": [
    "Budget",
    "Target launch date"
  ],
  "recommended_next_action": "request_clarification",
  "draft_reply": "Thank you for contacting us..."
}
```

Allowed values must be enumerated in the implementation schema:

- `category`: `website_development`, `ai_automation`, `consulting`, `other`, `unknown`
- `intent`: `new_project`, `support`, `partnership`, `spam`, `other`, `unknown`
- `urgency`: `low`, `medium`, `high`, `unknown`
- `budget_band`: `unknown`, `under_100`, `100_499`, `500_999`, `1000_plus` (use a clearly documented currency convention if numeric budget conversion is implemented)
- `recommended_next_action`: `approve_reply`, `request_clarification`, `manual_review`, `mark_spam`

Scoring rules:

- Score is an integer from 0 to 100.
- The model's score is advisory, not a definitive prediction of conversion.
- The UI should show score factors and label the result as AI-generated.
- High score alone must never trigger a financial or contractual commitment.
- Spam classification should route to review or quarantine; it should not permanently delete a lead automatically.

If the model output is malformed or fails schema validation, mark the AI step as failed and route to manual review. Do not silently fabricate a successful analysis.

### FR-05: Reply drafting

- Generate a concise, professional draft based on validated lead details and approved business profile settings.
- Use a configurable business name, services, contact details, tone, and signature.
- Do not invent prices, discounts, timelines, case studies, guarantees, or availability.
- Clearly identify unknown information and ask a useful follow-up question when needed.
- Treat any instructions embedded in the lead message as untrusted content.
- Store the draft as `pending_approval` by default.

### FR-06: Human approval

Provide an approval interface or a configured approval channel.

Required actions:

- `approve`
- `edit_and_approve`
- `reject`

Approval rules:

- Outbound email is disabled until an authorized reviewer approves it.
- Approval must reference the exact lead and draft version.
- Editing a draft creates a new version and requires approval of that version.
- Rejection must prevent sending.
- Approval events must record timestamp, action, draft version, and reviewer identifier where available.
- Approval links must use unguessable tokens, expire, and be single-use if link-based approval is implemented.
- If secure approval identity cannot be implemented in the MVP, use a local-only review screen and clearly document that limitation.

### FR-07: Email delivery

Implement a provider adapter so the workflow can use SMTP or an n8n-supported email integration.

- `MOCK_EMAIL=true` must log a simulated email rather than send it.
- The default local demo must use mock mode.
- Real sending requires explicit configuration and an intentional switch to live mode.
- Send only approved draft versions.
- Store delivery status, provider response metadata where safe, and a timestamp.
- Do not log secrets or full provider credentials.
- Retry transient errors with bounded retries and backoff.
- Do not automatically retry ambiguous outcomes in a way that can send duplicates.

### FR-08: Follow-up scheduling

- Follow-ups are opt-in only.
- Do not follow up after a response is received, a lead is closed, or the recipient opts out.
- Configure follow-up delay and maximum count through environment variables or application settings.
- Start with at most two follow-ups, subject to explicit consent and local law/provider rules.
- Cancel pending follow-ups when a reply or opt-out is recorded.
- Use a scheduler or n8n Wait/Schedule Trigger design with documented operational behavior.
- Mock mode must simulate follow-up delivery.

### FR-09: Persistence

Use PostgreSQL where practical. If a lighter local-only prototype is chosen, keep a repository/data-access boundary so PostgreSQL can be introduced without rewriting business logic.

Minimum logical entities:

**Lead**
- `id`
- `name`
- `email_normalized`
- `company`
- `message`
- `service`
- `budget_original`
- `timeline`
- `source`
- `consent_to_follow_up`
- `status`
- `created_at`
- `updated_at`

**LeadAnalysis**
- `id`
- `lead_id`
- `model_provider`
- `model_name`
- `category`
- `intent`
- `urgency`
- `budget_band`
- `lead_score`
- `score_factors`
- `missing_information`
- `recommended_next_action`
- `summary`
- `created_at`

**ReplyDraft**
- `id`
- `lead_id`
- `version`
- `subject`
- `body`
- `status`
- `approved_by`
- `approved_at`
- `sent_at`
- `created_at`

**WorkflowEvent**
- `id`
- `lead_id` (nullable for intake failures)
- `workflow_name`
- `execution_reference`
- `event_type`
- `status`
- `safe_metadata`
- `created_at`

**FollowUp**
- `id`
- `lead_id`
- `scheduled_at`
- `attempt_number`
- `status`
- `sent_at`
- `cancelled_at`

Use migrations or a clearly documented initialization method. Add indexes and uniqueness constraints for normalized email/idempotency records as appropriate. Do not store API keys in these tables.

### FR-10: Dashboard and review UI

Create a clean, responsive interface suitable for a portfolio demo.

Minimum screens:

1. **Overview:** total leads, pending approvals, sent replies, failed executions.
2. **Leads:** searchable/filterable list with status, category, score, source, and date.
3. **Lead detail:** submitted details, AI summary, score factors, missing information, and draft.
4. **Approval queue:** preview, edit, approve, and reject actions.
5. **Execution log:** workflow name, outcome, time, safe error summary, and retry guidance.
6. **Settings/demo mode:** show whether the project is using mock or live integrations.

UI requirements:

- Responsive on desktop, tablet, and mobile.
- Accessible labels, keyboard navigation, loading states, empty states, and error states.
- Clearly label AI-generated content.
- Confirm before irreversible or external actions.
- Do not expose n8n credentials or private execution payloads to the browser.
- Seed the interface with fictional sample leads.
- If authenticated multi-user access is not implemented, keep the dashboard local/demo-only and state that it is not safe for public production use.

### FR-11: Error handling and observability

- Configure an n8n Error Trigger workflow or equivalent error-handling workflow.
- Record a correlation/lead ID and execution reference.
- Classify errors as validation, AI provider, persistence, approval, email delivery, or unexpected.
- Provide bounded retries for transient failures.
- Never retry validation errors automatically.
- Keep error logs concise and redact secrets, tokens, and unnecessary personal data.
- Include a dead-letter/manual-review path for failures that cannot be recovered automatically.
- Document how an operator identifies and safely retries a failed item.

### FR-12: Demo mode

The entire happy path must work without paid APIs or real email delivery.

- Use fictional seed data.
- Provide deterministic mock AI output when no model credential is configured.
- Use mock email delivery.
- Display a visible `DEMO MODE` indicator.
- Never represent mock delivery as a real email.
- Provide a documented path to enable a real AI provider and email integration.

---

## 7. Workflow Design

Implement the workflows as separate, named n8n workflows where appropriate. Export them as version-controlled JSON files and document required credentials and environment variables.

### WF-01 — Lead Intake and Qualification

Suggested node sequence:

1. Webhook Trigger
2. Validate Request
3. Normalize Fields
4. Check Idempotency / Find Existing Lead
5. IF Duplicate → Return Existing Lead Result
6. Persist Lead
7. AI Provider or Mock AI
8. Validate Structured AI Output
9. IF AI Failure → Create Manual Review Event
10. Persist Analysis and Draft
11. Create Pending Approval
12. Notify Reviewer (optional integration)
13. Return Accepted Response

Use explicit node names, notes, and error outputs. Ensure the workflow's response behavior is compatible with the selected n8n Webhook response mode.

### WF-02 — Approval and Email Delivery

1. Receive approval action through the secured review interface or approval webhook.
2. Validate approval token/session and permissions.
3. Fetch the exact draft version.
4. Confirm the draft is still pending and not already sent.
5. If rejected, persist rejection and stop.
6. If approved, atomically mark it as sending or reserve the send operation.
7. Send via mock or configured email provider.
8. Persist the result and idempotency reference.
9. Show delivery outcome.
10. Route errors to the error workflow/manual review.

Do not expose an unauthenticated endpoint that allows arbitrary users to approve or send emails.

### WF-03 — Follow-up Scheduler

1. Trigger on a schedule or retrieve due follow-ups.
2. Check consent, opt-out, lead status, reply status, and attempt count.
3. Cancel ineligible follow-ups.
4. Create or retrieve an approved follow-up draft.
5. Require approval for the first version; allow automatic follow-up only if separately configured and explicitly authorized by the business owner.
6. Deliver in mock/live mode.
7. Persist outcome and next eligible action.

### WF-04 — Error Handler

1. Receive workflow error event.
2. Extract workflow name, execution reference, lead/correlation ID if available.
3. Redact sensitive fields.
4. Persist safe error summary.
5. Notify the operator using an optional configured channel.
6. Provide manual recovery instructions; do not automatically replay every failed workflow.

### Optional WF-05 — Demo Data Reset

A local-only helper to reset seeded data. Must be disabled in live mode and protected from public access.

---

## 8. Suggested Architecture

```text
Website Form / Webhook
          |
          v
   n8n Lead Intake
          |
   Validate + Deduplicate
          |
          v
    PostgreSQL Store
          |
          v
   AI Analysis / Mock AI
          |
    Schema Validation
          |
          v
   Draft + Approval Queue
          |
      Human Review
       /       \
   Reject     Approve
                 |
                 v
          Email Adapter
          Mock / Live
                 |
                 v
        Event + Status Log
                 |
                 v
        Dashboard / Reports

Scheduled Follow-ups ----> Eligibility Checks ----> Approved Delivery
Workflow Errors ----------> Error Handler --------> Manual Recovery
```

Keep business rules in readable, testable code or clearly documented n8n nodes. Avoid building a large custom backend unless the dashboard or security requirements justify it.

---

## 9. Recommended Technology Choices

Use the simplest stack that meets the requirements. Confirm current compatibility before pinning versions.

- **Automation:** n8n, self-hosted with Docker Compose for development.
- **Database:** PostgreSQL.
- **Dashboard:** Next.js + TypeScript, or a lightweight alternative if it materially reduces complexity.
- **Styling:** Tailwind CSS or a consistent component library.
- **Validation:** Zod or an equivalent schema validator for application code; validate again inside the workflow boundary.
- **AI:** provider adapter supporting a configured API provider and deterministic mock mode. A local Ollama adapter may be added if the machine can support the selected model.
- **Email:** mock adapter by default; SMTP or a supported n8n integration for real delivery.
- **Testing:** unit tests for validation, scoring/business rules, idempotency, approval, and follow-up eligibility; integration tests for the main workflow.
- **Version control:** Git with `.env.example`, sanitized workflow exports, and setup docs.
- **Local orchestration:** Docker Compose.

Do not assume n8n's command-line interface creates, imports, or manages every workflow feature. Use documented n8n export/import mechanisms or the supported API for the installed version. Verify behavior before automating imports.

---

## 10. Repository Structure

Claude Code should create and maintain a structure similar to:

```text
zt-ai-automation-hub/
├── SPEC.md
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── docs/
│   ├── architecture.md
│   ├── workflow-catalog.md
│   ├── setup-local.md
│   ├── deployment.md
│   ├── security.md
│   ├── testing.md
│   └── portfolio-demo-script.md
├── workflows/
│   ├── wf-01-lead-intake.json
│   ├── wf-02-approval-email.json
│   ├── wf-03-follow-up-scheduler.json
│   └── wf-04-error-handler.json
├── database/
│   ├── migrations/
│   └── seed/
├── apps/
│   └── dashboard/
├── packages/
│   ├── schemas/
│   ├── business-rules/
│   └── adapters/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── scripts/
    ├── health-check.*
    └── demo-reset.*
```

Adapt the structure if a simpler implementation is justified. Do not create empty folders or placeholder features without a purpose.

---

## 11. Configuration

Create `.env.example` containing variable names and safe placeholder values only. Never commit real secrets.

Suggested variables:

```dotenv
APP_ENV=development
DEMO_MODE=true
MOCK_AI=true
MOCK_EMAIL=true

APP_BASE_URL=http://localhost:3000
N8N_BASE_URL=http://localhost:5678
N8N_ENCRYPTION_KEY=replace_with_a_long_random_secret
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=change_me
N8N_BASIC_AUTH_PASSWORD=change_me

POSTGRES_DB=automation_hub
POSTGRES_USER=automation_user
POSTGRES_PASSWORD=replace_with_a_strong_password
DATABASE_URL=postgresql://automation_user:replace_with_a_strong_password@postgres:5432/automation_hub

AI_PROVIDER=mock
AI_API_KEY=
AI_MODEL=

EMAIL_PROVIDER=mock
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
REVIEWER_EMAIL=

FOLLOWUP_MAX_ATTEMPTS=2
FOLLOWUP_DELAY_HOURS=48
```

Implementation requirements:

- Confirm each environment variable is actually consumed by the application or workflow before documenting it as functional.
- Prefer n8n's credential store for integrations where appropriate.
- Generate unique secrets for each deployment.
- Do not expose database credentials, n8n keys, AI keys, or SMTP passwords to frontend variables.
- Do not publish the n8n editor or database directly to the public internet without appropriate access controls.
- Ensure `DEMO_MODE=true` cannot accidentally send real email.
- Document that secrets in an example file are placeholders, not usable credentials.

---

## 12. Security, Privacy, and AI Guardrails

1. Treat all form submissions, email content, and AI output as untrusted.
2. Validate AI output against a strict schema before using it.
3. Do not let lead text override system rules or approval requirements.
4. Require human approval before sending external messages by default.
5. Require authentication/authorization for approval and dashboard write actions before public deployment.
6. Protect approval tokens with secure randomness, expiry, single-use semantics, and server-side verification if tokens are used.
7. Use least-privilege credentials and separate development/demo credentials from live credentials.
8. Apply rate limits and request-size limits to public webhooks.
9. Restrict CORS and allowed origins if a browser form is used.
10. Avoid storing unnecessary personal data. Define a retention/deletion approach before real client use.
11. Redact API keys, authorization headers, cookies, approval tokens, and sensitive message content from logs.
12. Use parameterized database queries and validate all identifiers.
13. Pin and update dependencies deliberately; do not blindly install packages suggested by generated code.
14. Document that legal requirements for email consent, data retention, and outreach vary by jurisdiction and provider.
15. Never send real customer data to a third-party AI provider without appropriate authorization and disclosure.
16. Do not use real prospect data in portfolio screenshots; use fictional data.

---

## 13. Testing and Acceptance Criteria

### Unit tests

- Valid and invalid email.
- Missing/oversized message.
- Unknown enum values from AI output.
- AI score below 0 or above 100.
- Missing required AI fields.
- Follow-up eligibility and opt-out rules.
- Draft version changes after editing.
- Approval rejection and already-sent protection.
- Secret redaction in logs.

### Integration tests

- Valid lead reaches pending approval.
- Invalid lead is rejected and not stored as a qualified lead.
- Duplicate submission returns the existing result.
- Mock AI completes without external credentials.
- Malformed AI output routes to manual review.
- Rejected draft is never sent.
- Approved draft is sent once in mock mode.
- Email provider failure is logged and can be recovered safely.
- Follow-up is cancelled after opt-out or a recorded reply.
- Error handler records a safe event.
- Demo reset is unavailable in live mode.

### Acceptance checklist

- [ ] Clean setup succeeds using documented steps.
- [ ] Docker services report healthy or provide actionable errors.
- [ ] n8n workflows import successfully on the documented version.
- [ ] The demo completes without paid API credentials.
- [ ] The approval gate cannot be bypassed through normal UI/API paths.
- [ ] Duplicate requests do not create duplicate sends.
- [ ] No secrets appear in Git, frontend bundles, screenshots, or logs.
- [ ] Dashboard works at mobile and desktop widths.
- [ ] All critical tests pass.
- [ ] README includes known limitations and a teardown procedure.

---

## 14. Deployment Plan

### Phase A — local portfolio demo

- Run n8n and PostgreSQL with Docker Compose.
- Run the dashboard locally.
- Enable demo mode, mock AI, and mock email.
- Load fictional seed records.
- Record a short walkthrough video and take sanitized screenshots.

### Phase B — optional public demo

Only deploy after the authentication, authorization, rate limiting, secret management, data retention, and public webhook controls have been reviewed.

Possible low-cost hosting can change over time; check current free-tier limits before choosing a provider. Do not assume n8n, PostgreSQL, and the dashboard can all run reliably on a free tier. A local video/demo is acceptable for the first portfolio version.

Do not expose a self-hosted n8n instance to the public internet without securing the editor, webhook endpoints, credentials, and server.

### Phase C — real integrations

- Configure a real AI provider only when a valid credential is available.
- Configure an email provider and verify sender/domain requirements.
- Test with internal addresses before any customer-facing use.
- Keep human approval enabled until reliability and client-specific rules have been reviewed.
- Document expected usage costs and provider limits.

---

## 15. Implementation Milestones

### Milestone 1 — repository and specification
- Review this spec.
- Create the repository and architecture notes.
- Choose compatible versions and document assumptions.
- Create a task checklist before implementation.

### Milestone 2 — infrastructure and data
- Docker Compose for n8n and PostgreSQL.
- Database schema/migrations and fictional seed data.
- Health checks and environment validation.

### Milestone 3 — core n8n workflows
- Lead intake, validation, deduplication, and persistence.
- AI/mock analysis with schema validation.
- Approval and mock email delivery.
- Error handling and safe retry rules.

### Milestone 4 — dashboard
- Overview, lead list/detail, approval queue, and execution log.
- Responsive states and demo-mode indicator.
- Secure server-side calls; no secrets in the browser.

### Milestone 5 — follow-ups and hardening
- Consent-aware scheduler.
- Opt-out and reply suppression.
- Idempotency, rate limits, redaction, and tests.

### Milestone 6 — portfolio packaging
- README and setup guide.
- Workflow catalog and architecture diagram.
- Screenshots using fictional data.
- Demo video script.
- Honest project description and limitations.

Build incrementally. Do not begin with every optional integration.

---

## 16. Claude Code Working Instructions

Claude Code should follow these rules throughout implementation:

1. Read `SPEC.md` and `README.md` before modifying the project.
2. Work in small, verifiable milestones.
3. Before each milestone, list the intended files and acceptance criteria.
4. Inspect the existing repository before creating or overwriting files.
5. Ask before making a major architecture change or introducing a paid service.
6. Prefer free/local development and mock adapters unless explicitly authorized otherwise.
7. Never invent successful test results, deployed URLs, credentials, or integrations.
8. After each milestone, run available tests, linting, type checks, and build checks.
9. Report the exact commands run and distinguish passing checks from checks not run.
10. Keep workflow JSON exports under version control and exclude secrets.
11. Validate workflow JSON against the actual installed n8n version; do not assume generated node parameters are valid.
12. If n8n behavior is unclear, consult the official documentation for the installed version instead of guessing.
13. Keep a `TASKS.md` or equivalent checklist updated.
14. Do not weaken approval or security requirements to make a demo pass.
15. If a requirement is blocked, explain the blocker and propose the smallest safe alternative.

---

## 17. Suggested Portfolio Deliverables

- Source repository with a clear README.
- Sanitized n8n workflow exports.
- Architecture diagram.
- Screenshot of the workflow editor.
- Dashboard screenshots with fictional data.
- Short demo video showing intake → AI analysis → approval → mock send → event log.
- Test report.
- Setup and teardown instructions.
- A brief section listing implemented features, simulated integrations, and known limitations.

### Suggested Upwork project title

**AI Lead Qualification & Email Automation with n8n, LLMs, and Human Approval**

### Suggested Fiverr gig angle

**I will build n8n AI automations for lead management, email workflows, and business operations**

Only advertise the exact integrations and production capabilities you have actually tested.

---

## 18. Out of Scope for Version 1

- Unsupervised AI sending of sales proposals or contractual commitments.
- Automatic payments, refunds, or financial transactions.
- Bulk cold-email campaigns or scraping prospects.
- Guaranteed lead conversion or AI accuracy claims.
- Public multi-tenant SaaS with enterprise-grade access controls.
- WhatsApp automation before official provider requirements are understood.
- Complex autonomous multi-agent systems before the single workflow is reliable.

---

## 19. Final Definition of Success

A reviewer should be able to clone the repository, follow the setup guide, submit a fictional lead, see a structured AI/mock analysis, review and approve a draft, observe a simulated send, inspect the event log, and run the test suite—without needing paid API credentials or sending a real email.

The project should make it easy for a potential client to understand the business problem, see how the workflow works, verify the human approval safeguard, and assess what would be required to adapt it to their own systems.
