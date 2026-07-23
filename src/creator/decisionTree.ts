import {
  AnswerIssue,
  CreatorAnswers,
  CreatorAnswerValue,
  CreatorInputError,
  CreatorRecommendation,
  DecisionEvaluation,
  DecisionQuestion,
  QuestionCondition,
  QuestionOption,
} from './domain.js';
import { CATALOG_VERSION, getCatalogItem, isCatalogItemFor } from './catalog.js';

export const WORKFLOW_VERSION = '1.0.0';

const option = (id: string, label: string, description: string): QuestionOption => ({ id, label, description });

export const creatorQuestions: DecisionQuestion[] = [
  {
    id: 'agent_name', section: 'Identidad', prompt: '¿Cómo se llamará el agente?',
    description: 'Un nombre corto permite identificar archivos, skills y documentación.', type: 'text', required: true,
    placeholder: 'Ej: reviewer-plataforma',
  },
  {
    id: 'purpose', section: 'Objetivo', prompt: '¿Qué problema principal resolverá?',
    description: 'La finalidad abre ramas y recomendaciones especializadas.', type: 'select', required: true,
    options: [
      option('pr-review', 'Revisión de pull requests', 'Analiza cambios, riesgos y estándares antes de integrar.'),
      option('coding', 'Desarrollo y mantenimiento', 'Ayuda a implementar, refactorizar y corregir código.'),
      option('testing', 'Pruebas y calidad', 'Diseña pruebas, quality gates y validaciones.'),
      option('devops', 'DevOps y plataforma', 'Automatiza CI/CD, infraestructura y operación.'),
      option('operations', 'Operación de producción', 'Diagnóstico, observabilidad y respuesta guiada.'),
      option('security', 'Seguridad', 'Revisa código, dependencias, configuración y amenazas.'),
      option('data-ai', 'Datos e IA', 'Pipelines, modelos, RAG y calidad de datos.'),
      option('documentation', 'Documentación', 'Mantiene documentación técnica y runbooks.'),
      option('custom', 'Otro propósito', 'Conserva un objetivo personalizado.'),
    ],
  },
  {
    id: 'objective', section: 'Objetivo', prompt: 'Describe el resultado que esperas del agente',
    description: 'Explica entradas, resultado y límites; no incluyas credenciales.', type: 'textarea', required: true,
    placeholder: 'Ej: revisar cada PR, explicar riesgos y proponer cambios sin hacer merge automático.',
  },
  {
    id: 'success_criteria', section: 'Objetivo', prompt: '¿Cómo sabrás que funciona correctamente?',
    description: 'Define un criterio verificable para validar el agente.', type: 'textarea', required: true,
    placeholder: 'Ej: cada PR recibe un informe priorizado y no se publican falsos positivos críticos.',
  },
  {
    id: 'project_stage', section: 'Proyecto', prompt: '¿En qué estado está el proyecto?',
    description: 'Un proyecto existente prioriza compatibilidad; uno nuevo permite sugerencias estructurales.', type: 'select', required: true,
    options: [
      option('new', 'Proyecto nuevo', 'Se diseñará una base coherente desde cero.'),
      option('existing', 'Proyecto existente', 'Se respetará la arquitectura y convenciones actuales.'),
      option('migration', 'Migración', 'Se documentarán estados origen, destino y convivencia.'),
    ],
  },
  {
    id: 'technologies', section: 'Stack', prompt: 'Selecciona las tecnologías del proyecto',
    description: 'Puedes combinar lenguajes, frameworks, datos y añadir `custom:<slug>`.', type: 'catalog-multiselect', required: true,
    catalogCategories: ['language', 'frontend', 'backend', 'mobile', 'data-ai', 'database'], maxSelections: 24,
  },
  {
    id: 'architecture', section: 'Arquitectura', prompt: '¿Qué arquitectura describe mejor la aplicación?',
    description: 'La recomendación se ajustará a tamaño de equipo, despliegue y operación.', type: 'catalog-select', required: true,
    catalogCategories: ['architecture'],
  },
  {
    id: 'repository_provider', section: 'Proyecto', prompt: '¿Dónde vive el código?',
    description: 'Define integraciones de PR, tickets y CI.', type: 'catalog-select', required: true,
    catalogCategories: ['repository'],
  },
  {
    id: 'environment', section: 'Entornos', prompt: '¿Dónde trabajará el agente?',
    description: 'Desarrollo y producción tienen permisos, riesgos y artefactos diferentes.', type: 'select', required: true,
    options: [
      option('development', 'Sólo desarrollo', 'Opera sobre código y herramientas de desarrollo.'),
      option('production', 'Sólo producción', 'Asiste en un entorno operacional controlado.'),
      option('both', 'Desarrollo y producción', 'Genera políticas separadas para ambos contextos.'),
    ],
  },
  {
    id: 'development_setup', section: 'Entorno de desarrollo', prompt: '¿Cómo se prepara el entorno de desarrollo?',
    description: 'Permite generar pasos de instalación reproducibles.', type: 'select', required: true,
    visibleWhen: { operator: 'oneOf', questionId: 'environment', values: ['development', 'both'] },
    options: [
      option('local', 'Local', 'Dependencias instaladas en la estación del desarrollador.'),
      option('docker-compose', 'Docker Compose', 'Servicios locales reproducibles mediante contenedores.'),
      option('devcontainer', 'Dev Container', 'Entorno de editor y toolchain en contenedor.'),
      option('remote', 'Entorno remoto', 'Workspace de desarrollo alojado en servidor o cloud.'),
    ],
  },
  {
    id: 'deployment_target', section: 'Producción', prompt: '¿Dónde se ejecuta la aplicación o el agente?',
    description: 'Selecciona EC2, contenedores, Kubernetes, serverless o hosting administrado.', type: 'catalog-select', required: true,
    catalogCategories: ['cloud'],
    visibleWhen: { operator: 'oneOf', questionId: 'environment', values: ['production', 'both'] },
  },
  {
    id: 'container_platforms', section: 'Producción', prompt: '¿Qué capa de empaquetado u orquestación utilizas?',
    description: 'Es opcional para serverless o plataformas totalmente administradas.', type: 'catalog-multiselect', required: false,
    catalogCategories: ['container'], maxSelections: 5,
    visibleWhen: { operator: 'oneOf', questionId: 'environment', values: ['production', 'both'] },
  },
  {
    id: 'ci_cd', section: 'DevOps', prompt: '¿Qué plataforma de CI/CD utilizarás?',
    description: 'El agente documentará quality gates y promoción sin desplegar automáticamente.', type: 'catalog-select', required: true,
    catalogCategories: ['cicd'],
  },
  {
    id: 'infrastructure', section: 'DevOps', prompt: '¿Cómo se define la infraestructura?',
    description: 'Selecciona IaC y automatización aplicable.', type: 'catalog-multiselect', required: false,
    catalogCategories: ['infrastructure'], maxSelections: 5,
    visibleWhen: { operator: 'oneOf', questionId: 'environment', values: ['production', 'both'] },
  },
  {
    id: 'observability', section: 'Producción', prompt: '¿Qué observabilidad necesita?',
    description: 'Producción debe cubrir errores, logs, métricas y trazas según riesgo.', type: 'catalog-multiselect', required: true,
    catalogCategories: ['observability'], maxSelections: 6,
    visibleWhen: { operator: 'oneOf', questionId: 'environment', values: ['production', 'both'] },
  },
  {
    id: 'security_controls', section: 'Seguridad', prompt: 'Selecciona controles de seguridad y supply chain',
    description: 'Los secretos deben referenciarse por nombre; nunca se incluyen valores.', type: 'catalog-multiselect', required: true,
    catalogCategories: ['security'], maxSelections: 8,
  },
  {
    id: 'capabilities', section: 'Permisos', prompt: '¿Qué capacidades necesita el agente?',
    description: 'Concede sólo lo necesario. Producción no habilita escritura o despliegue por defecto.', type: 'multiselect', required: true,
    maxSelections: 8,
    options: [
      option('read-repository', 'Leer repositorio', 'Analiza código y documentación.'),
      option('edit-code', 'Proponer cambios', 'Genera parches, sin aplicarlos automáticamente.'),
      option('run-tests', 'Ejecutar pruebas', 'Ejecuta comandos de calidad allowlisted.'),
      option('review-pr', 'Revisar PR', 'Lee diffs y publica o prepara comentarios.'),
      option('manage-issues', 'Gestionar issues', 'Lee o actualiza trabajo planificado.'),
      option('inspect-infrastructure', 'Inspeccionar infraestructura', 'Consulta estado operacional en modo lectura.'),
      option('operate-production', 'Operar producción', 'Acciones operacionales con aprobación obligatoria.'),
      option('deploy', 'Desplegar', 'Promoción controlada con aprobación y rollback.'),
    ],
  },
  {
    id: 'autonomy', section: 'Permisos', prompt: '¿Qué nivel de autonomía tendrá?',
    description: 'El modo asesor es el valor más seguro; los otros requieren controles adicionales.', type: 'select', required: true,
    options: [
      option('advisory', 'Asesor', 'Sólo analiza y recomienda.'),
      option('assisted', 'Asistido', 'Prepara acciones que una persona aprueba.'),
      option('autonomous', 'Autónomo acotado', 'Ejecuta únicamente operaciones allowlisted y reversibles.'),
    ],
  },
  {
    id: 'human_approval', section: 'Permisos', prompt: '¿Exigir aprobación humana para acciones con efectos?',
    description: 'Obligatorio para producción, escritura, deploy y privilegios elevados.', type: 'boolean', required: true,
    visibleWhen: {
      operator: 'any', conditions: [
        { operator: 'oneOf', questionId: 'autonomy', values: ['assisted', 'autonomous'] },
        { operator: 'includes', questionId: 'capabilities', value: 'operate-production' },
        { operator: 'includes', questionId: 'capabilities', value: 'deploy' },
      ],
    },
  },
  {
    id: 'knowledge_enabled', section: 'Conocimiento', prompt: '¿Necesita conocimiento adicional al prompt?',
    description: 'Activa RAG o instrucciones versionadas cuando el contexto no cabe en una regla breve.', type: 'boolean', required: true,
  },
  {
    id: 'knowledge_sources', section: 'Conocimiento', prompt: '¿Qué fuentes utilizará?',
    description: 'El preview sólo documenta fuentes; no lee archivos ni URLs.', type: 'catalog-multiselect', required: true,
    catalogCategories: ['knowledge'], maxSelections: 8,
    visibleWhen: { operator: 'equals', questionId: 'knowledge_enabled', value: true },
  },
  {
    id: 'pr_review_enabled', section: 'Pull requests', prompt: '¿Debe incluir una configuración especializada de PR review?',
    description: 'Genera rúbrica, severidades y permisos; nunca activa auto-merge.', type: 'boolean', required: true,
  },
  {
    id: 'pr_review_focus', section: 'Pull requests', prompt: '¿Qué debe priorizar en los PR?',
    description: 'El informe explicará evidencia, severidad y corrección sugerida.', type: 'multiselect', required: true,
    maxSelections: 7,
    options: [
      option('correctness', 'Correctitud', 'Bugs, estados inválidos y regresiones.'),
      option('security', 'Seguridad', 'Entradas, permisos, secretos y supply chain.'),
      option('performance', 'Rendimiento', 'Complejidad, consultas y uso de recursos.'),
      option('architecture', 'Arquitectura', 'Límites, dependencias y mantenibilidad.'),
      option('tests', 'Pruebas', 'Cobertura de comportamiento y casos de borde.'),
      option('devops', 'DevOps', 'Pipelines, contenedores, IaC y observabilidad.'),
      option('documentation', 'Documentación', 'Contratos, cambios y operación.'),
    ],
    visibleWhen: { operator: 'equals', questionId: 'pr_review_enabled', value: true },
  },
  {
    id: 'agent_targets', section: 'Salida', prompt: '¿Para qué plataformas se generará la configuración?',
    description: 'Huascar genera su formato nativo, Kiro usa `.kiro/` y Portable usa AGENTS.md/skills.', type: 'catalog-multiselect', required: true,
    catalogCategories: ['agent-platform'], maxSelections: 3,
  },
  {
    id: 'hooks_enabled', section: 'Salida', prompt: '¿Generar políticas y hooks recomendados?',
    description: 'Los hooks generados son plantillas revisables y no se ejecutan durante el preview.', type: 'boolean', required: true,
  },
  {
    id: 'skills_enabled', section: 'Salida', prompt: '¿Generar skills reutilizables?',
    description: 'Convierte el procedimiento principal en una habilidad documentada.', type: 'boolean', required: true,
  },
];

