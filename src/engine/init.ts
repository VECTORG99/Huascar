import 'dotenv/config';
import { Store } from './Store.js';
import { logger } from '../logger.js';

async function init(): Promise<void> {
  logger.info('[init] Inicializando base de datos...');

  const store = new Store();

  // Verify tables exist
  const count = store.getChunksCount();
  logger.info({ count }, '[init] chunks table accessible');

  // Verify history table works
  const history = store.getHistory(1);
  logger.info({ records: history.length }, '[init] history table accessible');

  store.close();
  logger.info('[init] Base de datos inicializada correctamente.');
}

init().catch((err) => {
  logger.error({ err }, '[init] ERROR');
  process.exit(1);
});
