import type { Knex } from 'knex';
import path from 'path';
import './src/config/env';

const connection = process.env.DATABASE_URL ?? {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const sharedConfig: Knex.Config = {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: {
    tableName: 'knex_migrations',
    directory: path.resolve(__dirname, './migrations'),
    extension: 'ts',
  },
};

const config: Record<string, Knex.Config> = {
  development: sharedConfig,
  production: { ...sharedConfig, pool: { min: 2, max: 10 } },
  test: { ...sharedConfig, pool: { min: 0, max: 1 } },
};

export default config;
