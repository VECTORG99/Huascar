/**
 * Webhook event system for notifying external services about agent executions.
 *
 * Configure webhooks via WEBHOOK_URL env var (comma-separated for multiple).
 * Events: execution.started, execution.completed, execution.failed
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

const RAW_URLS = (process.env.WEBHOOK_URLS || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
const WEBHOOK_TIMEOUT_MS = 5000;

// Validate webhook URLs at module load — block SSRF-vulnerable URLs
const WEBHOOK_URLS: string[] = [];
for (const url of RAW_URLS) {
  if (isBlockedUrl(url)) {
    logger.warn({ url }, '[Webhook] Blocked SSRF-vulnerable webhook URL from configuration');
  } else {
    WEBHOOK_URLS.push(url);
  }
}

export async function emitWebhook(event: WebhookEvent): Promise<void> {
  if (WEBHOOK_URLS.length === 0) return;

  const payload = JSON.stringify(event);

  for (const url of WEBHOOK_URLS) {
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
