#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Applies db/schema.sql then every db/migrations/*.sql file to the configured
 * Postgres database. Uses IF NOT EXISTS everywhere so it is safe to re-run.
 *
 * - Prefers local `psql` if installed.
 * - Falls back to `docker run postgres:16-alpine psql` so no local psql is needed.
 *
 * Connection source:
 * - DATABASE_URL if present
 * - Otherwise DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
 *
 * Usage:  node createTables.js
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

function isDockerRuntime() {
	try {
		if (fs.existsSync('/.dockerenv')) return true;
		return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
	} catch { return false; }
}

function parseConnConfig() {
	let url = null;
	try { url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null; } catch (_) {}

	let host = url?.hostname || process.env.DB_HOST || 'localhost';
	let port = url?.port || process.env.DB_PORT || '5432';
	const database = (url?.pathname || '').replace(/^\//, '') || process.env.DB_NAME || 'postgres';
	const user = url?.username || process.env.DB_USER || 'postgres';
	const password = decodeURIComponent(url?.password || '') || process.env.DB_PASSWORD || '';

	if (host === 'db' && !isDockerRuntime()) {
		// DATABASE_URL uses the Docker-internal port (5432); switch to the
		// host-mapped port from DB_PORT so createTables works outside Docker.
		host = 'localhost';
		if (process.env.DB_PORT) port = process.env.DB_PORT;
	}

	const sslmode = ['localhost', '127.0.0.1'].includes(host) ? 'disable' : 'require';
	return { host, port, database, user, password, sslmode };
}

function connString(conn) {
	return `postgresql://${conn.user}@${conn.host}:${conn.port}/${conn.database}?sslmode=${conn.sslmode}`;
}

function runPsql(sqlFile, conn, useDocker) {
	const env = { ...process.env, PGPASSWORD: conn.password || '' };

	if (!useDocker) {
		const result = spawnSync(
			'psql',
			['-v', 'ON_ERROR_STOP=1', connString(conn), '-f', sqlFile],
			{ stdio: 'inherit', env }
		);
		return result.status === 0;
	}

	const dbDir = path.resolve(__dirname, 'db');
	const containerFile = '/db/' + path.relative(dbDir, sqlFile).replace(/\\/g, '/');
	const args = [
		'run', '--rm',
		'-v', `${dbDir}:/db:ro`,
		'-e', `PGPASSWORD=${conn.password || ''}`,
	];
	if (['localhost', '127.0.0.1'].includes(conn.host)) {
		args.push('--network', 'host');
	}
	args.push('postgres:16-alpine', 'psql', '-v', 'ON_ERROR_STOP=1', connString(conn), '-f', containerFile);

	const result = spawnSync('docker', args, { stdio: 'inherit' });
	return result.status === 0;
}

function applyFile(sqlFile, conn) {
	const label = path.relative(__dirname, sqlFile);
	process.stdout.write(`  Applying ${label} ... `);
	if (runPsql(sqlFile, conn, false) || runPsql(sqlFile, conn, true)) {
		console.log('✅');
		return true;
	}
	console.log('❌');
	return false;
}

function listMigrations() {
	const dir = path.resolve(__dirname, 'db', 'migrations');
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir)
		.filter(f => f.endsWith('.sql'))
		.sort()
		.map(f => path.resolve(dir, f));
}

function main() {
	loadEnv();
	const conn = parseConnConfig();

	console.log('');
	console.log('╔══════════════════════════════════════════╗');
	console.log('║       Fleet Command — Database Setup      ║');
	console.log('╚══════════════════════════════════════════╝');
	console.log('');
	console.log(`  Host     : ${conn.host}:${conn.port}`);
	console.log(`  Database : ${conn.database}`);
	console.log('');

	const schemaFile = path.resolve(__dirname, 'db', 'schema.sql');
	if (!fs.existsSync(schemaFile)) {
		console.error('  ❌  db/schema.sql not found');
		process.exit(1);
	}

	if (!applyFile(schemaFile, conn)) {
		console.error('  ❌  Schema failed.');
		process.exit(1);
	}

	const migrations = listMigrations();
	if (migrations.length === 0) {
		console.log('  ℹ   No migrations found in db/migrations/.');
	} else {
		for (const file of migrations) {
			if (!applyFile(file, conn)) {
				console.error(`  ❌  Migration failed: ${path.basename(file)}`);
				process.exit(1);
			}
		}
	}

	console.log('');
	console.log('  ✅  Database is up to date.');
	console.log('');
}

main();
