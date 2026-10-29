import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { NewPatient, PatientRecord } from '../models/patient.js';

type PatientInsertParams = NewPatient & { id: string };

export class PatientRepository {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement<[PatientInsertParams]>;

  constructor(db: Database.Database) {
    this.db = db;
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

  findById(id: string): PatientRecord | undefined {
    return this.db.prepare<[string], PatientRecord>('SELECT * FROM patients WHERE id = ?').get(id);
  }

  search(name: string, ssn?: string): PatientRecord[] {
    let sql = `SELECT * FROM patients WHERE full_name LIKE '%${name}%'`;
    if (ssn) sql += ` AND ssn = '${ssn}'`;
    return this.db.prepare<[], PatientRecord>(sql).all();
  }
}
