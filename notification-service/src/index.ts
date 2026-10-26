import { createApp } from './app.js';
import { config } from './config/env.js';
import { openDatabase } from './db/connection.js';
import { ContactRepository } from './repositories/contactRepository.js';
import { MockSmsGateway } from './services/mockSmsGateway.js';

const db = openDatabase(config.DB_PATH);
const app = createApp({
  contactRepository: new ContactRepository(db),
  smsGateway: new MockSmsGateway(config.MOCK_FAILURE_RATE),
});

const server = app.listen(config.PORT, () => {
  console.log(`[notification-service] listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[notification-service] ${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
