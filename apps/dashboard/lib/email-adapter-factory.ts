import { MockEmailAdapter, SmtpEmailAdapter, type EmailAdapter } from "@automation-hub/adapters";
import { isMockEmail } from "./config";

/**
 * Mirrors `ai-adapter-factory.ts`: fails closed rather than silently
 * substituting the mock adapter when a live send was explicitly
 * requested but isn't fully configured (constitution Principle VII).
 */
export function getEmailAdapter(): EmailAdapter {
  if (isMockEmail()) {
    return new MockEmailAdapter();
  }

  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !Number.isFinite(port) || !user || !password || !from) {
    throw new Error(
      "MOCK_EMAIL=false but SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/EMAIL_FROM are not fully set. " +
        "Set MOCK_EMAIL=true, or configure all SMTP_* variables to enable real delivery (FR-022).",
    );
  }
  return new SmtpEmailAdapter({ host, port, user, password, from });
}
