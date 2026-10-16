import { connection } from "next/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { countLeads } from "@/lib/repositories/lead";
import { countReplyDraftsByStatus } from "@/lib/repositories/reply-draft";
import { countWorkflowEventsByStatus } from "@/lib/repositories/workflow-event";

// Internal review tool, not a public marketing site — always-fresh DB
// reads matter more than instant navigation here. Opts this segment out
// of Cache Components' instant-navigation build validation.
export const instant = false;

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold" aria-live="polite">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function OverviewPage() {
  await connection(); // always reflects current DB state — never statically prerendered
  const [totalLeads, pendingApprovals, sentReplies, failedExecutions] = await Promise.all([
    countLeads(),
    countReplyDraftsByStatus("pending_approval"),
    countReplyDraftsByStatus("sent"),
    countWorkflowEventsByStatus("failed"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total Leads" value={totalLeads} />
        <Tile label="Pending Approvals" value={pendingApprovals} />
        <Tile label="Sent Replies" value={sentReplies} />
        <Tile label="Failed Executions" value={failedExecutions} />
      </div>
    </div>
  );
}
