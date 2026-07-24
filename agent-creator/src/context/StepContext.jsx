import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaluateCreator, loadCreatorDefinition, previewCreator } from '../api/creatorApi';
import { StepContext } from './stepContextValue';

const STORAGE_KEY = 'huascar_creator_answers_v1';
const CURSOR_STORAGE_KEY = 'huascar_creator_cursor_v1';
const NAVIGATION_STORAGE_KEY = 'huascar_creator_navigation_v1';

/**
 * Patterns that indicate sensitive values that should not be stored in sessionStorage (#254).
 */
const SENSITIVE_PATTERNS = [
  /^sk-/i, // OpenAI keys
  /^ghp_/i, // GitHub tokens
  /^glpat-/i, // GitLab tokens
  /^xox[bpras]-/i, // Slack tokens
  /^AKIA/i, // AWS keys
  /^-----BEGIN/i, // Private keys
  /secret/i, // Generic secrets
  /password/i, // Passwords
  /token/i, // Generic tokens
];

const SENSITIVE_KEYS = new Set([
  'api_key',
  'api_keys',
  'secret',
  'secrets',
  'token',
  'tokens',
  'password',
  'private_key',
  'credentials',
]);

/**
 * Redact values that look like secrets/API keys before storing in sessionStorage (#254).
 */
