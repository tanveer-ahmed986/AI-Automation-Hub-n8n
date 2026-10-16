"use server";

import { revalidatePath } from "next/cache";
import { upsertBusinessProfile } from "@/lib/repositories/business-profile";

export async function updateBusinessProfile(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const servicesOffered = String(formData.get("servicesOffered") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const contactDetails = String(formData.get("contactDetails") ?? "").trim();
  const replyTone = String(formData.get("replyTone") ?? "professional").trim();
  const signature = String(formData.get("signature") ?? "").trim();

  if (!businessName || !contactDetails || !signature) {
    throw new Error("Business name, contact details, and signature are required.");
  }

  await upsertBusinessProfile({ businessName, servicesOffered, contactDetails, replyTone, signature });
  revalidatePath("/settings");
}
