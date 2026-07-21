import fs from 'fs';
import path from 'path';
import { agentHooks } from '../kiro/hooks.js';

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
        
        // 3. Simulación de la respuesta exitosa del LLM
        return {
            status: "success",
            agent_role: this.activeRole.name,
            action_taken: simulatedCommand,
            response: "He ejecutado las herramientas permitidas. La tarea se completó con éxito basándome en mi System Prompt."
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
