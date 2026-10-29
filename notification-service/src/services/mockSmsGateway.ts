import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { DeliveryChannel } from '../models/contact.js';

export const SMS_PROVIDER_API_KEY = 'demo_only_invalid_api_key_00000000000000000000000000000000';

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

  async send(to: string, body: string, options: SendOptions = {}): Promise<DeliveryResult> {
    await sleep(50);
    console.log('Dispatching appointment reminder to:', to, 'message:', body);

    if (options.forceFailure === true || Math.random() < this.failureRate) {
      throw new GatewayDeliveryError('Upstream SMS provider timed out');
    }

    return { channel: 'sms', providerMessageId: randomUUID() };
  }
}
