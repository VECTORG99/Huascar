import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config.js';
import { ErrorCodes, McpError } from '../errors.js';
import { logger } from '../logger.js';

export interface ConnectedMcpClient {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: { name: string; description?: string; inputSchema?: unknown }[];
}

export interface McpServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  lastError?: string;
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
}

interface McpServersConfig {
  mcpServers: Record<string, McpServerConfig>;
}

type ConnectMcpServer = (name: string, serverConfig: McpServerConfig) => Promise<ConnectedMcpClient>;

const MAX_CONNECT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;

export class McpConnectionPool {
  private mcpConfig: McpServersConfig | null = null;
  private connections = new Map<string, ConnectedMcpClient>();
  private loading: Promise<ConnectedMcpClient[]> | null = null;
  private serverErrors = new Map<string, string>();
  private lastUsed = new Map<string, number>();
  private idleTimer: ReturnType<typeof setInterval> | undefined;
  private static IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min idle → close

  constructor(private readonly connectMcpServer: ConnectMcpServer = defaultConnectMcpServer) {
    // Periodically check for idle connections
    this.idleTimer = setInterval(() => this.closeIdleConnections(), 60_000);
    this.idleTimer.unref(); // Don't prevent process exit
  }

  private async closeIdleConnections(): Promise<void> {
    const now = Date.now();
    for (const [name, client] of this.connections) {
      const lastUse = this.lastUsed.get(name) ?? 0;
      if (now - lastUse > McpConnectionPool.IDLE_TIMEOUT_MS) {
        try {
          await client.client.close();
          await client.transport.close();
        } catch { /* ignore */ }
        this.connections.delete(name);
        this.lastUsed.delete(name);
        logger.info({ name }, '[McpConnectionPool] Closed idle connection');
      }
    }
  }

  async getConnections(): Promise<ConnectedMcpClient[]> {
    if (this.loading) return this.loading;
    this.loading = this.loadConnections();
    try {
      const result = await this.loading;
      // Track usage for idle timeout
      const now = Date.now();
      for (const c of result) this.lastUsed.set(c.name, now);
      return result;
    } finally {
      this.loading = null;
    }
  }

  /** Returns health status of all configured MCP servers. */
  getStatus(): McpServerStatus[] {
    const mcpConfig = this.getConfig();
    if (!mcpConfig) return [];
    return Object.keys(mcpConfig.mcpServers).map((name) => {
      const conn = this.connections.get(name);
      const lastError = this.serverErrors.get(name);
      if (conn) {
        return { name, status: 'connected' as const, toolCount: conn.tools.length };
      }
      return { name, status: lastError ? ('error' as const) : ('disconnected' as const), toolCount: 0, lastError };
    });
  }

  async closeAll(): Promise<void> {
    const connections = [...this.connections.values()];
    this.connections.clear();
    await Promise.all(
      connections.map(async (c) => {
        try {
          await c.client.close();
          await c.transport.close();
        } catch (err: unknown) {
          logger.error(
            `[McpConnectionPool] Error cerrando MCP "${c.name}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }

  private async loadConnections(): Promise<ConnectedMcpClient[]> {
    const mcpConfig = this.getConfig();
    if (!mcpConfig) return [];

    for (const [name, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      if (this.connections.has(name)) continue;
      const connection = await this.connectWithRetry(name, serverConfig);
      if (connection) {
        this.connections.set(name, connection);
        this.serverErrors.delete(name);
      }
    }

    return [...this.connections.values()];
  }

  private async connectWithRetry(name: string, serverConfig: McpServerConfig): Promise<ConnectedMcpClient | null> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_CONNECT_RETRIES; attempt++) {
      try {
        const connection = await this.connectMcpServer(name, serverConfig);
        if (attempt > 0) {
          logger.info(`[McpConnectionPool] MCP "${name}" connected on retry ${attempt}`);
        }
        return connection;
      } catch (err: unknown) {
        lastErr = err;
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          `[McpConnectionPool] MCP "${name}" connect attempt ${attempt + 1}/${MAX_CONNECT_RETRIES} failed, retrying in ${delay}ms`,
        );
        if (attempt < MAX_CONNECT_RETRIES - 1) {
          await sleep(delay);
        }
      }
    }
    const errMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    logger.error(`[McpConnectionPool] MCP "${name}" failed after ${MAX_CONNECT_RETRIES} attempts: ${errMsg}`);
    this.serverErrors.set(name, errMsg);
    return null;
  }

  private getConfig(): McpServersConfig | null {
    if (this.mcpConfig) return this.mcpConfig;
    if (!fs.existsSync(config.paths.mcps)) {
      logger.info('[McpConnectionPool] mcps.json no encontrado, saltando MCP.');
      this.mcpConfig = { mcpServers: {} };
      return this.mcpConfig;
    }
    this.mcpConfig = JSON.parse(fs.readFileSync(config.paths.mcps, config.rag.encoding));
    return this.mcpConfig;
  }

  /** Invalidate cached config — next getConnections() will reload from disk */
  invalidateConfig(): void {
    this.mcpConfig = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultConnectMcpServer(name: string, serverConfig: McpServerConfig): Promise<ConnectedMcpClient> {
  let transport: StdioClientTransport | undefined;
  let client: Client | undefined;
  try {
    logger.info(`[McpConnectionPool] Iniciando MCP server: "${name}" (${serverConfig.command})`);
    transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args || [],
      env: resolveEnv(serverConfig.env),
      stderr: config.mcp.stderr,
    });
    client = new Client({ name: 'huascar-engine', version: '1.0.0' }, { capabilities: {} });

    await withTimeout(client.connect(transport), config.react.mcpTimeoutMs, 'connect');
    const toolsResult = await withTimeout(client.listTools(), config.react.mcpTimeoutMs, 'listTools');
    const tools = (toolsResult.tools || []).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    logger.info(`[McpConnectionPool] MCP "${name}" conectado (${tools.length} herramientas)`);
    return { name, client, transport, tools };
  } catch (err) {
    try {
      if (transport) await transport.close();
    } catch {
      /* ignore */
    }
    try {
      if (client) await client.close();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

// Allowlist of env vars that can be interpolated into MCP process environments.
// Prevents exfiltration of secrets like OPENAI_API_KEY, JWT_SECRET, AWS_* etc.
const ALLOWED_MCP_ENV_VARS = new Set([
  'GITHUB_TOKEN',
  'GITHUB_PERSONAL_ACCESS_TOKEN',
  'MCP_SERVER_PORT',
  'NODE_ENV',
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'TERM',
  // Config-driven: extend via MCP_ALLOWED_ENV_VARS=VAR1,VAR2
  ...(process.env.MCP_ALLOWED_ENV_VARS?.split(',')
    .map((v) => v.trim())
    .filter(Boolean) || []),
]);

function resolveEnv(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env) return undefined;
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
      if (!ALLOWED_MCP_ENV_VARS.has(name)) {
        logger.warn({ var: name }, '[SECURITY] Blocked env var interpolation in MCP config');
        return '';
      }
      return process.env[name] || '';
    });
  }
  return resolved;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new McpError(ErrorCodes.MCP_TOOL_TIMEOUT, `MCP ${label} timeout after ${ms}ms`, 504)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const mcpConnectionPool = new McpConnectionPool();
