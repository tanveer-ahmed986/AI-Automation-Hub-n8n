import Link from "next/link";
import { connection } from "next/server";
import { getRecoveryGuidance, WORKFLOW_EVENT_CLASSIFICATIONS } from "@automation-hub/business-rules";
import type { WorkflowEventClassification } from "@automation-hub/business-rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workflowEventStatusEnum } from "@database/schema/workflow-event";
import type { WorkflowEvent } from "@database/schema/workflow-event";
import { listWorkflowEvents } from "@/lib/repositories/workflow-event";

export const instant = false;

const STATUS_BADGE_VARIANT: Record<WorkflowEvent["status"], "outline" | "destructive" | "secondary"> = {
  success: "outline",
  failed: "destructive",
  retrying: "secondary",
};

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
}

export default async function ExecutionLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; classification?: string }>;
}) {
  await connection();
  const { status, classification } = await searchParams;

  const events = await listWorkflowEvents({
    status: status ? (status as WorkflowEvent["status"]) : undefined,
    classification: classification ? (classification as WorkflowEventClassification) : undefined,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Execution Log</h1>
      <p className="text-muted-foreground text-sm">
        Every workflow outcome — lead intake, AI analysis, approval, delivery, and follow-up — with
        a safe, redacted summary (FR-031, FR-041). Never shows raw secrets or stack traces.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        <div className="space-y-1">
          <label htmlFor="status" className="text-xs font-medium">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">All</option>
            {workflowEventStatusEnum.enumValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="classification" className="text-xs font-medium">
            Classification
          </label>
          <select
            id="classification"
            name="classification"
            defaultValue={classification ?? ""}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {WORKFLOW_EVENT_CLASSIFICATIONS.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
        {(status || classification) && (
          <Link href="/execution-log" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      {events.length === 0 ? (
        <p className="text-muted-foreground" role="status">
          No workflow events match these filters.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>{formatTimestamp(event.createdAt)}</span>
                  <Badge variant={STATUS_BADGE_VARIANT[event.status]}>{event.status}</Badge>
                  <Badge variant="outline">{event.eventType.replace(/_/g, " ")}</Badge>
                  {event.classification && <Badge variant="secondary">{event.classification.replace(/_/g, " ")}</Badge>}
                  <span className="text-muted-foreground font-normal">{event.workflowName}</span>
                  {event.leadId && (
                    <Link
                      href={`/leads/${event.leadId}`}
                      className="text-xs font-normal underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
                    >
                      View lead →
                    </Link>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(event.safeMetadata, null, 2)}
                </pre>
                {event.classification && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Recovery guidance:</span>{" "}
                    {getRecoveryGuidance(event.classification)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
