export interface ContactRecord {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  home_address: string;
  created_at: string;
}

export type NewContact = Omit<ContactRecord, 'id' | 'created_at'>;

export type DeliveryChannel = 'sms';

export interface NotifyResponse {
  contact_id: number;
  status: 'sent';
  channel: DeliveryChannel;
  provider_message_id: string;
}
