import { Router } from 'express';
import type { PatientController } from '../controllers/patientController.js';

export function createPatientRouter(controller: PatientController): Router {
  const router = Router();
  router.post('/', controller.create);
  return router;
}
