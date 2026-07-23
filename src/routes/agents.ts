import { Router } from 'express';
import { HuascarEngine, type AgentConfig } from '../engine/HuascarEngine.js';
import type { AgentRecord, Store } from '../engine/Store.js';
import { SessionManager } from '../engine/SessionManager.js';
import { ApiError, ErrorCodes } from '../errors.js';

type EngineClass = new (role: string, store: Store) => Pick<HuascarEngine, 'executeTask'>;

const bad = (message: string) => new ApiError(ErrorCodes.API_VALIDATION_ERROR, message, 400);

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad('config debe ser un objeto');
  return value as Record<string, unknown>;
}

function validateName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.length > 200) throw bad('name debe ser un texto no vacio de maximo 200 caracteres');
  return name.trim();
}

function validateConfig(config: unknown): AgentConfig & Record<string, unknown> {
  const obj = asObject(config) as AgentConfig & Record<string, unknown>;
  const steering = (obj as { steering?: unknown }).steering;
  if (steering !== undefined) {
    const roles = asObject(steering).roles;
    if (Array.isArray(roles)) {
      for (const role of roles) {
        const r = asObject(role);
        if (typeof r.id !== 'string' || typeof (r.prompt ?? r.system_prompt) !== 'string') throw bad('steering.roles requiere id y prompt strings');
      }
    } else if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
      for (const [id, role] of Object.entries(roles)) {
        const r = asObject(role);
        if (!id || typeof (r.prompt ?? r.system_prompt) !== 'string') throw bad('steering.roles requiere prompts por rol');
      }
    } else {
      throw bad('steering.roles debe ser array u objeto');
    }
  }
  return obj;
}

function publicAgent(agent: AgentRecord, full = false) {
  const base = {
    id: agent.id,
    name: agent.name,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    last_executed_at: agent.last_executed_at,
    execution_count: agent.execution_count,
  };
  return full ? { ...base, config: JSON.parse(agent.config) } : base;
}

function defaultRole(agent: AgentRecord, config: Record<string, unknown>) {
  const steering = config.steering && typeof config.steering === 'object' ? config.steering as { roles?: unknown } : undefined;
  const roles = steering?.roles;
  if (Array.isArray(roles) && roles[0] && typeof roles[0] === 'object') {
    const role = roles[0] as Record<string, unknown>;
    return { role: String(role.id ?? agent.id), system_prompt: typeof (role.prompt ?? role.system_prompt) === 'string' ? String(role.prompt ?? role.system_prompt) : undefined };
  }
  if (roles && typeof roles === 'object') {
    const [id, role] = Object.entries(roles as Record<string, Record<string, unknown>>)[0] ?? [];
    return { role: id ?? agent.id, system_prompt: role && typeof (role.prompt ?? role.system_prompt) === 'string' ? String(role.prompt ?? role.system_prompt) : undefined };
  }
  return { role: agent.id, system_prompt: undefined };
}

function executeBody(body: Record<string, unknown>, agent: AgentRecord) {
  const task = body.task;
  const session_id = body.session_id;
  if (typeof task !== 'string' || !task || task.length > 10000) throw bad('task debe ser un texto de maximo 10000 caracteres');
  if (session_id !== undefined && (typeof session_id !== 'string' || session_id.length > 200)) throw bad('session_id debe ser un texto de maximo 200 caracteres');
  const config = validateConfig(JSON.parse(agent.config));
  const defaults = defaultRole(agent, config);
  const role = typeof body.role === 'string' ? body.role : defaults.role;
  const system_prompt = typeof body.system_prompt === 'string' ? body.system_prompt : defaults.system_prompt;
  return { task, session_id, role, system_prompt, config };
}

export function agentsRouter(store: Store, Engine: EngineClass = HuascarEngine): Router {
  const router = Router();

  router.post('/agents', (req, res) => {
    const agent = store.createAgent(validateName(req.body?.name), validateConfig(req.body?.config));
    res.status(201).json(publicAgent(agent, true));
  });

  router.get('/agents', (_req, res) => res.json(store.listAgents().map(agent => publicAgent(agent))));

  router.get('/agents/:id', (req, res) => {
    const agent = store.getAgent(req.params.id);
    if (!agent) throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'agent no encontrado', 404);
    res.json(publicAgent(agent, true));
  });

  router.put('/agents/:id', (req, res) => {
    const agent = store.updateAgent(req.params.id, validateName(req.body?.name), validateConfig(req.body?.config));
    if (!agent) throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'agent no encontrado', 404);
    res.json(publicAgent(agent, true));
  });

  router.delete('/agents/:id', (req, res) => res.json({ deleted: store.deleteAgent(req.params.id) }));

  router.post('/agents/:id/execute', async (req, res, next) => {
    try {
      const agent = store.getAgent(req.params.id);
      if (!agent) throw new ApiError(ErrorCodes.API_VALIDATION_ERROR, 'agent no encontrado', 404);
      const { task, role, system_prompt, config, session_id } = executeBody(req.body, agent);
      const sessions = new SessionManager(store);
      const session = sessions.getOrCreate(session_id, role);
      const sessionContext = sessions.recentContext(session.id);
      store.addSessionMessage(session.id, 'user', task);
      const result = await new Engine(role, store).executeTask(task, system_prompt, config, sessionContext);
      store.addSessionMessage(session.id, 'assistant', result.response ?? result.error ?? result.status);
      store.recordAgentExecution(agent.id);
      res.json({ ...result, session_id: session.id, agent_id: agent.id });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
