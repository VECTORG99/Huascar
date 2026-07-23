import fs from 'fs';
import { config } from '../config.js';
import { agentHooks } from '../kiro/hooks.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { RagEngine, RagSource } from './RagEngine.js';
import { Store } from './Store.js';
import { logger } from '../logger.js';
import { EngineError, ErrorCodes } from '../errors.js';
import { ConnectedMcpClient, mcpConnectionPool } from './McpConnectionPool.js';

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

      let mcpContext = '';

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

        if (this.mcpClients.length > 0) {
          mcpContext = '\n\n## Herramientas MCP disponibles:\n';
          for (const c of this.mcpClients) {
            for (const tool of c.tools) {
              mcpContext += `- ${tool.name}: ${tool.description || 'Sin descripción'}\n`;
              const schema = tool.inputSchema as { properties?: Record<string, unknown> } | undefined;
              if (schema?.properties) {
                const props = Object.keys(schema.properties).join(', ');
                mcpContext += `  Parametros: ${props}\n`;
              }
            }
          }
          mcpContext += [
            '',
            'Para usar una herramienta, responde EXACTAMENTE con este formato:',
            'USE_TOOL: <nombre_herramienta>',
            'Argumentos: {"key": "value"}',
            '',
            'Cuando la tarea este completa, responde con:',
            'FINAL: <respuesta final>',
            '',
          ].join('\n');
        }
      }

      const ragContext = await this.rag.getContext(task);
      const baseSystemPrompt = systemPrompt ?? this.activeRole.system_prompt;
      const effectiveSystemPrompt = baseSystemPrompt + (ragContext ? '\n\n' + ragContext : '') + mcpContext;

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
    const maxIterations = config.react.maxIterations;
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: task },
    ];

    for (let i = 0; i < maxIterations; i++) {
      logger.info(`\n[HuascarEngine] ReAct iteracion ${i + 1}/${maxIterations}`);

      const { text } = await generateText({
        model: openai(config.llm.modelId),
        system: systemPrompt,
        prompt: messages[messages.length - 1].content,
      });

      logger.info(`[HuascarEngine] Respuesta LLM:\n${text}`);

      const finalMatch = text.match(/FINAL:\s*(.+)/s);
      if (finalMatch) {
        logger.info(`[HuascarEngine] Respuesta final en iteracion ${i + 1}`);
        return finalMatch[1].trim();
      }

      const toolMatch = text.match(/USE_TOOL:\s*(\S+)/);
      if (!toolMatch) {
        logger.info(`[HuascarEngine] Sin herramienta ni respuesta final, retornando respuesta cruda`);
        return text;
      }

      const toolName = toolMatch[1].trim();

      // ponytail: brace-depth parser instead of regex, handles nested JSON
      let args: any = {};
      const argsLabel = 'Argumentos:';
      const argsIdx = text.indexOf(argsLabel);
      if (argsIdx !== -1) {
        const start = argsIdx + argsLabel.length;
        let depth = 0;
        let end = -1;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (ch === '{') { if (depth === 0 && end === -1) end = i; depth++; }
          else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (depth === 0 && end > start) {
          try {
            args = JSON.parse(text.slice(start, end));
          } catch {
            logger.info(`[HuascarEngine] No se pudieron parsear los argumentos JSON para "${toolName}"`);
          }
        }
      }

      logger.info(`[HuascarEngine] Llamando herramienta: "${toolName}"`);

      // Hook de seguridad: validar herramienta real
      agentHooks.before_action(toolName, args);

      let toolResult = `Error: herramienta "${toolName}" no encontrada en ningun servidor MCP`;

      for (const c of this.mcpClients) {
        const toolDef = c.tools.find(t => t.name === toolName);
        if (toolDef) {
          try {
            const timeoutMs = config.react.mcpTimeoutMs;
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`MCP tool "${toolName}" timed out after ${timeoutMs}ms`)), timeoutMs);
            });
            const callPromise = c.client.callTool({ name: toolName, arguments: args });
            const result = await Promise.race([callPromise, timeoutPromise]);
            const resultContent = result.content as { type: string; text?: string }[] | undefined;
            if (!resultContent) {
              toolResult = `Error: resultado sin contenido de "${toolName}"`;
              logger.info(`[HuascarEngine] Herramienta "${toolName}" retorno resultado sin contenido`);
              break;
            }
            toolResult = resultContent
              .filter(c => c.type === 'text')
              .map(c => c.text ?? '')
              .join('\n');
            // ponytail: truncate large tool results to avoid blowing context budget
            if (toolResult.length > config.react.toolResultMaxChars) {
              toolResult = toolResult.slice(0, config.react.toolResultMaxChars) + '\n... [truncado]';
            }
            logger.info(`[HuascarEngine] Herramienta "${toolName}" ejecutada correctamente`);
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toolResult = `Error ejecutando "${toolName}": ${errMsg}`;
            logger.error(`[HuascarEngine] Error en herramienta: ${errMsg}`);
          }
          break;
        }
      }

      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `## Resultado de ${toolName}:\n${toolResult}\n\nContinua o responde FINAL: <respuesta>.` });
    }

    logger.info(`[HuascarEngine] Maximo de iteraciones (${maxIterations}) alcanzado`);

    const { text } = await generateText({
      model: openai(config.llm.modelId),
      system: systemPrompt + '\n\nHas alcanzado el limite de iteraciones. Proporciona tu mejor respuesta final.',
      prompt: messages[messages.length - 1].content,
    });

    const finalMatch = text.match(/FINAL:\s*(.+)/s);
    return finalMatch ? finalMatch[1].trim() : text;
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
