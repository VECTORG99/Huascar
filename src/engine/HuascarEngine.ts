import fs from 'fs';
import { config } from '../config.js';
import { agentHooks } from '../kiro/hooks.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { RagEngine, RagSource } from './RagEngine.js';
import { Store } from './Store.js';

interface RagConfig {
  knowledge_bases: RagSource[];
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

interface ConnectedMcpClient {
  name: string;
  client: Client;
  transport: StdioClientTransport;
  tools: { name: string; description?: string; inputSchema?: any }[];
}

export interface AgentConfig {
  tools?: string[];
  knowledge?: RagSource[];
  security?: {
    block_destructive_commands?: boolean;
    require_commit_approval?: boolean;
  };
}

export class HuascarEngine {
  private steering: any;
  public activeRole: any;
  private mcpClients: ConnectedMcpClient[] = [];
  private rag: RagEngine;
  private store: Store | null;
  private roleKey: string;

  constructor(roleKey: string, store?: Store) {
    this.steering = JSON.parse(fs.readFileSync(config.paths.steering, config.rag.encoding));
    this.roleKey = roleKey;
    this.rag = new RagEngine({ maxContentChars: config.rag.maxContentChars, encoding: config.rag.encoding });
    this.store = store || null;
  }

  private resolveEnv(env?: Record<string, string>): Record<string, string> | undefined {
    if (!env) return undefined;
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name: string) => process.env[name] || '');
    }
    return resolved;
  }

  private async connectMcpServers(): Promise<void> {
    if (!fs.existsSync(config.paths.mcps)) {
      console.log('[HuascarEngine] mcps.json no encontrado, saltando MCP.');
      return;
    }

    const mcpConfig: McpServersConfig = JSON.parse(fs.readFileSync(config.paths.mcps, config.rag.encoding));

    for (const [name, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      try {
        console.log(`[HuascarEngine] Iniciando MCP server: "${name}" (${serverConfig.command})`);

        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: this.resolveEnv(serverConfig.env),
          stderr: config.mcp.stderr,
        });

        const client = new Client(
          { name: 'huascar-engine', version: '1.0.0' },
          { capabilities: {} },
        );

        await client.connect(transport);

        const toolsResult = await client.listTools();
        const tools = (toolsResult.tools || []).map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));

        console.log(`[HuascarEngine] MCP "${name}" conectado (${tools.length} herramientas)`);

        this.mcpClients.push({ name, client, transport, tools });
      } catch (err: unknown) {
        console.error(`[HuascarEngine] Error conectando MCP "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async loadRagSources(): Promise<void> {
    if (!fs.existsSync(config.paths.rag)) {
      console.log('[HuascarEngine] rag.json no encontrado, saltando RAG.');
      return;
    }
    try {
      const ragConfig: RagConfig = JSON.parse(fs.readFileSync(config.paths.rag, config.rag.encoding));
      if (!Array.isArray(ragConfig.knowledge_bases)) {
        console.warn('[HuascarEngine] knowledge_bases no es un array, saltando RAG.');
        return;
      }
      await this.rag.loadSources(ragConfig.knowledge_bases);
      console.log(`[HuascarEngine] RAG cargado: ${ragConfig.knowledge_bases.length} fuentes`);
    } catch (err: unknown) {
      console.warn(`[HuascarEngine] Error cargando RAG: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async disconnectMcpServers(): Promise<void> {
    for (const c of this.mcpClients) {
      try {
        await c.client.close();
      } catch (err: unknown) {
        console.error(`[HuascarEngine] Error cerrando MCP "${c.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.mcpClients = [];
  }

  async executeTask(task: string, systemPrompt?: string, agentConfig?: AgentConfig) {
    if (!this.steering.roles[this.roleKey]) {
      if (systemPrompt) {
        this.activeRole = { name: this.roleKey, system_prompt: systemPrompt, temperature: 0.3 };
      } else {
        throw new Error(`El rol '${this.roleKey}' no existe en steering.json`);
      }
    } else {
      this.activeRole = this.steering.roles[this.roleKey];
    }
    console.log(`\n[HuascarEngine] Iniciando LLM ReAct Loop...`);
    console.log(`[HuascarEngine] Rol activo: ${this.activeRole.name}`);
    console.log(`[HuascarEngine] Tarea: ${task}`);

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
            for (const c of this.mcpClients) {
              c.tools = c.tools.filter(t => agentConfig.tools!.includes(t.name));
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
              if (tool.inputSchema?.properties) {
                const props = Object.keys(tool.inputSchema.properties).join(', ');
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

      const ragContext = this.rag.getContext();
      const systemPrompt = this.activeRole.system_prompt + (ragContext ? '\n\n' + ragContext : '') + mcpContext;

      const responseText = !useMock
        ? await this.runReActLoop(systemPrompt, task)
        : this.runMockReActLoop(task);

      if (this.store) {
        try {
          this.store.saveExecution(this.activeRole.name, task, responseText);
        } catch (err) {
          console.warn('[HuascarEngine] Error guardando ejecucion:', err);
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
    let context = systemPrompt;
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: task },
    ];

    for (let i = 0; i < maxIterations; i++) {
      console.log(`\n[HuascarEngine] ReAct iteracion ${i + 1}/${maxIterations}`);

      const { text } = await generateText({
        model: openai(config.llm.modelId),
        system: context,
        prompt: messages[messages.length - 1].content,
      });

      console.log(`[HuascarEngine] Respuesta LLM:\n${text}`);

      const finalMatch = text.match(/FINAL:\s*(.+)/s);
      if (finalMatch) {
        console.log(`[HuascarEngine] Respuesta final en iteracion ${i + 1}`);
        return finalMatch[1].trim();
      }

      const toolMatch = text.match(/USE_TOOL:\s*(\S+)/);
      if (!toolMatch) {
        console.log(`[HuascarEngine] Sin herramienta ni respuesta final, retornando respuesta cruda`);
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
            console.log(`[HuascarEngine] No se pudieron parsear los argumentos JSON para "${toolName}"`);
          }
        }
      }

      console.log(`[HuascarEngine] Llamando herramienta: "${toolName}"`);

      // Hook de seguridad: validar herramienta real
      agentHooks.before_action(toolName, args);

      let toolResult = `Error: herramienta "${toolName}" no encontrada en ningun servidor MCP`;

      for (const c of this.mcpClients) {
        const toolDef = c.tools.find(t => t.name === toolName);
        if (toolDef) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), config.react.mcpTimeoutMs);
            const result = await c.client.callTool({ name: toolName, arguments: args });
            clearTimeout(timeout);
            const content = (result as any).content || [];
            toolResult = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
            // ponytail: truncate large tool results to avoid blowing context budget
            if (toolResult.length > config.react.toolResultMaxChars) {
              toolResult = toolResult.slice(0, config.react.toolResultMaxChars) + '\n... [truncado]';
            }
            console.log(`[HuascarEngine] Herramienta "${toolName}" ejecutada correctamente`);
          } catch (err: unknown) {
            toolResult = `Error ejecutando "${toolName}": ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[HuascarEngine] Error en herramienta: ${err instanceof Error ? err.message : String(err)}`);
          }
          break;
        }
      }

      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `## Resultado de ${toolName}:\n${toolResult}\n\nContinua o responde FINAL: <respuesta>.` });
    }

    console.log(`[HuascarEngine] Maximo de iteraciones (${maxIterations}) alcanzado`);

    const { text } = await generateText({
      model: openai(config.llm.modelId),
      system: context + '\n\nHas alcanzado el limite de iteraciones. Proporciona tu mejor respuesta final.',
      prompt: messages[messages.length - 1].content,
    });

    const finalMatch = text.match(/FINAL:\s*(.+)/s);
    return finalMatch ? finalMatch[1].trim() : text;
  }

  private runMockReActLoop(task: string): string {
    console.log(`[HuascarEngine] Sin API Key - simulando ReAct Loop...`);

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
