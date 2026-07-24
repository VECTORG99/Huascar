import crypto from 'crypto';
import { AuditLog } from './AuditLog.js';

export interface PolicyRule {
  id: string;
  roles?: string[]; // If empty/undefined, applies to all roles
  action: 'allow' | 'deny';
  match: {
    tool_pattern?: string; // glob-like: "bash*", "execute_*"
    args_contains?: string; // substring in serialized args
  };
  reason?: string;
}

export interface PolicyConfig {
  default_policy: 'allow' | 'deny';
  rules: PolicyRule[];
}

export interface PolicyDecision {
  decision: 'allow' | 'deny';
  rule_id: string | null;
  reason: string | null;
}

export class PolicyEngine {
  private config: PolicyConfig;
  private auditLog: AuditLog | null;

  constructor(config: PolicyConfig, auditLog?: AuditLog) {
    this.config = config;
    this.auditLog = auditLog || null;
  }

  evaluate(role: string, toolName: string, args: Record<string, unknown>, requestId?: string): PolicyDecision {
    const argsHash = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex').slice(0, 16);

    // Check rules in order (first match wins)
    for (const rule of this.config.rules) {
      // Skip if rule doesn't apply to this role
      if (rule.roles && rule.roles.length > 0 && !rule.roles.includes(role)) {
        continue;
      }

      let toolMatches = !rule.match.tool_pattern; // true if no pattern (vacuous)
      let argsMatches = !rule.match.args_contains; // true if no args pattern (vacuous)

      // Tool pattern matching (simple glob: * at end)
      if (rule.match.tool_pattern) {
        const pattern = rule.match.tool_pattern;
        if (pattern.endsWith('*')) {
          toolMatches = toolName.startsWith(pattern.slice(0, -1));
        } else {
          toolMatches = toolName === pattern;
        }
      }

      // Args content matching
      if (rule.match.args_contains) {
        const serialized = JSON.stringify(args).toLowerCase();
        argsMatches = serialized.includes(rule.match.args_contains.toLowerCase());
      }

      // Both conditions must match (AND logic) when both are specified
      const matches = toolMatches && argsMatches;

      if (matches) {
        const decision: PolicyDecision = {
          decision: rule.action,
          rule_id: rule.id,
          reason: rule.reason || null,
        };

        // Audit log
        if (this.auditLog) {
          this.auditLog.log({
            request_id: requestId || 'unknown',
            role,
            tool: toolName,
            args_hash: argsHash,
            decision: rule.action,
            rule_id: rule.id,
            reason: rule.reason || null,
          });
        }

        return decision;
      }
    }

    // Default policy (no rule matched)
    const decision: PolicyDecision = {
      decision: this.config.default_policy,
      rule_id: null,
      reason: this.config.default_policy === 'deny' ? 'No matching allow rule (default deny)' : null,
    };

    if (this.auditLog) {
      this.auditLog.log({
        request_id: requestId || 'unknown',
        role,
        tool: toolName,
        args_hash: argsHash,
        decision: this.config.default_policy,
        rule_id: null,
        reason: decision.reason,
      });
    }

    return decision;
  }
}
