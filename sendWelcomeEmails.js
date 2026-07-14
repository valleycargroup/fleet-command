#!/usr/bin/env node
/**
 * sendWelcomeEmails.js — send (or resend) welcome emails to users in seed-users.json
 *
 * Usage:
 *   node sendWelcomeEmails.js --env prod              # send with password from seed file
 *   node sendWelcomeEmails.js --env prod --reset-link # send with "Set My Password" link (recommended)
 *   node sendWelcomeEmails.js --env prod --dry        # preview only, no emails sent
 *
 * --reset-link generates a 24hr password reset link per user so no passwords
 * are stored or emailed in plain text. Use this for all future welcome sends.
 */

const fs   = require('fs');
const path = require('path');

const API_URLS = {
  local: 'http://localhost:5002',
  dev:   'https://dev.api.fleetcommandrecon.net',
  prod:  'https://api.fleetcommandrecon.net',
};

const args       = process.argv.slice(2);
const envArg     = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'local';
const isDry      = args.includes('--dry');
const resetLink  = args.includes('--reset-link');
const BASE       = API_URLS[envArg] || API_URLS.local;

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
    console.error('❌  Set SEED_ADMIN_PASSWORD env var before running.');
    console.error('    e.g.  $env:SEED_ADMIN_PASSWORD="mypassword"; node sendWelcomeEmails.js --env prod');
    process.exit(1);
  }
  const { ok, data } = await apiFetch('/api/auth/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!ok || !data.token) {
    console.error('❌  Login failed:', data.error || JSON.stringify(data));
    process.exit(1);
  }
  console.log(`✅  Logged in as ${ADMIN_EMAIL} → ${BASE}`);
  return data.token;
}

async function main() {
  console.log(`\n📧  Fleet Command Welcome Emails → ${BASE}${isDry ? '  [DRY RUN]' : ''}${resetLink ? '  [RESET LINK MODE]' : ''}\n`);

  const usersFile = path.resolve(__dirname, 'seed-users.json');
  if (!fs.existsSync(usersFile)) {
    console.error('❌  seed-users.json not found');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  if (!Array.isArray(users) || users.length === 0) {
    console.log('ℹ️   seed-users.json is empty — nothing to send.');
    return;
  }

  if (isDry) {
    console.log('Would send welcome emails to:');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.first_name} ${u.last_name || ''} <${u.email}>  password: ${u.password}`);
    });
    console.log('\nDry run complete — no emails sent.\n');
    return;
  }

  const token = await login();

  const payload = users
    .filter(u => u.email && u.password)
    .map(u => ({ email: u.email.trim().toLowerCase(), password: u.password }));

  const { ok, data } = await apiFetch('/api/users/welcome-batch', 'POST', { users: payload, reset_link: resetLink }, token);

  if (!ok) {
    console.error('❌  Request failed:', data.error || JSON.stringify(data));
    process.exit(1);
  }

  for (const r of data.results || []) {
    if (r.status === 'sent')                  console.log(`  ✅  ${r.email} — sent`);
    else if (r.status === 'suppressed_kill_switch') console.log(`  🔕  ${r.email} — suppressed (kill switch is ON)`);
    else if (r.status === 'not_found')        console.log(`  ⚠️   ${r.email} — user not found in DB`);
    else if (r.status === 'skipped_incomplete') console.log(`  ⏭️   ${r.email} — skipped (missing email or password)`);
    else                                       console.log(`  ❌  ${r.email} — ${r.status}`);
  }

  console.log(`\n  Sent: ${data.sent}  Suppressed: ${data.suppressed}  Total: ${payload.length}`);
  if (data.suppressed > 0) {
    console.log('  ⚠️  Some emails were suppressed by the master kill switch.');
    console.log('      Turn off the kill switch in Settings → Tech Support, then run again.');
  }
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
