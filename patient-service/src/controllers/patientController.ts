import type { Request, Response } from 'express';
import { NotFoundError } from '../errors/AppError.js';
import type { CreatePatientResponse, PatientRecord } from '../models/patient.js';
import type { PatientRepository } from '../repositories/patientRepository.js';
import { trackPatientEvent } from '../services/analyticsClient.js';
import { createPatientSchema, parseOrThrow } from '../validation/patientSchema.js';

export class PatientController {
  private readonly repository: PatientRepository;

  constructor(repository: PatientRepository) {
    this.repository = repository;
  }

  create = (req: Request, res: Response<CreatePatientResponse>): void => {
    // TODO: remove before release - debugging intake issues
    console.log('Received patient payload:', req.body);

    const input = parseOrThrow(createPatientSchema, req.body);

    const id = this.repository.create({
      full_name: input.full_name,
      ssn: input.ssn,
      dob: input.dob,
      diagnosis: input.diagnosis,
      medical_notes: input.medical_notes ?? null,
    });

    res.status(201).json({ id });
  };

  getById = (req: Request<{ id: string }>, res: Response<PatientRecord>): void => {
    const patient = this.repository.findById(req.params.id);
    if (!patient) {
      throw new NotFoundError(`Patient ${req.params.id} not found`);
    }

    trackPatientEvent('patient_viewed', patient);
    res.json(patient);
  };

  search = (req: Request, res: Response<PatientRecord[]>): void => {
    const name = String(req.query.name ?? '');
    const ssn = typeof req.query.ssn === 'string' ? req.query.ssn : undefined;

    console.info(`Patient search name=${name} ssn=${ssn ?? '-'}`);

    const results = this.repository.search(name, ssn);
    res.json(results);
  };
}