export const creatorTutorial = {
  version: '1.0.0',
  skippable: true,
  title: 'Rescate de una API ficticia en producción',
  description: 'Tutorial tipo juego para aprender a separar objetivo, contexto, permisos y operación antes de crear un agente real.',
  stages: [
    { id: 'incident', title: 'La alerta', narrative: 'Una API ficticia presenta errores después de un despliegue.', learning: 'Define un resultado verificable antes de elegir herramientas.' },
    { id: 'context', title: 'El mapa', narrative: 'Elige stack, arquitectura y fuentes de conocimiento.', learning: 'Distingue reglas estables, documentación y datos vivos.' },
    { id: 'permissions', title: 'La llave', narrative: 'Concede permisos mínimos y decide qué requiere aprobación.', learning: 'Un agente no debe ser su propia autoridad.' },
    { id: 'delivery', title: 'La salida', narrative: 'Compara artefactos Huascar, Kiro y portables.', learning: 'Cada decisión queda explicada y es reversible.' },
  ],
  completion: 'Al terminar o saltar el tutorial, la UI debe abrir el creador guiado sin modificar estado del backend.',
};

function conditionMatches(condition: QuestionCondition, answers: CreatorAnswers): boolean {
  switch (condition.operator) {
    case 'equals': return answers[condition.questionId] === condition.value;
    case 'oneOf': return condition.values.some(value => answers[condition.questionId] === value);
    case 'includes': {
      const answer = answers[condition.questionId];
      return Array.isArray(answer) && answer.includes(condition.value);
    }
    case 'all': return condition.conditions.every(item => conditionMatches(item, answers));
    case 'any': return condition.conditions.some(item => conditionMatches(item, answers));
  }
}

