import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const cases = [
  ['security-policy.json', 'security-policy.schema.json'],
  ['rag.json', 'rag.schema.json'],
  ['mcps.json', 'mcps.schema.json'],
  ['steering.json', 'steering.schema.json'],
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validate(schema, value, at = '$') {
  const errors = [];
  const actual = typeOf(value);

  if (schema.type && actual !== schema.type) return [`${at} expected ${schema.type}, got ${actual}`];
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) errors.push(`${at} below minimum`);
  if (schema.maximum !== undefined && typeof value === 'number' && value > schema.maximum) errors.push(`${at} above maximum`);
  if (schema.type !== 'object' && schema.type !== 'array') return errors;

  if (schema.type === 'array') {
    value.forEach((item, index) => errors.push(...validate(schema.items ?? {}, item, `${at}[${index}]`)));
    return errors;
  }

  for (const key of schema.required ?? []) {
    if (!Object.hasOwn(value, key)) errors.push(`${at}.${key} is required`);
  }

  for (const [key, child] of Object.entries(value)) {
    const childSchema = schema.properties?.[key] ?? (schema.additionalProperties && schema.additionalProperties !== true ? schema.additionalProperties : null);
    if (!childSchema) {
      if (schema.additionalProperties === false) errors.push(`${at}.${key} is not allowed`);
      continue;
    }
    errors.push(...validate(childSchema, child, `${at}.${key}`));
  }

  return errors;
}

describe('Kiro JSON schemas', () => {
  for (const [configFile, schemaFile] of cases) {
    it(`validates src/kiro/${configFile}`, () => {
      const config = readJson(`src/kiro/${configFile}`);
      const schema = readJson(`src/kiro/schemas/${schemaFile}`);
      assert.deepEqual(validate(schema, config), []);
    });
  }
});
