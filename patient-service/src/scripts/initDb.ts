import { resolve } from 'node:path';
import { config } from '../config/env.js';
import { openDatabase } from '../db/connection.js';

const db = openDatabase(config.DB_PATH);
db.close();
console.log(`[patient-service] Database initialized at ${resolve(config.DB_PATH)}`);
