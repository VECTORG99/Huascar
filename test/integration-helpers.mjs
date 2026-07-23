/**
 * Integration test helpers and property-based test utilities.
 * 
 * Usage:
 *   import { httpClient, randomString, checkProperty } from './integration-helpers.mjs';
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

/**
 * Simple HTTP client for integration tests.
 */
export async function httpClient(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: Object.fromEntries(res.headers) };
}

/**
 * Generate random strings for property-based testing.
 */
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Simple property-based test runner.
 * Generates N random inputs and checks that a property holds for all.
 */
export function checkProperty(name, generator, property, iterations = 100) {
  for (let i = 0; i < iterations; i++) {
    const input = generator();
    const result = property(input);
    if (!result) {
      throw new Error(`Property "${name}" violated for input: ${JSON.stringify(input)} (iteration ${i})`);
    }
  }
}
