import fs from 'fs';
import path from 'path';
import { agentHooks } from '../kiro/hooks.js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export class HuascarEngine {
  private steering: any;
  public activeRole: any;

  constructor(roleKey: string) {
    const steeringPath = path.resolve('./src/kiro/steering.json');
    this.steering = JSON.parse(fs.readFileSync(steeringPath, 'utf8'));

    if (!this.steering.roles[roleKey]) {
        throw new Error(`El rol '${roleKey}' no existe en steering.json`);
    }
    this.activeRole = this.steering.roles[roleKey];
  }

  async executeTask(task: string) {
    console.log(`\n[HuascarEngine] Iniciando LLM ReAct Loop...`);
    console.log(`[HuascarEngine] Rol activo: ${this.activeRole.name}`);
    console.log(`[HuascarEngine] Tarea: ${task}`);

    try {
        // Hook de seguridad: validar que la tarea no intente algo destructivo
        const toolPayload = { command: task };
        agentHooks.before_action("execute_bash", toolPayload);

        let responseText = "He ejecutado las herramientas permitidas. La tarea se completó con éxito.";

        if (process.env.OPENAI_API_KEY) {
            console.log(`[HuascarEngine] API Key detectada. Llamando a OpenAI...`);
            const { text } = await generateText({
                model: openai(process.env.MODEL_ID || 'gpt-4o'),
                system: this.activeRole.system_prompt,
                prompt: task,
            });
            responseText = text;
        } else {
            console.log(`[HuascarEngine] No se encontró OPENAI_API_KEY. Usando respuesta simulada.`);
        }

        return { status: "success", agent_role: this.activeRole.name, response: responseText };

    } catch (error: any) {
        return { status: "blocked", error: error.message };
    }
  }
}
