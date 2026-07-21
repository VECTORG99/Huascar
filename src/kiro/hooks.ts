/**
 * Hooks de Seguridad y Human-in-the-Loop (Estilo Kiro)
 * Interceptan las acciones del agente antes de que interactúen con el sistema o el repositorio.
 */

export const agentHooks = {
  // Hook de seguridad preventivo
  before_action: (action: string, payload: any): boolean => {
    const destructiveCommands = ['rm -rf', 'drop table', 'git push --force'];
    
    // Si el agente intenta ejecutar un comando de consola
    if (action === "execute_bash") {
      const isDestructive = destructiveCommands.some(cmd => payload.command?.includes(cmd));
      if (isDestructive) {
        console.error(`[HOOK ERROR] Acción destructiva bloqueada: ${payload.command}`);
        throw new Error("HOOK TRIGGERED: Acción destructiva bloqueada por política de seguridad.");
      }
    }
    
    console.log(`[HOOK SUCCESS] Autorizando acción segura: ${action}`);
    return true;
  },

  // Hook Human-in-the-Loop (HITL)
  on_commit: async (diffContext: string): Promise<string> => {
    console.log("[HOOK PAUSE] Esperando aprobación del desarrollador para realizar el commit...");
    // Aquí en la plataforma real se enviaría un WebSocket al Frontend
    // para que el usuario presione "Aprobar" o "Rechazar".
    return "PENDING_HUMAN_APPROVAL";
  }
};
