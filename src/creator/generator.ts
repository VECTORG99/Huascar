import crypto from 'crypto';
import {
  AgentBlueprint,
  CreatorAnswers,
  CreatorInputError,
  GeneratedAgentBundle,
  GeneratedArtifact,
} from './domain.js';
import { describeCatalogSelection, evaluateDecisionTree } from './decisionTree.js';

export const GENERATOR_VERSION = '1.0.0';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value), null, 2) + '\n';
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function slugify(value: string): string {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return slug || 'generated-agent';
}

function stringAnswer(answers: CreatorAnswers, id: string): string {
  const value = answers[id];
  return typeof value === 'string' ? value : '';
}

function boolAnswer(answers: CreatorAnswers, id: string): boolean {
  return answers[id] === true;
}

function listAnswer(answers: CreatorAnswers, id: string): string[] {
  const value = answers[id];
  return Array.isArray(value) ? value : [];
}

function validateArtifactPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(segment => segment === '..' || segment === '')) {
    throw new CreatorInputError('Se intentó generar una ruta de artefacto insegura.', [{ path: 'artifact.path', message: path }], 422);
  }
}

function assertNoLiteralSecrets(content: string, path: string): void {
  const patterns = [
    /\bghp_[A-Za-z0-9]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
  ];
  if (patterns.some(pattern => pattern.test(content))) {
    throw new CreatorInputError('El preview contiene un valor con apariencia de secreto.', [{ path, message: 'Reemplaza secretos por referencias de entorno como ${SECRET_NAME}.' }], 422);
  }
}

function makeArtifact(path: string, kind: GeneratedArtifact['kind'], mediaType: GeneratedArtifact['mediaType'], description: string, content: string): GeneratedArtifact {
  validateArtifactPath(path);
  assertNoLiteralSecrets(content, path);
  return { path, kind, mediaType, description, content, sha256: sha256(content) };
}

function jsonArtifact(path: string, kind: GeneratedArtifact['kind'], description: string, value: unknown): GeneratedArtifact {
  return makeArtifact(path, kind, 'application/json', description, stableJson(value));
}

function markdownArtifact(path: string, kind: GeneratedArtifact['kind'], description: string, content: string): GeneratedArtifact {
  const normalized = content.trim() + '\n';
  return makeArtifact(path, kind, 'text/markdown', description, normalized);
}

function buildBlueprint(answers: CreatorAnswers): AgentBlueprint {
  const evaluation = evaluateDecisionTree(answers);
  if (!evaluation.progress.complete || evaluation.issues.length > 0) {
    const issues = evaluation.issues.length > 0
      ? evaluation.issues
      : [{ path: evaluation.nextQuestion ? `answers.${evaluation.nextQuestion.id}` : 'answers', message: 'Completa todas las preguntas requeridas antes de generar.' }];
    throw new CreatorInputError('El árbol de decisiones está incompleto.', issues, 422);
  }

  const name = stringAnswer(answers, 'agent_name').trim();
  const target = stringAnswer(answers, 'environment') as AgentBlueprint['environments']['target'];
  const technologies = listAnswer(answers, 'technologies');
  const targets = listAnswer(answers, 'agent_targets');
  const knowledgeEnabled = boolAnswer(answers, 'knowledge_enabled');
  const prReviewEnabled = boolAnswer(answers, 'pr_review_enabled');
  const capabilities = listAnswer(answers, 'capabilities');
  const production = target === 'production' || target === 'both';
  const development = target === 'development' || target === 'both';

  return {
    schemaVersion: '1.0.0',
    identity: {
      name,
      slug: slugify(name),
      description: stringAnswer(answers, 'objective').trim(),
    },
    purpose: {
      type: stringAnswer(answers, 'purpose'),
      objective: stringAnswer(answers, 'objective').trim(),
      successCriteria: stringAnswer(answers, 'success_criteria').trim(),
    },
    project: {
      stage: stringAnswer(answers, 'project_stage'),
      architecture: stringAnswer(answers, 'architecture'),
      technologies,
      repositoryProvider: stringAnswer(answers, 'repository_provider'),
    },
    environments: {
      target,
      developmentSetup: development ? stringAnswer(answers, 'development_setup') : null,
      deploymentTarget: production ? stringAnswer(answers, 'deployment_target') : null,
      cloudProvider: production ? inferCloudProvider(stringAnswer(answers, 'deployment_target')) : null,
      containerPlatforms: production ? listAnswer(answers, 'container_platforms') : [],
    },
    devops: {
      ciCd: stringAnswer(answers, 'ci_cd'),
      infrastructure: production ? listAnswer(answers, 'infrastructure') : [],
      observability: production ? listAnswer(answers, 'observability') : [],
      compliance: listAnswer(answers, 'security_controls'),
    },
    agent: {
      autonomy: stringAnswer(answers, 'autonomy'),
      capabilities,
      targets,
      requireHumanApproval: boolAnswer(answers, 'human_approval') || production || capabilities.some(value => value === 'deploy' || value === 'operate-production'),
    },
    knowledge: {
      enabled: knowledgeEnabled,
      sources: knowledgeEnabled ? listAnswer(answers, 'knowledge_sources') : [],
    },
    prReview: {
      enabled: prReviewEnabled,
      focus: prReviewEnabled ? listAnswer(answers, 'pr_review_focus') : [],
    },
    features: {
      hooks: boolAnswer(answers, 'hooks_enabled'),
      skills: boolAnswer(answers, 'skills_enabled'),
      steering: true,
      agentsMd: development || targets.includes('portable') || targets.includes('kiro'),
      kiro: targets.includes('kiro'),
    },
    recommendations: evaluation.recommendations,
  };
}

