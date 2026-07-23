import fs from 'fs';
import { config } from '../config.js';
import { agentHooks } from '../kiro/hooks.js';
import { generateText, isStepCount, jsonSchema, tool, type ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';
import { RagEngine, RagSource } from './RagEngine.js';
import { Store } from './Store.js';
import { logger } from '../logger.js';
import { EngineError, ErrorCodes } from '../errors.js';
import { ConnectedMcpClient, mcpConnectionPool } from './McpConnectionPool.js';
import type { JSONSchema7 } from 'json-schema';

interface RagConfig {
  knowledge_bases: RagSource[];
}

export interface AgentConfig {
  tools?: string[];
  knowledge?: RagSource[];
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

type AgentHooks = typeof agentHooks;

export function buildAiTools(mcpClients: ConnectedMcpClient[], hooks: AgentHooks = agentHooks): ToolSet {
  const aiTools: ToolSet = {};

  for (const c of mcpClients) {
    for (const mcpTool of c.tools) {
      const toolName = mcpTool.name;
      aiTools[toolName] = tool({
        description: mcpTool.description || 'Sin descripción',
        inputSchema: jsonSchema((mcpTool.inputSchema ?? { type: 'object', additionalProperties: true }) as JSONSchema7),
        execute: async (args: unknown) => {
          const toolArgs = args as Record<string, unknown>;
          hooks.before_action(toolName, toolArgs);

          const timeoutMs = config.react.mcpTimeoutMs;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`MCP tool "${toolName}" timed out after ${timeoutMs}ms`)), timeoutMs);
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
              .filter(c => c.type === 'text')
              .map(c => c.text ?? '')
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
  private rag: RagEngine;
  private store: Store | null;
  private roleKey: string;

  constructor(roleKey: string, store?: Store) {
    this.steering = JSON.parse(fs.readFileSync(config.paths.steering, config.rag.encoding));
    this.roleKey = roleKey;
    this.rag = new RagEngine({ maxContentChars: config.rag.maxContentChars, encoding: config.rag.encoding, store: store ?? undefined });
    this.store = store || null;
  }

  private async connectMcpServers(): Promise<void> {
    this.mcpClients = (await mcpConnectionPool.getConnections()).map(c => ({ ...c, tools: [...c.tools] }));
  }

  private async loadRagSources(): Promise<void> {
    if (!fs.existsSync(config.paths.rag)) {
      logger.info('[HuascarEngine] rag.json no encontrado, saltando RAG.');
      return;
    }
    try {
      const ragConfig: RagConfig = JSON.parse(fs.readFileSync(config.paths.rag, config.rag.encoding));
      if (!Array.isArray(ragConfig.knowledge_bases)) {
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

  async executeTask(task: string, systemPrompt?: string, agentConfig?: AgentConfig) {
    if (!this.steering.roles[this.roleKey]) {
      if (systemPrompt) {
        this.activeRole = { name: this.roleKey, system_prompt: systemPrompt, temperature: 0.3 };
      } else {
        throw new EngineError(ErrorCodes.ENGINE_ROLE_NOT_FOUND, `El rol '${this.roleKey}' no existe en steering.json`, 404);
      }
    } else {
      this.activeRole = this.steering.roles[this.roleKey];
    }
    logger.info(`\n[HuascarEngine] Iniciando LLM ReAct Loop...`);
    logger.info(`[HuascarEngine] Rol activo: ${this.activeRole.name}`);
    logger.info(`[HuascarEngine] Tarea: ${task}`);

    try {
      const useMock = config.llm.mockMode || !config.hasApiKey;

      if (!useMock) {
        await this.connectMcpServers();

        await this.loadRagSources();

        // Apply optional agent config (from questionnaire) on top of base settings
        if (agentConfig) {
          // Filter MCP tools to only those selected by user
          if (agentConfig.tools && agentConfig.tools.length > 0) {
            const selectedTools = agentConfig.tools;
            for (const c of this.mcpClients) {
              c.tools = c.tools.filter(t => selectedTools.includes(t.name));
            }
          }
          // Add knowledge sources from config
          if (agentConfig.knowledge && agentConfig.knowledge.length > 0) {
            await this.rag.loadSources(agentConfig.knowledge);
          }
        }

      }

      const ragContext = await this.rag.getContext(task);
      const baseSystemPrompt = systemPrompt ?? this.activeRole.system_prompt;
      const effectiveSystemPrompt = baseSystemPrompt + (ragContext ? '\n\n' + ragContext : '');

      const responseText = !useMock
        ? await this.runReActLoop(effectiveSystemPrompt, task)
        : this.runMockReActLoop(task);

      if (this.store) {
        try {
          this.store.saveExecution(this.activeRole.name, task, responseText);
        } catch (err) {
          logger.warn({ err }, '[HuascarEngine] Error guardando ejecucion');
        }
      }

      return { status: "success", agent_role: this.activeRole.name, response: responseText };

    } catch (error: unknown) {
      return { status: "blocked", error: error instanceof Error ? error.message : String(error) };
    } finally {
      await this.disconnectMcpServers();
    }
  }


  private async runReActLoop(systemPrompt: string, task: string): Promise<string> {
    const { text } = await generateText({
      model: openai(config.llm.modelId),
      system: systemPrompt,
      prompt: task,
      tools: buildAiTools(this.mcpClients),
      stopWhen: isStepCount(config.react.maxIterations),
    });

    logger.info(`[HuascarEngine] Respuesta LLM:\n${text}`);
    return text;
  }

  private runMockReActLoop(task: string): string {
    logger.info(`[HuascarEngine] Sin API Key - simulando ReAct Loop...`);

    const mockSteps = [
      `Paso 1: Evaluando tarea "${task}"...`,
      `  -> Se analizo la estructura del proyecto`,
      `  -> No se detectaron comandos destructivos`,
      `Paso 2: Herramientas disponibles verificadas`,
      `  -> MCP no disponible en modo simulado`,
      `Paso 3: Sintesis de resultados`,
    ];

    return [
      `[SIMULADO] ReAct completado para: "${task}"`,
      ``,
      ...mockSteps,
      ``,
      `Conclusion: La tarea fue procesada correctamente en modo simulado.`,
      `Para ejecucion real, configura OPENAI_API_KEY en el entorno.`,
    ].join('\n');
  }
}
