import type { AgentRole } from "@/types/agent";

interface AgentFormProps {
  role: string;
  roles: AgentRole[];
  task: string;
  loading: boolean;
  onRoleChange: (role: string) => void;
  onTaskChange: (task: string) => void;
  onDeploy: () => void;
}

export function AgentForm({ role, roles, task, loading, onRoleChange, onTaskChange, onDeploy }: AgentFormProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-zinc-100">Configuración del Agente</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="role" className="text-sm font-medium text-zinc-300">Rol del Agente</label>
        <select
          id="role"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-md p-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {roles.map(agentRole => (
            <option key={agentRole.id} value={agentRole.id}>{agentRole.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor="task" className="text-sm font-medium text-zinc-300">Tarea a Ejecutar</label>
        <textarea
          id="task"
          value={task}
          onChange={(e) => onTaskChange(e.target.value)}
          placeholder="Describe la tarea que el agente debe realizar..."
          className="bg-zinc-950 border border-zinc-700 rounded-md p-3 text-zinc-100 h-48 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <button
        onClick={onDeploy}
        disabled={loading || !task.trim()}
        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors mt-auto"
      >
        {loading ? "Ejecutando..." : "Desplegar y Ejecutar"}
      </button>
    </div>
  );
}