function inferCloudProvider(target: string): string | null {
  if (target.startsWith('aws-')) return 'aws';
  if (target.startsWith('azure-')) return 'azure';
  if (target.startsWith('gcp-')) return 'gcp';
  if (['vercel', 'render', 'flyio'].includes(target)) return target;
  if (target === 'vps') return 'self-managed';
  return null;
}

function buildSystemPrompt(blueprint: AgentBlueprint): string {
  const constraints = [
    `Objetivo: ${blueprint.purpose.objective}`,
    `Criterio de éxito: ${blueprint.purpose.successCriteria}`,
    `Arquitectura: ${describeCatalogSelection(blueprint.project.architecture)}`,
    `Entorno: ${blueprint.environments.target}`,
    'Explica evidencia, supuestos, riesgos y cambios propuestos.',
    'No reveles secretos ni inventes acceso a herramientas o datos.',
    blueprint.agent.requireHumanApproval ? 'Solicita aprobación humana antes de cualquier acción con efectos.' : 'Trabaja en modo asesor y no realices acciones con efectos.',
  ];
  if (blueprint.environments.target !== 'development') constraints.push('En producción prioriza mínimo privilegio, observabilidad, rollback y disponibilidad.');
  return constraints.join('\n');
}

function mapRagSources(sourceIds: string[]): unknown[] {
  return sourceIds.map(source => {
    if (source === 'repository-docs') return { type: 'local_directory', path: './docs', pattern: '*.md' };
    if (source === 'source-code') return { type: 'local_directory', path: './src', pattern: '*.ts' };
    if (source === 'runbooks') return { type: 'local_directory', path: './runbooks', pattern: '*.md' };
    if (source === 'web-documentation') return { type: 'inline', content: 'Configura únicamente URLs de documentación aprobadas en el entorno destino.' };
    if (source === 'tickets') return { type: 'inline', content: 'Conecta el proveedor de tickets mediante un MCP de sólo lectura y credenciales de mínimo privilegio.' };
    if (source === 'rag-vector-store') return { type: 'inline', content: 'Configura el namespace vectorial del proyecto y su política de retención antes de indexar.' };
    return { type: 'inline', content: `Fuente personalizada pendiente de adaptar: ${source}` };
  });
}

function buildMcpConfig(blueprint: AgentBlueprint): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  const repository = blueprint.project.repositoryProvider;
  const capabilities = blueprint.agent.capabilities;
  if (repository === 'github' && (blueprint.prReview.enabled || capabilities.includes('manage-issues'))) {
    servers['github-integration'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
      description: 'Integración GitHub; usa un token de mínimo privilegio y fija la versión del paquete antes de producción.',
    };
  }
  if (blueprint.environments.target !== 'production' && capabilities.includes('read-repository')) {
    servers['local-fs'] = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './target-repo'],
      description: 'Acceso limitado al workspace del repositorio.',
    };
  }
  if (blueprint.environments.target !== 'production' && capabilities.includes('run-tests')) {
    servers['bash-terminal'] = {
      command: 'npx',
      args: ['-y', 'mcp-server-bash'],
      description: 'Sólo para comandos de build/test allowlisted dentro de un sandbox.',
    };
  }
  return { mcpServers: servers };
}

