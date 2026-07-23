import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { config } from '../config.js';
import { ErrorCodes, McpError } from '../errors.js';
import { logger } from '../logger.js';

export interface ConnectedMcpClient {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: { name: string; description?: string; inputSchema?: unknown }[];
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

export class McpConnectionPool {
  private mcpConfig: McpServersConfig | null = null;
  private connections = new Map<string, ConnectedMcpClient>();
  private loading: Promise<ConnectedMcpClient[]> | null = null;

  constructor(private readonly connectMcpServer: ConnectMcpServer = defaultConnectMcpServer) {}

  async getConnections(): Promise<ConnectedMcpClient[]> {
    if (this.loading) return this.loading;
    this.loading = this.loadConnections();
    try {
      return await this.loading;
    } finally {
      this.loading = null;
    }
  }

  async closeAll(): Promise<void> {
    const connections = [...this.connections.values()];
    this.connections.clear();
    await Promise.all(connections.map(async c => {
      try {
        await c.client.close();
        await c.transport.close();
      } catch (err: unknown) {
        logger.error(`[McpConnectionPool] Error cerrando MCP "${c.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }));
  }

  private async loadConnections(): Promise<ConnectedMcpClient[]> {
    const mcpConfig = this.getConfig();
    if (!mcpConfig) return [];

    for (const [name, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      if (this.connections.has(name)) continue;
      try {
        const connection = await this.connectMcpServer(name, serverConfig);
        this.connections.set(name, connection);
      } catch (err: unknown) {
        logger.error(`[McpConnectionPool] Error conectando MCP "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return [...this.connections.values()];
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
    const tools = (toolsResult.tools || []).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    logger.info(`[McpConnectionPool] MCP "${name}" conectado (${tools.length} herramientas)`);
    return { name, client, transport, tools };
  } catch (err) {
    try { if (transport) await transport.close(); } catch { /* ignore */ }
    try { if (client) await client.close(); } catch { /* ignore */ }
    throw err;
  }
}

function resolveEnv(env?: Record<string, string>): Record<string, string> | undefined {
  if (!env) return undefined;
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] || '');
  }
  return resolved;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new McpError(ErrorCodes.MCP_TOOL_TIMEOUT, `MCP ${label} timeout after ${ms}ms`, 504)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const mcpConnectionPool = new McpConnectionPool();
