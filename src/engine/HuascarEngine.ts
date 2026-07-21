import fs from 'fs';
import path from 'path';
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

const TOOL_RESULT_MAX = 8192;
const MCP_TIMEOUT_MS = 30000;

export class HuascarEngine {
  private steering: any;
  public activeRole: any;
  private mcpClients: ConnectedMcpClient[] = [];
  private rag: RagEngine;
  private store: Store | null;

  constructor(roleKey: string, store?: Store) {
    const steeringPath = path.resolve('./src/kiro/steering.json');
    this.steering = JSON.parse(fs.readFileSync(steeringPath, 'utf8'));

    if (!this.steering.roles[roleKey]) {
        throw new Error(`El rol '${roleKey}' no existe en steering.json`);
    }
    this.activeRole = this.steering.roles[roleKey];
    this.rag = new RagEngine();
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
    const mcpsPath = path.resolve('./src/kiro/mcps.json');
    if (!fs.existsSync(mcpsPath)) {
      console.log('[HuascarEngine] mcps.json no encontrado, saltando MCP.');
      return;
    }

    const config: McpServersConfig = JSON.parse(fs.readFileSync(mcpsPath, 'utf8'));

    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      try {
        console.log(`[HuascarEngine] Iniciando MCP server: "${name}" (${serverConfig.command})`);

        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: this.resolveEnv(serverConfig.env),
          stderr: 'ignore',
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
      } catch (err: any) {
        console.error(`[HuascarEngine] Error conectando MCP "${name}": ${err.message}`);
      }
    }
  }

  private loadRagSources(): void {
    const ragPath = path.resolve('./src/kiro/rag.json');
    if (!fs.existsSync(ragPath)) {
      console.log('[HuascarEngine] rag.json no encontrado, saltando RAG.');
      return;
    }
    try {
      const config: RagConfig = JSON.parse(fs.readFileSync(ragPath, 'utf8'));
      if (!Array.isArray(config.knowledge_bases)) {
        console.warn('[HuascarEngine] knowledge_bases no es un array, saltando RAG.');
        return;
      }
      this.rag.loadSources(config.knowledge_bases);
      console.log(`[HuascarEngine] RAG cargado: ${config.knowledge_bases.length} fuentes`);
    } catch (err: any) {
      console.warn(`[HuascarEngine] Error cargando RAG: ${err.message}`);
    }
  }

  private async disconnectMcpServers(): Promise<void> {
    for (const c of this.mcpClients) {
      try {
        await c.client.close();
      } catch (err: any) {
        console.error(`[HuascarEngine] Error cerrando MCP "${c.name}": ${err.message}`);
      }
    }
    this.mcpClients = [];
  }

  async executeTask(task: string) {
    console.log(`\n[HuascarEngine] Iniciando LLM ReAct Loop...`);
    console.log(`[HuascarEngine] Rol activo: ${this.activeRole.name}`);
    console.log(`[HuascarEngine] Tarea: ${task}`);

    try {
      const hasApiKey = !!process.env.OPENAI_API_KEY;

      let mcpContext = '';

      if (hasApiKey) {
        await this.connectMcpServers();

        this.loadRagSources();

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

      const responseText = hasApiKey
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
    const maxIterations = 3;
    let context = systemPrompt;
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: task },
    ];

    for (let i = 0; i < maxIterations; i++) {
      console.log(`\n[HuascarEngine] ReAct iteracion ${i + 1}/${maxIterations}`);

      const { text } = await generateText({
        model: openai(process.env.MODEL_ID || 'gpt-4o'),
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

      const argsMatch = text.match(/Argumentos:\s*(\{[\s\S]*?\})/);
      let args: any = {};
      if (argsMatch) {
        try {
          args = JSON.parse(argsMatch[1]);
        } catch {
          console.log(`[HuascarEngine] No se pudieron parsear los argumentos JSON para "${toolName}"`);
        }
      }

      console.log(`[HuascarEngine] Llamando herramienta: "${toolName}"`);

      // Hook de seguridad: validar herramienta real
      const hookPayload = { command: `${toolName} ${JSON.stringify(args)}` };
      const allowed = agentHooks.before_action("execute_bash", hookPayload);
      if (!allowed) {
        throw new Error(`HOOK TRIGGERED: Accion destructiva bloqueada por politica de seguridad.`);
      }

      let toolResult = `Error: herramienta "${toolName}" no encontrada en ningun servidor MCP`;

      for (const c of this.mcpClients) {
        const toolDef = c.tools.find(t => t.name === toolName);
        if (toolDef) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
            const result = await c.client.callTool({ name: toolName, arguments: args });
            clearTimeout(timeout);
            const content = (result as any).content || [];
            toolResult = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
            // ponytail: truncate large tool results to avoid blowing context budget
            if (toolResult.length > TOOL_RESULT_MAX) {
              toolResult = toolResult.slice(0, TOOL_RESULT_MAX) + '\n... [truncado]';
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
      model: openai(process.env.MODEL_ID || 'gpt-4o'),
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
