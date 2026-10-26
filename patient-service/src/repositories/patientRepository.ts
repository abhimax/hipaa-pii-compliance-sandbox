import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { NewPatient } from '../models/patient.js';

type PatientInsertParams = NewPatient & { id: string };

export class PatientRepository {
  private readonly insertStmt: Database.Statement<[PatientInsertParams]>;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare<PatientInsertParams>(`
      INSERT INTO patients (id, full_name, ssn, dob, diagnosis, medical_notes)
      VALUES (@id, @full_name, @ssn, @dob, @diagnosis, @medical_notes)
    `);
  }

  create(patient: NewPatient): string {
    const id = randomUUID();
    this.insertStmt.run({ id, ...patient });
    return id;
  }
}
