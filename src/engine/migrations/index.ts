import type { Migration } from '../Migrations.js';
import { createExecutions } from './001_create_executions.js';
import { createRagDocuments } from './002_create_rag_documents.js';
import { addRagHashes } from './003_add_rag_hashes.js';

export const initialMigrations: Migration[] = [createExecutions, createRagDocuments, addRagHashes];
