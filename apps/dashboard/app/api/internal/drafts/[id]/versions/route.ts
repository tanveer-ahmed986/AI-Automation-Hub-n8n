import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createDraftVersionRequestSchema } from "@automation-hub/schemas";
import { createEditedDraftVersion, getReplyDraftById } from "@/lib/repositories/reply-draft";

/**
 * Not in the OpenAPI doc verbatim — contracts/n8n-webhooks.md leaves
 * "how a new ReplyDraft version gets created" as an implementation-time
 * choice. This route is the one place that logic lives
 * (`createEditedDraftVersion`, which also marks the prior version
 * permanently unsendable per FR-018); the dashboard's edit-and-approve
 * server action calls the same underlying function in-process, so both
 * entry points share identical behavior.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: draftId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createDraftVersionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const original = await getReplyDraftById(draftId);
  if (!original) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const created = await createEditedDraftVersion({
    leadId: original.leadId,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  return NextResponse.json({ draftId: created.id, version: created.version });
}
