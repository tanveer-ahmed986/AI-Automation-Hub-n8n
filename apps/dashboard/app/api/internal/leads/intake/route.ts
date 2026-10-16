import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeMessageFingerprint, findDedupMatch, validateLeadIntake } from "@automation-hub/business-rules";
import { getDedupWindowHours } from "@/lib/config";
import { checkRateLimit, getClientKeyFromHeaders, getMaxBodyBytes } from "@/lib/rate-limit";
import { findDedupCandidates, findLeadByIdempotencyKey, insertLead } from "@/lib/repositories/lead";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

export async function POST(request: NextRequest) {
  const clientKey = getClientKeyFromHeaders(request.headers);
  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > getMaxBodyBytes()) {
    return NextResponse.json({ error: "Request payload too large." }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    // No leadId yet (nothing was created) — leadId stays null (FR-006:
    // never retain more than necessary; the malformed body itself is
    // never persisted, only the fact that parsing failed).
    await insertWorkflowEvent({
      leadId: null,
      workflowName: "wf-01-lead-intake",
      eventType: "intake",
      status: "failed",
      classification: "validation",
      safeMetadata: { reason: "malformed_json" },
    });
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validated = validateLeadIntake(body);
  if (!validated.ok) {
    // `fields` is just a list of field names (packages/business-rules/src/
    // lead-intake.ts) — never the raw submitted values (FR-006, FR-041).
    await insertWorkflowEvent({
      leadId: null,
      workflowName: "wf-01-lead-intake",
      eventType: "intake",
      status: "failed",
      classification: "validation",
      safeMetadata: { reason: "schema_validation_failed", fields: validated.fields },
    });
    return NextResponse.json({ error: validated.error, fields: validated.fields }, { status: 400 });
  }

  const data = validated.data;
  const messageFingerprint = computeMessageFingerprint(data.message);
  const now = new Date();

  if (data.idempotency_key) {
    const existing = await findLeadByIdempotencyKey(data.idempotency_key);
    if (existing) {
      return NextResponse.json({ leadId: existing.id, deduped: true, status: existing.status });
    }
  } else {
    const windowHours = getDedupWindowHours();
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const candidates = await findDedupCandidates(data.email, messageFingerprint, windowStart);
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: data.email,
        messageFingerprint,
        now,
        dedupWindowHours: windowHours,
      },
      candidates.map((c) => ({
        id: c.id,
        idempotencyKey: c.idempotencyKey,
        emailNormalized: c.emailNormalized,
        messageFingerprint: c.messageFingerprint,
        createdAt: c.createdAt,
      })),
    );
    if (match) {
      const existing = candidates.find((c) => c.id === match.id);
      return NextResponse.json({ leadId: match.id, deduped: true, status: existing?.status ?? "pending_review" });
    }
  }

  const created = await insertLead({
    name: data.name,
    emailNormalized: data.email,
    company: data.company ?? null,
    message: data.message,
    service: data.service ?? null,
    budgetOriginal: data.budget ?? null,
    timeline: data.timeline ?? null,
    source: data.source ?? null,
    consentToFollowUp: data.consent_to_follow_up,
    idempotencyKey: data.idempotency_key ?? null,
    messageFingerprint,
    status: "pending_review",
  });

  return NextResponse.json({ leadId: created.id, deduped: false, status: created.status });
}
