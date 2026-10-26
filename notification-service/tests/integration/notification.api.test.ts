import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { openDatabase } from '../../src/db/connection';
import type { ContactRecord } from '../../src/models/contact';
import { ContactRepository } from '../../src/repositories/contactRepository';
import { MockSmsGateway } from '../../src/services/mockSmsGateway';

const validPayload = {
  full_name: 'Jane Test',
  email: 'jane@example.com',
  phone_number: '+15550100',
  home_address: '1 Fake St',
  appointment_at: '2026-11-01T10:00:00Z',
};

function buildApp(db: Database.Database, failureRate: number): Express {
  return createApp({
    contactRepository: new ContactRepository(db),
    smsGateway: new MockSmsGateway(failureRate),
  });
}

function getContact(db: Database.Database, id: number): ContactRecord | undefined {
  return db.prepare<[number], ContactRecord>('SELECT * FROM contacts WHERE id = ?').get(id);
}

describe('POST /api/notify (integration)', () => {
  let db: Database.Database;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    db = openDatabase(':memory:');
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM contacts');
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful delivery', () => {
    let app: Express;

    beforeAll(() => {
      app = buildApp(db, 0);
    });

    it('returns 202, persists the contact, and does not log PII', async () => {
      const res = await request(app).post('/api/notify').send(validPayload).expect('Content-Type', /json/).expect(202);

      expect(res.body).toEqual({
        contact_id: expect.any(Number),
        status: 'sent',
        channel: 'sms',
        provider_message_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
      expect(getContact(db, res.body.contact_id)).toMatchObject({
        full_name: 'Jane Test',
        email: 'jane@example.com',
        phone_number: '+15550100',
        home_address: '1 Fake St',
      });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('assigns incrementing contact ids', async () => {
      const first = await request(app).post('/api/notify').send(validPayload).expect(202);
      const second = await request(app).post('/api/notify').send(validPayload).expect(202);

      expect(second.body.contact_id).toBeGreaterThan(first.body.contact_id);
    });
  });

  describe('failed delivery (PII logging trap)', () => {
    it('returns 502 via the centralized error handler when simulate_failure is true', async () => {
      const app = buildApp(db, 0);

      const res = await request(app)
        .post('/api/notify')
        .send({ ...validPayload, simulate_failure: true })
        .expect(502);

      expect(res.body).toEqual({
        error: {
          code: 'DELIVERY_FAILED',
          message: 'Notification delivery failed',
          details: { contact_id: expect.any(Number), reason: 'Upstream SMS provider timed out' },
        },
      });
    });

    it('writes unmasked phone, name, and address to stderr', async () => {
      const app = buildApp(db, 0);

      await request(app)
        .post('/api/notify')
        .send({ ...validPayload, simulate_failure: true })
        .expect(502);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [logged] = errorSpy.mock.calls[0] ?? [];
      expect(logged).toBe('Failed to dispatch alert to phone: +15550100 for user: Jane Test residing at 1 Fake St');
    });

    it('fails randomly according to the configured failure rate', async () => {
      const app = buildApp(db, 1);

      await request(app).post('/api/notify').send(validPayload).expect(502);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('+15550100'));
    });

    it('still persists the contact even when delivery fails', async () => {
      const app = buildApp(db, 1);

      const res = await request(app).post('/api/notify').send(validPayload).expect(502);

      expect(getContact(db, res.body.error.details.contact_id)).toMatchObject({ full_name: 'Jane Test' });
    });
  });

  describe('request validation', () => {
    let app: Express;

    beforeAll(() => {
      app = buildApp(db, 0);
    });

    it('returns 400 with details and persists nothing for invalid input', async () => {
      const res = await request(app)
        .post('/api/notify')
        .send({ ...validPayload, email: 'not-an-email', phone_number: '12' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'phone_number' }),
        ]),
      );
      expect(db.prepare('SELECT COUNT(*) AS count FROM contacts').get()).toEqual({ count: 0 });
    });

    it('returns 400 INVALID_JSON for a malformed body', async () => {
      const res = await request(app)
        .post('/api/notify')
        .set('Content-Type', 'application/json')
        .send('{"full_name": ')
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_JSON');
    });

    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown').expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('exposes a health check', async () => {
      await request(app).get('/health').expect(200, { status: 'ok', service: 'notification-service' });
    });
  });
});
