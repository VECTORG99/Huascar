import fs from 'fs';
import { config } from '../config.js';
import { agentHooks } from '../kiro/hooks.js';
import { isStepCount, jsonSchema, tool, type ToolSet } from 'ai';
import { RagEngine, RagSource } from './RagEngine.js';
import { Store } from './Store.js';
import { logger } from '../logger.js';
import { EngineError, ErrorCodes } from '../errors.js';
import { ConnectedMcpClient, mcpConnectionPool } from './McpConnectionPool.js';
import type { JSONSchema7 } from 'json-schema';
import { generateTextWithFallback } from './LlmProvider.js';
import { runMockScenario } from './MockProvider.js';
import { ConfigCache } from './ConfigCache.js';

interface RagConfig {
  knowledge_bases: RagSource[];
}

export interface AgentConfig {
  tools?: string[];
  knowledge?: RagSource[];
  steering?: unknown;
  security?: {
    block_destructive_commands?: boolean;
    require_commit_approval?: boolean;
  };
}

interface SteeringRole {
  name: string;
  system_prompt: string;
  temperature: number;
}

interface SteeringConfig {
  roles: Record<string, SteeringRole>;
}

function registeredSteeringRole(steering: unknown, roleKey: string): SteeringRole | null {
  if (!steering || typeof steering !== 'object') return null;
  const roles = (steering as { roles?: unknown }).roles;
  const role = Array.isArray(roles)
    ? roles.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).id === roleKey)
    : roles && typeof roles === 'object'
      ? (roles as Record<string, unknown>)[roleKey]
      : null;
  if (!role || typeof role !== 'object') return null;
  const r = role as Record<string, unknown>;
  const system_prompt = r.prompt ?? r.system_prompt;
  if (typeof system_prompt !== 'string') return null;
  return {
    name: typeof r.name === 'string' ? r.name : roleKey,
    system_prompt,
    temperature: typeof r.temperature === 'number' ? r.temperature : 0.3,
  };
}

type AgentHooks = typeof agentHooks;

export interface HuascarEngineDeps {
  store?: Store;
  readFile?: (path: string, encoding: BufferEncoding) => string;
  exists?: (path: string) => boolean;
  rag?: RagEngine;
  mcpPool?: { getConnections(): Promise<ConnectedMcpClient[]>; closeAll?(): Promise<void> };
  generateTextWithFallback?: typeof generateTextWithFallback;
}

export function buildAiTools(
  mcpClients: ConnectedMcpClient[],
  hooks: AgentHooks = agentHooks,
  onToolExecution?: (toolName: string) => void,
): ToolSet {
  const aiTools: ToolSet = {};

  for (const c of mcpClients) {
    for (const mcpTool of c.tools) {
      const toolName = mcpTool.name;
      aiTools[toolName] = tool({
        description: mcpTool.description || 'Sin descripción',
        inputSchema: jsonSchema((mcpTool.inputSchema ?? { type: 'object', additionalProperties: true }) as JSONSchema7),
        execute: async (args: unknown) => {
          const toolArgs = args as Record<string, unknown>;
          onToolExecution?.(toolName);
          hooks.before_action(toolName, toolArgs);

          const timeoutMs = config.react.mcpTimeoutMs;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`MCP tool "${toolName}" timed out after ${timeoutMs}ms`)),
              timeoutMs,
            );
          });

          try {
            const result = await Promise.race([
              c.client.callTool({ name: toolName, arguments: toolArgs }),
              timeoutPromise,
            ]);
            const resultContent = result.content as { type: string; text?: string }[] | undefined;
            if (!resultContent) {
              logger.info(`[HuascarEngine] Herramienta "${toolName}" retorno resultado sin contenido`);
              return `Error: resultado sin contenido de "${toolName}"`;
            }
            let toolResult = resultContent
              .filter((c) => c.type === 'text')
              .map((c) => c.text ?? '')
              .join('\n');
            if (toolResult.length > config.react.toolResultMaxChars) {
              toolResult = toolResult.slice(0, config.react.toolResultMaxChars) + '\n... [truncado]';
            }
            logger.info(`[HuascarEngine] Herramienta "${toolName}" ejecutada correctamente`);
            return toolResult;
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error(`[HuascarEngine] Error en herramienta: ${errMsg}`);
            return `Error ejecutando "${toolName}": ${errMsg}`;
          } finally {
            if (timer) clearTimeout(timer);
          }
        },
      });
    }
  }

  return aiTools;
}

