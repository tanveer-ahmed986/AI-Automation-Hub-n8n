import { timingSafeEqual } from "node:crypto";

export const INTERNAL_API_SECRET_HEADER = "x-internal-api-secret";

/**
 * Constant-time comparison — a naive `===` on a shared secret leaks
 * timing information an attacker could use to brute-force it character
 * by character (constitution Principle VI, least privilege).
 */
export function verifyInternalApiSecret(
  headerValue: string | null | undefined,
  configuredSecret: string | undefined,
): boolean {
  if (!configuredSecret || !headerValue) {
    return false;
  }
  const headerBuf = Buffer.from(headerValue);
  const secretBuf = Buffer.from(configuredSecret);
  if (headerBuf.length !== secretBuf.length) {
    return false;
  }
  return timingSafeEqual(headerBuf, secretBuf);
}

export function unauthorizedResponseBody() {
  return { error: "Unauthorized" };
}