function isAnswered(_question: DecisionQuestion, value: CreatorAnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  return value.length > 0;
}

function validateQuestionAnswer(question: DecisionQuestion, value: CreatorAnswerValue): AnswerIssue[] {
  const issues: AnswerIssue[] = [];
  const path = `answers.${question.id}`;
  if (question.type === 'text' || question.type === 'textarea') {
    if (typeof value !== 'string') return [{ path, message: 'Debe ser un texto.' }];
    const max = question.type === 'textarea' ? 4000 : 120;
    if (value.trim().length === 0 || value.length > max) issues.push({ path, message: `Debe contener entre 1 y ${max} caracteres.` });
    return issues;
  }
  if (question.type === 'boolean') {
    if (typeof value !== 'boolean') issues.push({ path, message: 'Debe ser true o false.' });
    return issues;
  }
  if (question.type === 'select') {
    if (typeof value !== 'string' || !question.options?.some(item => item.id === value)) issues.push({ path, message: 'La opción no pertenece a esta pregunta.' });
    return issues;
  }
  if (question.type === 'catalog-select') {
    if (typeof value !== 'string' || !isCatalogItemFor(value, question.catalogCategories ?? [])) issues.push({ path, message: 'La tecnología seleccionada no pertenece a la categoría esperada.' });
    return issues;
  }
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return [{ path, message: 'Debe ser una lista de identificadores.' }];
  if (value.length > (question.maxSelections ?? 20)) issues.push({ path, message: `Supera el máximo de ${question.maxSelections ?? 20} selecciones.` });
  if (new Set(value).size !== value.length) issues.push({ path, message: 'No se permiten selecciones duplicadas.' });
  if (question.type === 'multiselect') {
    const allowed = new Set(question.options?.map(item => item.id));
    if (value.some(item => !allowed.has(item))) issues.push({ path, message: 'La lista contiene una opción desconocida.' });
  } else if (value.some(item => !isCatalogItemFor(item, question.catalogCategories ?? []))) {
    issues.push({ path, message: 'La lista contiene una tecnología fuera de la categoría esperada.' });
  }
  return issues;
}

