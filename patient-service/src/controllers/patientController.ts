import type { Request, Response } from 'express';
import type { CreatePatientResponse } from '../models/patient.js';
import type { PatientRepository } from '../repositories/patientRepository.js';
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
}
