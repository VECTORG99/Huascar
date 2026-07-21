import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface SecurityPolicy {
  blocked_tool_patterns: string[];
  blocked_args_substrings: Record<string, string[]>;
}

function loadPolicy(): SecurityPolicy {
  const policyPath = process.env.SECURITY_POLICY_PATH || path.resolve('./src/kiro/security-policy.json');
  try {
    return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch (err) {
    console.error(`[SECURITY] Error cargando politica de seguridad desde ${policyPath}:`, err);
    // Fail-closed: default to blocking everything if policy can't be loaded
    return {
      blocked_tool_patterns: [''],
      blocked_args_substrings: {}
    };
  }
}

const policy = loadPolicy();
const BYPASS_SECRET = process.env.BYPASS_SECRET;

// ponytail: redact sensitive values from logs to prevent accidental env leaks
function redact(value: string): string {
  if (!BYPASS_SECRET || !value) return value;
  const escaped = BYPASS_SECRET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(escaped, 'gi'), '{redacted}');
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
    // Bypass: if the caller provides the correct BYPASS_SECRET, skip checks
    if (BYPASS_SECRET && args.bypass_secret === BYPASS_SECRET) {
      console.log(`[HOOK BYPASS] Bypass de seguridad activado para: ${toolName}`);
      return true;
    }

    // Check if tool name matches blocked patterns (case-insensitive)
    for (const pattern of policy.blocked_tool_patterns) {
      if (toolNameLower.includes(pattern)) {
        console.error(`[HOOK ERROR] Herramienta bloqueada por politica de seguridad: ${redact(toolName)}`);
        throw new Error(`HOOK TRIGGERED: Herramienta "${redact(toolName)}" bloqueada por politica de seguridad.`);
      }
    }

    // Check if args contain blocked substrings (case-insensitive match)
    const blockedArgs = policy.blocked_args_substrings[toolName];
    if (blockedArgs) {
      const serialized = JSON.stringify(args).toLowerCase();
      for (const substr of blockedArgs) {
        if (serialized.includes(substr.toLowerCase())) {
          console.error(`[HOOK ERROR] Accion destructiva bloqueada en "${toolName}": ${redact(substr)}`);
          throw new Error(`HOOK TRIGGERED: Accion destructiva bloqueada por politica de seguridad.`);
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
