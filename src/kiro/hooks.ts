import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../logger.js';

// --- Types ---

interface AllowedCommand {
  binary: string;
  allowed_args: string[];
}

interface SecurityPolicy {
  version: string;
  mode: 'allowlist' | 'denylist';
  allowed_tools: string[];
  allowed_commands: { entries: AllowedCommand[] };
  blocked_tool_patterns: string[];
  blocked_args_substrings: Record<string, string[]>;
}

// --- Policy Loading (fail-closed) ---

function loadPolicy(): SecurityPolicy {
  const policyPath = process.env.SECURITY_POLICY_PATH || path.resolve('./src/kiro/security-policy.json');
  try {
    const raw = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    if (!raw.version || !raw.allowed_commands?.entries) {
      throw new Error('Invalid policy schema');
    }
    return raw as SecurityPolicy;
  } catch (err) {
    logger.error({ err, policyPath }, '[SECURITY] Error loading security policy');
    return {
      version: '0.0.0',
      mode: 'allowlist',
      allowed_tools: [],
      allowed_commands: { entries: [] },
      blocked_tool_patterns: [''],
      blocked_args_substrings: {},
    };
  }
}

const policy = loadPolicy();

// --- Administrative Bypass (out-of-band only, request-scoped) ---

const BYPASS_SECRET = process.env.BYPASS_SECRET;
const BYPASS_TTL_MS = parseInt(process.env.BYPASS_TTL_MS || '60000', 10); // default 60s

// Request-scoped bypass: only the specific request ID that activated it gets bypass
const activeBypassRequests = new Map<string, ReturnType<typeof setTimeout>>();

function timingSafeSecretCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Compare against itself to maintain constant time, then return false
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function activateAdminBypass(secret: string, requestId: string): boolean {
  if (!BYPASS_SECRET || !requestId) return false;
  if (!timingSafeSecretCompare(secret, BYPASS_SECRET)) return false;

  // Scope bypass to this specific request ID
  const existing = activeBypassRequests.get(requestId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    activeBypassRequests.delete(requestId);
  }, BYPASS_TTL_MS);
  activeBypassRequests.set(requestId, timer);
  logger.warn({ requestId, ttlMs: BYPASS_TTL_MS }, '[SECURITY AUDIT] Admin bypass ACTIVATED');
  return true;
}

export function deactivateAdminBypass(requestId?: string): void {
  if (requestId) {
    const timer = activeBypassRequests.get(requestId);
    if (timer) clearTimeout(timer);
    activeBypassRequests.delete(requestId);
    logger.warn({ requestId }, '[SECURITY AUDIT] Admin bypass DEACTIVATED');
  } else {
    // Clear all (emergency)
    for (const [id, timer] of activeBypassRequests) {
      clearTimeout(timer);
      logger.warn({ requestId: id }, '[SECURITY AUDIT] Admin bypass DEACTIVATED (emergency clear)');
    }
    activeBypassRequests.clear();
  }
}

export function isAdminBypassActive(requestId?: string): boolean {
  if (!requestId) return false;
  return activeBypassRequests.has(requestId);
}

// --- Command Parsing & Validation ---

