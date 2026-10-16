"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { closeLead } from "@/lib/close-lead";
import { getLeadById } from "@/lib/repositories/lead";

export async function closeLeadAction(formData: FormData) {
  if (formData.get("confirmed") !== "on") {
    throw new Error("Confirmation is required before taking this action (FR-036).");
  }
  const leadId = String(formData.get("leadId") ?? "");
  const reason = String(formData.get("reason") ?? "manual") as "replied" | "opted_out" | "manual";
  if (!leadId) {
    throw new Error("Missing lead id.");
  }

  const lead = await getLeadById(leadId);
  if (!lead) {
    throw new Error("Lead not found.");
  }

  await closeLead(leadId, reason);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/");
  redirect(`/leads/${leadId}`);
}