function redactSensitiveAnswers(answers) {
  const redacted = {};
  for (const [key, value] of Object.entries(answers)) {
    if (SENSITIVE_KEYS.has(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && SENSITIVE_PATTERNS.some((p) => p.test(value))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function loadSavedAnswers() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function hasStoredAnswer(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function hasAnswer(question, value) {
  if (value === undefined || value === null) return !question?.required;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0 || !question?.required;
  return false;
}

export function StepProvider({ children }) {
  const [phase, setPhase] = useState('loading');
  const [catalog, setCatalog] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [tutorial, setTutorial] = useState(null);
  const [tutorialIndex, setTutorialIndex] = useState(0);
  const [answers, setAnswers] = useState(loadSavedAnswers);
  const [evaluation, setEvaluation] = useState(null);
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const versions = useMemo(
    () => ({
      workflowVersion: workflow?.version,
      catalogVersion: catalog?.version,
    }),
    [workflow, catalog],
  );

  const runEvaluation = useCallback(
    async (nextAnswers, nextWorkflow = workflow, nextCatalog = catalog) => {
      if (!nextWorkflow || !nextCatalog) return null;
      const result = await evaluateCreator(nextAnswers, {
        workflowVersion: nextWorkflow.version,
        catalogVersion: nextCatalog.version,
      });
      setEvaluation(result);
      setAnswers(result.answers || {});
      return result;
    },
    [workflow, catalog],
  );

  const initialize = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const definition = await loadCreatorDefinition();
      setCatalog(definition.catalog);
      setWorkflow(definition.workflow);
      setTutorial(definition.tutorial);
      const initial = await runEvaluation(answers, definition.workflow, definition.catalog);
      const visibleQuestions = initial?.visibleQuestions || [];
      const savedCursor = sessionStorage.getItem(CURSOR_STORAGE_KEY);
      const savedNavigation = sessionStorage.getItem(NAVIGATION_STORAGE_KEY);
      const savedQuestion = visibleQuestions.find((question) => question.id === savedCursor);
      const resumeQuestion =
        savedQuestion ||
        visibleQuestions.find((question) => !hasStoredAnswer(initial?.answers?.[question.id])) ||
        initial?.nextQuestion ||
        visibleQuestions[0];
      setCurrentQuestionId(resumeQuestion?.id || null);
      const tutorialDone = sessionStorage.getItem('huascar_creator_tutorial_done') === 'true';
      const resumeEditing = savedNavigation === 'questions' && Boolean(savedQuestion);
      setPhase(tutorialDone ? (initial?.progress?.complete && !resumeEditing ? 'review' : 'questions') : 'tutorial');
    } catch (cause) {
      setError(cause.message || 'No se pudo cargar el Creator backend.');
      setPhase('error');
    }
  }, [answers, runEvaluation]);

  useEffect(() => {
    initialize();
    // Initialization intentionally runs once; answers are restored before mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Redact sensitive answers before storing in sessionStorage (#254)
    const safeAnswers = redactSensitiveAnswers(answers);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safeAnswers));
  }, [answers]);

  useEffect(() => {
    if (currentQuestionId) sessionStorage.setItem(CURSOR_STORAGE_KEY, currentQuestionId);
  }, [currentQuestionId]);

  useEffect(() => {
    if (phase === 'questions' || phase === 'review') sessionStorage.setItem(NAVIGATION_STORAGE_KEY, phase);
  }, [phase]);

  const currentQuestion = useMemo(() => {
    const questions = evaluation?.visibleQuestions || workflow?.questions || [];
    return (
      questions.find((question) => question.id === currentQuestionId) ||
      evaluation?.nextQuestion ||
      questions[0] ||
      null
    );
  }, [currentQuestionId, evaluation, workflow]);

  const currentIssue = useMemo(
    () => evaluation?.issues?.find((issue) => issue.path === `answers.${currentQuestion?.id}`),
    [evaluation, currentQuestion],
  );

  const updateAnswer = (questionId, value) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
    setError(null);
  };

  const continueFlow = async () => {
    if (!currentQuestion || !hasAnswer(currentQuestion, answers[currentQuestion.id])) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runEvaluation(answers);
      const issue =
        result?.issues?.find((item) => item.path === `answers.${currentQuestion.id}`) || result?.issues?.[0];
      if (issue) {
        const issueQuestionId = issue.path?.replace('answers.', '');
        if (result.visibleQuestions?.some((question) => question.id === issueQuestionId))
          setCurrentQuestionId(issueQuestionId);
        setError(issue.message);
        return;
      }
      const position = result.visibleQuestions?.findIndex((question) => question.id === currentQuestion.id) ?? -1;
      const nextVisible = position >= 0 ? result.visibleQuestions?.[position + 1] : null;
      if (nextVisible) {
        setCurrentQuestionId(nextVisible.id);
      } else if (result.progress.complete) {
        setPhase('review');
      } else {
        setCurrentQuestionId(result.nextQuestion?.id || currentQuestion.id);
      }
    } catch (cause) {
      setError(cause.message || 'No se pudo evaluar la respuesta.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (phase === 'review') {
      const visible = evaluation?.visibleQuestions || [];
      setCurrentQuestionId(visible.at(-1)?.id || null);
      setPhase('questions');
      return;
    }
    const visible = evaluation?.visibleQuestions || [];
    const index = visible.findIndex((question) => question.id === currentQuestion?.id);
    if (index > 0) setCurrentQuestionId(visible[index - 1].id);
  };

  const goToQuestion = (questionId) => {
    if (evaluation?.visibleQuestions?.some((question) => question.id === questionId)) {
      setCurrentQuestionId(questionId);
      setPhase('questions');
    }
  };

  const skipTutorial = () => {
    sessionStorage.setItem('huascar_creator_tutorial_done', 'true');
    setPhase(evaluation?.progress?.complete ? 'review' : 'questions');
  };

  const continueTutorial = () => {
    if (!tutorial || tutorialIndex >= tutorial.stages.length - 1) {
      skipTutorial();
      return;
    }
    setTutorialIndex((index) => index + 1);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await previewCreator(answers, versions);
      setBundle(result);
      setPhase('complete');
    } catch (cause) {
      setError(
        cause.issues?.map((issue) => issue.message).join(' ') || cause.message || 'No se pudo generar el bundle.',
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await runEvaluation({});
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(CURSOR_STORAGE_KEY);
      sessionStorage.removeItem(NAVIGATION_STORAGE_KEY);
      setBundle(null);
      setTutorialIndex(0);
      setCurrentQuestionId(result?.nextQuestion?.id || null);
      setPhase('questions');
    } catch (cause) {
      setError(cause.message || 'No se pudo reiniciar el Creator.');
      setPhase('complete');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    phase,
    catalog,
    workflow,
    tutorial,
    tutorialIndex,
    answers,
    evaluation,
    currentQuestion,
    currentIssue,
    bundle,
    loading,
    error,
    canContinue: currentQuestion ? hasAnswer(currentQuestion, answers[currentQuestion.id]) : false,
    initialize,
    updateAnswer,
    continueFlow,
    goBack,
    goToQuestion,
    skipTutorial,
    continueTutorial,
    generate,
    reset,
  };

  return <StepContext.Provider value={value}>{children}</StepContext.Provider>;
}
