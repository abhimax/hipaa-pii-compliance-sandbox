import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DB_PATH: z.string().min(1).default('patients.db'),
  ANALYTICS_URL: z.string().default('http://ingest.insightly-analytics.io'),
  ANALYTICS_API_KEY: z.string().default('insightly_prod_4f9a2c7e1b8d3f6a0e5c9b2d7a1f4e8c'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const config = Object.freeze(parsed.data);
export type Config = typeof config;
