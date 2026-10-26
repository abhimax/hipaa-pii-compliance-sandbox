const appointmentFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function buildReminderMessage(fullName: string, appointmentAt: string): string {
  const when = appointmentFormatter.format(new Date(appointmentAt));
  return `Hi ${fullName}, this is a reminder of your appointment on ${when} UTC.`;
}
