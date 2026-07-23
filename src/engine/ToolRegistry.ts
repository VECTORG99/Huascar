/**
 * Dynamic Tool Registry with lazy connection, health checks, hot-reload,
 * and capability discovery for MCP servers.
 */
import fs from 'fs';
import { logger } from '../logger.js';
import { config } from '../config.js';

export interface ToolCapability {
  name: string;
  description: string;
  inputSchema: unknown;
  serverName: string;
}

export interface ServerHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown' | 'idle';
  lastCheck: number;
  toolCount: number;
  lastError?: string;
}

export interface ToolFilter {
  allowed?: string[];
  blocked?: string[];
}

export class ToolRegistry {
  private capabilities = new Map<string, ToolCapability[]>();
  private serverHealth = new Map<string, ServerHealth>();
  private lastConfigMtime = 0;
  private watchInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Register tools discovered from an MCP server.
   */
  registerServer(serverName: string, tools: { name: string; description?: string; inputSchema?: unknown }[]): void {
    const caps: ToolCapability[] = tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? { type: 'object' },
      serverName,
    }));
    this.capabilities.set(serverName, caps);
    this.serverHealth.set(serverName, {
      name: serverName,
      status: 'healthy',
      lastCheck: Date.now(),
      toolCount: tools.length,
    });
    logger.info({ server: serverName, tools: tools.length }, '[ToolRegistry] Server registered');
  }

  /**
   * Remove a server and its tools from the registry.
   */
  unregisterServer(serverName: string): void {
    this.capabilities.delete(serverName);
    this.serverHealth.delete(serverName);
    logger.info({ server: serverName }, '[ToolRegistry] Server unregistered');
  }

  /**
   * Get all registered tool capabilities.
   */
  getAllTools(): ToolCapability[] {
    const allTools: ToolCapability[] = [];
    for (const tools of this.capabilities.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Get tools filtered by role-based access rules.
   */
  getToolsForRole(filter?: ToolFilter): ToolCapability[] {
    const all = this.getAllTools();
    if (!filter) return all;

    return all.filter((tool) => {
      if (filter.blocked) {
        for (const pattern of filter.blocked) {
          if (matchToolPattern(pattern, tool.name, tool.serverName)) return false;
        }
      }
      if (filter.allowed && filter.allowed.length > 0) {
        return filter.allowed.some((pattern) => matchToolPattern(pattern, tool.name, tool.serverName));
      }
      return true;
    });
  }

  /**
   * Mark a server as unhealthy.
   */
  markUnhealthy(serverName: string, error: string): void {
    const health = this.serverHealth.get(serverName);
    if (health) {
      health.status = 'unhealthy';
      health.lastError = error;
      health.lastCheck = Date.now();
    }
  }

  /**
   * Mark a server as healthy.
   */
  markHealthy(serverName: string): void {
    const health = this.serverHealth.get(serverName);
    if (health) {
      health.status = 'healthy';
      health.lastError = undefined;
      health.lastCheck = Date.now();
    }
  }

  /**
   * Get health status of all registered servers.
   */
  getHealthStatus(): ServerHealth[] {
    return [...this.serverHealth.values()];
  }

  /**
   * Check if the MCP config file has been modified and needs reload.
   */
  checkForConfigChanges(): { changed: boolean; currentMtime: number } {
    try {
      if (!fs.existsSync(config.paths.mcps)) return { changed: false, currentMtime: 0 };
      const stat = fs.statSync(config.paths.mcps);
      const mtime = stat.mtimeMs;
      const changed = mtime > this.lastConfigMtime;
      if (changed) this.lastConfigMtime = mtime;
      return { changed, currentMtime: mtime };
    } catch {
      return { changed: false, currentMtime: 0 };
    }
  }

  /**
   * Start a file watcher for hot-reload of MCP config.
   */
  startWatching(onReload: () => void, intervalMs = 5000): void {
    if (this.watchInterval) return;
    this.watchInterval = setInterval(() => {
      const { changed } = this.checkForConfigChanges();
      if (changed) {
        logger.info('[ToolRegistry] Config change detected, triggering reload');
        onReload();
      }
    }, intervalMs);
  }

  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  get stats() {
    return {
      servers: this.capabilities.size,
      totalTools: this.getAllTools().length,
      healthyServers: [...this.serverHealth.values()].filter((h) => h.status === 'healthy').length,
    };
  }
}

function matchToolPattern(pattern: string, toolName: string, serverName: string): boolean {
  // Pattern formats:
  // "server.*" — all tools from a server
  // "toolName" — exact tool name match
  // "server.toolName" — specific tool from specific server
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return serverName === prefix;
  }
  if (pattern.includes('.')) {
    const [server, tool] = pattern.split('.', 2);
    return serverName === server && toolName === tool;
  }
  return toolName === pattern;
}

/** Shared singleton */
export const toolRegistry = new ToolRegistry();
