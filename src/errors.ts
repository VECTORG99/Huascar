export const ErrorCodes = {
  MCP_CONNECTION_FAILED: 'MCP_CONNECTION_FAILED',
  MCP_TOOL_TIMEOUT: 'MCP_TOOL_TIMEOUT',
  MCP_TOOL_ERROR: 'MCP_TOOL_ERROR',
  RAG_SOURCE_NOT_FOUND: 'RAG_SOURCE_NOT_FOUND',
  RAG_EMBEDDING_FAILED: 'RAG_EMBEDDING_FAILED',
  RAG_SSRF_BLOCKED: 'RAG_SSRF_BLOCKED',
  ENGINE_CONFIG_INVALID: 'ENGINE_CONFIG_INVALID',
  ENGINE_ROLE_NOT_FOUND: 'ENGINE_ROLE_NOT_FOUND',
  STORE_QUERY_FAILED: 'STORE_QUERY_FAILED',
  STORE_MIGRATION_FAILED: 'STORE_MIGRATION_FAILED',
  API_VALIDATION_ERROR: 'API_VALIDATION_ERROR',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  CREATOR_INPUT_ERROR: 'CREATOR_INPUT_ERROR',
  CREATOR_GENERATION_FAILED: 'CREATOR_GENERATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode = 500,
    readonly details?: unknown,
    readonly isOperational = true,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class McpError extends AppError {}
export class RagError extends AppError {}
export class EngineError extends AppError {}
export class StoreError extends AppError {}
export class ApiError extends AppError {}
export class CreatorError extends AppError {}

export interface FormattedError {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: unknown;
  isOperational: boolean;
}

export function formatError(error: unknown): FormattedError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      isOperational: error.isOperational,
    };
  }
  if (error instanceof Error) {
    return { code: ErrorCodes.INTERNAL_ERROR, message: error.message, statusCode: 500, isOperational: false };
  }
  return { code: ErrorCodes.INTERNAL_ERROR, message: String(error), statusCode: 500, isOperational: false };
}
