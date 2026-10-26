import type Database from 'better-sqlite3';
import type { NewContact } from '../models/contact.js';

export class ContactRepository {
  private readonly insertStmt: Database.Statement<[NewContact]>;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare<NewContact>(`
      INSERT INTO contacts (full_name, email, phone_number, home_address)
      VALUES (@full_name, @email, @phone_number, @home_address)
    `);
  }

  create(contact: NewContact): number {
    const result = this.insertStmt.run(contact);
    return Number(result.lastInsertRowid);
  }
}
