import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { businessProfile } from "@database/schema/business-profile";
import type { BusinessProfile, NewBusinessProfile } from "@database/schema/business-profile";

/** Singleton row — exactly one `BusinessProfile` exists in this version. */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const rows = await db.select().from(businessProfile).limit(1);
  return rows[0] ?? null;
}

export async function upsertBusinessProfile(
  values: Omit<NewBusinessProfile, "id" | "updatedAt">,
): Promise<BusinessProfile> {
  const existing = await getBusinessProfile();
  if (existing) {
    const [row] = await db
      .update(businessProfile)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(businessProfile.id, existing.id))
      .returning();
    if (!row) {
      throw new Error("Failed to update business profile");
    }
    return row;
  }
  const [row] = await db.insert(businessProfile).values(values).returning();
  if (!row) {
    throw new Error("Failed to create business profile");
  }
  return row;
}
