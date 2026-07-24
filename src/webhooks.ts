/**
 * Webhook event system for notifying external services about agent executions.
 *
 * Configure webhooks via WEBHOOK_URL env var (comma-separated for multiple).
 * Events: execution.started, execution.completed, execution.failed
 *
 * SSRF validation is performed at send time (#248), not just at module load.
 */

import { logger } from './logger.js';
import { isBlockedUrl } from './security/urlValidation.js';

export interface WebhookEvent {
  type: 'execution.started' | 'execution.completed' | 'execution.failed';
  timestamp: string;
  data: {
    role: string;
    task: string;
    duration_ms?: number;
    error?: string;
  };
}

const WEBHOOK_TIMEOUT_MS = 5000;

/** Parse configured webhook URLs from environment. */
function getWebhookUrls(): string[] {
  return (process.env.WEBHOOK_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

export async function emitWebhook(event: WebhookEvent): Promise<void> {
  const urls = getWebhookUrls();
  if (urls.length === 0) return;

  const payload = JSON.stringify(event);

  for (const url of urls) {
    // Validate at send time to catch dynamically configured SSRF-vulnerable URLs (#248)
    if (isBlockedUrl(url)) {
      logger.warn({ url }, '[Webhook] Blocked SSRF-vulnerable webhook URL at send time');
      continue;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': event.type },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      // Fire-and-forget: don't let webhook failures affect execution
      logger.warn({ url, err: err instanceof Error ? err.message : 'unknown' }, '[Webhook] Failed to deliver');
    }
  }
}
