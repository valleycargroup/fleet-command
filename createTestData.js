#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Applies test data scripts against Postgres:
 *  1) db/test-data-purge.sql
 *  2) db/test-data.sql OR db/test-data.minimal.sql
 *
 * Profiles:
 *  - default: full (db/test-data.sql)
 *  - --minimal: minimal (db/test-data.minimal.sql)
 *
 * - Prefers local `psql` if installed.
 * - Falls back to `docker run postgres:16-alpine psql ...` so no local psql is needed.
 *
 * Usage:
 *   node createTestData.js
 *   node createTestData.js --minimal
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function loadEnv() {
	const envPath = path.resolve(__dirname, '.env');
	if (!fs.existsSync(envPath)) return;

	try {
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

function buildSqlVars(isMinimal) {
	if (!isMinimal) return {};

	return {
		MIN_ADMIN_USERNAME: process.env.TEST_ADMIN_USERNAME || 'admin',
		MIN_ADMIN_EMAIL: process.env.TEST_ADMIN_EMAIL || 'admin@example.com',
		MIN_ADMIN_PHONE: process.env.TEST_ADMIN_PHONE || '15555550001',

		MIN_USER_USERNAME: process.env.TEST_USER_USERNAME || 'user',
		MIN_USER_EMAIL: process.env.TEST_USER_EMAIL || 'user@example.com',
		MIN_USER_PHONE: process.env.TEST_USER_PHONE || '15555550002',
	};
}

const args = process.argv.slice(2);
const isMinimal = args.includes('--minimal') || process.env.TEST_DATA_PROFILE === 'minimal';
const isPlan    = args.includes('--plan')    || process.env.TEST_DATA_PROFILE === 'plan';

const purgeFile = path.resolve(__dirname, 'db', 'test-data-purge.sql');
const testDataFile = isPlan
	? path.resolve(__dirname, 'db', 'test-data.plan.sql')
	: isMinimal
		? path.resolve(__dirname, 'db', 'test-data.minimal.sql')
		: path.resolve(__dirname, 'db', 'test-data.sql');

for (const f of [purgeFile, testDataFile]) {
	if (!fs.existsSync(f)) {
		console.error(`Cannot find ${f}`);
		process.exit(1);
	}
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

function parseFromEnv() {
	const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;

	const user = url?.username || process.env.DB_USER;
	const password = url?.password || process.env.DB_PASSWORD || '';
	let host = url?.hostname || process.env.DB_HOST || 'localhost';
	const database =
		(url?.pathname || '').replace(/^\//, '') || process.env.DB_NAME || 'postgres';

	// When host is 'db' (Docker service name) and we're running outside Docker,
	// rewrite to localhost and use the EXTERNAL port (DB_PORT in .env) rather
	// than the internal URL port — they differ (5434 external vs 5432 internal).
	let port = url?.port || process.env.DB_PORT || '5432';
	if (host === 'db' && !isDockerRuntime()) {
		host = 'localhost';
		port = process.env.DB_PORT || port;
	}

	const sslmode =
		process.env.DB_SSLMODE ||
		(['localhost', '127.0.0.1'].includes(host) ? 'disable' : 'require');

	return { user, password, host, port, database, sslmode };
}

function buildConnString({ user, host, port, database, sslmode }) {
	return `postgresql://${user}@${host}:${port}/${database}?sslmode=${sslmode}`;
}

function runLocalPsql(conn, filePath) {
	const vars = buildSqlVars(isMinimal);
	const args = ['-v', 'ON_ERROR_STOP=1'];

	for (const [k, v] of Object.entries(vars)) {
		args.push('-v', `${k}=${v}`);
	}

	args.push(buildConnString(conn));
	args.push('-f', filePath);

	const result = spawnSync('psql', args, {
		stdio: 'inherit',
		env: { ...process.env, PGPASSWORD: conn.password || '' },
	});

	return result.status === 0;
}

// Preferred Docker fallback: copy the file into the already-running db container
// and run psql inside it. Works on Windows Docker Desktop (no --network host needed).
function runDockerExecPsql(conn, filePath) {
	const containerName = 'fleet-command-db-1';
	const remotePath = `/tmp/seed_${Date.now()}.sql`;

	// Check the container is running first
	const check = spawnSync('docker', ['inspect', '--format={{.State.Running}}', containerName], {
		encoding: 'utf8',
	});
	if (check.status !== 0 || check.stdout.trim() !== 'true') {
		console.log(`[test-data] Container ${containerName} not running — skipping docker exec fallback`);
		return false;
	}

	// Copy the SQL file into the container
	const cp = spawnSync('docker', ['cp', filePath, `${containerName}:${remotePath}`], {
		stdio: 'inherit',
	});
	if (cp.status !== 0) return false;

	// Run psql inside the container
	const run = spawnSync(
		'docker',
		['exec', containerName, 'sh', '-c',
			`psql -U ${conn.user} -d ${conn.database} -v ON_ERROR_STOP=1 -f ${remotePath} && rm -f ${remotePath}`],
		{ stdio: 'inherit', env: { ...process.env, PGPASSWORD: conn.password || '' } }
	);
	return run.status === 0;
}

// Last-resort fallback: spin up a throwaway postgres container.
// Works on Linux (--network host) but NOT on Windows Docker Desktop.
function runDockerPsql(conn, filePath) {
	const dbDir = path.resolve(__dirname, 'db');
	const vars = buildSqlVars(isMinimal);

	const args = [
		'run', '--rm',
		'-v', `${dbDir}:/db:ro`,
		'-e', `PGPASSWORD=${conn.password || ''}`,
	];

	if (['localhost', '127.0.0.1'].includes(conn.host)) {
		args.push('--network', 'host');
	}

	args.push('postgres:16-alpine', 'psql', '-v', 'ON_ERROR_STOP=1');

	for (const [k, v] of Object.entries(vars)) {
		args.push('-v', `${k}=${v}`);
	}

	args.push(buildConnString(conn), '-f', `/db/${path.basename(filePath)}`);

	const result = spawnSync('docker', args, { stdio: 'inherit' });
	return result.status === 0;
}

function runPsqlWithFallback(conn, filePath) {
	console.log(`[test-data] Applying ${path.relative(__dirname, filePath)} ...`);

	if (runLocalPsql(conn, filePath)) return true;

	console.log('[test-data] Local psql not found; trying docker exec into fleet-command-db-1...');
	if (runDockerExecPsql(conn, filePath)) return true;

	console.log('[test-data] docker exec failed; trying docker run (Linux only)...');
	return runDockerPsql(conn, filePath);
}

function main() {
	const conn = parseFromEnv();
	console.log(
		`[test-data] Target: ${conn.host}:${conn.port}/${conn.database} (sslmode=${conn.sslmode})`
	);
	console.log(`[test-data] Profile: ${isPlan ? 'plan' : isMinimal ? 'minimal' : 'full'}`);

	console.log('[test-data] Running purge...');
	const purgeOk = runPsqlWithFallback(conn, purgeFile);
	if (!purgeOk) {
		console.error('[test-data] Purge failed.');
		process.exit(1);
	}

	console.log('[test-data] Loading test data...');
	const dataOk = runPsqlWithFallback(conn, testDataFile);
	if (!dataOk) {
		console.error('[test-data] Test data load failed.');
		process.exit(1);
	}

	console.log('[test-data] Done.');
}

main();