export class HuascarEngine {
  private steering: SteeringConfig;
  public activeRole!: SteeringRole;
  private mcpClients: ConnectedMcpClient[] = [];
  // Set by agentConfig.security.require_commit_approval; exposed via getter
  // for callers that gate commit/apply steps on this flag (see routes/hooks.ts).
  private requireCommitApproval = false;

  get commitApprovalRequired(): boolean {
    return this.requireCommitApproval;
  }
  private rag: RagEngine;
  private store: Store | null;
  private roleKey: string;
  private deps: Required<Pick<HuascarEngineDeps, 'readFile' | 'exists' | 'mcpPool' | 'generateTextWithFallback'>>;
  private hasCustomReadFile: boolean;

  constructor(roleKey: string, store?: Store);
  constructor(roleKey: string, deps?: HuascarEngineDeps);
  constructor(roleKey: string, storeOrDeps?: Store | HuascarEngineDeps) {
    const deps = storeOrDeps instanceof Store ? { store: storeOrDeps } : (storeOrDeps ?? {});
    this.hasCustomReadFile = !!deps.readFile;
    this.deps = {
      readFile: deps.readFile ?? ((path, encoding) => fs.readFileSync(path, encoding)),
      exists: deps.exists ?? fs.existsSync,
      mcpPool: deps.mcpPool ?? mcpConnectionPool,
      generateTextWithFallback: deps.generateTextWithFallback ?? generateTextWithFallback,
    };
    this.steering = ConfigCache.getInstance().getSteering(
      this.hasCustomReadFile ? this.deps.readFile : undefined,
    ) as SteeringConfig;
    this.roleKey = roleKey;
    this.rag =
      deps.rag ??
      new RagEngine({ maxContentChars: config.rag.maxContentChars, encoding: config.rag.encoding, store: deps.store });
    this.store = deps.store || null;
  }

  private async connectMcpServers(): Promise<void> {
    this.mcpClients = (await this.deps.mcpPool.getConnections()).map((c) => ({ ...c, tools: [...c.tools] }));
  }

