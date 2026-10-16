import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { INTERNAL_API_SECRET_HEADER, unauthorizedResponseBody, verifyInternalApiSecret } from "./lib/internal-api-auth";

// Guards every /api/internal/* route (n8n calls these; the browser never
// does). Network isolation inside the Docker Compose network is the
// primary control — this shared-secret header is defense-in-depth, per
// the constitution's least-privilege principle.
export function proxy(request: NextRequest) {
  const headerValue = request.headers.get(INTERNAL_API_SECRET_HEADER);
  const configuredSecret = process.env.INTERNAL_API_SECRET;
  if (!verifyInternalApiSecret(headerValue, configuredSecret)) {
    return NextResponse.json(unauthorizedResponseBody(), { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/internal/:path*",
};
