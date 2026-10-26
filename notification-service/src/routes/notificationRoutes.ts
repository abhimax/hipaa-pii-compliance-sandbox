import { Router } from 'express';
import type { NotificationController } from '../controllers/notificationController.js';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();
  router.post('/', controller.notify);
  return router;
}
