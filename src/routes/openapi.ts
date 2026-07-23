import { Router } from 'express';

const json = { type: 'object', additionalProperties: true };

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Huascar API',
    version: '0.1.0',
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Backend health check',
        responses: { '200': { description: 'Service status', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/metrics': {
      get: {
        summary: 'Runtime request metrics',
        parameters: [{ name: 'x-metrics-token', in: 'header', required: false, schema: { type: 'string' } }],
        responses: { '200': { description: 'Metrics snapshot', content: { 'application/json': { schema: json } } }, '401': { description: 'Invalid metrics token' } },
      },
    },
    '/api/openapi.json': {
      get: {
        summary: 'OpenAPI 3.1 document',
        responses: { '200': { description: 'OpenAPI document', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/history': {
      get: {
        summary: 'Execution history',
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Execution records', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/roles': {
      get: {
        summary: 'Configured steering roles',
        responses: { '200': { description: 'Role list', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/agent/execute': {
      post: {
        summary: 'Execute an agent task',
        requestBody: { required: true, content: { 'application/json': { schema: json } } },
        responses: { '200': { description: 'Agent execution result', content: { 'application/json': { schema: json } } }, '400': { description: 'Invalid task or role' } },
      },
    },
    '/api/agent/execute/stream': {
      post: {
        summary: 'Execute an agent task with Server-Sent Events',
        requestBody: { required: true, content: { 'application/json': { schema: json } } },
        responses: { '200': { description: 'SSE events: start, complete, error', content: { 'text/event-stream': { schema: { type: 'string' } } } }, '400': { description: 'Invalid task or role' } },
      },
    },
    '/api/agents': {
      get: { summary: 'List registered agents', responses: { '200': { description: 'Registered agent summaries', content: { 'application/json': { schema: json } } } } },
      post: { summary: 'Create registered agent', requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '201': { description: 'Registered agent', content: { 'application/json': { schema: json } } }, '400': { description: 'Invalid agent config' } } },
    },
    '/api/agents/{id}': {
      get: { summary: 'Get registered agent', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Registered agent', content: { 'application/json': { schema: json } } }, '404': { description: 'Agent not found' } } },
      put: { summary: 'Update registered agent', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '200': { description: 'Registered agent', content: { 'application/json': { schema: json } } }, '400': { description: 'Invalid agent config' }, '404': { description: 'Agent not found' } } },
      delete: { summary: 'Delete registered agent', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Deletion result', content: { 'application/json': { schema: json } } } } },
    },
    '/api/agents/{id}/execute': {
      post: { summary: 'Execute a registered agent', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '200': { description: 'Agent execution result', content: { 'application/json': { schema: json } } }, '400': { description: 'Invalid execution payload' }, '404': { description: 'Agent not found' } } },
    },
    '/api/hooks/commit-approval': {
      post: {
        summary: 'Create a commit approval request',
        requestBody: { required: false, content: { 'application/json': { schema: json } } },
        responses: { '200': { description: 'Pending approval id', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/hooks/commit-approval/{id}': {
      get: {
        summary: 'Read a commit approval request',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Approval state', content: { 'application/json': { schema: json } } }, '404': { description: 'Approval request not found' } },
      },
      post: {
        summary: 'Resolve a commit approval request',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: json } } },
        responses: { '200': { description: 'Updated approval state', content: { 'application/json': { schema: json } } }, '400': { description: 'Invalid approval payload' }, '404': { description: 'Approval request not found' } },
      },
    },
    '/api/rag/sources': {
      get: {
        summary: 'List indexed RAG sources',
        responses: { '200': { description: 'RAG source list', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/rag/sources/{source}': {
      delete: {
        summary: 'Delete RAG chunks by source',
        parameters: [{ name: 'source', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Deletion result', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/v1/creator/catalog': {
      get: {
        summary: 'Creator catalog',
        parameters: [
          { name: 'category', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'environment', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'q', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Catalog options', content: { 'application/json': { schema: json } } } },
      },
    },
    '/api/v1/creator/workflow': {
      get: { summary: 'Creator workflow definition', responses: { '200': { description: 'Workflow definition', content: { 'application/json': { schema: json } } } } },
    },
    '/api/v1/creator/tutorial': {
      get: { summary: 'Creator tutorial', responses: { '200': { description: 'Tutorial content', content: { 'application/json': { schema: json } } } } },
    },
    '/api/v1/creator/evaluate': {
      post: { summary: 'Evaluate creator answers', requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '200': { description: 'Evaluation result', content: { 'application/json': { schema: json } } } } },
    },
    '/api/v1/creator/preview': {
      post: { summary: 'Preview generated agent bundle', requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '200': { description: 'Generated bundle preview', content: { 'application/json': { schema: json } } } } },
    },
    '/api/v1/creator/generate': {
      post: { summary: 'Generate agent bundle', requestBody: { required: true, content: { 'application/json': { schema: json } } }, responses: { '200': { description: 'Generated bundle', content: { 'application/json': { schema: json } } } } },
    },
  },
} as const;

export const openApiRouter = Router();

openApiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
