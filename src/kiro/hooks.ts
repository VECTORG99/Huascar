import fs from 'fs';
import path from 'path';

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
      blocked_tool_patterns: ['.'],
      blocked_args_substrings: {}
    };
  }
}

const policy = loadPolicy();

export const agentHooks = {
  before_action: (toolName: string, args: Record<string, unknown>): boolean => {
    // Check if tool name matches blocked patterns
    for (const pattern of policy.blocked_tool_patterns) {
      if (toolName.includes(pattern)) {
        console.error(`[HOOK ERROR] Herramienta bloqueada por politica de seguridad: ${toolName}`);
        throw new Error(`HOOK TRIGGERED: Herramienta "${toolName}" bloqueada por politica de seguridad.`);
      }
    }

    // Check if args contain blocked substrings (for this specific tool)
    const blockedArgs = policy.blocked_args_substrings[toolName];
    if (blockedArgs) {
      const serialized = JSON.stringify(args);
      for (const substr of blockedArgs) {
        if (serialized.includes(substr)) {
          console.error(`[HOOK ERROR] Accion destructiva bloqueada en "${toolName}": ${substr}`);
          throw new Error(`HOOK TRIGGERED: Accion destructiva bloqueada por politica de seguridad.`);
        }
      }
    }

    console.log(`[HOOK SUCCESS] Autorizando accion segura: ${toolName}`);
    return true;
  },

  on_commit: async (diffContext: string): Promise<string> => {
    console.log('[HOOK PAUSE] Esperando aprobacion del desarrollador para realizar el commit...');
    return 'PENDING_HUMAN_APPROVAL';
  }
};
