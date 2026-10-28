import dotenv from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

dotenv.config({ path: resolve(__dirname, '../../src/.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});