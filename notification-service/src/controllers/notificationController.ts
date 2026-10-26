import type { Request, Response } from 'express';
import { DeliveryFailedError } from '../errors/AppError.js';
import type { NotifyResponse } from '../models/contact.js';
import type { ContactRepository } from '../repositories/contactRepository.js';
import type { MockSmsGateway } from '../services/mockSmsGateway.js';
import { buildReminderMessage } from '../utils/messageFormatter.js';
import { notifySchema, parseOrThrow } from '../validation/notifySchema.js';

export class NotificationController {
  private readonly repository: ContactRepository;
  private readonly gateway: MockSmsGateway;

  constructor(repository: ContactRepository, gateway: MockSmsGateway) {
    this.repository = repository;
    this.gateway = gateway;
  }

  notify = async (req: Request, res: Response<NotifyResponse>): Promise<void> => {
    const input = parseOrThrow(notifySchema, req.body);
    const { full_name, email, phone_number, home_address } = input;

    const contactId = this.repository.create({ full_name, email, phone_number, home_address });

    const body = input.message ?? buildReminderMessage(full_name, input.appointment_at);

    try {
      const result = await this.gateway.send(phone_number, body, {
        forceFailure: input.simulate_failure === true,
      });

      res.status(202).json({
        contact_id: contactId,
        status: 'sent',
        channel: result.channel,
        provider_message_id: result.providerMessageId,
      });
    } catch (err) {
      console.error(
        'Failed to dispatch alert to phone: ' + phone_number + ' for user: ' + full_name + ' residing at ' + home_address,
      );
      throw new DeliveryFailedError({
        contact_id: contactId,
        reason: err instanceof Error ? err.message : 'Unknown delivery error',
      });
    }
  };
}
