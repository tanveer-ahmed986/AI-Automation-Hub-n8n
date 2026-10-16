import { connection } from "next/server";
import { Users, Clock3, Send, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { countLeads } from "@/lib/repositories/lead";
import { countReplyDraftsByStatus } from "@/lib/repositories/reply-draft";
import { countWorkflowEventsByStatus } from "@/lib/repositories/workflow-event";

// Internal review tool, not a public marketing site — always-fresh DB
// reads matter more than instant navigation here. Opts this segment out
// of Cache Components' instant-navigation build validation.
export const instant = false;

function Tile({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tabular-nums" aria-live="polite">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tone === "destructive"
              ? "bg-destructive/15 text-destructive"
              : "bg-primary/15 text-primary"
          )}
        >
          <Icon className="size-4.5" />
        </span>
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Live counts from the database — no client-side caching.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total Leads" value={totalLeads} icon={Users} />
        <Tile label="Pending Approvals" value={pendingApprovals} icon={Clock3} />
        <Tile label="Sent Replies" value={sentReplies} icon={Send} />
        <Tile
          label="Failed Executions"
          value={failedExecutions}
          icon={AlertTriangle}
          tone={failedExecutions > 0 ? "destructive" : "primary"}
        />
      </div>
    </div>
  );
}
