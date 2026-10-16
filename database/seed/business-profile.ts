import { db } from "../client";
import { businessProfile } from "../schema/business-profile";

// Fictional demo business — never real company details (constitution
// Principle IV: seed/demo data must be fictional).
export async function seedBusinessProfile() {
  await db.insert(businessProfile).values({
    businessName: "Z&T Web Studio (Demo)",
    servicesOffered: ["website_development", "ai_automation", "consulting"],
    contactDetails: "hello@ztwebstudio.example — +1 (555) 010-0100",
    replyTone: "professional",
    signature: "Best regards,\nThe Z&T Web Studio Team (Demo)",
  });
  console.log("Seeded: business_profile (1 row)");
}
