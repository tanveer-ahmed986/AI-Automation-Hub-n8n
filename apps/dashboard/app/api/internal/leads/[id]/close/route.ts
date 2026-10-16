import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { leadCloseRequestSchema } from "@automation-hub/schemas";
import { closeLead } from "@/lib/close-lead";
import { getLeadById } from "@/lib/repositories/lead";

/**
 * Not in the OpenAPI doc verbatim — this demo has no inbound-reply
 * detection channel, so a reviewer records a reply/opt-out/manual close
 * here, which is what FR-027 actually keys its cancellation off of
 * (lead.status becoming `closed`). Immediately cancels any in-flight
 * follow-up for this lead rather than waiting for WF-03's next sweep.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = leadCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const lead = await getLeadById(leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const result = await closeLead(leadId, parsed.data.reason);
  return NextResponse.json(result);
}
