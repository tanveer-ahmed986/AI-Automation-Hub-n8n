import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDemoMode, isMockAi, isMockEmail } from "@/lib/config";
import { getBusinessProfile } from "@/lib/repositories/business-profile";
import { updateBusinessProfile } from "./actions";

export const instant = false;

export default async function SettingsPage() {
  await connection();
  const profile = await getBusinessProfile();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Demo mode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant={isDemoMode() ? "outline" : "default"}>
            Demo mode: {isDemoMode() ? "on" : "off"}
          </Badge>
          <Badge variant={isMockAi() ? "outline" : "default"}>AI: {isMockAi() ? "mock" : "live"}</Badge>
          <Badge variant={isMockEmail() ? "outline" : "default"}>
            Email: {isMockEmail() ? "mock" : "live"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateBusinessProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                defaultValue={profile?.businessName ?? ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servicesOffered">Services offered (comma-separated)</Label>
              <Input
                id="servicesOffered"
                name="servicesOffered"
                defaultValue={profile?.servicesOffered.join(", ") ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contactDetails">Contact details</Label>
              <Textarea
                id="contactDetails"
                name="contactDetails"
                defaultValue={profile?.contactDetails ?? ""}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="replyTone">Reply tone</Label>
              <Input id="replyTone" name="replyTone" defaultValue={profile?.replyTone ?? "professional"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signature">Signature</Label>
              <Textarea id="signature" name="signature" defaultValue={profile?.signature ?? ""} required />
            </div>
            <p className="text-sm text-muted-foreground">
              Draft replies always read from this profile and never invent prices, discounts,
              guarantees, or availability beyond what&apos;s configured here (FR-013a/FR-014).
            </p>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2"
            >
              Save
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
