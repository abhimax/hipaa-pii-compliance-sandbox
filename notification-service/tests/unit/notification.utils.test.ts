import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { NotificationController } from '../../src/controllers/notificationController';
import { DeliveryFailedError, ValidationError } from '../../src/errors/AppError';
import type { ContactRepository } from '../../src/repositories/contactRepository';
import { GatewayDeliveryError, MockSmsGateway } from '../../src/services/mockSmsGateway';
import { buildReminderMessage } from '../../src/utils/messageFormatter';
import { notifySchema, parseOrThrow } from '../../src/validation/notifySchema';

const validPayload = {
  full_name: 'Jane Test',
  email: 'jane@example.com',
  phone_number: '+15550100',
  home_address: '1 Fake St',
  appointment_at: '2026-11-01T10:00:00Z',
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

describe('buildReminderMessage', () => {
  it('includes the recipient name and a UTC-formatted appointment time', () => {
    expect(buildReminderMessage('Jane Test', '2026-11-01T10:00:00Z')).toBe(
      'Hi Jane Test, this is a reminder of your appointment on Nov 1, 2026, 10:00 AM UTC.',
    );
  });

  it('normalizes timezone offsets to UTC', () => {
    expect(buildReminderMessage('Jane', '2026-11-01T15:30:00+05:30')).toContain('Nov 1, 2026, 10:00 AM UTC');
  });
});

describe('notifySchema', () => {
  it('accepts a valid payload', () => {
    expect(notifySchema.safeParse(validPayload).success).toBe(true);
  });

  it.each(['+15550100', '(555) 010-0000', '555-010-0000', '+44 20 7946 0000'])('accepts phone format %s', (phone_number) => {
    expect(notifySchema.safeParse({ ...validPayload, phone_number }).success).toBe(true);
  });

  it.each(['123', 'call-me-maybe', '+1 555 010 0000 0000 0000'])('rejects phone format %s', (phone_number) => {
    expect(notifySchema.safeParse({ ...validPayload, phone_number }).success).toBe(false);
  });

  it.each(['not-an-email', 'jane@', '@example.com'])('rejects email %s', (email) => {
    expect(notifySchema.safeParse({ ...validPayload, email }).success).toBe(false);
  });

  it.each(['2026-11-01', 'tomorrow', '2026-11-01 10:00'])('rejects appointment_at %s', (appointment_at) => {
    expect(notifySchema.safeParse({ ...validPayload, appointment_at }).success).toBe(false);
  });

  it('accepts an offset datetime', () => {
    const result = notifySchema.safeParse({ ...validPayload, appointment_at: '2026-11-01T10:00:00+05:30' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-boolean simulate_failure', () => {
    expect(notifySchema.safeParse({ ...validPayload, simulate_failure: 'yes' }).success).toBe(false);
  });

  it('parseOrThrow raises a ValidationError listing each invalid field', () => {
    expect.assertions(2);
    try {
      parseOrThrow(notifySchema, { ...validPayload, email: 'bad', home_address: '' });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'email' }),
          expect.objectContaining({ path: 'home_address' }),
        ]),
      );
    }
  });
});

describe('MockSmsGateway', () => {
  it('returns a provider message id on success', async () => {
    const result = await new MockSmsGateway(0).send('+15550100', 'hi');
    expect(result).toEqual({ channel: 'sms', providerMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });

  it('logs the unmasked phone number and reminder message', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await new MockSmsGateway(0).send('+15550100', 'Hi Jane Test, your appointment is tomorrow.');

    expect(logSpy).toHaveBeenCalledWith(
      'Dispatching appointment reminder to:',
      '+15550100',
      'message:',
      'Hi Jane Test, your appointment is tomorrow.',
    );
  });

  it('always fails when forceFailure is set', async () => {
    await expect(new MockSmsGateway(0).send('+15550100', 'hi', { forceFailure: true })).rejects.toBeInstanceOf(
      GatewayDeliveryError,
    );
  });

  it('fails when the random roll is below the failure rate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.29);
    await expect(new MockSmsGateway(0.3).send('+15550100', 'hi')).rejects.toThrow('Upstream SMS provider timed out');
  });

  it('succeeds when the random roll is at or above the failure rate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.3);
    await expect(new MockSmsGateway(0.3).send('+15550100', 'hi')).resolves.toHaveProperty('channel', 'sms');
  });
});

describe('NotificationController.notify', () => {
  let createContact: jest.Mock<ContactRepository['create']>;
  let send: jest.Mock<MockSmsGateway['send']>;
  let controller: NotificationController;

  beforeEach(() => {
    createContact = jest.fn<ContactRepository['create']>().mockReturnValue(42);
    send = jest.fn<MockSmsGateway['send']>().mockResolvedValue({ channel: 'sms', providerMessageId: 'msg-1' });
    controller = new NotificationController(
      { create: createContact } as unknown as ContactRepository,
      { send } as unknown as MockSmsGateway,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the contact, sends the formatted reminder, and responds 202', async () => {
    const res = createMockResponse();

    await controller.notify({ body: validPayload } as Request, res as unknown as Response);

    expect(createContact).toHaveBeenCalledWith({
      full_name: 'Jane Test',
      email: 'jane@example.com',
      phone_number: '+15550100',
      home_address: '1 Fake St',
    });
    expect(send).toHaveBeenCalledWith(
      '+15550100',
      buildReminderMessage('Jane Test', validPayload.appointment_at),
      { forceFailure: false },
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      contact_id: 42,
      status: 'sent',
      channel: 'sms',
      provider_message_id: 'msg-1',
    });
  });

  it('uses a custom message when provided', async () => {
    await controller.notify(
      { body: { ...validPayload, message: 'Custom text' } } as Request,
      createMockResponse() as unknown as Response,
    );

    expect(send).toHaveBeenCalledWith('+15550100', 'Custom text', { forceFailure: false });
  });

  it('passes simulate_failure through to the gateway', async () => {
    await controller.notify(
      { body: { ...validPayload, simulate_failure: true } } as Request,
      createMockResponse() as unknown as Response,
    );

    expect(send).toHaveBeenCalledWith(expect.any(String), expect.any(String), { forceFailure: true });
  });

  it('converts gateway failures into DeliveryFailedError and logs the unmasked PII', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    send.mockRejectedValue(new GatewayDeliveryError('Upstream SMS provider timed out'));

    const promise = controller.notify({ body: validPayload } as Request, createMockResponse() as unknown as Response);

    await expect(promise).rejects.toBeInstanceOf(DeliveryFailedError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 502,
      details: { contact_id: 42, reason: 'Upstream SMS provider timed out' },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to dispatch alert to phone: +15550100 for user: Jane Test residing at 1 Fake St',
    );
  });

  it('rejects invalid input before touching the repository or gateway', async () => {
    await expect(
      controller.notify({ body: { ...validPayload, email: 'bad' } } as Request, createMockResponse() as unknown as Response),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(createContact).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
