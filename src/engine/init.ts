import 'dotenv/config';
import { MigrationRunner } from './Migrations.js';
import migration001 from './migrations/001_create_executions.js';
import migration002 from './migrations/002_create_rag_documents.js';
import { Store } from './Store.js';

async function init(): Promise<void> {
  console.log('[init] Base de datos...');
  const runner = new MigrationRunner();
  runner.register(migration001);
  runner.register(migration002);
  const store = new Store(undefined, runner);
  console.log('[init] OK: ' + store.getChunksCount() + ' chunks');
  console.log('[init] OK: ' + store.getHistory(1).length + ' registros');
  const status = runner.getStatus();
  for (const m of status) {
    console.log(
      '  [migrations] ' + m.id + ': ' + m.description + ' ' + (m.appliedAt ? 'OK (' + m.appliedAt + ')' : 'PENDIENTE'),
    );
  }
  store.close();
  console.log('[init] OK');
}
init().catch((err) => {
  console.error('[init] ERROR:', err.message);
  process.exit(1);
});