function buildWhy(blueprint: AgentBlueprint): string {
  const technologies = blueprint.project.technologies.map(describeCatalogSelection).join(', ');
  const recommendations = blueprint.recommendations.length === 0
    ? '- No se activaron recomendaciones adicionales.'
    : blueprint.recommendations.map(item => `- **${item.title}:** ${item.reason}\n  - Beneficios: ${item.benefits.join('; ')}\n  - Trade-offs: ${item.tradeoffs.join('; ')}\n  - Alternativas: ${item.alternatives.join('; ')}`).join('\n');
  return `# Por qué se generó este agente

## Problema y éxito

- **Objetivo:** ${blueprint.purpose.objective}
- **Criterio de éxito:** ${blueprint.purpose.successCriteria}
- **Tipo:** ${blueprint.purpose.type}

## Contexto técnico

- **Stack:** ${technologies}
- **Arquitectura:** ${describeCatalogSelection(blueprint.project.architecture)}
- **Entorno:** ${blueprint.environments.target}
- **Destino de producción:** ${blueprint.environments.deploymentTarget ? describeCatalogSelection(blueprint.environments.deploymentTarget) : 'No aplica'}
- **CI/CD:** ${describeCatalogSelection(blueprint.devops.ciCd)}

## Decisiones de seguridad

El agente opera en modo **${blueprint.agent.autonomy}**. ${blueprint.agent.requireHumanApproval ? 'Las acciones con efectos requieren aprobación humana.' : 'El alcance generado es asesor y sin acciones con efectos.'} Los secretos sólo se expresan como referencias de variables de entorno.

## Conocimiento y artefactos

${blueprint.knowledge.enabled ? `Se solicitó contexto mediante: ${blueprint.knowledge.sources.map(describeCatalogSelection).join(', ')}.` : 'No se habilitó RAG; el contexto estable permanece en steering y documentación.'}
${blueprint.prReview.enabled ? `Se genera una rúbrica de PR enfocada en ${blueprint.prReview.focus.join(', ')}.` : 'No se genera automatización de PR review.'}
${blueprint.features.kiro ? 'Se generan steering, hooks/skills aplicables bajo `.kiro/`.' : 'No se generan archivos `.kiro/` porque Kiro no fue seleccionado.'}

## Recomendaciones explicables

${recommendations}
`;
}

function buildInstall(blueprint: AgentBlueprint): string {
  const production = blueprint.environments.target === 'production' || blueprint.environments.target === 'both';
  return `# Instalación del agente ${blueprint.identity.name}

> Este bundle es un **preview**: Huascar no escribió archivos ni ejecutó herramientas. Revisa cada contenido antes de copiarlo.

## 1. Copiar los artefactos

Copia únicamente los archivos del target que utilizarás. Conserva las rutas relativas del manifest.

## 2. Configurar secretos

- Crea las variables mencionadas como \`\${NOMBRE}\` en el gestor de secretos del entorno.
- Nunca reemplaces referencias por valores dentro del repositorio.
- Usa identidades y tokens de mínimo privilegio.

## 3. Validar localmente

1. Revisa \`huascar.blueprint.json\` y \`docs/WHY.md\`.
2. Ajusta rutas RAG al workspace permitido.
3. Fija versiones exactas de servidores MCP.
4. Ejecuta lint, tests y una prueba en modo asesor.
5. Verifica que herramientas no seleccionadas permanezcan deshabilitadas.

${production ? `## 4. Paso a producción

- Despliega primero en staging.
- Configura logs, métricas, trazas y alertas.
- Verifica backup, rollback y límites de costo.
- Ejecuta con identidad separada del usuario administrador.
- Mantén deploy y operación detrás de aprobación humana.
` : `## 4. Uso en desarrollo

- Limita filesystem al repositorio destino.
- Allowlista comandos de build/test.
- Revisa los parches antes de aplicarlos o hacer commit.
`}
`;
}

function buildAgentsMd(blueprint: AgentBlueprint): string {
  return `# AGENTS.md

## Misión

${blueprint.purpose.objective}

## Criterio de éxito

${blueprint.purpose.successCriteria}

## Stack y arquitectura

- Arquitectura: ${describeCatalogSelection(blueprint.project.architecture)}
- Tecnologías: ${blueprint.project.technologies.map(describeCatalogSelection).join(', ')}

## Forma de trabajar

1. Lee la documentación y convenciones antes de proponer cambios.
2. Mantén los límites de la arquitectura existente.
3. Realiza cambios pequeños, reversibles y acompañados de pruebas.
4. Explica evidencia, riesgos y trade-offs.
5. No incluyas secretos, credenciales o datos sensibles.
6. No hagas merge, deploy ni acciones de producción sin aprobación explícita.

## Verificación

Antes de finalizar, ejecuta únicamente los comandos de lint, test y build permitidos por el proyecto y documenta cualquier validación que no pueda realizarse.
`;
}

