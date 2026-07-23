import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3001';

test.describe('API Health Smoke Tests', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/v1/creator/catalog returns catalog', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/creator/catalog`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.version).toBeDefined();
    expect(body.categories).toBeDefined();
  });

  test('GET /api/v1/creator/workflow returns workflow', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/creator/workflow`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.version).toBeDefined();
    expect(body.questions).toBeDefined();
  });

  test('GET /api/v1/creator/tutorial returns tutorial', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/creator/tutorial`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.skippable).toBe(true);
  });

  test('POST /api/v1/creator/evaluate handles valid input', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/creator/evaluate`, {
      data: {
        workflowVersion: '1.0.0',
        catalogVersion: '1.0.0',
        answers: {
          agent_name: 'Test Agent',
          purpose: 'development',
        },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.progress).toBeDefined();
  });

  test('POST /api/v1/creator/evaluate rejects invalid body', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/creator/evaluate`, {
      data: 'not-json',
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
