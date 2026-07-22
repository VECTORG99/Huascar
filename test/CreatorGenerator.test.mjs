import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateAgentBundle } from '../src/creator/generator.js';
import { CreatorInputError } from '../src/creator/domain.js';
import { developmentAnswers, productionAnswers } from './creatorFixture.mjs';

describe('Creator generator', () => {
  it('generates Huascar, Kiro, portable, RAG, PR and skill artifacts when applicable', () => {
    const bundle = generateAgentBundle(developmentAnswers);
    const paths = bundle.artifacts.map(artifact => artifact.path);
    for (const expected of [
      'huascar.blueprint.json',
      'manifest.json',
      'docs/INSTALL.md',
      'docs/WHY.md',
      'AGENTS.md',
      'huascar/steering.json',
      'huascar/security-policy.json',
      'huascar/mcps.json',
      'huascar/rag.json',
      'huascar/pr-review.json',
      '.kiro/steering/frontend-quality-guardian.md',
      '.kiro/hooks/frontend-quality-guardian-quality.json',
      '.kiro/skills/frontend-quality-guardian/SKILL.md',
      'skills/frontend-quality-guardian/SKILL.md',
    ]) assert.ok(paths.includes(expected), `missing ${expected}`);
    assert.equal(bundle.blueprint.prReview.enabled, true);
    assert.equal(bundle.manifest.artifactCount, bundle.artifacts.length);
    assert.ok(bundle.artifacts.every(artifact => /^[a-f0-9]{64}$/.test(artifact.sha256)));
  });

  it('is deterministic for identical answers', () => {
    const first = generateAgentBundle(developmentAnswers);
    const second = generateAgentBundle(structuredClone(developmentAnswers));
    assert.deepEqual(first, second);
  });

  it('generates production guidance without Kiro or PR artifacts when omitted', () => {
    const bundle = generateAgentBundle(productionAnswers);
    const paths = bundle.artifacts.map(artifact => artifact.path);
    assert.ok(bundle.applicationGuide.productionChecklist.length >= 4);
    assert.ok(paths.includes('huascar/steering.json'));
    assert.ok(paths.includes('huascar/governance.json'));
    assert.ok(!paths.some(path => path.startsWith('.kiro/')));
    assert.ok(!paths.includes('huascar/pr-review.json'));
    assert.deepEqual(bundle.blueprint.environments.containerPlatforms, ['docker']);
    assert.deepEqual(bundle.blueprint.devops.infrastructure, ['terraform', 'ansible']);
    assert.ok(bundle.warnings.some(message => message.includes('producción')));

    const policy = JSON.parse(bundle.artifacts.find(file => file.path === 'huascar/security-policy.json').content);
    assert.deepEqual(Object.keys(policy).sort(), ['blocked_args_substrings', 'blocked_tool_patterns']);
  });

  it('quotes YAML frontmatter descriptions containing colons', () => {
    const bundle = generateAgentBundle({ ...developmentAnswers, objective: 'Revisar cambios: explicar riesgos y correcciones.' });
    const skill = bundle.artifacts.find(file => file.path === 'skills/frontend-quality-guardian/SKILL.md');
    const description = skill.content.split('\n').find(line => line.startsWith('description: '));
    assert.equal(JSON.parse(description.slice('description: '.length)), 'Revisar cambios: explicar riesgos y correcciones.');
  });

  it('rejects an incomplete decision tree with 422 semantics', () => {
    assert.throws(
      () => generateAgentBundle({ agent_name: 'Incomplete' }),
      error => error instanceof CreatorInputError && error.statusCode === 422 && error.issues.length > 0,
    );
  });

  it('rejects literal secrets supplied in free text', () => {
    const answers = { ...developmentAnswers, objective: `Usar token ${'ghp_' + 'A'.repeat(30)} para revisar cambios.` };
    assert.throws(
      () => generateAgentBundle(answers),
      error => error instanceof CreatorInputError && error.statusCode === 422 && error.message.includes('secreto'),
    );
  });
});