function buildSkill(blueprint: AgentBlueprint): string {
  return `---
name: ${blueprint.identity.slug}
description: ${JSON.stringify(blueprint.identity.description.replace(/\n/g, ' '))}
---

# ${blueprint.identity.name}

## Cuándo usar esta skill

Úsala cuando el objetivo sea: ${blueprint.purpose.objective}

## Procedimiento

1. Confirma alcance, entradas y criterio de éxito.
2. Reúne contexto sólo desde fuentes aprobadas.
3. Analiza el proyecto según ${describeCatalogSelection(blueprint.project.architecture)}.
4. Propón el cambio o informe mínimo que resuelva el objetivo.
5. Valida con pruebas y controles de seguridad aplicables.
6. Solicita aprobación antes de cualquier acción con efectos.
7. Entrega evidencia, riesgos, limitaciones y próximos pasos.
`;
}

function buildKiroHook(blueprint: AgentBlueprint): Record<string, unknown> {
  return {
    enabled: true,
    name: `${blueprint.identity.name} quality gate`,
    description: 'Solicita una revisión guiada después de modificar archivos relevantes.',
    version: '1',
    when: { type: 'fileEdited', patterns: ['**/*'] },
    then: {
      type: 'askAgent',
      prompt: `Aplica la skill ${blueprint.identity.slug}, valida el criterio de éxito y no ejecutes acciones con efectos sin aprobación.`,
    },
  };
}

function buildPrReview(blueprint: AgentBlueprint): Record<string, unknown> {
  return {
    enabled: true,
    provider: blueprint.project.repositoryProvider,
    trigger: 'pull_request',
    focus: blueprint.prReview.focus,
    output: {
      format: 'markdown',
      includeEvidence: true,
      severities: ['critical', 'high', 'medium', 'low', 'info'],
      deduplicateFindings: true,
    },
    permissions: {
      readRepository: true,
      comment: blueprint.agent.capabilities.includes('review-pr'),
      merge: false,
    },
    requireHumanApproval: true,
  };
}

function buildApplicationGuide(blueprint: AgentBlueprint): GeneratedAgentBundle['applicationGuide'] {
  const production = blueprint.environments.target === 'production' || blueprint.environments.target === 'both';
  const steps = [
    'Descarga o copia los artefactos respetando las rutas del manifest.',
    'Revisa huascar.blueprint.json y docs/WHY.md con el equipo responsable.',
    'Configura referencias de secretos e integraciones con mínimo privilegio.',
    'Valida el agente en modo asesor con un repositorio o entorno de prueba.',
    'Activa únicamente las capacidades verificadas y documenta cualquier override.',
  ];
  const productionChecklist = production ? [
    'Usar una identidad de workload separada y sin credenciales personales.',
    'Probar en staging, configurar observabilidad y verificar alertas.',
    'Definir timeout, rate limit, presupuesto, backup y rollback.',
    'Exigir aprobación humana para deploy y acciones operacionales.',
    'Registrar auditoría de entradas, decisiones y herramientas invocadas.',
  ] : [];
  return {
    summary: `Aplicación guiada de ${blueprint.identity.name} para ${blueprint.environments.target}.`,
    steps,
    productionChecklist,
  };
}

