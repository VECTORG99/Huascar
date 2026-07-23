import express from 'express';
import { CATALOG_VERSION, getCreatorCatalog } from './catalog.js';
import { CreatorInputError } from './domain.js';
import { creatorTutorial, evaluateDecisionTree, getWorkflowDefinition, WORKFLOW_VERSION } from './decisionTree.js';
import { generateAgentBundle } from './generator.js';

interface CreatorRequestBody {
  answers?: unknown;
  workflowVersion?: unknown;
  catalogVersion?: unknown;
}

export const creatorPublicRouter = express.Router();
export const creatorProtectedRouter = express.Router();

function parseBody(body: unknown): CreatorRequestBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new CreatorInputError('El body debe ser un objeto JSON.', [{ path: 'body', message: 'Se esperaba un objeto.' }]);
  }
  const value = body as Record<string, unknown>;
  const allowed = new Set(['answers', 'workflowVersion', 'catalogVersion']);
  const unknownKeys = Object.keys(value).filter(key => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new CreatorInputError('El body contiene propiedades desconocidas.', unknownKeys.map(key => ({ path: `body.${key}`, message: 'Propiedad no permitida.' })));
  }
  return value;
}

function assertVersions(body: CreatorRequestBody): void {
  if (body.workflowVersion !== undefined && body.workflowVersion !== WORKFLOW_VERSION) {
    throw new CreatorInputError('La versión del workflow cambió; vuelve a cargar el flujo.', [{ path: 'workflowVersion', message: `Versión esperada: ${WORKFLOW_VERSION}.` }], 409);
  }
  if (body.catalogVersion !== undefined && body.catalogVersion !== CATALOG_VERSION) {
    throw new CreatorInputError('La versión del catálogo cambió; vuelve a cargar las opciones.', [{ path: 'catalogVersion', message: `Versión esperada: ${CATALOG_VERSION}.` }], 409);
  }
}

function versionHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  res.set('X-Creator-Workflow-Version', WORKFLOW_VERSION);
  res.set('X-Creator-Catalog-Version', CATALOG_VERSION);
  next();
}

creatorPublicRouter.use(versionHeaders);
creatorProtectedRouter.use(versionHeaders);

creatorPublicRouter.get('/catalog', (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const environment = typeof req.query.environment === 'string' ? req.query.environment : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getCreatorCatalog({ category, environment, q }));
});

creatorPublicRouter.get('/workflow', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getWorkflowDefinition());
});

creatorPublicRouter.get('/tutorial', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(creatorTutorial);
});

creatorProtectedRouter.post('/evaluate', (req, res, next) => {
  try {
    const body = parseBody(req.body);
    assertVersions(body);
    res.json(evaluateDecisionTree(body.answers));
  } catch (error: unknown) {
    next(error);
  }
});

function previewHandler(req: express.Request, res: express.Response, next: express.NextFunction): void {
  try {
    const body = parseBody(req.body);
    assertVersions(body);
    res.json(generateAgentBundle(body.answers));
  } catch (error: unknown) {
    next(error);
  }
}

creatorProtectedRouter.post('/preview', previewHandler);
creatorProtectedRouter.post('/generate', previewHandler);
