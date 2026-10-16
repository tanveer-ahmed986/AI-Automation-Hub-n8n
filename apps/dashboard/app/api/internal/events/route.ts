import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { workflowEventRequestSchema } from "@automation-hub/schemas";
import { workflowEventClassificationEnum, workflowEventStatusEnum } from "@database/schema/workflow-event";
import { insertWorkflowEvent, listWorkflowEvents } from "@/lib/repositories/workflow-event";

/**
 * Not in contracts/internal-api.openapi.yaml (only POST /events is
 * documented there) — added so the execution log UI (T059) and the US4
 * integration test (T056) have a way to read back what a route or WF-04
 * just logged, without either needing direct database access. Same
 * category of justified, documented deviation as T051's /leads/{id}/close.
 */
export async function GET(request: NextRequest) {
  const leadId = request.nextUrl.searchParams.get("leadId") ?? undefined;
  const statusParam = request.nextUrl.searchParams.get("status");
  const classificationParam = request.nextUrl.searchParams.get("classification");

  if (statusParam && !workflowEventStatusEnum.enumValues.includes(statusParam as never)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }
  if (classificationParam && !workflowEventClassificationEnum.enumValues.includes(classificationParam as never)) {
    return NextResponse.json({ error: "Invalid classification filter." }, { status: 400 });
  }

  const events = await listWorkflowEvents({
    leadId,
    status: (statusParam as (typeof workflowEventStatusEnum.enumValues)[number] | null) ?? undefined,
    classification:
      (classificationParam as (typeof workflowEventClassificationEnum.enumValues)[number] | null) ?? undefined,
  });

  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = workflowEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workflow event payload", fields: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 400 },
    );
  }

  const event = parsed.data;
  const row = await insertWorkflowEvent({
    leadId: event.leadId ?? null,
    workflowName: event.workflowName,
    executionReference: event.executionReference ?? null,
    eventType: event.eventType,
    status: event.status,
    classification: event.classification ?? null,
    safeMetadata: event.safeMetadata ?? {},
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
