import 'dotenv/config';
import { Store } from './Store.js';

async function init(): Promise<void> {
  console.log('[init] Inicializando base de datos...');

  const store = new Store();

  // Verify tables exist
  const count = store.getChunksCount();
  console.log(`[init] OK — ${count} chunks en tabla rag_documents`);

  // Verify history table works
  const history = store.getHistory(1);
  console.log(`[init] OK — history table accesible (${history.length} registros)`);

  store.close();
  console.log('[init] Base de datos inicializada correctamente.');
}

init().catch((err) => {
  console.error('[init] ERROR:', err.message);
  process.exit(1);
});
