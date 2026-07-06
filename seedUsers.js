#!/usr/bin/env node
/**
 * seedUsers.js — bulk register real users against dev or prod API
 *
 * Usage:
 *   node seedUsers.js                  # targets local (http://localhost:5001)
 *   node seedUsers.js --env dev        # targets https://dev.api.fleetcommandrecon.net
 *   node seedUsers.js --env prod       # targets https://api.fleetcommandrecon.net
 *   node seedUsers.js --env prod --dry # print what would be sent, don't POST
 *
 * Reads users from seed-users.json in the same directory.
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars
 * (or the defaults below — change them before running against prod).
 */

const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

async function login() {
  if (!ADMIN_PASSWORD) {
    console.error('❌  Set SEED_ADMIN_PASSWORD env var before running.');
    console.error('    e.g.  SEED_ADMIN_PASSWORD=mypassword node seedUsers.js --env dev');
    process.exit(1);
  }
  const { ok, data } = await apiFetch('/api/auth/login', 'POST', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!ok || !data.token) {
    console.error('❌  Login failed:', data.error || JSON.stringify(data));
    process.exit(1);
  }
  console.log(`✅  Logged in as ${ADMIN_EMAIL} → ${BASE}`);
  return data.token;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedUsers(token) {
  const usersFile = path.resolve(__dirname, 'seed-users.json');
  if (!fs.existsSync(usersFile)) { console.log('ℹ️   No seed-users.json found — skipping users.'); return; }

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  if (!Array.isArray(users) || users.length === 0) { console.log('ℹ️   seed-users.json is empty — skipping.'); return; }

  console.log(`\n👤  Users (${users.length})${isDry ? '  [DRY RUN]' : ''}`);

  if (isDry) {
    users.forEach((u, i) => console.log(`  ${i + 1}. ${u.first_name} ${u.last_name || ''} <${u.email}>  role=${u.role}  loc=${u.location || 'Both'}`));
    return;
  }

  let ok = 0, skipped = 0, failed = 0;
  for (const u of users) {
    if (!u.email || !u.phone || !u.first_name) {
      console.warn(`  ⚠️  Skipping incomplete entry:`, JSON.stringify(u));
      skipped++; continue;
    }
    const payload = {
      email:      u.email.trim().toLowerCase(),
      phone:      u.phone,
      first_name: u.first_name,
      last_name:  u.last_name  || '',
      role:       u.role       || 'admin',
      is_buyer:   !!u.is_buyer,
      is_seller:  !!u.is_seller,
      is_ap:      !!u.is_ap,
      location:   u.location   || 'Both',
      password:   u.password   || '',
    };
    const { ok: success, data } = await apiFetch('/api/users', 'POST', payload, token);
    if (success) { console.log(`  ✅  ${u.first_name} ${u.last_name || ''} <${u.email}>`); ok++; }
    else if (data.error?.includes('already registered')) { console.log(`  ⏭️   ${u.email} — already exists, skipped`); skipped++; }
    else { console.error(`  ❌  ${u.email} — ${data.error || JSON.stringify(data)}`); failed++; }
  }
  console.log(`     Added: ${ok}  Skipped: ${skipped}  Failed: ${failed}`);
  if (ok > 0) console.log('     📧  Welcome emails sent (password = phone digits unless overridden)');
}

async function seedVendors(token) {
  const vendorsFile = path.resolve(__dirname, 'seed-vendors.json');
  if (!fs.existsSync(vendorsFile)) { console.log('ℹ️   No seed-vendors.json found — skipping vendors.'); return; }

  const vendors = JSON.parse(fs.readFileSync(vendorsFile, 'utf8'));
  if (!Array.isArray(vendors) || vendors.length === 0) { console.log('ℹ️   seed-vendors.json is empty — skipping.'); return; }

  console.log(`\n🔧  Vendors (${vendors.length})${isDry ? '  [DRY RUN]' : ''}`);

  if (isDry) {
    vendors.forEach((v, i) => console.log(`  ${i + 1}. ${v.name} <${v.email}>  cats=${(v.categories||[]).join(',') || 'none'}`));
    return;
  }

  let ok = 0, skipped = 0, failed = 0;
  for (const v of vendors) {
    if (!v.name || !v.email) {
      console.warn(`  ⚠️  Skipping incomplete vendor entry:`, JSON.stringify(v));
      skipped++; continue;
    }
    if (!v.password) {
      console.warn(`  ⚠️  ${v.email} — "password" is required for vendors. Skipping.`);
      skipped++; continue;
    }
    const payload = {
      name:            v.name,
      email:           v.email.trim().toLowerCase(),
      contact_name:    v.contact_name || v.name,
      phone:           v.phone        || '',
      office_phone:    v.office_phone || '',
      location:        v.location     || '',
      categories:      v.categories   || [],
      payment_terms:   v.payment_terms   || 'weekly',
      cutoff_day:      v.cutoff_day      || 'Friday',
      cutoff_time:     v.cutoff_time     || '5 PM',
      delivery_method: v.delivery_method || 'USPS Mail',
      password:        v.password,
    };
    const { ok: success, data } = await apiFetch('/api/vendors', 'POST', payload, token);
    if (success) { console.log(`  ✅  ${v.name} <${v.email}>`); ok++; }
    else if (data.error?.includes('already')) { console.log(`  ⏭️   ${v.email} — already exists, skipped`); skipped++; }
    else { console.error(`  ❌  ${v.email} — ${data.error || JSON.stringify(data)}`); failed++; }
  }
  console.log(`     Added: ${ok}  Skipped: ${skipped}  Failed: ${failed}`);
}

async function main() {
  console.log(`\n🚗  Fleet Command Seed → ${BASE}${isDry ? '  [DRY RUN]' : ''}`);

  if (isDry) {
    await seedUsers(null);
    await seedVendors(null);
    console.log('\nDry run complete — no changes made.\n');
    return;
  }

  const token = await login();
  await seedUsers(token);
  await seedVendors(token);
  console.log('\nDone.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
