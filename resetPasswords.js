#!/usr/bin/env node
/**
 * resetPasswords.js — set passwords to match what was emailed (from seed-users.json)
 *
 * Usage:
 *   SEED_ADMIN_PASSWORD="yourpassword" node resetPasswords.js --env prod --dry
 *   SEED_ADMIN_PASSWORD="yourpassword" node resetPasswords.js --env prod
 */

const fs   = require('fs');
const path = require('path');

const API_URLS = {
  local: 'http://localhost:5002',
  dev:   'https://dev.api.fleetcommandrecon.net',
  prod:  'https://api.fleetcommandrecon.net',
};

const args   = process.argv.slice(2);
const envArg = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'local';
const isDry  = args.includes('--dry');
const BASE   = API_URLS[envArg] || API_URLS.local;

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'michael.alanw@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || '';

async function apiFetch(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

async function login() {
  if (!ADMIN_PASSWORD) {
    console.error('❌  Set SEED_ADMIN_PASSWORD env var.');
    console.error('    e.g.  SEED_ADMIN_PASSWORD="yourpassword" node resetPasswords.js --env prod');
    process.exit(1);
  }
  const { ok, data } = await apiFetch('/api/auth/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!ok || !data.token) { console.error('❌  Login failed:', data.error || JSON.stringify(data)); process.exit(1); }
  console.log(`✅  Logged in as ${ADMIN_EMAIL} → ${BASE}`);
  return data.token;
}

async function main() {
  console.log(`\n🔑  Reset Passwords → ${BASE}${isDry ? '  [DRY RUN]' : ''}\n`);

  const usersFile = path.resolve(__dirname, 'seed-users.json');
  if (!fs.existsSync(usersFile)) { console.error('❌  seed-users.json not found'); process.exit(1); }

  const seeds = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

  if (isDry) {
    console.log('Would reset passwords for:');
    seeds.forEach((u, i) => console.log(`  ${i + 1}. ${u.email}  →  ${u.password}`));
    console.log('\nDry run complete — no changes made.\n');
    return;
  }

  const token = await login();

  // Fetch existing users to get IDs
  const { data: existingData } = await apiFetch('/api/users', 'GET', null, token);
  const byEmail = {};
  for (const u of existingData.users || []) byEmail[u.email.toLowerCase()] = u;

  let ok = 0, failed = 0, notFound = 0;
  for (const u of seeds) {
    if (!u.email || !u.password) continue;
    const cleanEmail = u.email.trim().toLowerCase();
    const existing = byEmail[cleanEmail];
    if (!existing) { console.log(`  ⚠️   ${cleanEmail} — not found in DB`); notFound++; continue; }

    const { ok: success, data } = await apiFetch(`/api/users/${existing.id}`, 'PUT', { password: u.password }, token);
    if (success) { console.log(`  ✅  ${cleanEmail} → ${u.password}`); ok++; }
    else { console.error(`  ❌  ${cleanEmail} — ${data.error || JSON.stringify(data)}`); failed++; }
  }

  console.log(`\n  Updated: ${ok}  Not found: ${notFound}  Failed: ${failed}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