export function parseCreatorAnswers(input: unknown): { answers: CreatorAnswers; issues: AnswerIssue[]; warnings: string[] } {
  if (input === undefined) return { answers: {}, issues: [], warnings: [] };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new CreatorInputError('answers debe ser un objeto.', [{ path: 'answers', message: 'Se esperaba un objeto JSON.' }]);
  }
  const known = new Map(creatorQuestions.map(question => [question.id, question]));
  const answers: CreatorAnswers = {};
  const issues: AnswerIssue[] = [];
  const warnings: string[] = [];
  for (const [key, raw] of Object.entries(input)) {
    const question = known.get(key);
    if (!question) {
      warnings.push(`La respuesta "${key}" no pertenece a la versión ${WORKFLOW_VERSION} y fue ignorada.`);
      continue;
    }
    if (typeof raw !== 'string' && typeof raw !== 'boolean' && !(Array.isArray(raw) && raw.every(item => typeof item === 'string'))) {
      issues.push({ path: `answers.${key}`, message: 'Tipo de dato no permitido.' });
      continue;
    }
    const value = Array.isArray(raw) ? raw.slice(0, 50) : raw;
    answers[key] = value as CreatorAnswers[string];
    issues.push(...validateQuestionAnswer(question, value as CreatorAnswers[string]));
  }
  return { answers, issues, warnings };
}

