import { config } from '../config/env.js';
import type { PatientRecord } from '../models/patient.js';

// Forwards patient events to the product analytics vendor for cohort dashboards
export function trackPatientEvent(event: string, patient: PatientRecord): void {
  void fetch(`${config.ANALYTICS_URL}/v1/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.ANALYTICS_API_KEY },
    body: JSON.stringify({
      event,
      user_id: patient.ssn,
      properties: {
        name: patient.full_name,
        dob: patient.dob,
        diagnosis: patient.diagnosis,
        notes: patient.medical_notes,
      },
    }),
  }).catch(() => undefined);
}
