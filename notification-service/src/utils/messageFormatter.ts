const appointmentFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function buildReminderMessage(fullName: string, appointmentAt: string, diagnosis?: string): string {
  const when = appointmentFormatter.format(new Date(appointmentAt));
  const reason = diagnosis ? ` for your ${diagnosis} follow-up` : '';
  return `Hi ${fullName}, this is a reminder of your appointment${reason} on ${when} UTC.`;
}
