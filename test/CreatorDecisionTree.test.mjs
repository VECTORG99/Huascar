import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCreatorCatalog } from '../src/creator/catalog.js';
import { evaluateDecisionTree, getWorkflowDefinition } from '../src/creator/decisionTree.js';
import { developmentAnswers, productionAnswers } from './creatorFixture.mjs';

describe('Creator decision tree', () => {
  it('exposes a broad, versioned and searchable catalog', () => {
    const catalog = getCreatorCatalog();
    assert.equal(catalog.version, '1.0.0');
    assert.ok(catalog.categories.length >= 15);
    assert.ok(catalog.items.length >= 80);
    assert.ok(getCreatorCatalog({ q: 'kubernetes' }).items.some(item => item.id === 'kubernetes'));
    assert.ok(getCreatorCatalog({ category: 'cloud' }).items.every(item => item.category === 'cloud'));
  });

  it('starts with the identity question and reports progress', () => {
    const evaluation = evaluateDecisionTree({});
    assert.equal(evaluation.nextQuestion?.id, 'agent_name');
    assert.equal(evaluation.progress.answered, 0);
    assert.equal(evaluation.progress.complete, false);
  });

  it('uses different branches for development and production', () => {
    const development = evaluateDecisionTree(developmentAnswers);
    const production = evaluateDecisionTree(productionAnswers);
    assert.equal(development.progress.complete, true);
    assert.equal(production.progress.complete, true);
    assert.ok(development.visibleQuestions.some(question => question.id === 'development_setup'));
    assert.ok(!development.visibleQuestions.some(question => question.id === 'deployment_target'));
    assert.ok(production.visibleQuestions.some(question => question.id === 'deployment_target'));
    assert.ok(!production.visibleQuestions.some(question => question.id === 'development_setup'));
  });

  it('produces explainable recommendations from architecture and environment', () => {
    const evaluation = evaluateDecisionTree(productionAnswers);
    const ids = evaluation.recommendations.map(item => item.id);
    assert.ok(ids.includes('production-guardrails'));
    assert.ok(ids.includes('aws-ec2-baseline'));
    assert.ok(ids.includes('microservices-observability'));
    assert.ok(ids.includes('sqlite-production'));
    for (const item of evaluation.recommendations) {
      assert.ok(item.reason.length > 0);
      assert.ok(item.evidence.length > 0);
      assert.ok(item.benefits.length > 0);
      assert.ok(item.tradeoffs.length > 0);
      assert.ok(item.alternatives.length > 0);
    }
  });

  it('accepts custom stack IDs but documents them as unverified', () => {
    const answers = { ...developmentAnswers, technologies: [...developmentAnswers.technologies, 'custom:internal-runtime'] };
    const evaluation = evaluateDecisionTree(answers);
    assert.equal(evaluation.progress.complete, true);
    assert.ok(evaluation.warnings.some(message => message.includes('custom:internal-runtime')));
  });

  it('rejects malformed custom slugs', () => {
    const answers = { ...developmentAnswers, technologies: [...developmentAnswers.technologies, 'custom:not a slug/../x'] };
    const evaluation = evaluateDecisionTree(answers);
    assert.equal(evaluation.progress.complete, false);
    assert.ok(evaluation.issues.some(issue => issue.path === 'answers.technologies'));
  });

  it('discards answers and recommendations from branches that became hidden', () => {
    const changed = {
      ...productionAnswers,
      environment: 'development',
      development_setup: 'local',
      autonomy: 'advisory',
      capabilities: ['read-repository'],
    };
    const evaluation = evaluateDecisionTree(changed);
    assert.equal(evaluation.progress.complete, true);
    assert.equal(evaluation.answers.deployment_target, undefined);
    assert.equal(evaluation.answers.observability, undefined);
    assert.ok(!evaluation.recommendations.some(item => item.id === 'aws-ec2-baseline'));
    assert.ok(evaluation.warnings.some(message => message.includes('ramas no visibles')));
  });

  it('returns field-level issues for invalid answers', () => {
    const evaluation = evaluateDecisionTree({ ...developmentAnswers, technologies: ['not-in-catalog'] });
    assert.equal(evaluation.progress.complete, false);
    assert.ok(evaluation.issues.some(issue => issue.path === 'answers.technologies'));
  });

  it('publishes a stateless workflow contract', () => {
    const workflow = getWorkflowDefinition();
    assert.equal(workflow.mode, 'stateless');
    assert.equal(workflow.id, 'agent-builder');
    assert.ok(workflow.questions.length >= 20);
  });
});
