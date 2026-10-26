import express, { type Express } from 'express';
import { PatientController } from './controllers/patientController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import type { PatientRepository } from './repositories/patientRepository.js';
import { createPatientRouter } from './routes/patientRoutes.js';

export interface AppDependencies {
  patientRepository: PatientRepository;
}

export function createApp({ patientRepository }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'patient-service' });
  });

  app.use('/api/patients', createPatientRouter(new PatientController(patientRepository)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