function recommendation(id: string, severity: CreatorRecommendation['severity'], title: string, reason: string, evidence: string[], benefits: string[], tradeoffs: string[], alternatives: string[]): CreatorRecommendation {
  return { id, severity, title, reason, evidence, benefits, tradeoffs, alternatives };
}

function buildRecommendations(answers: CreatorAnswers): CreatorRecommendation[] {
  const result: CreatorRecommendation[] = [];
  const environment = answers.environment;
  const technologies = Array.isArray(answers.technologies) ? answers.technologies : [];
  const architecture = answers.architecture;
  const deployment = answers.deployment_target;
  const targets = Array.isArray(answers.agent_targets) ? answers.agent_targets : [];

  if (environment === 'production' || environment === 'both') {
    result.push(recommendation(
      'production-guardrails', 'recommended', 'Separar políticas de producción y desarrollo',
      'Producción requiere identidad de workload, mínimo privilegio, aprobación y rollback; no debe heredar permisos del entorno de desarrollo.',
      [`environment=${environment}`], ['Reduce el radio de impacto', 'Permite auditoría y reversión'],
      ['Añade configuración operacional'], ['Mantener el agente sólo en modo asesor en producción'],
    ));
  }
  if (deployment === 'aws-ec2') {
    result.push(recommendation(
      'aws-ec2-baseline', 'recommended', 'Operar EC2 con un baseline reproducible',
      'EC2 entrega control del servidor, pero el equipo debe resolver proceso, parches, observabilidad y secretos.',
      ['deployment_target=aws-ec2'], ['Control del runtime', 'Integración con IAM, SSM y CloudWatch'],
      ['Mayor responsabilidad operacional'], ['AWS ECS/Fargate', 'AWS Lambda si el workload es stateless'],
    ));
  }
  if (architecture === 'microservices') {
    result.push(recommendation(
      'microservices-observability', 'recommended', 'Definir límites y trazabilidad distribuida',
      'Los microservicios sólo aportan independencia si contratos, ownership y observabilidad están explícitos.',
      ['architecture=microservices'], ['Despliegues independientes', 'Escalado por servicio'],
      ['Complejidad de red y operación'], ['Monolito modular hasta que existan límites y equipos claros'],
    ));
  }
  if (architecture === 'serverless') {
    result.push(recommendation(
      'serverless-stateless', 'info', 'Mantener funciones stateless e idempotentes',
      'El escalado administrado funciona mejor con estado externo y eventos reintentables.',
      ['architecture=serverless'], ['Escalado por demanda', 'Menor operación de servidores'],
      ['Cold starts y dependencia del proveedor'], ['Contenedores administrados'],
    ));
  }
  if ((environment === 'production' || environment === 'both') && technologies.includes('sqlite')) {
    result.push(recommendation(
      'sqlite-production', 'warning', 'Revisar SQLite para producción concurrente',
      'SQLite es excelente como base embebida, pero múltiples réplicas y escrituras concurrentes requieren una estrategia explícita.',
      ['technologies incluye sqlite', `environment=${environment}`], ['Simplicidad y portabilidad'],
      ['Coordinación de escritura y almacenamiento persistente'], ['PostgreSQL', 'Una sola réplica con backups verificados'],
    ));
  }
  if (answers.pr_review_enabled === true) {
    result.push(recommendation(
      'pr-human-merge', 'recommended', 'Mantener el merge bajo control humano',
      'El revisor debe producir evidencia y comentarios reproducibles, no decidir por sí solo la integración.',
      ['pr_review_enabled=true'], ['Reduce cambios no autorizados', 'Conserva trazabilidad'],
      ['Requiere revisión humana'], ['Quality gates automáticos para verificaciones deterministas'],
    ));
  }
  if (targets.includes('kiro')) {
    result.push(recommendation(
      'kiro-structure', 'info', 'Separar steering, hooks y skills de Kiro',
      'Las reglas estables pertenecen a steering, los eventos a hooks y los procedimientos reutilizables a skills.',
      ['agent_targets incluye kiro'], ['Configuración modular', 'Contexto mantenible'],
      ['Las plantillas deben revisarse en el proyecto destino'], ['Usar sólo AGENTS.md como formato portable'],
    ));
  }
  if (answers.autonomy === 'autonomous' || (Array.isArray(answers.capabilities) && answers.capabilities.some(value => value === 'deploy' || value === 'operate-production'))) {
    result.push(recommendation(
      'privileged-actions', 'warning', 'Acotar acciones privilegiadas',
      'Deploy y operación no deben depender únicamente de instrucciones del modelo.',
      ['autonomy/capabilities incluyen acciones con efectos'], ['Menor riesgo operacional'],
      ['Requiere integración de aprobación'], ['Modo asesor', 'Preparar plan y ejecutar desde CI/CD aprobado'],
    ));
  }
  return result;
}

