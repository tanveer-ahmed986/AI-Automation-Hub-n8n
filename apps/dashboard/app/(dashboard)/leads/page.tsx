import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLeadsWithAnalysis } from "@/lib/repositories/lead";

export const instant = false;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending_review: "secondary",
  approved: "default",
  sent: "default",
  closed: "outline",
  spam: "destructive",
};

export default async function LeadsPage() {
  await connection();
  const leads = await listLeadsWithAnalysis();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Leads</h1>
      {leads.length === 0 ? (
        <p className="text-muted-foreground" role="status">
          No leads yet. Submit one through the lead-intake webhook, or run{" "}
          <code>pnpm db:seed</code> to load fictional demo data.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  Score <span className="font-normal text-muted-foreground">(AI, advisory)</span>
                </TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(({ lead, analysis }) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
                    >
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status] ?? "secondary"}>
                      {lead.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{analysis ? analysis.category.replace(/_/g, " ") : "—"}</TableCell>
                  <TableCell>{analysis ? analysis.leadScore : "—"}</TableCell>
                  <TableCell>{lead.source ?? "—"}</TableCell>
                  <TableCell>{lead.createdAt.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
