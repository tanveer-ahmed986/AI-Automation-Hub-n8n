export interface EmailSendInput {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSendResult {
  mock: boolean;
  provider: string;
  providerResponseSafe: Record<string, unknown> | null;
}

export interface EmailAdapter {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

// Deterministic test hook for exercising the bounded-retry path (FR-025)
// without a real flaky SMTP server — mirrors the AI adapter's own
// documented failure-simulation markers (ai-adapter.ts).
export const FORCE_EMAIL_TRANSIENT_FAILURE_MARKER = "__FORCE_EMAIL_TRANSIENT_FAILURE__";

/**
 * Deterministic, no-op "send" — the default email adapter (constitution
 * Principle IV, FR-022). Never represents a simulated send as real
 * (`mock: true` always), and never actually contacts any mail provider.
 */
export class MockEmailAdapter implements EmailAdapter {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    if (input.body.includes(FORCE_EMAIL_TRANSIENT_FAILURE_MARKER)) {
      throw new Error("Simulated transient email delivery failure (test hook)");
    }
    return {
      mock: true,
      provider: "mock",
      providerResponseSafe: { to: input.to, subject: input.subject, simulated: true },
    };
  }
}

export interface SmtpEmailAdapterConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

/**
 * Real SMTP-backed adapter — only ever constructed when `MOCK_EMAIL=false`
 * and `EMAIL_PROVIDER`/`SMTP_*` are explicitly configured (FR-022). Never
 * reads credentials into persisted records; only safe, redacted metadata
 * (`providerResponseSafe`) leaves this function.
 */
export class SmtpEmailAdapter implements EmailAdapter {
  constructor(private readonly config: SmtpEmailAdapterConfig) {}

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      auth: { user: this.config.user, pass: this.config.password },
    });
    const info = await transport.sendMail({
      from: this.config.from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
    return {
      mock: false,
      provider: "smtp",
      providerResponseSafe: {
        messageId: info.messageId,
        accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
      },
    };
  }
}