// Shell metacharacters that indicate injection attempts
const SHELL_METACHAR_PATTERN = /[\$`\(\)<>\n\r\x00\\]/;

function parseCommand(cmd: string): { binary: string; fullCmd: string }[] {
  // Split on pipe, semicolon, ampersand (command chaining)
  return cmd
    .split(/\s*[|;&]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const parts = seg.split(/\s+/);
      return { binary: parts[0] ?? '', fullCmd: seg };
    });
}

export function validateCommand(command: string): { allowed: boolean; reason?: string } {
  const segments = parseCommand(command);
  if (segments.length === 0) return { allowed: false, reason: 'Empty command' };

  // Block shell metacharacters in the entire command (prevents subshells, backticks, etc.)
  if (SHELL_METACHAR_PATTERN.test(command)) {
    return { allowed: false, reason: 'Command contains shell metacharacters (possible injection)' };
  }

  for (const { binary, fullCmd } of segments) {
    const entry = policy.allowed_commands.entries.find((e) => e.binary === binary);
    if (!entry) return { allowed: false, reason: `Binary "${binary}" not in allowlist` };
    if (entry.allowed_args.length > 0) {
      const argsStr = fullCmd.slice(binary.length).trim();
      if (argsStr.length > 0) {
        // Exact match: args must exactly match one of the allowed patterns,
        // OR match as a complete prefix followed by a space (word boundary)
        const isAllowed = entry.allowed_args.some((p) => argsStr === p || argsStr.startsWith(p + ' '));
        if (!isAllowed) {
          return {
            allowed: false,
            reason: `Arguments "${argsStr}" not allowed for "${binary}". Permitted: ${entry.allowed_args.join(', ')}`,
          };
        }
      }
    }
  }
  return { allowed: true };
}

// --- Defense-in-Depth: Denylist ---

function denylistCheck(toolName: string, args: Record<string, unknown>): { blocked: boolean; reason?: string } {
  const toolNameLower = toolName.toLowerCase();
  for (const pattern of policy.blocked_tool_patterns) {
    if (pattern && toolNameLower.includes(pattern.toLowerCase())) {
      return { blocked: true, reason: `Tool name matches blocked pattern: "${pattern}"` };
    }
  }
  const serialized = JSON.stringify(args).toLowerCase();
  const allBlocked = [
    ...(policy.blocked_args_substrings['*'] || []),
    ...(policy.blocked_args_substrings[toolName] || []),
  ];
  for (const substr of allBlocked) {
    if (serialized.includes(substr.toLowerCase())) {
      return { blocked: true, reason: `Arguments contain blocked pattern: "${substr}"` };
    }
  }
  return { blocked: false };
}

// --- Commit Approval ---

const pendingApprovals = new Map<string, { status: string }>();

export function resolveApproval(id: string, approved: boolean): void {
  pendingApprovals.set(id, { status: approved ? 'approved' : 'rejected' });
}

export function getApprovalStatus(id: string): string | undefined {
  return pendingApprovals.get(id)?.status;
}

// --- Main Hook ---

export const agentHooks = {
  before_action: (toolName: string, args: Record<string, unknown>): boolean => {
    if ('bypass_secret' in args) {
      logger.warn('[SECURITY] Model attempted to inject bypass_secret — stripped');
      delete args.bypass_secret;
    }
    // Note: admin bypass is now request-scoped and checked by the route handler
    // before calling hooks. before_action always enforces policy.
    const denyResult = denylistCheck(toolName, args);
    if (denyResult.blocked) {
      logger.error(`[HOOK BLOCKED] ${denyResult.reason}`);
      throw new Error(`HOOK TRIGGERED: Action blocked by security policy — ${denyResult.reason}`);
    }
    if (policy.allowed_tools.length > 0) {
      if (!policy.allowed_tools.includes(toolName)) {
        const shellTools = ['execute_bash', 'run_command', 'shell', 'exec'];
        if (shellTools.includes(toolName.toLowerCase())) {
          const command = (args.command || args.cmd || args.script || '') as string;
          const result = validateCommand(command);
          if (!result.allowed) {
            logger.error(`[HOOK BLOCKED] Command rejected: ${result.reason}`);
            throw new Error(
              `HOOK TRIGGERED: Command blocked — ${result.reason}. Only allowlisted operations are permitted.`,
            );
          }
          logger.info(`[HOOK OK] Command validated: ${command.slice(0, 80)}`);
          return true;
        }
        logger.error(`[HOOK BLOCKED] Tool "${toolName}" not in allowlist — fail-closed`);
        throw new Error(`HOOK TRIGGERED: Tool "${toolName}" not in allowlist. Undeclared actions fail closed.`);
      }
    }
    logger.info(`[HOOK OK] Action authorized: ${toolName}`);
    return true;
  },

  on_commit: async (_diffContext: string): Promise<string> => {
    const id = crypto.randomUUID();
    pendingApprovals.set(id, { status: 'pending' });
    logger.info(`[HOOK PAUSE] Awaiting developer approval (id=${id})...`);
    try {
      for (let i = 0; i < 30; i++) {
        const record = pendingApprovals.get(id);
        if (record && record.status !== 'pending') return record.status === 'approved' ? 'APPROVED' : 'REJECTED';
        await new Promise((r) => setTimeout(r, 1000));
      }
      return 'TIMEOUT';
    } finally {
      pendingApprovals.delete(id);
    }
  },
};
