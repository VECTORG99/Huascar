import crypto from 'crypto';
import { config } from '../config.js';
import { ApiError, ErrorCodes } from '../errors.js';
import type { SessionMessageRecord, SessionRecord, Store } from './Store.js';

export class SessionManager {
  constructor(private readonly store: Store, private readonly ttlMs = config.sessions.ttlMs) {}

  getOrCreate(sessionId: string | undefined, role: string): SessionRecord {
    const now = Date.now();
    if (!sessionId) return this.store.createSession(crypto.randomUUID(), role, now);

    const session = this.store.getSession(sessionId);
    if (!session) throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'session_id no existe', 404);
    if (session.last_active_at < now - this.ttlMs) {
      this.store.deleteExpiredSessions(this.ttlMs, now);
      throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'session_id expiro', 404);
    }
    this.store.touchSession(session.id, now);
    return { ...session, last_active_at: now };
  }

  recentContext(sessionId: string): string {
    const messages = this.store.listSessionMessages(sessionId, config.sessions.maxMessages);
    if (messages.length === 0) return '';
    return `Contexto de sesion reciente:\n${messages.map(formatMessage).join('\n')}`;
  }
}

function formatMessage(message: SessionMessageRecord): string {
  return `${message.role}: ${message.content}`;
}
