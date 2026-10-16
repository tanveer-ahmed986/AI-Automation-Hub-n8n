import { redactEventMetadata } from "@automation-hub/business-rules";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@database/client";
import { workflowEvent } from "@database/schema/workflow-event";
import type { NewWorkflowEvent, WorkflowEvent } from "@database/schema/workflow-event";

/**
 * Redaction always happens here, right before the row is written (FR-006,
 * FR-041) — `packages/business-rules/src/error-classification.ts` owns the
 * actual policy (unit-tested, classification-aware) so every caller gets
 * the same floor without re-implementing it.
 */
export async function insertWorkflowEvent(event: NewWorkflowEvent): Promise<WorkflowEvent> {
  const safeMetadata = redactEventMetadata(
    (event.safeMetadata as Record<string, unknown> | undefined) ?? {},
  );
  const [row] = await db
    .insert(workflowEvent)
    .values({ ...event, safeMetadata })
    .returning();
  if (!row) {
    throw new Error("Failed to insert workflow event");
  }
  return row;
}

export interface WorkflowEventFilter {
  leadId?: string;
  status?: WorkflowEvent["status"];
  classification?: WorkflowEvent["classification"];
}

/**
 * Backs both the Execution log UI (T059, filterable by status/
 * classification) and the internal `/events` GET endpoint used by
 * integration tests to verify a failure was actually recorded.
 */
export async function listWorkflowEvents(filter: WorkflowEventFilter = {}): Promise<WorkflowEvent[]> {
  const conditions = [
    filter.leadId ? eq(workflowEvent.leadId, filter.leadId) : undefined,
    filter.status ? eq(workflowEvent.status, filter.status) : undefined,
    filter.classification ? eq(workflowEvent.classification, filter.classification) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  return db
    .select()
    .from(workflowEvent)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(workflowEvent.createdAt));
}

export async function countWorkflowEventsByStatus(
  status: WorkflowEvent["status"],
): Promise<number> {
  const rows = await db
    .select()
    .from(workflowEvent)
    .where(and(eq(workflowEvent.status, status)));
  return rows.length;
}
