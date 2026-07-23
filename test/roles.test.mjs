import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';

describe('roles route', () => {
  it('returns available roles from steering config', async () => {
    const { readRoles, rolesRouter } = await import(`../src/routes/roles.js?case=${Date.now()}`);
    const roles = () => readRoles(() => JSON.stringify({
      roles: {
        PR_REVIEWER: {
          name: 'Senior Code Reviewer',
          description: 'Reviews code changes',
          recommended_tools: ['git diff'],
          examples: ['Review a pull request'],
          system_prompt: 'hidden',
          temperature: 0.2,
        },
        SCAFFOLDER: {
          name: 'Scaffold Architect',
          description: 'Creates scaffolding',
          recommended_tools: ['templates'],
          examples: ['Create a route skeleton'],
          system_prompt: 'hidden',
          temperature: 0.4,
        },
      },
    }));

    const app = express().use('/api', rolesRouter(roles));
    const server = app.listen(0);
    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/roles`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { roles: [
        {
          id: 'PR_REVIEWER',
          name: 'Senior Code Reviewer',
          description: 'Reviews code changes',
          recommended_tools: ['git diff'],
          examples: ['Review a pull request'],
          temperature: 0.2,
        },
        {
          id: 'SCAFFOLDER',
          name: 'Scaffold Architect',
          description: 'Creates scaffolding',
          recommended_tools: ['templates'],
          examples: ['Create a route skeleton'],
          temperature: 0.4,
        },
      ] });
      assert.equal(JSON.stringify(body).includes('system_prompt'), false);
    } finally {
      server.close();
    }
  });
});
