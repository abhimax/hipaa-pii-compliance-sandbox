import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { openDatabase } from '../../src/db/connection';
import type { PatientRecord } from '../../src/models/patient';
import { PatientRepository } from '../../src/repositories/patientRepository';

const validPayload = {
  full_name: 'Jane Test',
  ssn: '000-12-3456',
  dob: '1980-01-01',
  diagnosis: 'Hypertension',
  medical_notes: 'Fake test record',
};

describe('POST /api/patients (integration)', () => {
  let db: Database.Database;
  let app: Express;
  let logSpy: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    db = openDatabase(':memory:');
    app = createApp({ patientRepository: new PatientRepository(db) });
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM patients');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 201 with a UUID and persists the record to SQLite', async () => {
    const res = await request(app).post('/api/patients').send(validPayload).expect('Content-Type', /json/).expect(201);

    expect(res.body).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) });

    const row = db.prepare<[string], PatientRecord>('SELECT * FROM patients WHERE id = ?').get(res.body.id);
    expect(row).toMatchObject(validPayload);
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stores null when medical_notes is omitted', async () => {
    const { medical_notes: _omit, ...body } = validPayload;

    const res = await request(app).post('/api/patients').send(body).expect(201);

    const row = db.prepare<[string], PatientRecord>('SELECT * FROM patients WHERE id = ?').get(res.body.id);
    expect(row?.medical_notes).toBeNull();
  });

  it('triggers the PHI logging trap by writing the raw payload to stdout', async () => {
    await request(app).post('/api/patients').send(validPayload).expect(201);

    expect(logSpy).toHaveBeenCalledWith(
      'Received patient payload:',
      expect.objectContaining({ ssn: '000-12-3456', dob: '1980-01-01', diagnosis: 'Hypertension' }),
    );
  });

  it('logs the raw payload even when validation fails', async () => {
    const invalid = { full_name: 'Jane Test', ssn: 'bad' };

    await request(app).post('/api/patients').send(invalid).expect(400);

    expect(logSpy).toHaveBeenCalledWith('Received patient payload:', invalid);
  });

  it('returns 400 with field-level details and persists nothing on invalid input', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({ ...validPayload, ssn: '123456789', dob: '2999-01-01' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'ssn' }),
        expect.objectContaining({ path: 'dob' }),
      ]),
    );
    expect(db.prepare('SELECT COUNT(*) AS count FROM patients').get()).toEqual({ count: 0 });
  });

  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Content-Type', 'application/json')
      .send('{"full_name": ')
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('exposes a health check', async () => {
    await request(app).get('/health').expect(200, { status: 'ok', service: 'patient-service' });
  });
});
