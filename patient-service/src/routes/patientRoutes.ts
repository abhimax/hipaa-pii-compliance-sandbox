import { Router } from 'express';
import type { PatientController } from '../controllers/patientController.js';

export function createPatientRouter(controller: PatientController): Router {
  const router = Router();
  router.post('/', controller.create);
  router.get('/search', controller.search);
  router.get('/:id', controller.getById);
  return router;
}
