import knex, { type Knex } from 'knex';
import fs from 'fs';
import path from 'path';
import '../config/env';

const NODE_ENV = process.env.NODE_ENV || 'development';

const isLocal =
  NODE_ENV === 'local' ||
  process.env.DB_HOST === 'localhost' ||
  process.env.DB_HOST === 'db' ||
  process.env.DATABASE_URL?.includes('@localhost') === true ||
  process.env.DATABASE_URL?.includes('@db:') === true;

const rdsCaPath = process.env.RDS_CA_PATH || '/etc/ssl/certs/us-east-2-bundle.pem';
const hasRdsCa = !isLocal && fs.existsSync(rdsCaPath);

const hasDatabaseUrl =
  typeof process.env.DATABASE_URL === 'string' &&
  process.env.DATABASE_URL.trim().length > 0;

const host = process.env.DB_HOST ?? 'localhost';
const defaultPort = isLocal ? 5432 : 3306;
const port = Number(process.env.DB_PORT ?? String(defaultPort));
const user = process.env.DB_USER ?? 'postgres';
const password = process.env.DB_PASSWORD ?? 'postgres';
const database = process.env.DB_NAME ?? 'postgres';

const ssl: any = isLocal
  ? undefined
  : hasRdsCa
  ? { ca: fs.readFileSync(rdsCaPath, 'utf8') }
  : { rejectUnauthorized: false };

const connection: any = hasDatabaseUrl
  ? { connectionString: process.env.DATABASE_URL, ...(ssl ? { ssl } : {}) }
  : { host, port, user, password, database, ...(ssl ? { ssl } : {}) };

export const db: Knex = knex({
  client: 'pg',
  connection,
  pool: {
    min: Number(process.env.DB_POOL_MIN ?? 0),
    max: Number(process.env.DB_POOL_MAX ?? (isLocal ? 10 : 5)),
    acquireTimeoutMillis: Number(process.env.DB_ACQUIRE_TIMEOUT_MS ?? 10000),
    createTimeoutMillis: Number(process.env.DB_CREATE_TIMEOUT_MS ?? 10000),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    reapIntervalMillis: Number(process.env.DB_REAP_INTERVAL_MS ?? 1000),
  },
});

console.log('[db] NODE_ENV:', NODE_ENV);
console.log('[db] isLocal:', isLocal);
console.log('[db] using DATABASE_URL:', hasDatabaseUrl);
console.log('[db] host:', host, '| port:', port, '| database:', database);
console.log('[db] ssl:', isLocal ? 'disabled (local)' : hasRdsCa ? `enabled (ca: ${path.basename(rdsCaPath)})` : 'enabled (rejectUnauthorized:false)');

export default db;
