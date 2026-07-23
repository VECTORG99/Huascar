import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromptTemplate } from '../src/engine/PromptTemplate.ts';

describe('PromptTemplate (#77)', () => {
  it('interpolates variables', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('Hello {{name}}, you are a {{role}}.', { name: 'Agent', role: 'reviewer' });
    assert.equal(result, 'Hello Agent, you are a reviewer.');
  });

  it('interpolates built-in variables', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('Today is {{date}}');
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(result, `Today is ${today}`);
  });

  it('handles conditionals - truthy', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('{{#if has_rag}}RAG is active{{/if}}', { has_rag: true });
    assert.equal(result, 'RAG is active');
  });

  it('handles conditionals - falsy', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('Start {{#if has_rag}}RAG is active{{/if}} End', { has_rag: false });
    assert.equal(result, 'Start  End');
  });

  it('handles partials', () => {
    const tmpl = new PromptTemplate();
    tmpl.registerPartial('safety', 'SAFETY: Do not delete files.');
    const result = tmpl.render('{{> safety}}\nTask: {{task}}', { task: 'review' });
    assert.equal(result, 'SAFETY: Do not delete files.\nTask: review');
  });

  it('handles missing partials gracefully', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('Start {{> nonexistent}} End');
    assert.equal(result, 'Start  End');
  });

  it('handles missing variables gracefully', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.render('Hello {{name}}!', {});
    assert.equal(result, 'Hello !');
  });

  it('selectVersion uses active version', () => {
    const tmpl = new PromptTemplate();
    const version = tmpl.selectVersion({
      versions: [
        { id: 'v1', template: 'Version 1' },
        { id: 'v2', template: 'Version 2' },
      ],
      activeVersion: 'v2',
    });
    assert.equal(version.id, 'v2');
  });

  it('selectVersion falls back to first version', () => {
    const tmpl = new PromptTemplate();
    const version = tmpl.selectVersion({
      versions: [{ id: 'v1', template: 'Version 1' }],
    });
    assert.equal(version.id, 'v1');
  });

  it('renderRole combines version selection and rendering', () => {
    const tmpl = new PromptTemplate();
    const result = tmpl.renderRole(
      {
        versions: [{ id: 'v1', template: 'Role: {{role_name}}' }],
        activeVersion: 'v1',
      },
      { role_name: 'reviewer' },
    );
    assert.equal(result.text, 'Role: reviewer');
    assert.equal(result.versionUsed, 'v1');
  });

  it('lists and removes partials', () => {
    const tmpl = new PromptTemplate();
    tmpl.registerPartial('a', 'content a');
    tmpl.registerPartial('b', 'content b');
    assert.deepEqual(tmpl.getPartials().sort(), ['a', 'b']);
    tmpl.removePartial('a');
    assert.deepEqual(tmpl.getPartials(), ['b']);
  });
});
