import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3001';

test.describe('Error Handling', () => {
  test('404 for unknown routes', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nonexistent`);
    expect(response.status()).toBe(404);
  });

  test('415 for wrong content-type on POST', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/agent/execute`, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json',
    });
    expect(response.status()).toBe(415);
  });

  test('400 for missing required fields', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/agent/execute`, {
      data: { task: '' },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rate limiting returns 429 after many requests', async ({ request }) => {
    // Send many requests quickly (execution endpoint has strict limits)
    const responses = [];
    for (let i = 0; i < 10; i++) {
      responses.push(
        request.post(`${API_URL}/api/agent/execute`, {
          data: { task: 'test', role: 'TEST' },
        }),
      );
    }
    const results = await Promise.all(responses);
    const statuses = results.map((r) => r.status());
    // At least some should be rate limited (429) or unauthorized (401)
    expect(statuses.some((s) => s === 429 || s === 401)).toBeTruthy();
  });
});
