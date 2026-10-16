import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listPendingApprovalDrafts } from "@/lib/repositories/reply-draft";
import { approveDraftAction, editAndApproveDraftAction, rejectDraftAction } from "./actions";

export const instant = false;

const RESULT_MESSAGES: Record<string, string> = {
  sent: "Reply sent (see Email: mock/live in Settings for delivery mode).",
  already_sent: "That draft was already sent — no second delivery was made.",
  rejected: "Draft rejected. It can never be sent.",
  stale_version_rejected: "That version was superseded by a newer edit and could not be approved.",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await connection();
  const { result } = await searchParams;
  const pending = await listPendingApprovalDrafts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Approval Queue</h1>

      {result && (
        <p role="status" className="rounded-md border bg-muted p-3 text-sm">
          {RESULT_MESSAGES[result] ?? `Result: ${result}`}
        </p>
      )}

      {pending.length === 0 ? (
        <p className="text-muted-foreground" role="status">
          No drafts awaiting approval right now.
        </p>
      ) : (
        <div className="space-y-6">
          {pending.map(({ draft, lead, followUpAttemptNumber }) => (
            <Card key={draft.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {lead.name} <span className="text-sm text-muted-foreground">({lead.emailNormalized})</span>
                  <Badge variant="outline">AI-generated, advisory</Badge>
                  {followUpAttemptNumber != null ? (
                    <Badge variant="secondary">Follow-up attempt {followUpAttemptNumber}</Badge>
                  ) : (
                    <Badge variant="secondary">v{draft.version}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p>
                  <span className="font-medium">Subject:</span> {draft.subject}
                </p>
                <p className="whitespace-pre-wrap rounded-md border bg-muted p-3">{draft.body}</p>

                <div className="flex flex-wrap gap-3">
                  <form action={approveDraftAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="draftVersion" value={draft.version} />
                    <input type="hidden" name="leadId" value={draft.leadId} />
                    <div className="space-y-1">
                      <Label htmlFor={`reviewer-approve-${draft.id}`} className="text-xs">
                        Reviewer (optional)
                      </Label>
                      <Input id={`reviewer-approve-${draft.id}`} name="reviewerIdentity" className="h-8 w-40" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" name="confirmed" required />
                      Confirm send
                    </label>
                    <Button type="submit" size="sm">
                      Approve &amp; Send
                    </Button>
                  </form>

                  <form action={rejectDraftAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="draftVersion" value={draft.version} />
                    <input type="hidden" name="leadId" value={draft.leadId} />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" name="confirmed" required />
                      Confirm reject
                    </label>
                    <Button type="submit" size="sm" variant="destructive">
                      Reject
                    </Button>
                  </form>
                </div>

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Edit before approving</summary>
                  <form
                    action={editAndApproveDraftAction}
                    className="mt-3 space-y-3"
                  >
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="draftVersion" value={draft.version} />
                    <input type="hidden" name="leadId" value={draft.leadId} />
                    <div className="space-y-1.5">
                      <Label htmlFor={`edited-subject-${draft.id}`}>Subject</Label>
                      <Input id={`edited-subject-${draft.id}`} name="editedSubject" defaultValue={draft.subject} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edited-body-${draft.id}`}>Body</Label>
                      <Textarea
                        id={`edited-body-${draft.id}`}
                        name="editedBody"
                        defaultValue={draft.body}
                        required
                        rows={6}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`reviewer-edit-${draft.id}`} className="text-xs">
                        Reviewer (optional)
                      </Label>
                      <Input id={`reviewer-edit-${draft.id}`} name="reviewerIdentity" className="h-8 w-40" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" name="confirmed" required />
                      Confirm this creates a new version and sends it — the prior version can never be
                      sent after this.
                    </label>
                    <Button type="submit" size="sm">
                      Save Edit &amp; Approve &amp; Send
                    </Button>
                  </form>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
