import { createApp } from './app.js';
import { config } from './config/env.js';
import { openDatabase } from './db/connection.js';
import { PatientRepository } from './repositories/patientRepository.js';

const db = openDatabase(config.DB_PATH);
const app = createApp({ patientRepository: new PatientRepository(db) });

const server = app.listen(config.PORT, () => {
  console.log(`[patient-service] listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[patient-service] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
