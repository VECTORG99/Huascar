import fs from 'fs';
import path from 'path';
import { agentHooks } from '../kiro/hooks.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export class HuascarEngine {
  private steering: any;
  private mcps: any;
  public activeRole: any;

  constructor(roleKey: string) {
    // Cargar configuraciones "Kiro"
    const steeringPath = path.resolve('./src/kiro/steering.json');
    const mcpsPath = path.resolve('./src/kiro/mcps.json');
    
    this.steering = JSON.parse(fs.readFileSync(steeringPath, 'utf8'));
    this.mcps = JSON.parse(fs.readFileSync(mcpsPath, 'utf8'));
    
    if (!this.steering.roles[roleKey]) {
        throw new Error(`El rol '${roleKey}' no existe en steering.json`);
    }
    this.activeRole = this.steering.roles[roleKey];
  }

  async executeTask(task: string, simulatedCommand: string = "npm test") {
    console.log(`\n[HuascarEngine] 🧠 Iniciando LLM ReAct Loop...`);
    console.log(`[HuascarEngine] 🎭 Rol activo: ${this.activeRole.name}`);
    console.log(`[HuascarEngine] 🎯 Tarea: ${task}`);
    
    try {
        // 1. Simulación de que el LLM decidió usar la terminal (MCP bash)
        const toolPayload = { command: simulatedCommand };
        console.log(`[HuascarEngine] 🛠️  El Agente intenta usar MCP [bash-terminal]: ${simulatedCommand}`);
        
        // 2. Ejecutar Guardrail (Hook de seguridad)
        agentHooks.before_action("execute_bash", toolPayload);
        
        // 3. Llamada al LLM si hay API key, sino fallback
        let responseText = "He ejecutado las herramientas permitidas. La tarea se completó con éxito basándome en mi System Prompt.";
        
        if (process.env.OPENAI_API_KEY) {
            console.log(`[HuascarEngine] 🔑 API Key detectada. Llamando a OpenAI...`);
            const { text } = await generateText({
                model: openai(process.env.MODEL_ID || 'gpt-4o'),
                system: this.activeRole.system_prompt,
                prompt: task,
            });
            responseText = text;
        } else {
            console.log(`[HuascarEngine] ⚠️ No se encontró OPENAI_API_KEY. Usando respuesta simulada.`);
        }

        return {
            status: "success",
            agent_role: this.activeRole.name,
            action_taken: simulatedCommand,
            response: responseText
        };

    } catch (error: any) {
        // El Hook bloqueó la acción
        return {
            status: "blocked",
            error: error.message,
            action_attempted: simulatedCommand
        };
    }
  }
}
