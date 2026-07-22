import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface SecurityPolicy {
  blocked_tool_patterns: string[];
  blocked_args_substrings: Record<string, string[]>;
  allowed_tools?: string[];
}

function loadPolicy(): SecurityPolicy {
  const policyPath = process.env.SECURITY_POLICY_PATH || path.resolve('./src/kiro/security-policy.json');
  try {
    return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch (err) {
    console.error(`[SECURITY] Error cargando politica de seguridad desde ${policyPath}:`, err);
    // Fail-closed: block everything if policy can't be loaded
    return {
      blocked_tool_patterns: [''],
      blocked_args_substrings: {},
      allowed_tools: [],
    };
  }
}

const policy = loadPolicy();

// BYPASS_SECRET is only valid when provided via an administrative channel (HTTP header),
// NEVER from model-generated tool arguments. This prevents prompt injection attacks.
const BYPASS_SECRET = process.env.BYPASS_SECRET;

// Administrative bypass state — set by server middleware, not by tool args
let adminBypassActive = false;

/**
 * Activate bypass from an administrative channel (e.g., HTTP header validated by server).
 * Must NEVER be callable from model/tool arguments.
 */
export function activateAdminBypass(secret: string): boolean {
  if (BYPASS_SECRET && secret === BYPASS_SECRET) {
    adminBypassActive = true;
    // Auto-deactivate after 5 minutes
    setTimeout(() => { adminBypassActive = false; }, 5 * 60 * 1000);
    return true;
  }
  return false;
}

export function deactivateAdminBypass(): void {
  adminBypassActive = false;
}

const pendingApprovals = new Map<string, { status: string }>();

export function resolveApproval(id: string, approved: boolean): void {
  pendingApprovals.set(id, { status: approved ? 'approved' : 'rejected' });
}

export function getApprovalStatus(id: string): string | undefined {
  return pendingApprovals.get(id)?.status;
}

export const agentHooks = {
  before_action: (toolName: string, args: Record<string, unknown>): boolean => {
    const toolNameLower = toolName.toLowerCase();

    // Admin bypass — only activated via secure administrative channel, not from tool args
    if (adminBypassActive) {
      console.log(`[HOOK BYPASS] Administrative bypass active for: ${toolName}`);
      return true;
    }

    // IMPORTANT: Do NOT check args.bypass_secret — this was the vulnerability.
    // The model could be induced to include the bypass secret in its tool calls.

    // Strip any bypass_secret from args to prevent the model from using it
    if ('bypass_secret' in args) {
      console.warn(`[SECURITY] Model attempted to use bypass_secret in tool args — stripped and ignored`);
      delete args.bypass_secret;
    }

    // If allowlist mode is active, only explicitly allowed tools can execute
    if (policy.allowed_tools && policy.allowed_tools.length > 0) {
      if (!policy.allowed_tools.includes(toolName)) {
        console.error(`[HOOK ERROR] Tool "${toolName}" not in allowlist — blocked`);
        throw new Error(`HOOK TRIGGERED: Herramienta "${toolName}" no esta en la lista de herramientas permitidas.`);
      }
    }

    // Check if tool name matches blocked patterns (case-insensitive)
    for (const pattern of policy.blocked_tool_patterns) {
      if (pattern && toolNameLower.includes(pattern.toLowerCase())) {
        console.error(`[HOOK ERROR] Herramienta bloqueada por politica de seguridad: ${toolName}`);
        throw new Error(`HOOK TRIGGERED: Herramienta "${toolName}" bloqueada por politica de seguridad.`);
      }
    }

    // Check if args contain blocked substrings (case-insensitive match)
    // Check against all tools with blocked patterns, not just exact tool name match
    const argsToCheck = [toolName, '*'];
    for (const checkTool of argsToCheck) {
      const blockedArgs = policy.blocked_args_substrings[checkTool];
      if (blockedArgs) {
        const serialized = JSON.stringify(args).toLowerCase();
        for (const substr of blockedArgs) {
          if (serialized.includes(substr.toLowerCase())) {
            console.error(`[HOOK ERROR] Accion destructiva bloqueada en "${toolName}": detected "${substr}"`);
            throw new Error(`HOOK TRIGGERED: Accion destructiva bloqueada por politica de seguridad.`);
          }
        }
      }
    }

    console.log(`[HOOK SUCCESS] Autorizando accion segura: ${toolName}`);
    return true;
  },

  on_commit: async (diffContext: string): Promise<string> => {
    const id = crypto.randomUUID();
    pendingApprovals.set(id, { status: 'pending' });
    console.log(`[HOOK PAUSE] Esperando aprobacion del desarrollador (id=${id})...`);
    try {
      for (let i = 0; i < 30; i++) {
        const record = pendingApprovals.get(id);
        if (record && record.status !== 'pending') {
          return record.status === 'approved' ? 'APPROVED' : 'REJECTED';
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      return 'TIMEOUT';
    } finally {
      pendingApprovals.delete(id);
    }
  }
};
