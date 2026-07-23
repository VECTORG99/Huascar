import type { Migration } from '../Migrations.js';
import { createExecutions } from './001_create_executions.js';
import { createRagDocuments } from './002_create_rag_documents.js';

export const initialMigrations: Migration[] = [createExecutions, createRagDocuments];
