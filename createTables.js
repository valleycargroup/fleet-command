#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Runs db/init.sql (and nested scripts) against the configured Postgres database.
 * - Prefers local `psql` if installed.
 * - Falls back to `docker run postgres:16-alpine psql ...` so no local psql is needed.
 *
 * Connection source:
 * - DATABASE_URL if present
 * - Otherwise DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
 *
 * Usage:
 *   node createTables.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadEnv() {
	const envPath = path.resolve(__dirname, '.env');
	if (!fs.existsSync(envPath)) return;

	try {
		// eslint-disable-next-line global-require
		require('dotenv').config({ path: envPath, override: true });
		return;
	} catch (_) {
		const lines = fs.readFileSync(envPath, 'utf8').split('\n');
		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			const idx = line.indexOf('=');
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			let val = line.slice(idx + 1).trim();
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			process.env[key] = val;
		}
	}
}

loadEnv();

const sqlFile = path.resolve(__dirname, 'db', 'init.sql');

if (!fs.existsSync(sqlFile)) {
	console.error(`Cannot find ${sqlFile}`);
	process.exit(1);
}

function parseFromEnv() {
	const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
	const user = url?.username || process.env.DB_USER;
	const password = url?.password || process.env.DB_PASSWORD || '';
	let host = url?.hostname || process.env.DB_HOST || 'localhost';
	const port = url?.port || process.env.DB_PORT || (host === 'localhost' ? '5432' : '3306');
	const database =
		(url?.pathname || '').replace(/^\//, '') || process.env.DB_NAME || 'postgres';

	if (host === 'db' && !isDockerRuntime()) {
		host = 'localhost';
	}

	const sslmode =
		process.env.DB_SSLMODE ||
		(['localhost', '127.0.0.1'].includes(host) ? 'disable' : 'require');

	return { user, password, host, port, database, sslmode };
}

function isDockerRuntime() {
	try {
		if (fs.existsSync('/.dockerenv')) return true;
		const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
		return cgroup.includes('docker') || cgroup.includes('containerd');
	} catch {
		return false;
	}
}

function shouldRunSeeds() {
	const raw = String(process.env.SEED_DATA ?? '').trim().toLowerCase();
	return raw === '1';
}

function buildConnString({ user, host, port, database, sslmode }) {
	return `postgresql://${user}@${host}:${port}/${database}?sslmode=${sslmode}`;
}

function tryLocalPsql(conn) {
	console.log('[db] Attempting local psql...');
	const seedArgs = shouldRunSeeds() ? ['-v', 'SEED_DATA=1'] : [];
	const result = spawnSync(
		'psql',
		['-v', 'ON_ERROR_STOP=1', ...seedArgs, buildConnString(conn), '-f', sqlFile],
		{
			stdio: 'inherit',
			env: { ...process.env, PGPASSWORD: conn.password || '' },
		}
	);
	return result.status === 0;
}

function runDockerPsql(conn) {
	console.log('[db] Falling back to dockerized psql...');
	const dbDir = path.resolve(__dirname, 'db');
	const seedArgs = shouldRunSeeds() ? ['-v', 'SEED_DATA=1'] : [];
	const args = [
		'run',
		'--rm',
		'-v',
		`${dbDir}:/db:ro`,
		'-e',
		`PGPASSWORD=${conn.password || ''}`,
	];

	if (['localhost', '127.0.0.1'].includes(conn.host)) {
		args.push('--network', 'host');
	}

	args.push(
		'postgres:16-alpine',
		'psql',
		'-v',
		'ON_ERROR_STOP=1',
		...seedArgs,
		buildConnString(conn),
		'-f',
		'/db/init.sql'
	);

	const result = spawnSync('docker', args, { stdio: 'inherit' });
	return result.status === 0;
}

function main() {
	const conn = parseFromEnv();
	console.log(
		`[db] Target: ${conn.host}:${conn.port}/${conn.database} (sslmode=${conn.sslmode})`
	);

	const ok = tryLocalPsql(conn) || runDockerPsql(conn);
	if (!ok) {
		console.error('[db] Failed to apply schema.');
		process.exit(1);
	}
	console.log('[db] Schema applied successfully.');
}

main();
