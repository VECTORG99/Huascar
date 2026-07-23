/**
 * Prompt template system with variable interpolation, conditionals, partials,
 * versioning, and A/B testing support.
 *
 * Syntax:
 *   {{variable}}          — interpolate variable
 *   {{#if var}}...{{/if}} — conditional block
 *   {{> partial_name}}    — include partial
 */
import { logger } from '../logger.js';

export interface PromptVariables {
  [key: string]: string | boolean | number | undefined;
}

export interface PromptVersion {
  id: string;
  template: string;
  weight?: number;
}

export interface PromptRoleConfig {
  versions: PromptVersion[];
  activeVersion?: string;
  abTest?: Record<string, number>;
}

export interface TemplateRenderResult {
  text: string;
  versionUsed: string;
  variables: Record<string, string>;
}

const BUILT_IN_VARS: Record<string, () => string> = {
  date: () => new Date().toISOString().slice(0, 10),
  timestamp: () => new Date().toISOString(),
  year: () => String(new Date().getFullYear()),
};

export class PromptTemplate {
  private partials = new Map<string, string>();

  registerPartial(name: string, content: string): void {
    this.partials.set(name, content);
  }

  removePartial(name: string): boolean {
    return this.partials.delete(name);
  }

  getPartials(): string[] {
    return [...this.partials.keys()];
  }

  /**
   * Render a template string with variables and conditionals.
   */
  render(template: string, variables: PromptVariables = {}): string {
    let result = template;

    // Resolve partials (max 3 depth to avoid infinite recursion)
    for (let depth = 0; depth < 3; depth++) {
      const before = result;
      result = result.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_match, name: string) => {
        const partial = this.partials.get(name);
        if (partial === undefined) {
          logger.warn({ partial: name }, '[PromptTemplate] Partial not found');
          return '';
        }
        return partial;
      });
      if (result === before) break;
    }

    // Process conditionals: {{#if var}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, varName: string, content: string) => {
        const val = variables[varName] ?? BUILT_IN_VARS[varName]?.();
        const truthy = val !== undefined && val !== false && val !== '' && val !== 0;
        return truthy ? content : '';
      },
    );

    // Interpolate variables: {{variable}}
    result = result.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, varName: string) => {
      if (variables[varName] !== undefined) return String(variables[varName]);
      const builtin = BUILT_IN_VARS[varName];
      if (builtin) return builtin();
      return '';
    });

    return result.trim();
  }

  /**
   * Select a prompt version based on A/B test weights or active version.
   */
  selectVersion(roleConfig: PromptRoleConfig): PromptVersion {
    const { versions, activeVersion, abTest } = roleConfig;
    if (versions.length === 0) {
      throw new Error('PromptRoleConfig must have at least one version');
    }

    // If A/B test is configured, use weighted random selection
    if (abTest && Object.keys(abTest).length > 0) {
      const rand = Math.random();
      let cumulative = 0;
      for (const [versionId, weight] of Object.entries(abTest)) {
        cumulative += weight;
        if (rand <= cumulative) {
          const found = versions.find((v) => v.id === versionId);
          if (found) return found;
        }
      }
    }

    // Use active version
    if (activeVersion) {
      const found = versions.find((v) => v.id === activeVersion);
      if (found) return found;
    }

    // Fall back to first version
    return versions[0]!;
  }

  /**
   * Full render pipeline: select version + render template.
   */
  renderRole(roleConfig: PromptRoleConfig, variables: PromptVariables = {}): TemplateRenderResult {
    const version = this.selectVersion(roleConfig);
    const text = this.render(version.template, variables);
    const usedVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(variables)) {
      if (v !== undefined) usedVars[k] = String(v);
    }
    return { text, versionUsed: version.id, variables: usedVars };
  }
}

/** Shared singleton instance */
export const promptTemplate = new PromptTemplate();
