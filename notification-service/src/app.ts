import express, { type Express } from 'express';
import { NotificationController } from './controllers/notificationController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import type { ContactRepository } from './repositories/contactRepository.js';
import { createNotificationRouter } from './routes/notificationRoutes.js';
import type { MockSmsGateway } from './services/mockSmsGateway.js';

export interface AppDependencies {
  contactRepository: ContactRepository;
  smsGateway: MockSmsGateway;
}

export function createApp({ contactRepository, smsGateway }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'notification-service' });
  });

  app.use('/api/notify', createNotificationRouter(new NotificationController(contactRepository, smsGateway)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
