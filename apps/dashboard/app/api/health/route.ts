import { NextResponse } from "next/server";

// Public, unauthenticated liveness probe for Docker healthchecks and
// scripts/health-check — intentionally returns no internal state.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
