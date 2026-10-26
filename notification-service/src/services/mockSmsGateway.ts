import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { DeliveryChannel } from '../models/contact.js';

export class GatewayDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayDeliveryError';
  }
}

export interface DeliveryResult {
  channel: DeliveryChannel;
  providerMessageId: string;
}

export interface SendOptions {
  forceFailure?: boolean;
}

export class MockSmsGateway {
  private readonly failureRate: number;

  constructor(failureRate: number) {
    this.failureRate = failureRate;
  }

  async send(_to: string, _body: string, options: SendOptions = {}): Promise<DeliveryResult> {
    await sleep(50);

    if (options.forceFailure === true || Math.random() < this.failureRate) {
      throw new GatewayDeliveryError('Upstream SMS provider timed out');
    }

    return { channel: 'sms', providerMessageId: randomUUID() };
  }
}