export function evaluateDecisionTree(input: unknown): DecisionEvaluation {
  const parsed = parseCreatorAnswers(input);
  const answers: CreatorAnswers = {};
  const visibleQuestions: DecisionQuestion[] = [];

  // Rebuild the path in declaration order. Answers from branches that are no
  // longer visible are intentionally discarded so they cannot affect output.
  for (const question of creatorQuestions) {
    if (question.visibleWhen && !conditionMatches(question.visibleWhen, answers)) continue;
    visibleQuestions.push(question);
    const answerValue = parsed.answers[question.id];
    if (answerValue !== undefined) answers[question.id] = answerValue;
  }

  const visibleIds = new Set(visibleQuestions.map(question => question.id));
  const issues = parsed.issues.filter(issue => {
    const questionId = issue.path.replace(/^answers\./, '');
    return visibleIds.has(questionId);
  });
  const discarded = Object.keys(parsed.answers).filter(questionId => !visibleIds.has(questionId));
  const answeredQuestionIds = visibleQuestions.filter(question => isAnswered(question, answers[question.id])).map(question => question.id);
  const requiredQuestions = visibleQuestions.filter(question => question.required);
  const nextQuestion = requiredQuestions.find(question => !isAnswered(question, answers[question.id])) ?? null;
  const answeredRequired = requiredQuestions.filter(question => isAnswered(question, answers[question.id])).length;
  const percent = requiredQuestions.length === 0 ? 100 : Math.round((answeredRequired / requiredQuestions.length) * 100);
  const warnings = [...parsed.warnings];
  if (discarded.length > 0) warnings.push(`Se descartaron respuestas de ramas no visibles: ${discarded.join(', ')}.`);

  const custom = Object.entries(answers).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.filter(item => typeof item === 'string' && item.startsWith('custom:')).map(item => `${key}=${item}`);
  });
  if (custom.length > 0) warnings.push(`Opciones personalizadas sin adaptador automático: ${custom.join(', ')}. Se conservarán en blueprint y documentación.`);
  if ((answers.environment === 'production' || answers.environment === 'both') && answers.human_approval === false) {
    warnings.push('Producción sin aprobación humana: el preview documentará el conflicto y no recomendará ejecución autónoma.');
  }

  return {
    workflowVersion: WORKFLOW_VERSION,
    answers,
    visibleQuestions,
    answeredQuestionIds,
    nextQuestion,
    progress: {
      answered: answeredRequired,
      total: requiredQuestions.length,
      percent,
      complete: nextQuestion === null && issues.length === 0,
    },
    recommendations: buildRecommendations(answers),
    warnings,
    issues,
  };
}

export function getWorkflowDefinition() {
  return {
    id: 'agent-builder',
    version: WORKFLOW_VERSION,
    catalogVersion: CATALOG_VERSION,
    mode: 'stateless',
    description: 'Árbol de decisiones guiado para generar configuraciones de agentes de desarrollo y producción.',
    answersContract: 'El cliente reenvía todas las respuestas acumuladas en cada evaluación.',
    questions: creatorQuestions,
  };
}

export function describeCatalogSelection(id: string): string {
  return getCatalogItem(id)?.label ?? id.replace(/^custom:/, 'Personalizado: ');
}
