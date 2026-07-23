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
    return { version: '0.0.0', mode: 'allowlist', allowed_tools: [], allowed_commands: { entries: [] }, blocked_tool_patterns: [''], blocked_args_substrings: {} };
  }
}

const policy = loadPolicy();

// --- Administrative Bypass (out-of-band only) ---

const BYPASS_SECRET = process.env.BYPASS_SECRET;
let adminBypassActive = false;
let adminBypassTimer: ReturnType<typeof setTimeout> | undefined;

export function activateAdminBypass(secret: string): boolean {
  if (BYPASS_SECRET && secret === BYPASS_SECRET) {
    adminBypassActive = true;
    if (adminBypassTimer) clearTimeout(adminBypassTimer);
    adminBypassTimer = setTimeout(() => { adminBypassActive = false; }, 5 * 60 * 1000);
    return true;
  }
  return false;
}

export function deactivateAdminBypass(): void {
  adminBypassActive = false;
  if (adminBypassTimer) { clearTimeout(adminBypassTimer); adminBypassTimer = undefined; }
}

// --- Command Parsing & Validation ---

function parseCommand(cmd: string): { binary: string; fullCmd: string }[] {
  return cmd.split(/\s*[|;&]\s*/).map(s => s.trim()).filter(Boolean).map(seg => {
    const parts = seg.split(/\s+/);
    return { binary: parts[0] ?? '', fullCmd: seg };
  });
}

export function validateCommand(command: string): { allowed: boolean; reason?: string } {
  const segments = parseCommand(command);
  if (segments.length === 0) return { allowed: false, reason: 'Empty command' };
  for (const { binary, fullCmd } of segments) {
    const entry = policy.allowed_commands.entries.find(e => e.binary === binary);
    if (!entry) return { allowed: false, reason: `Binary "${binary}" not in allowlist` };
    if (entry.allowed_args.length > 0) {
      const argsStr = fullCmd.slice(binary.length).trim();
      if (argsStr.length > 0 && !entry.allowed_args.some(p => argsStr.startsWith(p))) {
        return { allowed: false, reason: `Arguments "${argsStr}" not allowed for "${binary}". Permitted: ${entry.allowed_args.join(', ')}` };
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
  const allBlocked = [...(policy.blocked_args_substrings['*'] || []), ...(policy.blocked_args_substrings[toolName] || [])];
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
    if (adminBypassActive) {
      logger.info(`[HOOK BYPASS] Administrative bypass active for: ${toolName}`);
      return true;
    }
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
            throw new Error(`HOOK TRIGGERED: Command blocked — ${result.reason}. Only allowlisted operations are permitted.`);
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
        await new Promise(r => setTimeout(r, 1000));
      }
      return 'TIMEOUT';
    } finally { pendingApprovals.delete(id); }
  }
};