  private async loadRagSources(): Promise<void> {
    if (!this.deps.exists(config.paths.rag)) {
      logger.info('[HuascarEngine] rag.json no encontrado, saltando RAG.');
      return;
    }
    try {
      const ragConfig = ConfigCache.getInstance().getRag(
        this.hasCustomReadFile ? this.deps.readFile : undefined,
        this.deps.exists,
      ) as RagConfig | null;
      if (!ragConfig || !Array.isArray(ragConfig.knowledge_bases)) {
        logger.warn('[HuascarEngine] knowledge_bases no es un array, saltando RAG.');
        return;
      }
      await this.rag.loadSources(ragConfig.knowledge_bases);
      logger.info(`[HuascarEngine] RAG cargado: ${ragConfig.knowledge_bases.length} fuentes`);
    } catch (err: unknown) {
      logger.warn(`[HuascarEngine] Error cargando RAG: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async disconnectMcpServers(): Promise<void> {
    this.mcpClients = [];
  }

  async cancelAll(): Promise<void> {
    logger.warn('[HuascarEngine] Cancelling all MCP connections...');
    await this.disconnectMcpServers();
  }

  async executeTask(
    task: string,
    systemPrompt?: string,
    agentConfig?: AgentConfig,
    sessionContext = '',
    mockScenario?: string,
    signal?: AbortSignal,
  ) {
    const registeredRole = registeredSteeringRole(agentConfig?.steering, this.roleKey);
    const steeringRole = this.steering.roles[this.roleKey];
    if (registeredRole) {
      this.activeRole = registeredRole;
    } else if (!steeringRole) {
      if (systemPrompt) {
        this.activeRole = { name: this.roleKey, system_prompt: systemPrompt, temperature: 0.3 };
      } else {
        throw new EngineError(
          ErrorCodes.ENGINE_ROLE_NOT_FOUND,
          `El rol '${this.roleKey}' no existe en steering.json`,
          404,
        );
      }
    } else {
      this.activeRole = steeringRole;
    }
    logger.info(`\n[HuascarEngine] Iniciando LLM ReAct Loop...`);
    logger.info(`[HuascarEngine] Rol activo: ${this.activeRole.name}`);
    logger.info(`[HuascarEngine] Tarea: ${task}`);

    try {
      const useMock = config.llm.mockMode || !config.hasLlmProvider;

      if (!useMock) {
        await this.connectMcpServers();

        await this.loadRagSources();

        // Apply optional agent config (from questionnaire) on top of base settings
        if (agentConfig) {
          // Tool selection enforcement (fail-closed):
          // - tools: undefined → use all available tools (default)
          // - tools: [] → disable ALL tools (explicit zero-tools mode)
          // - tools: ['a','b'] → only those tools available
          if (agentConfig.tools !== undefined) {
            const selectedTools = new Set(agentConfig.tools);
            for (const c of this.mcpClients) {
              c.tools = c.tools.filter((t) => selectedTools.has(t.name));
            }
            // Warn about unknown tool names requested by client
            const allAvailable = new Set(this.mcpClients.flatMap((c) => c.tools.map((t) => t.name)));
            for (const requested of agentConfig.tools) {
              if (!allAvailable.has(requested)) {
                logger.warn(`[HuascarEngine] Requested tool "${requested}" not found in any MCP server — ignored`);
              }
            }
            logger.info(
              `[HuascarEngine] Tool enforcement: ${selectedTools.size} selected, ${this.mcpClients.reduce((n, c) => n + c.tools.length, 0)} available after filter`,
            );
          }
          // Add knowledge sources from config
          // Security: only allow 'inline' sources from client requests.
          // local_file, local_directory, and web_url are restricted to server-side config
          // (rag.json) or registered agent configs to prevent path traversal and SSRF.
          if (agentConfig.knowledge && agentConfig.knowledge.length > 0) {
            const safeSources = agentConfig.knowledge.filter(source => {
              if (source.type === 'inline') return true;
              logger.warn(`[HuascarEngine] Blocked client-supplied RAG source type="${source.type}" — only inline allowed`);
              return false;
            });
            if (safeSources.length > 0) {
              await this.rag.loadSources(safeSources);
            }
          }

          // Apply security controls from agent config
          if (agentConfig.security) {
            if (agentConfig.security.block_destructive_commands) {
              logger.info('[HuascarEngine] Security: destructive command blocking enforced by client request');
            }
            if (agentConfig.security.require_commit_approval) {
              this.requireCommitApproval = true;
              logger.info('[HuascarEngine] Security: commit approval required for this execution');
            }
          }
        }
      }

      const effectiveTask = sessionContext ? `${sessionContext}\n\nTarea actual:\n${task}` : task;
      const ragContext = await this.rag.getContext(effectiveTask);
      const baseSystemPrompt = systemPrompt ?? this.activeRole.system_prompt;
      const effectiveSystemPrompt = baseSystemPrompt + (ragContext ? '\n\n' + ragContext : '');

      const responseText = !useMock
        ? await this.runReActLoop(effectiveSystemPrompt, effectiveTask, signal)
        : await this.runMockReActLoop(effectiveTask, mockScenario);

      if (this.store) {
        try {
          this.store.saveExecution(this.activeRole.name, task, responseText);
        } catch (err) {
          logger.warn({ err }, '[HuascarEngine] Error guardando ejecucion');
        }
      }

      return { status: 'success', agent_role: this.activeRole.name, response: responseText };
    } catch (error: unknown) {
      return { status: 'blocked', error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.disconnectMcpServers();
    }
  }

  private async runReActLoop(systemPrompt: string, task: string, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Error(`Execution cancelled: ${signal.reason || 'aborted'}`);
    let toolExecuted = false;
    const { text } = await this.deps.generateTextWithFallback(
      {
        system: systemPrompt,
        prompt: task,
        tools: buildAiTools(this.mcpClients, agentHooks, () => {
          toolExecuted = true;
        }),
        stopWhen: isStepCount(config.react.maxIterations),
      },
      undefined,
      undefined,
      () => !toolExecuted,
    );

    if (signal?.aborted) throw new Error(`Execution cancelled: ${signal.reason || 'aborted'}`);
    logger.info(`[HuascarEngine] Respuesta LLM:\n${text}`);
    return text;
  }

  private runMockReActLoop(task: string, scenario?: string): Promise<string> {
    logger.info(`[HuascarEngine] Sin API Key - simulando ReAct Loop...`);
    return runMockScenario({ task, scenario, readFile: this.deps.readFile });
  }
}
