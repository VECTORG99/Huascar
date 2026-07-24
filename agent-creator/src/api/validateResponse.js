/**
 * Runtime type guards for API responses (#288).
 * Validates shape of critical API data before use.
 */

/**
 * Validate that a value is a non-null object.
 */
function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Validate catalog response shape.
 */
export function validateCatalogResponse(data) {
  if (!isObject(data)) return null;
  if (typeof data.version !== 'string') return null;
  if (!isObject(data.categories) && !Array.isArray(data.categories)) return null;
  return data;
}

/**
 * Validate workflow response shape.
 */
export function validateWorkflowResponse(data) {
  if (!isObject(data)) return null;
  if (typeof data.version !== 'string') return null;
  if (!Array.isArray(data.questions)) return null;
  return data;
}

/**
 * Validate tutorial response shape.
 */
export function validateTutorialResponse(data) {
  if (!isObject(data)) return null;
  if (!Array.isArray(data.stages)) return null;
  return data;
}

/**
 * Validate evaluate response shape.
 */
export function validateEvaluateResponse(data) {
  if (!isObject(data)) return null;
  if (!isObject(data.progress)) return null;
  if (typeof data.progress.answered !== 'number') return null;
  if (typeof data.progress.complete !== 'boolean') return null;
  return data;
}

/**
 * Validate preview/generate response shape.
 */
export function validatePreviewResponse(data) {
  if (!isObject(data)) return null;
  if (!isObject(data.blueprint) && data.blueprint !== undefined) return null;
  return data;
}
