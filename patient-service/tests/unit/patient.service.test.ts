import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type Database from 'better-sqlite3';
import type { NextFunction, Request, Response } from 'express';
import { PatientController } from '../../src/controllers/patientController';
import { AppError, NotFoundError, ValidationError } from '../../src/errors/AppError';
import { errorHandler } from '../../src/middleware/errorHandler';
import { PatientRepository } from '../../src/repositories/patientRepository';
import { createPatientSchema, parseOrThrow } from '../../src/validation/patientSchema';

const validPayload = {
  full_name: 'Jane Test',
  ssn: '000-12-3456',
  dob: '1980-01-01',
  diagnosis: 'Hypertension',
  medical_notes: 'Fake test record',
};

interface MockResponse {
  status: jest.Mock<(code: number) => MockResponse>;
  json: jest.Mock<(body: unknown) => MockResponse>;
}

function createMockResponse(): MockResponse {
  const res = {} as MockResponse;
  res.status = jest.fn<(code: number) => MockResponse>().mockReturnValue(res);
  res.json = jest.fn<(body: unknown) => MockResponse>().mockReturnValue(res);
  return res;
}

describe('createPatientSchema', () => {
  it('accepts a valid payload', () => {
    expect(createPatientSchema.safeParse(validPayload).success).toBe(true);
  });

  it('treats medical_notes as optional', () => {
    const { medical_notes: _omit, ...withoutNotes } = validPayload;
    expect(createPatientSchema.safeParse(withoutNotes).success).toBe(true);
  });

  it('trims whitespace from string fields', () => {
    const result = createPatientSchema.parse({ ...validPayload, full_name: '  Jane Test  ' });
    expect(result.full_name).toBe('Jane Test');
  });

  it.each(['123456789', '123-456-789', 'abc-de-fghi', '000-12-345'])('rejects malformed SSN %s', (ssn) => {
    expect(createPatientSchema.safeParse({ ...validPayload, ssn }).success).toBe(false);
  });

  it.each(['01/01/1980', '1980-13-01', 'not-a-date'])('rejects invalid dob %s', (dob) => {
    expect(createPatientSchema.safeParse({ ...validPayload, dob }).success).toBe(false);
  });

  it('rejects a dob in the future', () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    const result = createPatientSchema.safeParse({ ...validPayload, dob: `${nextYear}-01-01` });
    expect(result.success).toBe(false);
  });

  it('rejects empty required fields', () => {
    const result = createPatientSchema.safeParse({ ...validPayload, full_name: '', diagnosis: '   ' });
    expect(result.success).toBe(false);
  });
});

describe('parseOrThrow', () => {
  it('returns parsed data on success', () => {
    expect(parseOrThrow(createPatientSchema, validPayload)).toEqual(validPayload);
  });

  it('throws a ValidationError with field-level details on failure', () => {
    expect.assertions(3);
    try {
      parseOrThrow(createPatientSchema, { ...validPayload, ssn: 'bad' });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).statusCode).toBe(400);
      expect((err as ValidationError).details).toEqual([
        { path: 'ssn', message: 'SSN must be in the format XXX-XX-XXXX' },
      ]);
    }
  });
});

describe('PatientRepository', () => {
  it('generates a UUID and inserts the patient via a prepared statement', () => {
    const run = jest.fn();
    const prepare = jest.fn().mockReturnValue({ run });
    const repo = new PatientRepository({ prepare } as unknown as Database.Database);

    const id = repo.create({ ...validPayload, medical_notes: null });

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(run).toHaveBeenCalledWith({ id, ...validPayload, medical_notes: null });
  });
});

describe('PatientController.create', () => {
  let create: jest.Mock<PatientRepository['create']>;
  let controller: PatientController;

  beforeEach(() => {
    create = jest.fn<PatientRepository['create']>().mockReturnValue('patient-id-123');
    controller = new PatientController({ create } as unknown as PatientRepository);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists validated data and responds 201 with the new id', () => {
    const res = createMockResponse();

    controller.create({ body: validPayload } as Request, res as unknown as Response);

    expect(create).toHaveBeenCalledWith(validPayload);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'patient-id-123' });
  });

  it('maps a missing medical_notes to null', () => {
    const { medical_notes: _omit, ...body } = validPayload;

    controller.create({ body } as Request, createMockResponse() as unknown as Response);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ medical_notes: null }));
  });

  it('throws a ValidationError and does not persist invalid input', () => {
    expect(() =>
      controller.create({ body: { ...validPayload, ssn: 'bad' } } as Request, createMockResponse() as unknown as Response),
    ).toThrow(ValidationError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('errorHandler', () => {
  const next = jest.fn() as unknown as NextFunction;

  it('serializes AppError subclasses with their status code', () => {
    const res = createMockResponse();

    errorHandler(new NotFoundError('nope'), {} as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'nope' } });
  });

  it('includes details when present', () => {
    const res = createMockResponse();

    errorHandler(new AppError(409, 'conflict', 'CONFLICT', { field: 'ssn' }), {} as Request, res as unknown as Response, next);

    expect(res.json).toHaveBeenCalledWith({ error: { code: 'CONFLICT', message: 'conflict', details: { field: 'ssn' } } });
  });

  it('returns a generic 500 for unknown errors without leaking the message', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = createMockResponse();

    errorHandler(new Error('db exploded'), {} as Request, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });
});
