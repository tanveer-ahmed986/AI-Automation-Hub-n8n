import { isDemoMode, isMockAi, isMockEmail } from "@/lib/config";
import { Badge } from "@/components/ui/badge";

/**
 * Visible whenever MOCK_AI or MOCK_EMAIL is active (FR-044) — mounted in
 * the dashboard layout so every page shows it, not opt-in per page.
 * Mock delivery/analysis must never be represented as real (constitution
 * Principle IV).
 */
export function DemoModeBadge() {
  const mockAi = isMockAi();
  const mockEmail = isMockEmail();
  if (!isDemoMode() && !mockAi && !mockEmail) {
    return null;
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      aria-label={`Demo mode active: ${mockAi ? "mock AI" : "live AI"}, ${mockEmail ? "mock email" : "live email"}`}
    >
      DEMO MODE — {mockAi ? "Mock AI" : "Live AI"} · {mockEmail ? "Mock Email" : "Live Email"}
    </Badge>
  );
}
