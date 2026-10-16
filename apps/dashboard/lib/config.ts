function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDedupWindowHours(): number {
  return envInt("DEDUP_WINDOW_HOURS", 24);
}

export function getFollowupMaxAttempts(): number {
  return envInt("FOLLOWUP_MAX_ATTEMPTS", 2);
}

export function getFollowupDelayHours(): number {
  return envInt("FOLLOWUP_DELAY_HOURS", 48);
}

export function isMockAi(): boolean {
  return process.env.MOCK_AI !== "false";
}

export function isMockEmail(): boolean {
  return process.env.MOCK_EMAIL !== "false";
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

/**
 * Container-network address of the n8n instance (research.md §4 —
 * the dashboard calls WF-02's webhook rather than approving-and-sending
 * in-process, to keep the send step a real, demonstrable n8n workflow).
 * Not a secret — defaults to the Docker Compose service name, same as
 * the literal `http://dashboard:3000` URL already hardcoded into the
 * committed n8n workflow JSON.
 */
export function getN8nInternalBaseUrl(): string {
  return process.env.N8N_INTERNAL_BASE_URL ?? "http://n8n:5678";
}
