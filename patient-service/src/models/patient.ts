export interface PatientRecord {
  id: string;
  full_name: string;
  ssn: string;
  dob: string;
  diagnosis: string;
  medical_notes: string | null;
  created_at: string;
}

export type NewPatient = Omit<PatientRecord, 'id' | 'created_at'>;

export interface CreatePatientResponse {
  id: string;
}
