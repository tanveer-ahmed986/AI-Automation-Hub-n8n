import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadAnalysisByLeadId } from "@/lib/repositories/lead-analysis";
import { getLeadById } from "@/lib/repositories/lead";
import { getLatestReplyDraftForLead } from "@/lib/repositories/reply-draft";
import { closeLeadAction } from "./actions";

export const instant = false;

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) {
    notFound();
  }

  const [analysis, draft] = await Promise.all([
    getLeadAnalysisByLeadId(lead.id),
    getLatestReplyDraftForLead(lead.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{lead.name}</h1>
        <p className="text-muted-foreground">{lead.emailNormalized}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Status:</span> {lead.status.replace(/_/g, " ")}
          </p>
          <p>
            <span className="font-medium">Company:</span> {lead.company ?? "Unknown"}
          </p>
          <p>
            <span className="font-medium">Service:</span> {lead.service ?? "Unknown"}
          </p>
          <p>
            <span className="font-medium">Budget (as submitted):</span> {lead.budgetOriginal ?? "Unknown"}
          </p>
          <p>
            <span className="font-medium">Timeline:</span> {lead.timeline ?? "Unknown"}
          </p>
          <p>
            <span className="font-medium">Follow-up consent:</span> {lead.consentToFollowUp ? "Yes" : "No"}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="font-medium">Message:</span> {lead.message}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI Analysis <Badge variant="outline">AI-generated, advisory</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {analysis ? (
            <>
              <p>
                <span className="font-medium">Category:</span> {analysis.category.replace(/_/g, " ")}
              </p>
              <p>
                <span className="font-medium">Intent:</span> {analysis.intent.replace(/_/g, " ")}
              </p>
              <p>
                <span className="font-medium">Urgency:</span> {analysis.urgency}
              </p>
              <p>
                <span className="font-medium">Score:</span> {analysis.leadScore} / 100 (advisory —
                never a guaranteed prediction)
              </p>
              <p>
                <span className="font-medium">Summary:</span> {analysis.summary}
              </p>
              <div>
                <span className="font-medium">Score factors:</span>
                <ul className="ml-5 list-disc">
                  {analysis.scoreFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium">Missing information:</span>
                {analysis.missingInformation.length === 0 ? (
                  " None identified"
                ) : (
                  <ul className="ml-5 list-disc">
                    {analysis.missingInformation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p>
                <span className="font-medium">Recommended next action:</span>{" "}
                {analysis.recommendedNextAction.replace(/_/g, " ")}
              </p>
            </>
          ) : (
            <p role="status" className="text-muted-foreground">
              No completed analysis yet — this lead was marked for manual review or hasn&apos;t been
              analyzed yet. See the execution log for details.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Draft Reply <Badge variant="outline">AI-generated, advisory</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {draft ? (
            <>
              <p>
                <span className="font-medium">Version:</span> {draft.version} ·{" "}
                <span className="font-medium">Status:</span> {draft.status.replace(/_/g, " ")}
              </p>
              <p>
                <span className="font-medium">Subject:</span> {draft.subject}
              </p>
              <p className="whitespace-pre-wrap rounded-md border bg-muted p-3">{draft.body}</p>
              {draft.status === "pending_approval" && (
                <p>
                  <Link
                    href="/approvals"
                    className="font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2"
                  >
                    Review in the Approval Queue →
                  </Link>
                </p>
              )}
            </>
          ) : (
            <p role="status" className="text-muted-foreground">
              No draft yet.
            </p>
          )}
        </CardContent>
      </Card>

      {lead.status !== "closed" && lead.status !== "spam" && (
        <Card>
          <CardHeader>
            <CardTitle>Reply &amp; Follow-up Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This demo has no inbound-email channel — record a reply or opt-out manually to stop any
              scheduled follow-up for this lead (FR-027). This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={closeLeadAction} className="flex items-center gap-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="reason" value="replied" />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" name="confirmed" required />
                  Confirm
                </label>
                <Button type="submit" size="sm" variant="outline">
                  Record reply / close
                </Button>
              </form>
              {lead.consentToFollowUp && (
                <form action={closeLeadAction} className="flex items-center gap-2">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="reason" value="opted_out" />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" name="confirmed" required />
                    Confirm
                  </label>
                  <Button type="submit" size="sm" variant="destructive">
                    Record opt-out
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
