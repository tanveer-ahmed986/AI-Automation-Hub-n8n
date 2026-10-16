function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * In-memory sliding window, per dashboard process — adequate for this
 * single-instance demo deployment (FR-007). NOTE: the installed n8n
 * 2.43.5 Webhook node has no built-in per-source-IP rate limit (verified
 * live — its only request-shaping options are an IP allowlist and CORS),
 * so this check runs one hop later, at the internal API, keyed by
 * whatever `X-Forwarded-For` WF-01 forwards from the inbound webhook
 * request. In this local Docker Compose setup there is no reverse proxy
 * setting that header trustworthily, so it is caller-suppliable and
 * therefore a best-effort control, not a hard guarantee — true abuse
 * resistance for a public deployment (SPEC.md Phase B) requires a
 * reverse proxy in front of n8n that sets this header itself. Documented
 * in docs/security.md.
 */
const windowStartByKey = new Map<string, { windowStart: number; count: number }>();
const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const limit = envInt("WEBHOOK_RATE_LIMIT_PER_MINUTE", 60);
  const now = Date.now();
  const entry = windowStartByKey.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    windowStartByKey.set(key, { windowStart: now, count: 1 });
    return { allowed: true, limit, remaining: limit - 1 };
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return { allowed, limit, remaining: Math.max(0, limit - entry.count) };
}

export function getMaxBodyBytes(): number {
  return envInt("WEBHOOK_MAX_BODY_BYTES", 20_000);
}

export function getClientKeyFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
