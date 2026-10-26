import type Database from 'better-sqlite3';

export const PATIENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS patients (
    id            TEXT PRIMARY KEY,
    full_name     TEXT NOT NULL,
    ssn           TEXT NOT NULL,
    dob           TEXT NOT NULL,
    diagnosis     TEXT NOT NULL,
    medical_notes TEXT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

export function initializeSchema(db: Database.Database): void {
  db.exec(PATIENTS_TABLE_SQL);
}