export function generateAgentBundle(input: unknown): GeneratedAgentBundle {
  const evaluation = evaluateDecisionTree(input);
  const blueprint = buildBlueprint(evaluation.answers);
  const artifacts: GeneratedArtifact[] = [];
  const paths = new Set<string>();
  const add = (artifact: GeneratedArtifact) => {
    if (paths.has(artifact.path)) throw new CreatorInputError('Ruta de artefacto duplicada.', [{ path: artifact.path, message: 'Cada archivo debe ser único.' }], 422);
    paths.add(artifact.path);
    artifacts.push(artifact);
  };

  add(jsonArtifact('huascar.blueprint.json', 'configuration', 'Blueprint canónico con todas las decisiones del agente.', blueprint));
  add(markdownArtifact('docs/INSTALL.md', 'documentation', 'Tutorial para aplicar el bundle de forma segura.', buildInstall(blueprint)));
  add(markdownArtifact('docs/WHY.md', 'documentation', 'Explicación de decisiones, recomendaciones y trade-offs.', buildWhy(blueprint)));

  if (blueprint.features.agentsMd) add(markdownArtifact('AGENTS.md', 'instruction', 'Instrucciones portables para agentes que trabajen en el repositorio.', buildAgentsMd(blueprint)));
  if (blueprint.features.skills) add(markdownArtifact(`skills/${blueprint.identity.slug}/SKILL.md`, 'instruction', 'Skill portable con el procedimiento principal.', buildSkill(blueprint)));

  if (blueprint.agent.targets.includes('huascar')) {
    const roleKey = blueprint.identity.slug.replace(/-/g, '_').toUpperCase();
    add(jsonArtifact('huascar/steering.json', 'configuration', 'Rol y steering consumible por HuascarEngine.', {
      roles: {
        [roleKey]: {
          name: blueprint.identity.name,
          system_prompt: buildSystemPrompt(blueprint),
          temperature: 0.2,
        },
      },
    }));
    add(jsonArtifact('huascar/security-policy.json', 'configuration', 'Política compatible con el hook runtime actual.', {
      blocked_tool_patterns: ['shell', 'sudo'],
      blocked_args_substrings: {
        execute_bash: ['rm -rf', 'git push --force', 'drop table', 'mkfs', 'dd if='],
      },
    }));
    add(jsonArtifact('huascar/governance.json', 'configuration', 'Capacidades y aprobaciones que debe aplicar un adaptador de runtime antes de ejecutar.', {
      enforcement: 'runtime-adapter-required',
      autonomy: blueprint.agent.autonomy,
      require_human_approval: blueprint.agent.requireHumanApproval,
      allowed_capabilities: blueprint.agent.capabilities,
      production: blueprint.environments.target !== 'development',
      notes: 'Este archivo documenta intención. HuascarEngine aún no lo consume automáticamente.',
    }));
    add(jsonArtifact('huascar/mcps.json', 'configuration', 'Servidores MCP sugeridos según entorno y capacidades.', buildMcpConfig(blueprint)));
    if (blueprint.knowledge.enabled) add(jsonArtifact('huascar/rag.json', 'configuration', 'Fuentes RAG declaradas; deben revisarse antes de cargarlas.', { knowledge_bases: mapRagSources(blueprint.knowledge.sources) }));
    if (blueprint.prReview.enabled) add(jsonArtifact('huascar/pr-review.json', 'configuration', 'Rúbrica y permisos para revisión de pull requests.', buildPrReview(blueprint)));
  }

  if (blueprint.features.kiro) {
    add(markdownArtifact(`.kiro/steering/${blueprint.identity.slug}.md`, 'instruction', 'Steering del proyecto para Kiro.', `# ${blueprint.identity.name}\n\n${buildSystemPrompt(blueprint)}\n`));
    if (blueprint.features.skills) add(markdownArtifact(`.kiro/skills/${blueprint.identity.slug}/SKILL.md`, 'instruction', 'Skill de Kiro para el procedimiento generado.', buildSkill(blueprint)));
    if (blueprint.features.hooks) add(jsonArtifact(`.kiro/hooks/${blueprint.identity.slug}-quality.json`, 'configuration', 'Hook Kiro revisable para quality gate.', buildKiroHook(blueprint)));
  }

  const applicationGuide = buildApplicationGuide(blueprint);
  const warnings = [...evaluation.warnings];
  if (blueprint.agent.targets.includes('huascar')) warnings.push('Fija versiones exactas de los paquetes MCP antes de usar el bundle fuera de una demo.');
  if (blueprint.environments.target !== 'development') warnings.push('El preview no despliega el agente: producción requiere staging, identidad separada, observabilidad y rollback verificados.');
  if (artifacts.length > 40 || artifacts.reduce((sum, artifact) => sum + artifact.content.length, 0) > 256_000) {
    throw new CreatorInputError('El bundle supera los límites seguros de preview.', [{ path: 'artifacts', message: 'Máximo 40 archivos y 256 KB de contenido.' }], 422);
  }

  const manifest = {
    agent: blueprint.identity.slug,
    artifactCount: artifacts.length + 1,
    targets: blueprint.agent.targets,
    files: artifacts.map(artifact => ({ path: artifact.path, sha256: artifact.sha256, kind: artifact.kind })),
  };
  add(jsonArtifact('manifest.json', 'manifest', 'Índice verificable de los archivos generados.', manifest));

  return {
    generatorVersion: GENERATOR_VERSION,
    blueprint,
    artifacts,
    manifest,
    applicationGuide,
    warnings,
  };
}
