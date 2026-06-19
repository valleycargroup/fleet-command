#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Applies db/schema.sql and every db/migrations/*.sql file to the configured
 * Postgres database. Uses IF NOT EXISTS everywhere so it is safe to re-run on
 * an existing database — one command works for both fresh installs and schema
 * updates.
 *
 * Usage:  node createTables.js
 */

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
function loadEnv() {
	const envPath = path.resolve(__dirname, '.env');
	if (!fs.existsSync(envPath)) return;
	try {
		require('dotenv').config({ path: envPath, override: true });
	} catch (_) {
		const lines = fs.readFileSync(envPath, 'utf8').split('\n');
		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			const idx = line.indexOf('=');
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			let val = line.slice(idx + 1).trim();
			if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
				val = val.slice(1, -1);
			process.env[key] = val;
		}
	}
}

// ---------------------------------------------------------------------------
// Connection config
// ---------------------------------------------------------------------------
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
	let port = Number(url?.port || process.env.DB_PORT || 5432);
	const database = (url?.pathname || '').replace(/^\//, '') || process.env.DB_NAME || 'postgres';
	const user = url?.username || process.env.DB_USER || 'postgres';
	const password = decodeURIComponent(url?.password || '') || process.env.DB_PASSWORD || '';

	// Inside docker-compose the host is "db" — from the host machine use localhost
	if (host === 'db' && !isDockerRuntime()) {
		host = 'localhost';
		port = Number(process.env.DB_PORT || port);
	}

	const ssl = ['localhost', '127.0.0.1'].includes(host) ? false : { rejectUnauthorized: false };
	return { host, port, database, user, password, ssl };
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
function listMigrations() {
	const dir = path.resolve(__dirname, 'db', 'migrations');
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
		.map(f => path.resolve(dir, f));
}

// Split a SQL file into individual statements (split on semicolons, ignore
// empty chunks and psql \-commands).
function splitStatements(sql) {
	return sql
		.split(/;[ \t]*(?:\r?\n|$)/)
		.map(s => s.trim())
		.filter(s => s.length > 0 && !s.startsWith('\\'));
}

// Extract the object name from a CREATE TABLE/INDEX/FUNCTION statement.
function extractName(stmt) {
	const m = stmt.match(
		/CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|FUNCTION|VIEW|SEQUENCE|TYPE|EXTENSION)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?)/i
	);
	return m ? m[1] : null;
}

function objectKind(stmt) {
	const m = stmt.match(/CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX|FUNCTION|VIEW|SEQUENCE|TYPE|EXTENSION|OR\s+REPLACE\s+FUNCTION)/i);
	if (!m) return 'object';
	const k = m[1].toUpperCase();
	if (k.includes('INDEX')) return 'index';
	if (k.includes('FUNCTION')) return 'function';
	return k.toLowerCase();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
	loadEnv();
	const conn = parseConnConfig();

	// Require pg from the server's node_modules — no extra install needed.
	const { Client } = require('./apps/server/node_modules/pg');
	const client = new Client(conn);

	console.log('');
	console.log('╔══════════════════════════════════════════╗');
	console.log('║       Fleet Command — Database Setup      ║');
	console.log('╚══════════════════════════════════════════╝');
	console.log('');
	console.log(`  Host     : ${conn.host}:${conn.port}`);
	console.log(`  Database : ${conn.database}`);
	console.log('');

	await client.connect();

	// ── Schema ──────────────────────────────────────────────────────────────
	const schemaFile = path.resolve(__dirname, 'db', 'schema.sql');
	if (!fs.existsSync(schemaFile)) {
		console.error('  ❌  db/schema.sql not found');
		await client.end();
		process.exit(1);
	}

	console.log('  Schema');
	console.log('  ──────────────────────────────────────────');
	const schemaStatements = splitStatements(fs.readFileSync(schemaFile, 'utf8'));
	for (const stmt of schemaStatements) {
		const name = extractName(stmt);
		const kind = objectKind(stmt);
		try {
			await client.query(stmt);
			if (name) console.log(`  ✔  Ensuring ${kind}: ${name}`);
		} catch (e) {
			console.error(`\n  ❌  Failed on statement:\n     ${stmt.slice(0, 120)}`);
			console.error(`     ${e.message}`);
			await client.end();
			process.exit(1);
		}
	}
	console.log('  ✅  Schema applied successfully.');
	console.log('');

	// ── Migrations ──────────────────────────────────────────────────────────
	const migrations = listMigrations();
	if (migrations.length === 0) {
		console.log('  ℹ   No migrations found in db/migrations/.');
	} else {
		console.log('  Migrations');
		console.log('  ──────────────────────────────────────────');
		for (const file of migrations) {
			const label = path.basename(file);
			const stmts = splitStatements(fs.readFileSync(file, 'utf8'));
			let ok = true;
			for (const stmt of stmts) {
				try {
					await client.query(stmt);
				} catch (e) {
					console.error(`\n  ❌  ${label} — ${e.message}`);
					ok = false;
					break;
				}
			}
			if (!ok) { await client.end(); process.exit(1); }
			console.log(`  ✔  ${label}`);
		}
		console.log(`  ✅  ${migrations.length} migration(s) applied.`);
	}

	console.log('');
	console.log('  ✅  Database is up to date.');
	console.log('');

	await client.end();
}

main().catch(e => {
	console.error('  ❌  Unexpected error:', e.message);
	process.exit(1);
});
