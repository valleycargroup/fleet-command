// Fleet Command Recon — Worker v4
// Full REST API + Auth + D1 Database + Email (24 instant + 3 digests)
// Rule: Only email when someone needs to ACT

const RESEND_API_KEY = "re_4xrDjafz_LU8xFSZYXjnv3VQ3cnCcXW8C";
const FROM_EMAIL = "Fleet Command <notifications@fleetcommandrecon.com>";
const APP_URL = "https://fleetcommandrecon.com";
const BCRYPT_ROUNDS = 10;

// ============================================================
// CORS + HELPERS
// ============================================================
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

// Simple password hashing (SHA-256 + salt for Workers environment — no bcrypt available)
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const enc = new TextEncoder().encode(saltHex + pw);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return saltHex + ':' + hashHex;
}
async function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const enc = new TextEncoder().encode(saltHex + pw);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  const check = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return check === hashHex;
}

// Session token
function generateToken() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auth middleware — returns user or null
async function getUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const row = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first();
  return row || null;
}

// Require auth — returns user or error response
async function requireAuth(request, env, roles = null) {
  const user = await getUser(request, env);
  if (!user) return { error: err("Unauthorized", 401) };
  if (roles && !roles.includes(user.role)) return { error: err("Forbidden", 403) };
  return { user };
}

// ============================================================
// D1 SCHEMA SETUP
// ============================================================
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  is_buyer INTEGER DEFAULT 0,
  is_seller INTEGER DEFAULT 0,
  location TEXT DEFAULT 'Both',
  vendor_tag TEXT,
  vendor_categories TEXT,
  parts_location TEXT,
  auction_assignments TEXT,
  recon_categories TEXT,
  recon_customized INTEGER DEFAULT 0,
  must_change_password INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vin TEXT,
  stock_number TEXT UNIQUE,
  year INTEGER,
  make TEXT,
  model TEXT,
  trim TEXT,
  color TEXT,
  miles INTEGER,
  location TEXT,
  source TEXT,
  origin TEXT,
  buyer TEXT,
  seller TEXT,
  sold_to TEXT,
  sale_date TEXT,
  enter_date TEXT,
  purchase_date TEXT,
  grounded_date TEXT,
  status TEXT DEFAULT 'active',
  kicked INTEGER DEFAULT 0,
  notes TEXT,
  recon_data TEXT,
  transport_data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  categories TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  office_phone TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recon_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  vendor_id INTEGER,
  vendor_name TEXT,
  status TEXT DEFAULT 'assigned',
  bid_amount REAL,
  approved_amount REAL,
  cost_type TEXT,
  line_items TEXT,
  date_assigned TEXT,
  date_approved TEXT,
  date_started TEXT,
  date_completed TEXT,
  eta_done TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS transport (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  cost REAL,
  origin TEXT,
  destination TEXT,
  eta TEXT,
  picked_up_date TEXT,
  delivered_date TEXT,
  transport_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  vehicle_id INTEGER,
  subject TEXT,
  status TEXT DEFAULT 'sent',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parts_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  recon_task_id INTEGER,
  description TEXT NOT NULL,
  vendor_name TEXT,
  category TEXT,
  status TEXT DEFAULT 'requested',
  supplier TEXT,
  cost REAL,
  tracking_number TEXT,
  eta TEXT,
  ordered_date TEXT,
  received_date TEXT,
  requested_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE TABLE IF NOT EXISTS arb_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL,
  auction TEXT,
  claim_type TEXT,
  status TEXT DEFAULT 'filed',
  amount REAL,
  filed_date TEXT,
  resolved_date TEXT,
  resolution TEXT,
  notes TEXT,
  filed_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
`;

async function initDB(env) {
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try { await env.DB.prepare(stmt).run(); } catch(e) { /* table already exists */ }
  }
  // Migrations — add columns that might be missing from earlier schema
  const migrations = [
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN recon_categories TEXT",
    "ALTER TABLE users ADD COLUMN recon_customized INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN vendor_categories TEXT",
    "ALTER TABLE users ADD COLUMN parts_location TEXT",
    "ALTER TABLE users ADD COLUMN auction_assignments TEXT",
    "ALTER TABLE users ADD COLUMN is_buyer INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN is_seller INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN vendor_tag TEXT",
    "ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN updated_at TEXT",
    "ALTER TABLE users ADD COLUMN is_ap INTEGER DEFAULT 0",
  ];
  for (const m of migrations) {
    try { await env.DB.prepare(m).run(); } catch(e) { /* column already exists, ignore */ }
  }
  // Backfill any vendors that have NULL id (legacy data from when AUTOINCREMENT didn't work)
  try {
    const nullIdVendors = await env.DB.prepare("SELECT rowid AS rwid, name FROM vendors WHERE id IS NULL OR id = ''").all();
    for (const v of (nullIdVendors.results || [])) {
      const newId = 'vn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      await env.DB.prepare("UPDATE vendors SET id = ? WHERE rowid = ?").bind(newId, v.rwid).run();
    }
  } catch(e) { /* migration safe to skip if anything wrong */ }
  // Seed default auctions if empty
  const count = await env.DB.prepare("SELECT COUNT(*) as c FROM auctions").first();
  if (count.c === 0) {
    const defaults = ["Manheim Express Phoenix", "Manheim Express Dallas", "ADESA Dallas", "ACV Auctions", "Openlane"];
    for (const name of defaults) {
      await env.DB.prepare("INSERT INTO auctions (name) VALUES (?)").bind(name).run();
    }
  }
}

// ============================================================
// API ROUTES
// ============================================================

// --- AUTH ---
async function handleSetup(request, env) {
  // First-time setup — create initial admin user
  const count = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
  if (count.c > 0) return err("Setup already completed. Use /api/auth/login.");

  const { email, phone, first_name, last_name } = await request.json();
  if (!email || !phone || !first_name) return err("Email, phone, and first name required");

  const hash = await hashPassword(phone.replace(/[^0-9]/g, ''));
  await env.DB.prepare(
    "INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, location, must_change_password) VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, 'Both', 1)"
  ).bind(email.toLowerCase(), hash, first_name, last_name, phone).run();

  return json({ ok: true, message: "Admin account created. Log in with your email and phone number as password." });
}

async function handleLogin(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) return err("Email and password required");

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? AND active = 1").bind(email.toLowerCase()).first();
  if (!user) return err("Invalid email or password", 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err("Invalid email or password", 401);

  const token = generateToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  await env.DB.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)").bind(user.id, token, expires).run();

  return json({
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_buyer: user.is_buyer,
      is_seller: user.is_seller,
      is_ap: user.is_ap,
      location: user.location,
      vendor_tag: user.vendor_tag,
      must_change_password: user.must_change_password,
    }
  });
}

async function handleChangePassword(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const { new_password } = await request.json();
  if (!new_password || new_password.length < 8) return err("Password must be at least 8 characters");
  if (!/[A-Z]/.test(new_password)) return err("Password must contain an uppercase letter");
  if (!/[0-9]/.test(new_password)) return err("Password must contain a number");

  const hash = await hashPassword(new_password);
  await env.DB.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?").bind(hash, auth.user.id).run();

  return json({ ok: true, message: "Password changed" });
}

async function handleForgotPassword(request, env) {
  const { email } = await request.json();
  if (!email) return err("Email required");

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ? AND active = 1").bind(email.toLowerCase()).first();
  if (!user) return json({ ok: true, message: "If that email exists, a reset link was sent." }); // Don't reveal if email exists

  // Generate reset token
  const resetToken = generateToken();
  const expires = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour
  await env.DB.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)").bind(user.id, 'reset:' + resetToken, expires).run();

  // Send reset email
  const resetUrl = `${APP_URL}?reset=${resetToken}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Segoe UI',sans-serif;background:#0A0A14;color:#E5E7EB;padding:20px;"><div style="max-width:500px;margin:0 auto;background:#12121E;border-radius:16px;border:1px solid #2A2A3E;overflow:hidden;"><div style="padding:28px;text-align:center;background:#1E3A5F"><div style="font-size:26px;font-weight:700;color:#FFF">Fleet<span style="color:#3B82F6">Command</span></div><div style="margin-top:10px;font-size:15px;color:#93C5FD">Password Reset</div></div><div style="padding:28px"><p style="margin-bottom:20px">Hi ${user.first_name},</p><p style="margin-bottom:20px;color:#9CA3AF">Click the button below to reset your password. This link expires in 1 hour.</p><div style="text-align:center;margin:24px 0"><a href="${resetUrl}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:16px;font-weight:700;border-radius:10px;text-decoration:none">Reset Password</a></div><p style="font-size:12px;color:#6B7280">If you didn't request this, ignore this email.</p></div></div></body></html>`;

  await sendEmail(user.email, "Reset your Fleet Command password", html);

  return json({ ok: true, message: "If that email exists, a reset link was sent." });
}

async function handleResetPassword(request, env) {
  const { token, new_password } = await request.json();
  if (!token || !new_password) return err("Token and new password required");
  if (new_password.length < 8) return err("Password must be at least 8 characters");

  const session = await env.DB.prepare("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')").bind('reset:' + token).first();
  if (!session) return err("Invalid or expired reset token", 401);

  const hash = await hashPassword(new_password);
  await env.DB.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?").bind(hash, session.user_id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind('reset:' + token).run();

  return json({ ok: true, message: "Password reset successful" });
}

// --- USERS ---
async function handleGetUsers(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (!auth.user.is_buyer && !auth.user.is_seller && auth.user.role !== 'admin') return err("Forbidden", 403);

  const users = await env.DB.prepare("SELECT id, email, first_name, last_name, phone, role, is_buyer, is_seller, is_ap, location, vendor_tag, vendor_categories, parts_location, auction_assignments, active, created_at FROM users WHERE active = 1 ORDER BY created_at DESC").all();
  return json({ users: users.results });
}

async function handleRegisterUser(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (!auth.user.is_buyer && !auth.user.is_seller && auth.user.role !== 'admin') return err("Only admins can register users", 403);

  const body = await request.json();
  const { email, phone, first_name, last_name, role, is_buyer, is_seller, is_ap, location, vendor_tag, vendor_categories, parts_location, auction_assignments, recon_categories, recon_customized, password } = body;

  if (!email || !phone || !first_name) return err("Email, phone, and first name required");

  // Trim all string inputs to prevent whitespace mismatches later
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanFirst = String(first_name).trim();
  const cleanLast = String(last_name || '').trim();
  const cleanPhone = String(phone).trim();

  // Check for existing user (active or inactive)
  const existing = await env.DB.prepare("SELECT id, active FROM users WHERE email = ?").bind(cleanEmail).first();
  if (existing && existing.active === 1) return err("Email already registered");

  // Use provided password, fallback to phone digits
  const pw = password && password.length > 0 ? password : cleanPhone.replace(/[^0-9]/g, '');
  const hash = await hashPassword(pw);

  if (existing && existing.active === 0) {
    // Reactivate soft-deleted user
    await env.DB.prepare(
      `UPDATE users SET active = 1, password_hash = ?, first_name = ?, last_name = ?, phone = ?, role = ?, is_buyer = ?, is_seller = ?, is_ap = ?, location = ?, vendor_tag = ?, vendor_categories = ?, parts_location = ?, auction_assignments = ?, recon_categories = ?, recon_customized = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?`
    ).bind(
      hash, cleanFirst, cleanLast, cleanPhone,
      role || 'admin', is_buyer ? 1 : 0, is_seller ? 1 : 0, is_ap ? 1 : 0, location || 'Both',
      vendor_tag || null, vendor_categories ? JSON.stringify(vendor_categories) : null,
      parts_location || null, auction_assignments ? JSON.stringify(auction_assignments) : null,
      recon_categories ? JSON.stringify(recon_categories) : null, recon_customized ? 1 : 0,
      existing.id
    ).run();

    // Send welcome email on reactivation
    try {
      const welcome = welcomeUserEmail(cleanFirst, cleanEmail, pw, role || 'admin', location || 'Both');
      const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
      await logEmail(env, 'welcome_user', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed', emailRes.ok ? null : JSON.stringify(emailRes.data || emailRes.error));
    } catch (e) { console.error('Welcome email failed:', e); }

    return json({ ok: true, message: "User reactivated", id: existing.id });
  }

  const result = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, is_ap, location, vendor_tag, vendor_categories, parts_location, auction_assignments, recon_categories, recon_customized, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).bind(
    cleanEmail, hash, cleanFirst, cleanLast, cleanPhone,
    role || 'admin', is_buyer ? 1 : 0, is_seller ? 1 : 0, is_ap ? 1 : 0, location || 'Both',
    vendor_tag || null, vendor_categories ? JSON.stringify(vendor_categories) : null,
    parts_location || null, auction_assignments ? JSON.stringify(auction_assignments) : null,
    recon_categories ? JSON.stringify(recon_categories) : null, recon_customized ? 1 : 0
  ).run();

  // Send welcome email (fire-and-forget)
  try {
    const welcome = welcomeUserEmail(cleanFirst, cleanEmail, pw, role || 'admin', location || 'Both');
    const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
    await logEmail(env, 'welcome_user', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed', emailRes.ok ? null : JSON.stringify(emailRes.data || emailRes.error));
  } catch (e) { console.error('Welcome email failed:', e); }

  return json({ ok: true, message: "User registered", id: result.meta.last_row_id });
}

async function handleDeleteUser(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role !== 'admin' && !auth.user.is_buyer && !auth.user.is_seller) return err("Forbidden", 403);

  const url = new URL(request.url);
  const userId = url.pathname.split('/').pop();

  if (auth.user.id == userId) return err("Cannot delete yourself");

  await env.DB.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").bind(userId).run();
  return json({ ok: true });
}

async function handleUpdateUser(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const userId = url.pathname.split('/').pop();
  const body = await request.json();

  // Users can update themselves, admins can update anyone
  if (auth.user.id != userId && auth.user.role !== 'admin' && !auth.user.is_buyer && !auth.user.is_seller) {
    return err("Forbidden", 403);
  }

  const fields = [];
  const values = [];
  const allowed = ['first_name', 'last_name', 'phone', 'role', 'is_buyer', 'is_seller', 'location', 'vendor_tag', 'vendor_categories', 'parts_location', 'auction_assignments', 'recon_categories', 'recon_customized', 'active'];
  const trimFields = ['first_name', 'last_name', 'phone', 'vendor_tag', 'parts_location'];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      let val = body[key];
      if (typeof val === 'object') val = JSON.stringify(val);
      else if (typeof val === 'string' && trimFields.includes(key)) val = val.trim();
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  // Handle password update separately - hash it and clear must_change_password
  if (body.password !== undefined && typeof body.password === 'string' && body.password.trim().length > 0) {
    const newPw = body.password.trim();
    if (newPw.length < 6) return err("Password must be at least 6 characters");
    const hash = await hashPassword(newPw);
    fields.push("password_hash = ?");
    values.push(hash);
    fields.push("must_change_password = 0");
  }

  if (fields.length === 0) return err("No fields to update");
  fields.push("updated_at = datetime('now')");
  values.push(userId);

  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ ok: true });
}

// --- VEHICLES ---
async function handleGetVehicles(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const vehicles = await env.DB.prepare("SELECT rowid as _rowid, * FROM vehicles ORDER BY CASE WHEN status='sold' THEN 0 WHEN kicked=1 THEN 1 ELSE 2 END, updated_at DESC").all();
  return json({ vehicles: vehicles.results });
}

async function handleCreateVehicle(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const v = await request.json();
  const result = await env.DB.prepare(
    `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source, origin, buyer, seller, sold_to, sale_date, enter_date, purchase_date, grounded_date, status, notes, recon_data, transport_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    v.vin, v.stock_number, v.year, v.make, v.model, v.trim || '', v.color, v.miles,
    v.location, v.source || '', v.origin || '', v.buyer || '', v.seller || '',
    v.sold_to || null, v.sale_date || null, v.enter_date || null, v.purchase_date || null,
    v.grounded_date || null, v.sold_to ? 'sold' : 'active', v.notes || '',
    v.recon_data || '{}', v.transport_data || '{}'
  ).run();

  return json({ ok: true, id: result.meta.last_row_id });
}

async function handleUpdateVehicle(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const vehicleId = url.pathname.split('/').pop();
  const body = await request.json();

  // Vendors can ONLY update recon_data (no other vehicle fields).
  // Permissive write — vendor can update full recon_data. Other fields are silently ignored
  // (frontend sends full payload via syncVehicle, that's fine — we just only persist recon_data).
  if (auth.user.role === 'vendor') {
    if (body.recon_data === undefined) return err("Vendors can only update recon data", 403);

    // Save recon_data only - frontend already validates the vendor only changes their own record
    await env.DB.prepare("UPDATE vehicles SET recon_data = ?, updated_at = datetime('now') WHERE rowid = ?")
      .bind(typeof body.recon_data === 'string' ? body.recon_data : JSON.stringify(body.recon_data), vehicleId).run();
    return json({ ok: true });
  }

  // Non-vendor full update path
  const fields = [];
  const values = [];
  const allowed = ['vin', 'stock_number', 'year', 'make', 'model', 'trim', 'color', 'miles', 'location', 'source', 'origin', 'buyer', 'seller', 'sold_to', 'sale_date', 'enter_date', 'purchase_date', 'grounded_date', 'status', 'kicked', 'notes', 'recon_data', 'transport_data'];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
    }
  }

  if (fields.length === 0) return err("No fields to update");
  fields.push("updated_at = datetime('now')");
  values.push(vehicleId);

  await env.DB.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE rowid = ?`).bind(...values).run();
  return json({ ok: true });
}

// --- VENDOR BID UPDATE ---
// Scoped endpoint that lets a vendor update ONLY their own bid record on a vehicle.
// Vendor cannot change vehicle info, status, other vendors' bids, or work tasks.
async function handleVendorBidUpdate(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vehicles/{id}/vendor-bid
  const vehicleId = parts[parts.length - 2];
  const body = await request.json();
  const { categoryKey, vendorUpdates, taskStatusChange } = body;

  if (!categoryKey || !vendorUpdates) return err("categoryKey and vendorUpdates required");

  // Load the current vehicle
  const vehicle = await env.DB.prepare("SELECT recon_data FROM vehicles WHERE rowid = ?").bind(vehicleId).first();
  if (!vehicle) return err("Vehicle not found", 404);

  let reconData;
  try {
    reconData = vehicle.recon_data ? JSON.parse(vehicle.recon_data) : {};
  } catch (e) {
    return err("Recon data corrupted", 500);
  }

  // Find the recon task for this category
  const task = reconData[categoryKey];
  if (!task) return err("Recon category not found on this vehicle", 404);
  if (!Array.isArray(task.vendors)) return err("No vendors assigned to this category", 404);

  // Find the vendor record that matches the logged-in user
  // Match by email (preferred), then full name, then first name (or first name contained in vendor name)
  const userEmail = (auth.user.email || '').toLowerCase();
  const userFirst = (auth.user.first_name || '').toLowerCase();
  const userFull = `${auth.user.first_name || ''} ${auth.user.last_name || ''}`.trim().toLowerCase();
  const myVendorIdx = task.vendors.findIndex(vn => {
    const vnEmail = (vn.email || '').toLowerCase();
    const vnName = (vn.name || '').toLowerCase();
    if (vnEmail && userEmail && vnEmail === userEmail) return true;
    if (vnName && userFull && vnName === userFull) return true;
    if (vnName && userFirst && vnName === userFirst) return true;
    if (vnName && userFirst && vnName.includes(userFirst)) return true;
    return false;
  });

  if (myVendorIdx < 0) return err("You are not assigned to this recon task", 403);

  // Whitelist of fields a vendor is allowed to update on their own record
  const allowedVendorFields = ['lineItems', 'bidLocked', 'estimate', 'etaDone', 'vendorPhotos', 'vendorFindings', 'findingsSubmitted', 'findingsSubmittedDate', 'findingsDecisionSent', 'declined', 'declinedDate', 'cancellationSent', 'dateStarted', 'dateCompleted', 'beforePhotos', 'afterPhotos', 'progressPhotos'];
  const safeUpdates = {};
  for (const key of allowedVendorFields) {
    if (vendorUpdates[key] !== undefined) safeUpdates[key] = vendorUpdates[key];
  }

  // Apply updates to ONLY the vendor's own record
  task.vendors[myVendorIdx] = { ...task.vendors[myVendorIdx], ...safeUpdates };

  // Recalculate task estimate from vendor estimates
  const totalEst = task.vendors.reduce((s, vn) => s + (Number(vn.estimate) || 0), 0);
  if (totalEst) task.estimate = totalEst;

  // Allow status changes the vendor can legitimately drive
  // estimated = bid submitted, declined = vendor declined, started = work begun, complete = work done
  if (taskStatusChange && typeof taskStatusChange === 'object') {
    const allowedStatusFields = ['status', 'estimate', 'dateStarted', 'dateCompleted'];
    const allowedStatusValues = ['estimated', 'declined', 'started', 'complete'];
    for (const key of allowedStatusFields) {
      if (taskStatusChange[key] !== undefined) {
        if (key === 'status' && !allowedStatusValues.includes(taskStatusChange[key])) continue;
        task[key] = taskStatusChange[key];
      }
    }
  }

  reconData[categoryKey] = task;

  // Write back
  await env.DB.prepare("UPDATE vehicles SET recon_data = ?, updated_at = datetime('now') WHERE rowid = ?")
    .bind(JSON.stringify(reconData), vehicleId).run();

  return json({ ok: true });
}

// --- PARTS UPDATE ---
// Scoped endpoint for Parts Manager to update a single part on a recon task line item.
// Parts Manager can update: partStatus, partPrice, partETA, partTracking, partCarrier,
// partReceivedDate, partRejectedReason. Cannot change vehicle info, vendors, or work tasks.
async function handlePartsUpdate(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;

  // Only parts manager or admin can use this
  if (auth.user.role !== 'parts_manager' && auth.user.role !== 'admin' && !auth.user.is_buyer) {
    return err("Only Parts Manager or admin can update parts", 403);
  }

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vehicles/{id}/parts-update
  const vehicleId = parts[parts.length - 2];
  const body = await request.json();
  const { categoryKey, lineItemId, vendorId, partUpdates } = body;

  if (!categoryKey || !lineItemId || !partUpdates) return err("categoryKey, lineItemId, and partUpdates required");

  const vehicle = await env.DB.prepare("SELECT recon_data FROM vehicles WHERE rowid = ?").bind(vehicleId).first();
  if (!vehicle) return err("Vehicle not found", 404);

  let reconData;
  try {
    reconData = vehicle.recon_data ? JSON.parse(vehicle.recon_data) : {};
  } catch (e) {
    return err("Recon data corrupted", 500);
  }

  const task = reconData[categoryKey];
  if (!task) return err("Recon category not found", 404);
  if (!Array.isArray(task.vendors)) return err("No vendors on this category", 404);

  // Find the vendor record (specified or any selected)
  const targetVendor = vendorId
    ? task.vendors.find(v => v.id === vendorId)
    : task.vendors.find(v => v.selected) || task.vendors[0];
  if (!targetVendor) return err("Target vendor not found", 404);

  const lineItems = targetVendor.lineItems || [];
  const liIdx = lineItems.findIndex(li => li.id === lineItemId);
  if (liIdx < 0) return err("Line item not found", 404);

  // Whitelist of allowed parts fields - supports both new partStatus enum and legacy boolean flags
  const allowedFields = ['partStatus', 'partPrice', 'partETA', 'partTracking', 'partCarrier', 'partReceivedDate', 'partRejectedReason', 'partApproved', 'partApprovedDate', 'partQuotedBy', 'partQuotedDate', 'partOrderedDate', 'partShippedDate', 'partNotes', 'partOrdered', 'partArrived', 'partArrivedDate', 'partInstalled', 'partInstalledDate', 'partCanceled', 'partCanceledDate'];
  const allowedStatusValues = ['needs_quote', 'quoted', 'approved', 'ordered', 'shipped', 'received', 'rejected', 'backorder'];

  const safe = {};
  for (const k of allowedFields) {
    if (partUpdates[k] !== undefined) {
      if (k === 'partStatus' && !allowedStatusValues.includes(partUpdates[k])) continue;
      safe[k] = partUpdates[k];
    }
  }

  lineItems[liIdx] = { ...lineItems[liIdx], ...safe };
  targetVendor.lineItems = lineItems;

  // Auto-update task status based on parts state - check both naming schemes
  const partItems = lineItems.filter(li => li.isPart);
  if (partItems.length > 0) {
    const isReceived = (li) => li.partStatus === 'received' || li.partArrived === true;
    const isRejected = (li) => li.partStatus === 'rejected';
    const isBackorder = (li) => li.partStatus === 'backorder';
    const allReceived = partItems.every(isReceived);
    const anyRejected = partItems.some(isRejected);
    const anyBackorder = partItems.some(isBackorder);
    if (allReceived && (task.status === 'parts_pending' || task.status === 'started')) {
      // Don't override if already complete - only flip from pending
      if (task.status === 'parts_pending') {
        task.status = 'started';
        task.dateAllPartsReceived = new Date().toISOString().split('T')[0];
      }
    } else if (anyBackorder) {
      task.status = 'parts_backorder';
    } else if (anyRejected) {
      task.status = 'parts_rejected';
    }
  }

  reconData[categoryKey] = task;

  await env.DB.prepare("UPDATE vehicles SET recon_data = ?, updated_at = datetime('now') WHERE rowid = ?")
    .bind(JSON.stringify(reconData), vehicleId).run();

  return json({ ok: true, partStatus: safe.partStatus, totalParts: partItems.length, receivedCount: partItems.filter(li => li.partStatus === 'received').length });
}
async function handleCSVUpload(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role === 'vendor') return err("Vendors cannot upload inventory", 403);

  const body = await request.json();
  const { csv_data } = body;
  if (!csv_data) return err("No CSV data provided");

  // Parse CSV
  const lines = csv_data.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return err("CSV must have a header row and at least one data row");

  const headers = parseCSVRow(lines[0]).map(h => h.trim().toUpperCase());
  const colMap = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  // Required columns
  const needed = ['STOCK #'];
  for (const n of needed) {
    if (colMap[n] === undefined) return err(`Missing required column: ${n}`);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let kickedCount = 0;
  let errors = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVRow(lines[i]);
      const stockNum = getCol(row, colMap, 'STOCK #');
      if (!stockNum) continue;

      const vin = getCol(row, colMap, 'VIN') || '';
      const year = parseInt(getCol(row, colMap, 'YEAR')) || null;
      const make = getCol(row, colMap, 'MAKE') || '';
      const model = getCol(row, colMap, 'MODEL') || '';
      const trim = getCol(row, colMap, 'TRIM') || '';
      const color = getCol(row, colMap, 'COLOR') || '';
      // Parse miles - handle multiple formats:
      // "57,971.00" (US) -> strip commas, drop decimal -> 57971
      // "57971,00"  (European) -> last comma is decimal, drop it -> 57971
      // "57971"     (clean) -> 57971
      const rawMiles = String(getCol(row, colMap, 'MILES') || '0');
      let cleanedMiles = rawMiles;
      // If there's a period, treat as US format - drop decimal portion
      if (cleanedMiles.includes('.')) {
        cleanedMiles = cleanedMiles.split('.')[0];
      } else if (cleanedMiles.includes(',')) {
        // Could be US "57,971" (thousands) or European "57971,00" (decimal)
        // European decimal: last comma has 1-2 digits after it
        const lastComma = cleanedMiles.lastIndexOf(',');
        const afterLastComma = cleanedMiles.substring(lastComma + 1);
        if (afterLastComma.length <= 2 && afterLastComma.length > 0) {
          // Looks like European decimal - drop the decimal portion
          cleanedMiles = cleanedMiles.substring(0, lastComma);
        }
      }
      // Strip everything but digits
      let miles = parseInt(cleanedMiles.replace(/[^0-9]/g, '')) || 0;
      // Sanity check - no vehicle has > 999,999 miles in normal use
      // If we got an absurd number, miles were probably mis-parsed - divide by 100
      if (miles > 999999) miles = Math.floor(miles / 100);
      const location = getCol(row, colMap, 'LOCATION') || '';
      const source = getCol(row, colMap, 'FROM') || '';
      const origin = getCol(row, colMap, 'ORIGIN') || '';
      const buyer = getCol(row, colMap, 'BUYER') || '';
      const seller = getCol(row, colMap, 'SELLER') || '';
      const soldTo = getCol(row, colMap, 'SOLD TO') || null;
      const saleDate = parseDate(getCol(row, colMap, 'SALE DATE'));
      const enterDate = parseDate(getCol(row, colMap, 'ENTER DATE'));
      const dogDate = parseDate(getCol(row, colMap, 'D.O.G.'));
      const kickedDate = parseDate(getCol(row, colMap, 'KICKED'));
      const notes = getCol(row, colMap, 'NOTES') || '';

      // Determine status: KICKED takes priority over SOLD
      // If the CSV marks a vehicle as kicked, it was sold then kicked back → now active with kick history
      const isKicked = !!kickedDate;
      const status = isKicked ? 'active' : (soldTo ? 'sold' : 'active');
      if (isKicked) kickedCount++;

      // Build kick history entry if this vehicle was kicked
      const kickHistoryEntry = isKicked ? {
        dealer: soldTo || '—',
        soldDate: saleDate,
        kickedDate: kickedDate,
        sellingBroker: seller,
        reason: 'From CSV import',
        fromCSV: true
      } : null;

      // Check if vehicle exists
      const existing = await env.DB.prepare("SELECT id, recon_data, transport_data, status FROM vehicles WHERE stock_number = ?").bind(stockNum).first();

      if (existing) {
        // Don't overwrite delivered vehicles with CSV data
        if (existing.status === 'delivered') { skipped++; continue; }
        // Never overwrite recon_data if vehicle has recon/kick work in Fleet Command
        const existingReconStr = existing.recon_data || '{}';
        const hasFleetWork = existingReconStr.includes('_kickedHistory') || existingReconStr.includes('"needed":true') || existingReconStr.includes('"status":"assigned"') || existingReconStr.includes('"status":"started"') || existingReconStr.includes('"status":"complete"');

        // Build updated recon_data with kick history if needed
        let reconDataForUpdate = existingReconStr;
        if (isKicked) {
          try {
            const existingRecon = JSON.parse(existingReconStr);
            if (!existingRecon._kickedHistory) existingRecon._kickedHistory = [];
            // Only add if this kick date isn't already logged
            const alreadyLogged = existingRecon._kickedHistory.some(k => k.kickedDate === kickedDate && k.dealer === soldTo);
            if (!alreadyLogged) existingRecon._kickedHistory.push(kickHistoryEntry);
            reconDataForUpdate = JSON.stringify(existingRecon);
          } catch (e) { /* keep existing if JSON fails */ }
        }

        if (hasFleetWork && !isKicked) {
          // Preserve recon_data as-is (no kick to log), update other fields
          await env.DB.prepare(
            `UPDATE vehicles SET vin=?, year=?, make=?, model=?, trim=?, color=?, miles=?, location=?, source=?, origin=?, buyer=?, seller=?, sold_to=?, sale_date=?, enter_date=?, grounded_date=?, status=?, notes=?, updated_at=datetime('now') WHERE stock_number=?`
          ).bind(vin, year, make, model, trim, color, miles, location, source, origin, buyer, seller, soldTo, saleDate, enterDate, dogDate, status, notes, stockNum).run();
        } else {
          // Update everything including recon_data (either new kick history or no fleet work to preserve)
          await env.DB.prepare(
            `UPDATE vehicles SET vin=?, year=?, make=?, model=?, trim=?, color=?, miles=?, location=?, source=?, origin=?, buyer=?, seller=?, sold_to=?, sale_date=?, enter_date=?, grounded_date=?, status=?, notes=?, recon_data=?, updated_at=datetime('now') WHERE stock_number=?`
          ).bind(vin, year, make, model, trim, color, miles, location, source, origin, buyer, seller, soldTo, saleDate, enterDate, dogDate, status, notes, reconDataForUpdate, stockNum).run();
        }
        updated++;
      } else {
        // New vehicle — seed kick history if CSV shows it was kicked
        const initialReconData = isKicked ? JSON.stringify({ _kickedHistory: [kickHistoryEntry] }) : '{}';
        await env.DB.prepare(
          `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source, origin, buyer, seller, sold_to, sale_date, enter_date, grounded_date, status, notes, recon_data, transport_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')`
        ).bind(vin, stockNum, year, make, model, trim, color, miles, location, source, origin, buyer, seller, soldTo, saleDate, enterDate, dogDate, status, notes, initialReconData).run();
        imported++;
      }
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  return json({ ok: true, imported, updated, skipped, kicked: kickedCount, errors, total: imported + updated });
}

function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function getCol(row, colMap, name) {
  const idx = colMap[name];
  return idx !== undefined && idx < row.length ? row[idx].replace(/^"|"$/g, '').trim() : '';
}

function parseDate(val) {
  if (!val) return null;
  const clean = val.replace(/[^0-9/\-]/g, '');
  // Handle M/D/YY or M/D/YYYY
  const parts = clean.split('/');
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return clean || null;
}

// --- VENDORS ---
async function handleGetVendors(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  const vendors = await env.DB.prepare("SELECT * FROM vendors WHERE active = 1 ORDER BY name").all();
  return json({ vendors: vendors.results });
}

async function handleCreateVendor(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role === 'vendor') return err("Forbidden", 403);

  const v = await request.json();

  // Validation
  if (!v.name || !String(v.name).trim()) return err("Vendor name required");
  const cleanName = String(v.name).trim();
  const cleanEmail = v.email ? String(v.email).trim().toLowerCase() : null;
  const cleanContact = v.contact_name ? String(v.contact_name).trim() : '';
  const cleanPhone = v.phone ? String(v.phone).trim() : '';

  // Check for existing vendor (by name, case-insensitive, trim-safe)
  const existingVendor = await env.DB.prepare(
    "SELECT id, email, active FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1"
  ).bind(cleanName).first();

  let vendorId;
  if (existingVendor) {
    // Update existing vendor instead of creating duplicate
    await env.DB.prepare(
      `UPDATE vendors SET location = ?, categories = ?, contact_name = ?, email = ?, phone = ?, office_phone = ?, active = 1 WHERE id = ?`
    ).bind(
      v.location || '',
      v.categories ? JSON.stringify(v.categories) : '[]',
      cleanContact,
      cleanEmail || existingVendor.email || '',
      cleanPhone,
      v.office_phone || '',
      existingVendor.id
    ).run();
    vendorId = existingVendor.id;
  } else {
    // Generate a unique ID explicitly (don't rely on AUTOINCREMENT — actual table may have TEXT id)
    const newVendorId = 'vn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await env.DB.prepare(
      "INSERT INTO vendors (id, name, location, categories, contact_name, email, phone, office_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(newVendorId, cleanName, v.location || '', v.categories ? JSON.stringify(v.categories) : '[]', cleanContact, cleanEmail || '', cleanPhone, v.office_phone || '').run();
    vendorId = newVendorId;
  }

  // Create/update user account for vendor login — BUT only if this email isn't already a non-vendor user
  if (cleanEmail && v.password) {
    try {
      const existing = await env.DB.prepare("SELECT id, active, role FROM users WHERE email = ?").bind(cleanEmail).first();

      // Safety: don't clobber non-vendor roles
      if (existing && existing.role && existing.role !== 'vendor') {
        return json({
          ok: true,
          id: vendorId,
          warning: `Vendor saved, but email ${cleanEmail} is already assigned to a ${existing.role} user — no login account created for this vendor. Use a different email to give them login access.`
        });
      }

      const hash = await hashPassword(v.password);
      if (existing) {
        await env.DB.prepare("UPDATE users SET active = 1, password_hash = ?, first_name = ?, last_name = ?, phone = ?, role = 'vendor', is_buyer = 0, is_seller = 0, vendor_tag = ?, vendor_categories = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?")
          .bind(hash, cleanContact || cleanName, '', cleanPhone, cleanName, JSON.stringify(v.categories || []), existing.id).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, must_change_password)
           VALUES (?, ?, ?, ?, ?, 'vendor', 0, 0, ?, ?, 0)`
        ).bind(cleanEmail, hash, cleanContact || cleanName, '', cleanPhone, cleanName, JSON.stringify(v.categories || [])).run();
      }

      // Send welcome email to vendor
      const welcome = welcomeVendorEmail(cleanName, cleanContact || cleanName, cleanEmail, v.password, v.categories || []);
      const emailRes = await sendEmail(cleanEmail, welcome.subject, welcome.html);
      await logEmail(env, 'welcome_vendor', cleanEmail, null, welcome.subject, emailRes.ok ? 'sent' : 'failed');
    } catch (e) { console.error('Vendor user/email setup failed:', e); }
  }

  return json({ ok: true, id: vendorId, updated: !!existingVendor });
}

async function handleUpdateVendor(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role === 'vendor') return err("Forbidden", 403);

  const url = new URL(request.url);
  const vendorId = url.pathname.split('/').pop();
  const body = await request.json();

  // Build update fields
  const fields = [];
  const values = [];

  if (body.name !== undefined) { fields.push("name = ?"); values.push(String(body.name).trim()); }
  if (body.contact_name !== undefined) { fields.push("contact_name = ?"); values.push(String(body.contact_name).trim()); }
  if (body.email !== undefined) { fields.push("email = ?"); values.push(String(body.email).trim().toLowerCase()); }
  if (body.phone !== undefined) { fields.push("phone = ?"); values.push(String(body.phone).trim()); }
  if (body.office_phone !== undefined) { fields.push("office_phone = ?"); values.push(String(body.office_phone)); }
  if (body.location !== undefined) { fields.push("location = ?"); values.push(String(body.location)); }
  if (body.active !== undefined) { fields.push("active = ?"); values.push(body.active ? 1 : 0); }

  // Categories — always store as JSON string of the array
  if (body.categories !== undefined) {
    let catsArr = [];
    if (Array.isArray(body.categories)) {
      catsArr = body.categories;
    } else if (typeof body.categories === 'string') {
      try { const parsed = JSON.parse(body.categories); catsArr = Array.isArray(parsed) ? parsed : [body.categories]; }
      catch(e) { catsArr = [body.categories]; }
    }
    fields.push("categories = ?");
    values.push(JSON.stringify(catsArr));
  }

  if (fields.length === 0) return err("No fields to update");
  values.push(vendorId);

  await env.DB.prepare(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  // Sync the user login account if email/password/name changed
  // Get fresh vendor data to know current state
  const vendor = await env.DB.prepare("SELECT name, email, contact_name, phone, categories FROM vendors WHERE id = ?").bind(vendorId).first();
  let warning = null;

  if (vendor && vendor.email) {
    const cleanEmail = vendor.email.trim().toLowerCase();
    try {
      const existingUser = await env.DB.prepare("SELECT id, role FROM users WHERE email = ?").bind(cleanEmail).first();

      // Only touch user account if it's a vendor account or doesn't exist yet
      if (existingUser && existingUser.role && existingUser.role !== 'vendor') {
        warning = `Vendor saved, but email ${cleanEmail} is already a ${existingUser.role} login — vendor login NOT updated. Use a different email if vendor needs login access.`;
      } else if (body.password && body.password.trim()) {
        // Password provided — create or update vendor user account
        const hash = await hashPassword(body.password.trim());
        if (existingUser) {
          // Update existing vendor user
          await env.DB.prepare("UPDATE users SET active = 1, password_hash = ?, first_name = ?, phone = ?, vendor_tag = ?, vendor_categories = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?")
            .bind(hash, vendor.contact_name || vendor.name, vendor.phone || '', vendor.name, vendor.categories || '[]', existingUser.id).run();
        } else {
          // Create new vendor user
          await env.DB.prepare(
            `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_buyer, is_seller, vendor_tag, vendor_categories, must_change_password)
             VALUES (?, ?, ?, ?, ?, 'vendor', 0, 0, ?, ?, 0)`
          ).bind(cleanEmail, hash, vendor.contact_name || vendor.name, '', vendor.phone || '', vendor.name, vendor.categories || '[]').run();
        }
      } else if (existingUser) {
        // No password, but vendor user exists — update non-password fields
        await env.DB.prepare("UPDATE users SET first_name = ?, phone = ?, vendor_tag = ?, vendor_categories = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(vendor.contact_name || vendor.name, vendor.phone || '', vendor.name, vendor.categories || '[]', existingUser.id).run();
      } else {
        // No password provided, no existing user — flag as warning
        warning = `Vendor saved, but no login account created (no password set). Edit the vendor and provide a password to enable login.`;
      }
    } catch (e) { console.error('Vendor user sync failed:', e); warning = "Vendor saved, but login account sync failed."; }
  }

  return json({ ok: true, warning });
}

async function handleDeleteVendor(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role !== 'admin' && !auth.user.is_buyer && !auth.user.is_seller) return err("Forbidden", 403);

  const url = new URL(request.url);
  const vendorId = url.pathname.split('/').pop();

  await env.DB.prepare("UPDATE vendors SET active = 0 WHERE id = ?").bind(vendorId).run();
  return json({ ok: true });
}

// --- AUCTIONS ---
async function handleGetAuctions(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  const auctions = await env.DB.prepare("SELECT * FROM auctions WHERE active = 1 ORDER BY name").all();
  return json({ auctions: auctions.results });
}

async function handleCreateAuction(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  const { name } = await request.json();
  if (!name) return err("Name required");
  await env.DB.prepare("INSERT INTO auctions (name) VALUES (?)").bind(name).run();
  return json({ ok: true });
}

// --- PARTS REQUESTS ---
async function handleGetParts(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  const parts = await env.DB.prepare("SELECT p.*, v.year, v.make, v.model, v.stock_number FROM parts_requests p JOIN vehicles v ON p.vehicle_id = v.id ORDER BY p.created_at DESC").all();
  return json({ parts: parts.results });
}

// --- EMAIL LOG ---
async function handleGetEmailLog(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role === 'vendor') return err("Forbidden", 403);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const logs = await env.DB.prepare("SELECT * FROM email_log ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return json({ emails: logs.results });
}

// --- REPORTS ---
async function handleGetReports(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error;
  if (auth.user.role === 'vendor' || auth.user.role === 'parts') return err("Forbidden", 403);

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'overview';

  if (type === 'overview') {
    const total = await env.DB.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status != 'delivered'").first();
    const inRecon = await env.DB.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'active' OR status = 'in_recon'").first();
    const sold = await env.DB.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'sold'").first();
    const delivered = await env.DB.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'delivered'").first();
    return json({ overview: { total: total.c, in_recon: inRecon.c, sold: sold.c, delivered: delivered.c } });
  }

  return json({ message: "Report type: " + type });
}

// --- DB STATUS ---
async function handleDBStatus(request, env) {
  const userCount = await env.DB.prepare("SELECT COUNT(*) as c FROM users").first();
  const vehicleCount = await env.DB.prepare("SELECT COUNT(*) as c FROM vehicles").first();
  const vendorCount = await env.DB.prepare("SELECT COUNT(*) as c FROM vendors").first();
  const needsSetup = userCount.c === 0;

  return json({
    status: "ok",
    needs_setup: needsSetup,
    counts: {
      users: userCount.c,
      vehicles: vehicleCount.c,
      vendors: vendorCount.c,
    }
  });
}

// ============================================================
// EMAIL FUNCTIONS (preserved from v3)
// ============================================================
async function sendEmail(to, subject, html) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function logEmail(env, type, recipient, vehicleId, subject, status, error) {
  try {
    await env.DB.prepare("INSERT INTO email_log (email_type, recipient, vehicle_id, subject, status) VALUES (?, ?, ?, ?, ?)").bind(type, recipient, vehicleId, subject, status).run();
  } catch (e) { console.error("Email log error:", e); }
}

// ============================================================
// EMAIL RECIPIENT ROUTING
// Returns array of email addresses for a given email type + data.
// Deduplicates. Falls back to [fallbackTo] if nothing resolves.
// Safe: catches all errors and returns fallback rather than throwing.
// ============================================================
async function resolveRecipients(type, data, env, fallbackTo) {
  try {
    const recipients = new Set();

    // Helper: find a user's email by their name (firstName or "firstName lastName")
    const findUserEmailByName = async (name) => {
      if (!name || typeof name !== 'string') return null;
      const clean = name.trim();
      if (!clean) return null;
      // Try exact match on "first_name last_name" (TRIM both sides to be whitespace-safe)
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts.slice(1).join(' ');
        const u = await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = LOWER(?) AND LOWER(TRIM(last_name)) = LOWER(?) LIMIT 1").bind(first, last).first();
        if (u?.email) return u.email;
      }
      // Try just first name
      const u2 = await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = LOWER(?) LIMIT 1").bind(parts[0]).first();
      if (u2?.email) return u2.email;
      return null;
    };

    const findVendorEmail = async (vendorName) => {
      if (!vendorName) return null;
      const v = await env.DB.prepare("SELECT email FROM vendors WHERE LOWER(TRIM(name)) = LOWER(?) AND active = 1 LIMIT 1").bind(vendorName.trim()).first();
      return v?.email || null;
    };

    // ==== VENDOR-DIRECTED EMAILS ====
    if (type.startsWith('vendor_')) {
      const ve = await findVendorEmail(data?.vendor?.name);
      if (ve) recipients.add(ve.toLowerCase());
    }

    // ==== BUYER-DIRECTED EMAILS ====
    const buyerTypes = ['buyer_work_complete','buyer_recon_complete','buyer_bid_submitted','buyer_vendor_declined','buyer_approved_shipping','transport_inbound_set','shipping_hold','vehicle_grounded','driveway_outbound_shipped','driveway_outbound_delivered','retail_vehicle_shipped','retail_vehicle_delivered','dealer_vehicle_shipped','dealer_vehicle_delivered','parts_quoted_to_buyer'];
    if (buyerTypes.includes(type)) {
      const be = await findUserEmailByName(data?.buyer);
      if (be) recipients.add(be.toLowerCase());
    }

    // ==== PARTS EMAILS — buyer + vendor get notified per-part events ====
    const partsBuyerVendorTypes = ['part_received','all_parts_received','part_rejected','part_backorder'];
    if (partsBuyerVendorTypes.includes(type)) {
      // Buyer
      const buyerName = data?.buyer || data?.vehicle?.buyingBroker;
      if (buyerName) {
        const be = await findUserEmailByName(buyerName);
        if (be) recipients.add(be.toLowerCase());
      }
      // Vendor
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    // ==== PARTS REQUEST → Parts Manager ====
    if (type === 'parts_request_to_pm' || type === 'parts_approved_to_pm') {
      const pmName = data?.partsManager;
      if (pmName) {
        const pe = await findUserEmailByName(pmName);
        if (pe) recipients.add(pe.toLowerCase());
      }
      // Also notify all parts managers at the vehicle's location
      const loc = data?.vehicle?.location;
      if (loc) {
        const pms = await env.DB.prepare("SELECT email FROM users WHERE role = 'parts_manager' AND active = 1 AND (parts_location = ? OR parts_location = 'Both')").bind(loc).all();
        (pms.results || []).forEach(u => { if (u.email) recipients.add(u.email.toLowerCase()); });
      }
    }

    // ==== PARTS APPROVED → Vendor ====
    if (type === 'parts_approved_to_vendor') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    // ==== RECON APPROVED FOR PAYMENT → AP team + vendor ====
    if (type === 'recon_approved_for_payment') {
      // Vendor gets notified
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
      // ALL active AP users get notified
      try {
        const aps = await env.DB.prepare("SELECT email FROM users WHERE (role = 'ap' OR is_ap = 1) AND active = 1").all();
        (aps.results || []).forEach(u => { if (u.email) recipients.add(u.email.toLowerCase()); });
      } catch (e) {}
    }

    // ==== RECON DISPUTED → Vendor only ====
    if (type === 'recon_disputed') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    // ==== VENDOR PAYMENT RECEIPT → Vendor only ====
    if (type === 'vendor_payment_receipt') {
      if (data?.vendor?.email) recipients.add(data.vendor.email.toLowerCase());
      else if (data?.vendor?.name) {
        const ve = await findUserEmailByName(data.vendor.name);
        if (ve) recipients.add(ve.toLowerCase());
      }
    }

    // ==== SELLER-DIRECTED EMAILS ====
    // Seller only gets: grounded, recon complete, sold, kicked
    const sellerGetsEmail = ['vehicle_grounded','buyer_recon_complete','seller_vehicle_sold','seller_vehicle_kicked'];
    if (sellerGetsEmail.includes(type)) {
      // seller name can be in data.seller OR (for kick/sold) we may need to look up vehicle's sellingBroker
      const sellerName = data?.seller;
      if (sellerName) {
        const se = await findUserEmailByName(sellerName);
        if (se) recipients.add(se.toLowerCase());
      }
    }

    // ==== KICK EMAIL — goes to BOTH buyer and seller ====
    if (type === 'seller_vehicle_kicked') {
      const be = await findUserEmailByName(data?.buyer);
      if (be) recipients.add(be.toLowerCase());
    }

    // If no recipients resolved, fall back to the original `to` param
    if (recipients.size === 0 && fallbackTo) {
      recipients.add(fallbackTo.toLowerCase());
    }

    return Array.from(recipients);
  } catch (e) {
    console.error('resolveRecipients error:', e);
    return fallbackTo ? [fallbackTo] : [];
  }
}

// --- WELCOME EMAIL TEMPLATES ---
function welcomeUserEmail(firstName, email, password, role, location) {
  const roleLabel = {admin:'Admin',buyer:'Buyer',seller:'Seller'}[role] || 'User';
  return {
    subject: `🎉 Welcome to Fleet Command — Your account is ready`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:'Segoe UI','DM Sans',-apple-system,sans-serif;background:#0A0A14;color:#E5E7EB"><div style="max-width:560px;margin:0 auto;padding:20px"><div style="background:#12121E;border-radius:16px;border:1px solid #2A2A3E;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5)"><div style="padding:36px 28px 28px;text-align:center;background:linear-gradient(135deg,#1E3A5F 0%,#0F2940 100%);border-bottom:1px solid #2A4A6E"><div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#1E3A5F,#0F2940);border:1px solid #3B82F6;line-height:56px;font-size:28px;margin-bottom:14px">🚗</div><div style="font-size:28px;font-weight:800;color:#FFF;letter-spacing:2px;margin-bottom:6px">FLEET<span style="color:#3B82F6">COMMAND</span></div><div style="font-size:12px;color:#93C5FD;letter-spacing:3px;text-transform:uppercase;font-weight:600">Welcome Aboard</div></div><div style="padding:32px 28px"><div style="font-size:20px;color:#FFF;font-weight:700;margin-bottom:8px">Hi ${firstName} 👋</div><div style="font-size:15px;color:#9CA3AF;line-height:1.6;margin-bottom:24px">Your Fleet Command account is ready. You've been registered as <b style="color:#93C5FD">${roleLabel}</b>${location?` — <b style="color:#93C5FD">${location}</b>`:''}.</div><div style="background:#0D0D1A;border:1px solid #2A2A3E;border-radius:10px;padding:20px;margin-bottom:24px"><div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:14px">🔑 Login Credentials</div><div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1E1E32"><span style="color:#6B7280;font-size:13px">Email</span><span style="color:#E5E7EB;font-size:14px;font-weight:600">${email}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0"><span style="color:#6B7280;font-size:13px">Password</span><span style="color:#FBBF24;font-size:14px;font-weight:700;font-family:'Courier New',monospace">${password}</span></div></div><div style="text-align:center;margin:24px 0"><a href="${APP_URL}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;letter-spacing:0.5px">🚀 Open Fleet Command</a></div><div style="background:#1E3A5F;border-left:3px solid #3B82F6;border-radius:6px;padding:14px 16px;margin-bottom:16px"><div style="font-size:13px;color:#93C5FD;font-weight:600;margin-bottom:4px">💡 Tip</div><div style="font-size:13px;color:#C9CDD3;line-height:1.5">Change your password after first login under My Account for security.</div></div><div style="font-size:12px;color:#6B7280;line-height:1.5;text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #1E1E32">Questions? Reply to this email.<br>— Fleet Command Team</div></div></div><div style="text-align:center;padding:16px;font-size:11px;color:#4B5563">© ${new Date().getFullYear()} Fleet Command Recon • Valley Car Group</div></div></body></html>`
  };
}

function welcomeVendorEmail(company, contactName, email, password, categories) {
  const catNames = {bodyshop:'🔨 Body Shop',detail:'✨ Detail',tires:'🛞 Tires',mechanical:'⚙️ Mechanical',oemdealer:'🚗 OEM/Dealer',parts:'📦 Parts',photos:'📸 Photos'};
  const catBadges = (categories||[]).map(c=>`<span style="display:inline-block;padding:4px 10px;margin:2px;border-radius:4px;background:#1E3A5F;color:#93C5FD;font-size:12px;font-weight:700">${catNames[c]||c}</span>`).join('');
  return {
    subject: `🔧 ${company} — Welcome to Fleet Command Vendor Portal`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;font-family:'Segoe UI','DM Sans',-apple-system,sans-serif;background:#0A0A14;color:#E5E7EB"><div style="max-width:560px;margin:0 auto;padding:20px"><div style="background:#12121E;border-radius:16px;border:1px solid #2A2A3E;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5)"><div style="padding:36px 28px 28px;text-align:center;background:linear-gradient(135deg,#1E3A5F 0%,#0F2940 100%);border-bottom:1px solid #2A4A6E"><div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#1E3A5F,#0F2940);border:1px solid #3B82F6;line-height:56px;font-size:28px;margin-bottom:14px">🔧</div><div style="font-size:28px;font-weight:800;color:#FFF;letter-spacing:2px;margin-bottom:6px">FLEET<span style="color:#3B82F6">COMMAND</span></div><div style="font-size:12px;color:#93C5FD;letter-spacing:3px;text-transform:uppercase;font-weight:600">Vendor Partner Welcome</div></div><div style="padding:32px 28px"><div style="font-size:20px;color:#FFF;font-weight:700;margin-bottom:8px">Hi ${contactName} 👋</div><div style="font-size:15px;color:#9CA3AF;line-height:1.6;margin-bottom:20px"><b style="color:#FFF">${company}</b> has been registered as a Recon Vendor partner on Fleet Command. You'll now receive job assignments, digests, and notifications directly from this system.</div>${catBadges?`<div style="background:#0D0D1A;border:1px solid #2A2A3E;border-radius:10px;padding:16px;margin-bottom:20px"><div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:10px">Assigned Categories</div><div>${catBadges}</div></div>`:''}<div style="background:#0D0D1A;border:1px solid #2A2A3E;border-radius:10px;padding:20px;margin-bottom:24px"><div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:14px">🔑 Login Credentials</div><div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1E1E32"><span style="color:#6B7280;font-size:13px">Email</span><span style="color:#E5E7EB;font-size:14px;font-weight:600">${email}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0"><span style="color:#6B7280;font-size:13px">Password</span><span style="color:#FBBF24;font-size:14px;font-weight:700;font-family:'Courier New',monospace">${password}</span></div></div><div style="text-align:center;margin:24px 0"><a href="${APP_URL}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none;letter-spacing:0.5px">🚀 Open Vendor Portal</a></div><div style="background:#1E3A5F;border-left:3px solid #3B82F6;border-radius:6px;padding:14px 16px;margin-bottom:16px"><div style="font-size:13px;color:#93C5FD;font-weight:600;margin-bottom:4px">📋 What to expect</div><div style="font-size:13px;color:#C9CDD3;line-height:1.5">You'll receive instant emails when vehicles are assigned to you, plus daily digests at 6 AM, 12 PM, and 6 PM with past due items and jobs needing bids.</div></div><div style="font-size:12px;color:#6B7280;line-height:1.5;text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #1E1E32">Questions? Reply to this email.<br>— Fleet Command Team</div></div></div><div style="text-align:center;padding:16px;font-size:11px;color:#4B5563">© ${new Date().getFullYear()} Fleet Command Recon • Valley Car Group</div></div></body></html>`
  };
}

// --- EMAIL TEMPLATE HELPERS (preserved from v3) ---
function fmtDate(d){if(!d)return"—";const p=d.split("-");return p.length===3?p[1]+"/"+p[2]+"/"+p[0].slice(2):d;}
function vLink(id,cat){return `${APP_URL}?vehicle=${id}${cat?"&cat="+cat:""}`;}
function vBlock(v){const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const soldTo=clean(v.soldTo)||clean(v.sold_to);const soldDate=clean(v.soldDate)||clean(v.sale_date);const trim=clean(v.trim)||'';const color=clean(v.color)||'—';const location=clean(v.location)||'—';const vinLabel=clean(v.vin8)||clean(v.stock_number)||'—';return `<div style="padding:12px 16px;background:#0D0D1A;border-radius:8px;border:1px solid #2A2A3E;margin-bottom:20px"><b style="color:#FFF;font-size:16px">${v.year||''} ${v.make||''} ${v.model||''} ${trim}</b><br><span style="font-size:14px;color:#9CA3AF">VIN: ${vinLabel} • ${color} • ${(v.miles||0).toLocaleString()} mi • ${location}</span>${soldTo?`<br><span style="color:#34D399;font-weight:600">Sold to: ${soldTo}${soldDate?" — "+fmtDate(soldDate):""}</span>`:""}</div>`;}
function cta(text,id,bg,tc,cat){return `<div style="text-align:center;margin-top:24px"><a href="${vLink(id,cat)}" style="display:inline-block;padding:14px 44px;background:${bg};color:${tc};font-size:16px;font-weight:700;border-radius:10px;text-decoration:none;font-family:'DM Sans',sans-serif">${text}</a><div style="font-size:12px;color:#6B7280;margin-top:8px">Opens directly in Fleet Command</div></div>`;}
function soldBnr(v){const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const soldTo=clean(v.soldTo)||clean(v.sold_to);return soldTo?`<div style="background:#7F1D1D;padding:10px 28px;text-align:center;font-size:14px;font-weight:700;color:#FCA5A5;letter-spacing:1px">🔴 SOLD VEHICLE — Priority</div>`:"";}
function wsrt(ct){const w=(ct||"ws")==="ws";return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:${w?"#1E3A5F":"#78590A"};color:${w?"#93C5FD":"#FDE68A"}">${w?"WS":"RT"}</span>`;}
function liRow(li,bc){return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;border-left:3px solid ${bc||"#3B82F6"}"><span style="font-size:14px;color:#E5E7EB">${li.desc} ${wsrt(li.costType)}${li.isPart?' <span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:#4C1D95;color:#DDD6FE">PART</span>':""}</span><span style="font-size:15px;font-weight:700;color:#E5E7EB">$${li.price||0}</span></div>`;}
function totBar(l,a,bg,tc){return `<div style="display:flex;justify-content:space-between;padding:14px;background:${bg};border-radius:8px;margin-top:10px"><span style="font-size:14px;font-weight:700;color:${tc}">${l}</span><span style="font-size:20px;font-weight:700;color:#FFF">$${(a||0).toLocaleString()}</span></div>`;}
function shell(hBg,bBg,bC,bBd,bI,bT,body,extra){return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#0A0A14;color:#E5E7EB;min-height:100vh;display:flex;justify-content:center;padding:20px}.email{max-width:600px;width:100%;background:#12121E;border-radius:16px;overflow:hidden;border:1px solid #2A2A3E}</style></head><body><div class="email"><div style="background:linear-gradient(135deg,${hBg} 0%,#0D0D1A 100%);padding:28px;text-align:center"><div style="font-size:26px;font-weight:700;color:#FFF">Fleet<span style="color:#3B82F6">Command</span></div><div style="display:inline-block;margin-top:12px;padding:8px 22px;border-radius:20px;font-size:15px;font-weight:700;background:${bBg};color:${bC};border:2px solid ${bBd}">${bI} ${bT}</div></div>${extra||""}<div style="padding:28px">${body}</div><div style="padding:20px 28px;background:#0A0A14;text-align:center;border-top:1px solid #2A2A3E"><div style="font-size:12px;color:#4B5563;line-height:1.6">Valley Car Group — PHX &bull; Dallas</div></div></div></body></html>`;}
function dRow(v,rHtml,bc){return `<a href="${vLink(v.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;text-decoration:none;border-left:3px solid ${bc||"#3B82F6"}"><div><b style="color:#FFF;font-size:13px">${v.year} ${v.make} ${v.model}</b><br><span style="font-size:11px;color:#6B7280">VIN: ${v.vin8||v.stock_number}${v.soldTo||v.sold_to?" • Sold to: "+(v.soldTo||v.sold_to):""}</span></div><div style="text-align:right">${rHtml}</div></a>`;}
function dSec(t,c,n,rows){if(!rows)return"";return `<div style="margin-bottom:22px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:13px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:1px">${t}</span><span style="font-size:10px;padding:3px 10px;border-radius:10px;font-weight:600;background:${c}22;color:${c}">${n}</span></div>${rows}</div>`;}
function dTag(t,bg,c){return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:${bg};color:${c}">${t}</span>`;}

// Shows "who's who" block — buyer, seller, sold-to. Dedups if buyer == seller.
function partyBlock(d){
  const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;
  const buyer=clean(d.buyer)||clean(d.vehicle?.buyingBroker);
  const seller=clean(d.seller)||clean(d.vehicle?.sellingBroker);
  const soldTo=clean(d.vehicle?.soldTo)||clean(d.vehicle?.sold_to)||clean(d.dealer);
  const soldDate=clean(d.vehicle?.soldDate)||clean(d.vehicle?.sale_date);
  const sameBS=buyer&&seller&&buyer.toLowerCase()===seller.toLowerCase();
  const row=(label,value,valueColor)=>`<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1E1E32">${label}</td><td style="padding:8px 0;text-align:right;color:${valueColor||'#E5E7EB'};font-size:14px;font-weight:700;border-bottom:1px solid #1E1E32">${value}</td></tr>`;
  const lastRow=(label,value,valueColor)=>`<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px">${label}</td><td style="padding:8px 0;text-align:right;color:${valueColor||'#E5E7EB'};font-size:14px;font-weight:700">${value}</td></tr>`;
  const rows=[];
  if(sameBS){
    rows.push({label:'Buyer / Seller',value:buyer,color:'#E5E7EB'});
  }else{
    if(buyer)rows.push({label:'Buyer',value:buyer,color:'#E5E7EB'});
    if(seller)rows.push({label:'Seller',value:seller,color:'#E5E7EB'});
  }
  if(soldTo)rows.push({label:'Sold to',value:soldTo,color:'#34D399'});
  if(soldDate)rows.push({label:'Sale Date',value:fmtDate(soldDate),color:'#6EE7B7'});
  if(rows.length===0)return '';
  const trs=rows.map((r,i)=>i===rows.length-1?lastRow(r.label,r.value,r.color):row(r.label,r.value,r.color)).join('');
  return `<div style="background:#0D0D1A;border:1px solid #2A2A3E;border-radius:10px;padding:14px 16px;margin-bottom:16px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${trs}</table></div>`;
}

// Contact card — shows buyer contact info so vendors know who to reach with questions.
// `contact` is { name, phone, email, registered } — passed in via data.buyerContact (fetched in /send).
function contactBlock(contact,seller){
  if(!contact||!contact.name)return '';
  const name=contact.name;
  const phone=contact.phone;
  const email=contact.email;
  const cleanS=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;
  const sellerName=cleanS(seller);
  const row=(label,value,valueColor)=>`<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1E1E32">${label}</td><td style="padding:8px 0;text-align:right;color:${valueColor||'#E5E7EB'};font-size:14px;font-weight:700;border-bottom:1px solid #1E1E32;word-break:keep-all;overflow-wrap:anywhere">${value}</td></tr>`;
  const lastRow=(label,value,valueColor)=>`<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px">${label}</td><td style="padding:8px 0;text-align:right;color:${valueColor||'#E5E7EB'};font-size:14px;font-weight:700;word-break:keep-all;overflow-wrap:anywhere">${value}</td></tr>`;
  const rows=[];
  rows.push(row('Buyer',name,'#93C5FD'));
  if(phone)rows.push(row('Buyer phone',`<a href="tel:${phone.replace(/[^0-9+]/g,'')}" style="color:#E5E7EB;text-decoration:none">${phone}</a>`));
  if(email)rows.push(row('Buyer email',`<a href="mailto:${email}" style="color:#93C5FD;text-decoration:none">${email}</a>`));
  if(sellerName){
    if(rows.length>0){const last=rows.pop();rows.push(last);}
    rows.push(lastRow('Seller',sellerName,'#FCD34D'));
  }else if(rows.length>0){
    const lastIdx=rows.length-1;
    rows[lastIdx]=rows[lastIdx].replace('border-bottom:1px solid #1E1E32"','"');
  }
  return `<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-bottom:20px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:12px">Deal contacts</div><table style="width:100%;border-collapse:collapse">${rows.join('')}</table></div>`;
}


// NOTE: All 24 instant email templates (T object) and 3 digest templates from v3 are preserved.
// They are called via POST /send with {type, to, data} — same as before.
// The full template code is identical to worker v3 lines 26-167.
// For brevity in this file, they are referenced as T_TEMPLATES below.
// When deploying, paste the full T={...} and digests={...} objects from your current worker.

// PLACEHOLDER — paste your existing T={...} object here from the current worker
// This includes all 24 templates: vendor_assigned, vendor_bid_accepted, vendor_bid_declined,
// vendor_work_canceled, vendor_part_approved, vendor_work_started, buyer_bid_submitted,
// buyer_vendor_declined, buyer_work_complete, buyer_recon_complete, buyer_vehicle_kicked,
// buyer_approved_shipping, shipping_hold, vehicle_grounded, transport_inbound_set,
// driveway_inbound_pickedup, driveway_outbound_shipped, driveway_outbound_delivered,
// retail_vehicle_shipped, retail_vehicle_delivered, seller_vehicle_sold, seller_vehicle_kicked,
// seller_progress, dealer_vehicle_shipped, dealer_vehicle_delivered
const T={
vendor_assigned:(d)=>{const orderInfo=d.reconOrder?`<div style="padding:14px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-bottom:16px;text-align:center"><div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Recon Order</div><div style="font-size:28px;font-weight:800;color:#3B82F6">#${d.reconOrder} <span style="font-size:14px;font-weight:400;color:#6B7280">of ${d.totalReconSteps||"?"}</span></div>${(d.aheadTasks||[]).length>0?`<div style="margin-top:10px;padding-top:10px;border-top:1px solid #2A2A3E"><div style="font-size:11px;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">⏳ Ahead of You</div>${d.aheadTasks.map(a=>`<div style="font-size:13px;color:#E5E7EB;padding:4px 0">#${a.order} ${a.name} — <span style="color:${a.status==="complete"?"#34D399":a.status==="started"?"#FBBF24":"#6B7280"}">${a.status==="complete"?"✅ Done":a.status==="started"?"🔧 In Progress":"⏳ Pending"}</span></div>`).join("")}</div>`:`<div style="margin-top:6px;font-size:13px;color:#34D399;font-weight:600">🥇 You're first in line!</div>`}</div>`:"";const groundBanner=d.isGrounded?`<div style="background:#0D3B1E;padding:12px 28px;text-align:center;font-size:15px;font-weight:700;color:#34D399;letter-spacing:1px;border-bottom:1px solid #166534">✅ VEHICLE ON GROUND — Ready for Work${d.groundedDate?" — "+fmtDate(d.groundedDate):""}</div>`:"";return{subject:`🔧 New Job Assigned — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.category}`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","🔧","New Job Assigned",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">You've been assigned a new <b style="color:#93C5FD">${d.category}</b> job. Review and submit your bid.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller||d.vehicle?.sellingBroker)}${orderInfo}<div style="font-size:11px;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">🛠️ Tasks to Bid</div>${(d.tasks||[]).map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1A1A2E;border-radius:8px;margin-bottom:6px;font-size:14px;color:#E5E7EB;border-left:3px solid #3B82F6">🔧 ${t.desc}${t.isPart?" (Part Needed)":""}</div>`).join("")}${cta("View Job & Submit Bid →",d.vehicle.id,"#3B82F6","#FFF",d.categoryKey)}`,groundBanner+soldBnr(d.vehicle))}},
vendor_bid_accepted:(d)=>({subject:`✅ Bid Accepted — Start Work — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Bid Accepted — Start Work",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your bid has been accepted. Begin work immediately.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller||d.vehicle?.sellingBroker)}<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">✅ Approved Line Items</div>${(d.lineItems||[]).map(li=>liRow(li,"#166534")).join("")}${totBar("Total Approved",d.totalApproved,"#166534","#D1FAE5")}${cta("Open Job in Fleet Command →",d.vehicle.id,"#34D399","#0D0D1A",d.categoryKey)}`,soldBnr(d.vehicle))}),
vendor_bid_declined:(d)=>({subject:`❌ Bid Declined — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","❌","Bid Declined",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your bid has been declined. No further action needed.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller||d.vehicle?.sellingBroker)}${d.reason?`<div style="padding:14px;background:#3B1515;border:1px solid #7F1D1D;border-radius:8px"><div style="font-size:12px;color:#FCA5A5;font-weight:700;margin-bottom:4px">Reason</div><div style="font-size:14px;color:#FDBA74">${d.reason}</div></div>`:""}`)}),
vendor_work_canceled:(d)=>{const activeCount=(d.lineItems||[]).filter(li=>li.price>0).length;const cancelCount=(d.lineItems||[]).filter(li=>li.price===0).length;const allCanceled=activeCount===0;const hdrColor=allCanceled?"#3B1515":"#3B2F10";const hdrBorder=allCanceled?"#7F1D1D":"#78590A";const hdrText=allCanceled?"#FCA5A5":"#FDE68A";const hdrAccent=allCanceled?"#EF4444":"#F59E0B";const hdrIcon=allCanceled?"❌":"⚠️";const hdrLabel=allCanceled?"All work canceled":"Work updated — "+cancelCount+" item"+(cancelCount>1?"s":"")+" canceled";const bodyMsg=allCanceled?"All work has been canceled on this vehicle. <b style=\"color:#FCA5A5\">No further action needed.</b>":cancelCount+" item"+(cancelCount>1?"s have":" has")+" been canceled. You still have <b style=\"color:#34D399\">"+activeCount+" active task"+(activeCount>1?"s":"")+"</b> remaining.";return{subject:`${allCanceled?"❌ All Work Canceled":"⚠️ Work Updated — "+cancelCount+" Item"+(cancelCount>1?"s":"")+" Canceled"} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell(hdrColor,hdrBorder,hdrText,hdrAccent,hdrIcon,hdrLabel,`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${bodyMsg}</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller||d.vehicle?.sellingBroker)}${activeCount>0?`<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">✅ Active — continue work</div>${(d.lineItems||[]).filter(li=>li.price>0).map(li=>liRow(li,"#166534")).join("")}`:""}${`<div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:16px 0 8px">❌ Canceled</div>${(d.lineItems||[]).filter(li=>li.price===0).map(li=>liRow(li,"#7F1D1D")).join("")}`}${totBar(allCanceled?"Total":"Remaining total",d.totalRemaining||0,allCanceled?"#7F1D1D":"#166534",allCanceled?"#FCA5A5":"#D1FAE5")}${activeCount>0?cta("View remaining work →",d.vehicle.id,"#F59E0B","#0D0D1A"):""}`)}},
vendor_part_approved:(d)=>({subject:`📦 Part Approved — ${d.part.desc} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","📦","Part Approved — Order Now",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part has been approved. Order ASAP.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller||d.vehicle?.sellingBroker)}<div style="background:#0D0D1A;border-radius:12px;border:2px solid #3B82F6;padding:20px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:20px;font-weight:700;color:#FFF">${d.part.desc}</span><span style="font-size:22px;font-weight:700;color:#FBBF24">$${d.part.price}</span></div><div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0D3B1E;border-radius:8px;border:1px solid #166534"><span style="font-size:20px">✅</span><div><div style="font-size:15px;font-weight:600;color:#34D399">Approved by ${d.part.approvedBy||"Buyer"}</div><div style="font-size:12px;color:#6EE7B7">${fmtDate(d.part.approvedDate)}</div></div></div></div>${cta("Open Job & Mark Ordered →",d.vehicle.id,"#3B82F6","#FFF",d.categoryKey)}`,soldBnr(d.vehicle))}),
vendor_work_started:(d)=>({subject:`🔧 Work Started — ${d.vendor.name} — ${d.category} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","🔧","Work Started",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> has started work on <b style="color:#93C5FD">${d.category}</b>.</div>${vBlock(d.vehicle)}${(d.lineItems||[]).map(li=>liRow(li,"#78590A")).join("")}${totBar("Approved Total",d.totalApproved,"#78590A","#FDE68A")}<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-top:16px;text-align:center"><div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">Started</div><div style="font-size:18px;font-weight:700;color:#FBBF24">${fmtDate(d.startedDate)}</div>${d.etaComplete?`<div style="font-size:12px;color:#6B7280;margin-top:4px">ETA Complete: <b style="color:#60A5FA">${fmtDate(d.etaComplete)}</b></div>`:""}</div>${cta("View Progress →",d.vehicle.id,"#F59E0B","#0D0D1A")}`,soldBnr(d.vehicle))}),
buyer_bid_submitted:(d)=>{const ws=(d.lineItems||[]).filter(l=>l.costType==="ws").reduce((s,l)=>s+(l.price||0),0);const rt=(d.lineItems||[]).filter(l=>l.costType!=="ws").reduce((s,l)=>s+(l.price||0),0);return{subject:`📩 Bid Submitted — ${d.vendor.name} — $${d.totalBid||0} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","📩","Vendor Bid Submitted",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> submitted a bid for <b style="color:#93C5FD">${d.category}</b>.</div>${vBlock(d.vehicle)}<div style="padding:14px;background:#0D0D1A;border-radius:10px 10px 0 0;border:1px solid #2A2A3E;border-bottom:none;display:flex;justify-content:space-between;align-items:center"><span style="font-size:16px;font-weight:700;color:#FFF">🔧 ${d.vendor.name}</span><span style="font-size:18px;font-weight:700;color:#FBBF24">$${d.totalBid||0}</span></div><div style="border:1px solid #2A2A3E;border-top:none;border-radius:0 0 10px 10px;padding:10px">${(d.lineItems||[]).map(li=>liRow(li,"#78590A")).join("")}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><div style="text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase">WS</div><div style="font-size:18px;font-weight:700;color:#93C5FD">$${ws}</div></div><div style="text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase">RT</div><div style="font-size:18px;font-weight:700;color:#FDE68A">$${rt}</div></div></div>${cta("Review & Accept/Decline →",d.vehicle.id,"#F59E0B","#0D0D1A",d.categoryKey)}`,soldBnr(d.vehicle))};},
buyer_vendor_declined:(d)=>({subject:`❌ Vendor Declined — ${d.vendor.name} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","❌","Vendor Declined Job",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FCA5A5">${d.vendor.name}</b> declined the <b>${d.category}</b> job. Reassign to another vendor.</div>${vBlock(d.vehicle)}${d.reason?`<div style="padding:14px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:16px;text-align:center"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;font-weight:700;margin-bottom:4px">Reason</div><div style="font-size:15px;color:#FDBA74">"${d.reason}"</div></div>`:""}${cta("Reassign Vendor →",d.vehicle.id,"#EF4444","#FFF",d.categoryKey)}`,soldBnr(d.vehicle))}),
buyer_work_complete:(d)=>({subject:`⚠️ ACTION NEEDED — Approve Payment — ${d.vendor.name} — ${d.category} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","⚠️","Work Complete — Approval Needed",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> marked <b>${d.category}</b> complete. <b style="color:#FDE68A">Review and approve for payment</b> — accounting cannot cut a check until you approve.</div>${vBlock(d.vehicle)}${(d.lineItems||[]).map(li=>liRow(li,"#78590A")).join("")}${totBar("Total to Approve",d.totalCost,"#78590A","#FDE68A")}<div style="padding:14px;background:#3B2F10;border:2px solid #F59E0B;border-radius:10px;margin-bottom:16px;text-align:center"><div style="font-size:13px;color:#FDE68A;font-weight:700">⚠️ APPROVAL REQUIRED TO RELEASE PAYMENT</div><div style="font-size:11px;color:#FBBF24;margin-top:4px">Click below to review the finished work and approve or dispute.</div></div>${cta("Review & Approve →",d.vehicle.id,"#F59E0B","#0D0D1A",d.categoryKey)}`,soldBnr(d.vehicle))}),
buyer_recon_complete:(d)=>{const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const role=d.recipientRole||'other';const greet=role==='seller'?(clean(d.seller)||clean(d.buyer)||"Team"):(clean(d.buyer)||clean(d.seller)||"Team");const msg=role==='seller'?"A vehicle you sold has finished recon. Ready for transport.":role==='buyer'?"Your vehicle has finished recon. Ready for transport.":"All recon tasks are complete. Ready for transport.";return{subject:`✅ All Recon Complete — Ready to Ship — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","All Recon Done — Ready to Ship",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">✅ Completed Tasks</div>${(d.reconSummary||[]).map(r=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;border-left:3px solid #166534"><div><div style="font-size:13px;color:#E5E7EB">${r.icon||"🔧"} ${r.category}</div><div style="font-size:11px;color:#6B7280">${r.vendor}</div></div><div style="font-size:14px;font-weight:700;color:#34D399">$${r.cost||0}</div></div>`).join("")}${totBar("Total Recon Cost",d.totalReconCost,"#166534","#D1FAE5")}${cta("Set Up Transport →",d.vehicle.id,"#34D399","#0D0D1A")}`)}},
buyer_vehicle_kicked:(d)=>({subject:`🔄 URGENT — Vehicle Kicked — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.kickedBy}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","🔄","Vehicle Kicked Back",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A vehicle has been kicked back. Immediate attention needed.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:20px"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔴 Reason</div><div style="font-size:16px;font-weight:600;color:#FDBA74">${d.kickReason}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Kicked by: ${d.kickedBy} • ${fmtDate(d.kickDate)}</div></div><div style="padding:14px;background:#3B2F10;border:1px solid #78590A;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:700;color:#FDE68A">📍 Back in Inventory — ${d.vehicle.location}</div></div>${cta("View Vehicle →",d.vehicle.id,"#EF4444","#FFF")}`)}),
buyer_approved_shipping:(d)=>({subject:`✅ Shipping Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.dealer}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Shipping Approved",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Shipping has been approved. Ready to set up outbound transport.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:14px;color:#6EE7B7;text-transform:uppercase;letter-spacing:2px;font-weight:700">Ready to Ship</div><div style="font-size:22px;font-weight:700;color:#34D399;margin-top:4px">${d.dealer||"Buyer"}</div><div style="font-size:13px;color:#6EE7B7;margin-top:4px">Approved: ${fmtDate(d.approvedDate)}</div></div>${cta("Set Up Transport →",d.vehicle.id,"#34D399","#0D0D1A")}`)}),
shipping_hold:(d)=>({subject:`🛑 SHIPPING ON HOLD — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","🛑","Shipping On Hold",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Shipping has been put on hold for this vehicle.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">🛑</div><div style="font-size:18px;font-weight:700;color:#FCA5A5">SHIPPING ON HOLD</div><div style="font-size:14px;color:#FDBA74;margin-top:8px">${d.reason||"Buyer unapproved shipping"}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Held by: ${d.holdBy||"Buyer"} • ${fmtDate(d.holdDate)}</div></div>${cta("View Vehicle →",d.vehicle.id,"#EF4444","#FFF")}`)}),
vehicle_grounded:(d)=>{const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const role=d.recipientRole||'other';const greet=role==='seller'?(clean(d.seller)||clean(d.buyer)||"Team"):(clean(d.buyer)||clean(d.seller)||"Team");const msg=role==='seller'?"A vehicle you sold is on the ground and ready for work.":role==='buyer'?"Your vehicle is on the ground and ready for work.":"Vehicle is on the ground and ready for action.";return{subject:`📍 GROUNDED — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.location}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","📍","GROUNDED",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">📍</div><div style="font-size:24px;font-weight:700;color:#34D399">GROUNDED — ${d.location}</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.groundedDate)}</div></div>${cta("Open Vehicle →",d.vehicle.id,"#34D399","#0D0D1A")}`)}},
transport_inbound_set:(d)=>({subject:`🚛 Inbound Transport Set — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ETA ${fmtDate(d.transport?.eta)}`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","🚛","Inbound Transport Set",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Inbound transport has been arranged. Vehicle is on the way.</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:20px;background:#1E3A5F;border:2px solid #3B82F6;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:#93C5FD;text-transform:uppercase;letter-spacing:2px;font-weight:700">ETA Arrival</div><div style="font-size:28px;font-weight:700;color:#FFF;margin-top:4px">${fmtDate(d.transport?.eta)}</div><div style="font-size:14px;color:#93C5FD;margin-top:4px">→ ${d.transport?.destination||"TBD"}</div></div><div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport Details</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.company||"—"}</b></div><div>Phone<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.phone||"—"}</b></div><div>Email<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.email||"—"}</b></div><div>Cost<br><b style="color:#FBBF24;font-size:14px">${d.transport?.cost?"$"+d.transport.cost:"—"}</b></div></div></div>${cta("View Vehicle →",d.vehicle.id,"#3B82F6","#FFF")}`)}),
driveway_inbound_pickedup:(d)=>({subject:`🏠 Driveway Picked Up — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.destination}`,html:shell("#4C1D95","#4C1D95","#DDD6FE","#7C3AED","🏠","Driveway — Picked Up",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway buy has been picked up and is headed to <b style="color:#DDD6FE">${d.destination}</b>.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#4C1D95;border:2px solid #7C3AED;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">🏠</div><div style="font-size:18px;font-weight:700;color:#DDD6FE">PICKED UP</div><div style="font-size:14px;color:#C4B5FD;margin-top:4px">${d.dwCompany||"Transport"} • ${fmtDate(d.pickedUpDate)}</div><div style="font-size:16px;font-weight:700;color:#FFF;margin-top:8px">→ ${d.destination}</div></div>${cta("Track Vehicle →",d.vehicle.id,"#7C3AED","#FFF")}`)}),
driveway_outbound_shipped:(d)=>({subject:`🏠 Driveway Shipped — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.destination}`,html:shell("#4C1D95","#4C1D95","#DDD6FE","#7C3AED","🏠","Driveway — Shipped",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway delivery has been picked up and shipped to <b style="color:#DDD6FE">${d.destination||d.dealer}</b>.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#4C1D95;border:2px solid #7C3AED;border-radius:12px;text-align:center"><div style="font-size:36px;margin-bottom:6px">🚛</div><div style="font-size:18px;font-weight:700;color:#DDD6FE">SHIPPED — DRIVEWAY</div><div style="font-size:16px;font-weight:700;color:#FFF;margin-top:8px">→ ${d.destination||d.dealer}</div></div>${cta("Track Vehicle →",d.vehicle.id,"#7C3AED","#FFF")}`)}),
driveway_outbound_delivered:(d)=>({subject:`✅ Driveway Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Driveway — Delivered",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway delivery has been completed to <b style="color:#34D399">${d.destination||d.dealer}</b>.</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">DELIVERED</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.deliveredDate)}</div></div>${cta("View Vehicle →",d.vehicle.id,"#34D399","#0D0D1A")}`)}),
retail_vehicle_shipped:(d)=>({subject:`🚛 Retail Delivery Shipped — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.customerName}`,html:shell("#164E63","#164E63","#67E8F9","#06B6D4","🚛","Retail Delivery Shipped",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Retail delivery is on the way to the customer.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#164E63;border:2px solid #06B6D4;border-radius:12px;margin-bottom:16px"><div style="font-size:11px;color:#67E8F9;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Customer</div><div style="font-size:18px;font-weight:700;color:#FFF">${d.customerName||"—"}</div><div style="font-size:13px;color:#67E8F9;margin-top:4px">${d.customerPhone||""} • ${d.customerEmail||""}</div><div style="font-size:13px;color:#67E8F9;margin-top:2px">📍 ${d.deliveryAddress||"—"}</div></div>${d.transport?`<div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${d.transport.company||"—"}</b></div><div>ETA<br><b style="color:#67E8F9;font-size:14px">${fmtDate(d.transport.eta)}</b></div></div></div>`:""}<div style="font-size:13px;color:#6B7280;margin-top:12px;text-align:center">Picked up: ${fmtDate(d.pickedUpDate)}</div>${cta("View Vehicle →",d.vehicle.id,"#06B6D4","#FFF")}`)}),
retail_vehicle_delivered:(d)=>({subject:`✅ Retail Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.customerName}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Retail Delivery Complete",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Retail delivery has been completed.</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">DELIVERED TO CUSTOMER</div><div style="font-size:16px;font-weight:600;color:#6EE7B7;margin-top:6px">${d.customerName||"Customer"}</div><div style="font-size:13px;color:#6EE7B7;margin-top:2px">📍 ${d.deliveryAddress||"—"}</div><div style="font-size:14px;color:#6EE7B7;margin-top:8px">${fmtDate(d.deliveredDate)}</div></div>${cta("View Vehicle →",d.vehicle.id,"#34D399","#0D0D1A")}`)}),
seller_vehicle_sold:(d)=>{const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const role=d.recipientRole||'other';const greet=role==='seller'?(clean(d.seller)||clean(d.buyer)||"Team"):(clean(d.buyer)||clean(d.seller)||"Team");const dealer=clean(d.vehicle.soldTo)||"—";const msg=role==='seller'?`You sold this vehicle to <b style="color:#6EE7B7">${dealer}</b>.`:role==='buyer'?`Your vehicle sold to <b style="color:#6EE7B7">${dealer}</b>.`:"This vehicle has been sold.";return{subject:`💰 Vehicle Sold — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.vehicle.soldTo}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","💰","Vehicle Sold",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#34D399">Sold to: ${d.vehicle.soldTo}</div><div style="font-size:14px;color:#6EE7B7;margin-top:4px">Sale Date: ${fmtDate(d.vehicle.soldDate)}</div></div>${cta("View Vehicle →",d.vehicle.id,"#34D399","#0D0D1A")}`)}},
seller_vehicle_kicked:(d)=>{const clean=(x)=>x&&typeof x==='string'&&x.trim()&&x.trim().toLowerCase()!=='null'&&x.trim().toLowerCase()!=='undefined'?x.trim():null;const role=d.recipientRole||'other';const greet=role==='seller'?(clean(d.seller)||clean(d.buyer)||"Team"):(clean(d.buyer)||clean(d.seller)||"Team");const msg=role==='seller'?"A vehicle you sold has been kicked back and is returning to inventory.":role==='buyer'?"Your vehicle has been kicked back and is returning to inventory.":"A vehicle has been kicked back and is returning to inventory.";return{subject:`🔄 Vehicle Kicked — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.kickedBy}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","🔄","Vehicle Kicked Back",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:20px"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔴 Reason</div><div style="font-size:16px;font-weight:600;color:#FDBA74">${d.kickReason||"—"}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Kicked by: ${d.kickedBy||"—"}${d.kickDate?" • "+fmtDate(d.kickDate):""}</div></div><div style="padding:14px;background:#3B2F10;border:1px solid #78590A;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:700;color:#FDE68A">📍 Back in Inventory — ${d.vehicle.location||"—"}</div></div>${cta("View Vehicle →",d.vehicle.id,"#EF4444","#FFF")}`)}},
seller_progress:(d)=>({subject:`📋 Update — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.statusText}`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","📋",d.statusText,`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.seller},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Update on a vehicle you sold:</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E"><div style="font-size:13px;font-weight:700;color:#93C5FD;margin-bottom:8px">📋 STATUS</div><div style="font-size:16px;font-weight:700;color:#FFF">${d.statusText}</div>${d.detail?`<div style="font-size:13px;color:#9CA3AF;margin-top:4px">${d.detail}</div>`:""}</div>${cta("View Vehicle →",d.vehicle.id,"#3B82F6","#FFF")}`)}),
dealer_vehicle_shipped:(d)=>({subject:`🚛 Vehicle Shipped — ETA ${fmtDate((d.transport||{}).eta)} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","🚛","Your Vehicle Has Shipped",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.dealer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your vehicle is on its way.</div><div style="background:#0D0D1A;border-radius:12px;border:1px solid #2A2A3E;padding:18px;margin-bottom:20px"><div style="font-size:20px;font-weight:700;color:#FFF">${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}</div><div style="font-size:13px;color:#6B7280">VIN: ${d.vehicle.vin8||d.vehicle.stock_number} • ${d.vehicle.color} • ${(d.vehicle.miles||0).toLocaleString()} mi</div></div><div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:20px"><div style="font-size:12px;color:#6EE7B7;text-transform:uppercase;letter-spacing:2px;font-weight:700">Estimated Arrival</div><div style="font-size:28px;font-weight:700;color:#34D399;margin-top:4px">${fmtDate((d.transport||{}).eta)}</div></div><div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${(d.transport||{}).company||"—"}</b></div><div>Phone<br><b style="color:#E5E7EB;font-size:14px">${(d.transport||{}).phone||"—"}</b></div></div></div><div style="font-size:13px;color:#6B7280;margin-top:12px;text-align:center">Picked up: ${fmtDate(d.pickedUpDate)}</div>`)}),
dealer_vehicle_delivered:(d)=>({subject:`✅ Vehicle Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Vehicle Delivered",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.dealer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your vehicle has been delivered. Thank you!</div><div style="background:#0D0D1A;border-radius:12px;border:1px solid #2A2A3E;padding:18px;margin-bottom:20px"><div style="font-size:20px;font-weight:700;color:#FFF">${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}</div><div style="font-size:13px;color:#6B7280">VIN: ${d.vehicle.vin8||d.vehicle.stock_number} • ${d.vehicle.color}</div></div><div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">Delivered Successfully</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.deliveredDate)}</div></div>`)}),

parts_request_to_pm:(d)=>({subject:`📦 Parts Request — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.partCount} parts`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","📦","New Parts Request",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.partsManager||"Parts Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Vendor <b style="color:#FDE68A">${d.vendor?.name||"—"}</b> has flagged parts needed on this vehicle. Please source and quote each part.</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#3B2F10;border:2px solid #78590A;border-radius:10px;margin-bottom:16px"><div style="font-size:11px;color:#FBBF24;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Parts needed (${d.partCount||0})</div>${(d.parts||[]).map(p=>`<div style="padding:10px;background:#0D0D1A;border-radius:8px;border-left:3px solid #FBBF24;margin-bottom:6px"><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div></div>`).join("")}</div>${cta("Quote Parts →",d.vehicle.id,"#F59E0B","#0D0D1A")}`)}),

parts_quoted_to_buyer:(d)=>({subject:`💰 Parts Quoted — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — $${(d.totalQuote||0).toLocaleString()}`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","💰","Parts Quote Ready",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Parts manager has quoted prices. Review and approve each part to proceed.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#3B2F10;border:2px solid #78590A;border-radius:10px;margin-bottom:16px"><div style="font-size:11px;color:#FBBF24;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Quoted parts</div>${(d.parts||[]).map(p=>`<div style="padding:10px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div><div style="font-size:11px;color:#6B7280;margin-top:2px">ETA: ${fmtDate(p.partETA)}</div></div><div style="font-size:16px;font-weight:700;color:#FBBF24">$${(p.partPrice||0).toLocaleString()}</div></div>`).join("")}<div style="border-top:1px solid #78590A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between"><span style="font-size:13px;color:#FDE68A;font-weight:700">Total quote</span><span style="font-size:18px;color:#FDE68A;font-weight:700">$${(d.totalQuote||0).toLocaleString()}</span></div></div>${cta("Review & Approve →",d.vehicle.id,"#F59E0B","#0D0D1A")}`)}),

parts_approved_to_pm:(d)=>({subject:`✅ Parts Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — Order now`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Parts Approved — Place Order",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.partsManager||"Parts Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Buyer has approved parts pricing. Please place orders.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px"><div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Approved parts (${(d.parts||[]).length})</div>${(d.parts||[]).map(p=>`<div style="padding:10px;background:#0D0D1A;border-radius:8px;margin-bottom:6px"><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div><div style="font-size:11px;color:#6B7280;margin-top:2px">$${(p.partPrice||0).toLocaleString()} • ETA ${fmtDate(p.partETA)}</div></div>`).join("")}</div>${cta("Order Parts →",d.vehicle.id,"#34D399","#0D0D1A")}`)}),

parts_approved_to_vendor:(d)=>({subject:`✅ Parts Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","Parts Approved — Ordering",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name||"Vendor"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Buyer approved the parts. Parts manager is placing the order. You'll get an email when each part arrives.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px"><div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Parts being ordered</div>${(d.parts||[]).map(p=>`<div style="padding:8px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between"><span style="font-size:13px;color:#E5E7EB">${p.desc}</span><span style="font-size:11px;color:#6B7280">ETA ${fmtDate(p.partETA)}</span></div>`).join("")}</div>${cta("View Job →",d.vehicle.id,"#34D399","#0D0D1A",d.categoryKey)}`)}),

part_received:(d)=>({subject:`📦 Part Received — ${d.partDesc} — ${d.receivedCount} of ${d.totalParts} in`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","📦","Part Received",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part has arrived for this vehicle.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">📦</div><div style="font-size:18px;font-weight:700;color:#34D399">${d.partDesc}</div><div style="font-size:13px;color:#6EE7B7;margin-top:4px">Received ${fmtDate(d.partReceivedDate)}</div></div><div style="padding:14px;background:#0D0D1A;border:1px solid #2A2A3E;border-radius:8px;text-align:center"><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px">Progress</div><div style="font-size:22px;font-weight:700;color:#FFF;margin-top:4px">${d.receivedCount} of ${d.totalParts} parts in</div>${d.remainingParts?.length?`<div style="margin-top:10px;font-size:12px;color:#6B7280">Still waiting on: ${d.remainingParts.map(p=>p.desc+" (ETA "+fmtDate(p.partETA)+")").join(", ")}</div>`:""}</div>${cta("View Vehicle →",d.vehicle.id,"#34D399","#0D0D1A",d.categoryKey)}`)}),

all_parts_received:(d)=>({subject:`✅ ALL Parts In — Resume Work — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","✅","All Parts Received — Resume Work",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">All parts have arrived. ${d.recipientRole==="vendor"?"You can now resume work on this vehicle.":"Vendor has been notified to resume work."}</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">ALL PARTS IN</div><div style="font-size:13px;color:#6EE7B7;margin-top:6px">${(d.parts||[]).length} parts received</div></div><div style="padding:14px;background:#0D0D1A;border:1px solid #2A2A3E;border-radius:8px">${(d.parts||[]).map(p=>`<div style="padding:6px 0;font-size:13px;color:#E5E7EB;border-bottom:1px solid #1E1E32">✓ ${p.desc} <span style="color:#6B7280;font-size:11px">— ${fmtDate(p.partReceivedDate)}</span></div>`).join("")}</div>${cta(d.recipientRole==="vendor"?"Resume Work →":"View Vehicle →",d.vehicle.id,"#34D399","#0D0D1A",d.categoryKey)}`)}),

part_rejected:(d)=>({subject:`❌ Part Rejected — ${d.partDesc} — Re-ordering`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","❌","Part Rejected",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part arrived but was rejected. Parts manager is sourcing a replacement.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#FCA5A5;margin-bottom:6px">❌ ${d.partDesc}</div><div style="font-size:12px;color:#FDBA74;margin-bottom:6px">Reason: ${d.rejectedReason||"Not specified"}</div><div style="font-size:11px;color:#6B7280">Rejected ${fmtDate(d.rejectedDate)}</div></div><div style="padding:12px;background:#0D0D1A;border-radius:8px;text-align:center"><div style="font-size:13px;color:#FBBF24">⏳ Re-ordering — new ETA will be provided</div></div>${cta("View Vehicle →",d.vehicle.id,"#EF4444","#FFF",d.categoryKey)}`)}),

part_backorder:(d)=>({subject:`⏳ Part Backordered — ${d.partDesc} — New ETA ${fmtDate(d.newETA)}`,html:shell("#3B2F10","#78590A","#FDE68A","#F59E0B","⏳","Part Backordered",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient||"Team"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part is on backorder. ETA has been extended.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#3B2F10;border:2px solid #78590A;border-radius:12px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#FDE68A;margin-bottom:6px">⏳ ${d.partDesc}</div><div style="font-size:12px;color:#FBBF24;margin-top:8px">Original ETA: ${fmtDate(d.originalETA)}</div><div style="font-size:14px;color:#FDE68A;margin-top:4px;font-weight:700">New ETA: ${fmtDate(d.newETA)}</div></div>${cta("View Vehicle →",d.vehicle.id,"#F59E0B","#0D0D1A",d.categoryKey)}`)}),

recon_approved_for_payment:(d)=>({subject:`💸 Approved for Payment — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — $${(d.lockedTotal||0).toLocaleString()} to ${d.vendor?.name}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","💸","Approved for Payment",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">Team,</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${d.approvedBy||"Buyer"} has approved this completed recon work for payment. Amount is locked.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700">${d.category}</span><span style="padding:3px 8px;background:#1E3A5F;color:#93C5FD;border-radius:4px;font-size:10px;font-weight:700">📍 ${d.location||"PHX"}</span></div><div style="font-size:18px;font-weight:700;color:#FFF;margin-bottom:6px">${d.vendor?.name}</div>${(d.lineItems||[]).map(li=>`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#E5E7EB;border-bottom:1px solid #1E1E32"><span>${li.desc}</span><span><span style="color:${li.costType==="retail"?"#67E8F9":"#93C5FD"};font-size:10px;margin-right:6px">${li.costType==="retail"?"Retail":"W/S"}</span><span style="color:#FBBF24;font-weight:700">$${Number(li.price)||0}</span></span></div>`).join("")}<div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:8px;border-top:1px solid #166534"><span style="color:#34D399;font-weight:700">LOCKED TOTAL</span><span style="color:#34D399;font-weight:700;font-size:20px">$${(d.lockedTotal||0).toLocaleString()}</span></div>${(d.lockedWS>0||d.lockedRetail>0)?`<div style="font-size:11px;color:#6B7280;text-align:right;margin-top:4px">W/S: $${(d.lockedWS||0).toLocaleString()} • Retail: $${(d.lockedRetail||0).toLocaleString()}</div>`:""}</div><div style="padding:12px;background:#0D0D1A;border:1px dashed #166534;border-radius:8px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:#9CA3AF">Approved by</div><div style="font-size:14px;color:#FFF;font-weight:700;margin-top:2px">${d.approvedBy||"Buyer"} on ${fmtDate(d.approvedDate)}</div></div>${cta("Open Payment Queue →",d.vehicle.id,"#34D399","#0D0D1A",d.categoryKey)}`)}),

recon_disputed:(d)=>({subject:`⚠️ Work Disputed — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.category}`,html:shell("#3B1515","#7F1D1D","#FCA5A5","#EF4444","⚠️","Work Disputed",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name||"Vendor"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${d.disputedBy||"Buyer"} has disputed your completed work. Please review and address.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact,d.seller)}<div style="padding:18px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;margin-bottom:16px"><div style="font-size:12px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">Reason for dispute</div><div style="font-size:14px;color:#FFF;line-height:1.6;background:#0D0D1A;padding:12px;border-radius:8px;border-left:3px solid #EF4444">${d.reason}</div><div style="font-size:11px;color:#FDBA74;margin-top:10px">Disputed by ${d.disputedBy||"Buyer"} on ${fmtDate(d.disputedDate)}</div></div><div style="padding:12px;background:#0D0D1A;border:1px dashed #7F1D1D;border-radius:8px;text-align:center"><div style="font-size:13px;color:#FCA5A5;font-weight:700">Work status reverted to "In Progress"</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px">Please address the issue and re-submit when complete</div></div>${cta("View Job →",d.vehicle.id,"#EF4444","#FFF",d.categoryKey)}`)}),

vendor_payment_receipt:(d)=>({subject:`💸 Payment Sent — Check #${d.checkNumber} — $${(d.totalPaid||0).toLocaleString()} to ${d.vendor?.name||"Vendor"}`,html:shell("#0D3B1E","#166534","#6EE7B7","#34D399","💸","Payment Sent",`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name||"Vendor"},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your payment has been issued. Below is the breakdown for your records.</div><div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;margin-bottom:16px"><div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1;text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">📝 Check written</div><div style="font-size:15px;color:#FFF;font-weight:700;margin-top:4px">${fmtDate(d.checkWrittenDate)}</div></div><div style="flex:1;text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">📬 Mailed</div><div style="font-size:15px;color:#FFF;font-weight:700;margin-top:4px">${fmtDate(d.checkMailedDate)}</div></div></div><div style="text-align:center;padding-top:10px;border-top:1px solid #166534"><div style="font-size:12px;color:#6EE7B7">Check #${d.checkNumber} via ${d.deliveryMethod||"USPS Mail"}</div><div style="font-size:26px;font-weight:700;color:#34D399;margin-top:2px">$${(d.totalPaid||0).toLocaleString()}</div></div></div><div style="font-size:12px;color:#9CA3AF;margin-bottom:10px;font-weight:600">Covered work (${(d.jobs||[]).length} job${(d.jobs||[]).length===1?"":"s"}):</div>${(d.jobs||[]).map(j=>`<div style="padding:12px;background:#0D0D1A;border-radius:8px;border-left:3px solid #34D399;margin-bottom:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-size:13px;color:#FFF;font-weight:700">${j.vehicleYear} ${j.vehicleMake} ${j.vehicleModel} ${j.vehicleTrim||""}</div><div style="font-size:13px;color:#FBBF24;font-weight:700">$${Number(j.total).toLocaleString()}</div></div><div style="font-size:10px;color:#6B7280;font-family:monospace">VIN ${j.vin8||"—"} • ${j.categoryIcon||""} ${j.categoryLabel?.toUpperCase()}</div><div style="font-size:11px;color:#9CA3AF;margin-top:6px;line-height:1.7;padding-left:8px">${(j.lineItems||[]).map(li=>`• ${li.desc} — $${Number(li.price)||0}${li.costType?` <span style="color:#6B7280">(${li.costType==="retail"?"Retail":"W/S"})</span>`:""}`).join("<br>")}</div><div style="font-size:10px;color:#6EE7B7;margin-top:6px;padding-top:6px;border-top:1px solid #166534">✅ Approved ${fmtDate(j.approvedDate)} by ${j.approvedBy||"Buyer"}</div></div>`).join("")}<div style="margin-top:12px;padding:10px;background:#0D0D1A;border-radius:6px;text-align:center;font-size:11px;color:#6B7280">Issued by ${d.paidBy||"Accounting"} • Fleet Command Recon</div>`)}),
};

const digests={
vendor_digest:(d)=>{const sv=(d.vehicles||[]);if(!sv.length)return null;const sp=sv.filter(v=>v.sold&&v.pastDue),sa=sv.filter(v=>v.sold&&!v.pastDue),pd=sv.filter(v=>!v.sold&&v.pastDue),ip=sv.filter(v=>!v.sold&&!v.pastDue&&v.status==="started"),nb=sv.filter(v=>v.status==="assigned"),pw=sv.filter(v=>v.partsInfo);const tl={morning:"7:00 AM",noon:"12:00 PM",evening:"6:00 PM"}[d.time]||"";const stats=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px 28px;background:#0D0D1A;border-bottom:1px solid #2A2A3E"><div style="text-align:center;padding:10px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:24px;font-weight:700;color:#FCA5A5">${sp.length+pd.length}</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase">Past Due</div></div><div style="text-align:center;padding:10px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:24px;font-weight:700;color:#FBBF24">${ip.length+sa.length}</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase">In Progress</div></div><div style="text-align:center;padding:10px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:24px;font-weight:700;color:#93C5FD">${nb.length}</div><div style="font-size:10px;color:#6B7280;text-transform:uppercase">Needs Bid</div></div></div>`;let b="";if(sp.length)b+=dSec("🔴 SOLD — Past Due (PRIORITY)","#EF4444",sp.length,sp.map(v=>dRow(v,dTag(`${v.daysLate}d LATE`,"#3B1515","#FCA5A5"),"#EF4444")).join(""));if(sa.length)b+=dSec("💰 Sold — In Progress","#F59E0B",sa.length,sa.map(v=>dRow(v,dTag(v.statusLabel||"IN PROGRESS","#3B2F10","#FDE68A"),"#F59E0B")).join(""));if(pd.length)b+=dSec("⚠️ Past Due","#F59E0B",pd.length,pd.map(v=>dRow(v,dTag(`${v.daysLate}d LATE`,"#3B2F10","#FDE68A"),"#F59E0B")).join(""));if(ip.length)b+=dSec("🔧 In Progress","#FBBF24",ip.length,ip.map(v=>dRow(v,dTag(`ETA ${fmtDate(v.eta)}`,"#1A1A2E","#9CA3AF"),"#FBBF24")).join(""));if(nb.length)b+=dSec("📋 Needs Your Bid","#93C5FD",nb.length,nb.map(v=>dRow(v,dTag(`Since ${fmtDate(v.assignedDate)}`,"#1E3A5F","#93C5FD"),"#3B82F6")).join(""));if(pw.length)b+=dSec("📦 Parts Status","#DDD6FE",pw.length,pw.map(v=>dRow(v,dTag(v.partsInfo,"#4C1D95","#DDD6FE"),"#7C3AED")).join(""));b+=`<div style="text-align:center;margin-top:20px"><a href="${APP_URL}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none">Open All Jobs →</a></div>`;return{subject:`📋 ${d.vendor.name} — ${sv.length} Open Jobs — ${sp.length+pd.length} Past Due`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","📋",`Vendor Digest — ${tl}`,b,stats)};},
buyer_digest:(d)=>{const sp=d.sections?.soldPastDue||[],up=d.sections?.unsoldPastDue||[],bw=d.sections?.bidsWaiting||[],vd=d.sections?.vendorsDeclined||[],rs=d.sections?.readyToShip||[],it=d.sections?.inTransit||[];const tot=sp.length+up.length+bw.length+vd.length+rs.length+it.length;if(!tot)return null;const tl=d.time==="morning"?"6:00 AM":"5:00 PM";const stats=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:14px 20px;background:#0D0D1A;border-bottom:1px solid #2A2A3E"><div style="text-align:center;padding:10px 4px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:22px;font-weight:700;color:#FCA5A5">${sp.length+up.length}</div><div style="font-size:9px;color:#6B7280;text-transform:uppercase">Past Due</div></div><div style="text-align:center;padding:10px 4px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:22px;font-weight:700;color:#FBBF24">${bw.length+vd.length}</div><div style="font-size:9px;color:#6B7280;text-transform:uppercase">Need Action</div></div><div style="text-align:center;padding:10px 4px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:22px;font-weight:700;color:#34D399">${rs.length}</div><div style="font-size:9px;color:#6B7280;text-transform:uppercase">Ready Ship</div></div><div style="text-align:center;padding:10px 4px;border-radius:8px;background:#12121E;border:1px solid #2A2A3E"><div style="font-size:22px;font-weight:700;color:#60A5FA">${it.length}</div><div style="font-size:9px;color:#6B7280;text-transform:uppercase">In Transit</div></div></div>`;let b="";if(sp.length)b+=dSec("🔴 Sold — Past Due","#FCA5A5",sp.length,sp.map(v=>dRow(v,dTag(v.statusLabel||"LATE","#3B1515","#FCA5A5"),"#EF4444")).join(""));if(up.length)b+=dSec("⚠️ Unsold — Past Due","#F59E0B",up.length,up.map(v=>dRow(v,dTag(v.statusLabel||"LATE","#3B2F10","#FDE68A"),"#F59E0B")).join(""));if(bw.length)b+=dSec("📩 Bids Waiting Review","#FBBF24",bw.length,bw.map(v=>dRow(v,dTag(v.statusLabel||"REVIEW","#3B2F10","#FDE68A"),"#FBBF24")).join(""));if(vd.length)b+=dSec("❌ Vendors Declined","#FCA5A5",vd.length,vd.map(v=>dRow(v,dTag("REASSIGN","#3B1515","#FCA5A5"),"#EF4444")).join(""));if(rs.length)b+=dSec("✅ Ready to Ship","#34D399",rs.length,rs.map(v=>dRow(v,dTag("SHIP","#0D3B1E","#34D399"),"#34D399")).join(""));if(it.length)b+=dSec("🚛 In Transit","#60A5FA",it.length,it.map(v=>dRow(v,dTag(`ETA ${fmtDate(v.eta)}`,"#1E3A5F","#93C5FD"),"#3B82F6")).join(""));b+=`<div style="text-align:center;margin-top:20px"><a href="${APP_URL}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none">Open Fleet Command →</a></div>`;return{subject:`📋 ${d.buyer} — ${sp.length+up.length} Past Due, ${bw.length} Bids Waiting, ${rs.length} Ready to Ship`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","📋",`Buyer ${d.time==="morning"?"Morning":"End of Day"} Digest`,b,stats)};},
seller_digest:(d)=>{const sr=d.sections?.soldRecon||[],rs=d.sections?.readyToShip||[],sh=d.sections?.shipped||[],ki=d.sections?.kicked||[];const tot=sr.length+rs.length+sh.length+ki.length;if(!tot)return null;let b=`<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.seller},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Status of vehicles you sold still in the pipeline:</div>`;if(ki.length)b+=dSec("🔄 Kicked — Needs Attention","#FCA5A5",ki.length,ki.map(v=>dRow(v,dTag(v.kickedBy||"KICKED","#3B1515","#FCA5A5"),"#EF4444")).join(""));if(sr.length)b+=dSec("🔧 Sold — Recon In Progress","#FBBF24",sr.length,sr.map(v=>dRow(v,dTag(v.statusLabel||"IN RECON","#3B2F10","#FDE68A"),"#F59E0B")).join(""));if(rs.length)b+=dSec("✅ Ready to Ship","#34D399",rs.length,rs.map(v=>dRow(v,dTag("READY","#0D3B1E","#34D399"),"#34D399")).join(""));if(sh.length)b+=dSec("🚛 Shipped","#60A5FA",sh.length,sh.map(v=>dRow(v,dTag(`ETA ${fmtDate(v.eta)}`,"#1E3A5F","#93C5FD"),"#3B82F6")).join(""));b+=`<div style="text-align:center;margin-top:20px"><a href="${APP_URL}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:15px;font-weight:700;border-radius:10px;text-decoration:none">Open Fleet Command →</a></div>`;return{subject:`📋 ${d.seller} — ${tot} Vehicles in Pipeline${ki.length?" — "+ki.length+" KICKED":""}`,html:shell("#1E3A5F","#1E3A5F","#93C5FD","#3B82F6","📋",`Seller ${d.time==="morning"?"Morning":"End of Day"} Update`,b)};},
};

// ============================================================
// TIMEZONE HELPERS (preserved from v3)
// ============================================================
function getAZHour(date) { return (date.getUTCHours() - 7 + 24) % 24; }
function getDallasHour(date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
  const mar2ndSun = new Date(Date.UTC(y, 2, 1)); mar2ndSun.setUTCDate(14 - mar2ndSun.getUTCDay());
  const nov1stSun = new Date(Date.UTC(y, 10, 1)); nov1stSun.setUTCDate(7 - nov1stSun.getUTCDay());
  const utcMs = date.getTime();
  const isDST = utcMs >= mar2ndSun.getTime() && utcMs < nov1stSun.getTime();
  return (date.getUTCHours() - (isDST ? 5 : 6) + 24) % 24;
}

// ============================================================
// MAIN ROUTER
// ============================================================
export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Initialize DB on first request
      try { await initDB(env); } catch (e) { console.error("DB init:", e); }

    // --- STATUS ---
    if (path === "/" && method === "GET") return json({ status: "ok", service: "Fleet Command API v4", database: "D1 connected" });
    if (path === "/api/status" && method === "GET") return handleDBStatus(request, env);

    // --- AUTH ---
    if (path === "/api/auth/setup" && method === "POST") return handleSetup(request, env);
    if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env);
    if (path === "/api/auth/change-password" && method === "POST") return handleChangePassword(request, env);
    if (path === "/api/auth/forgot-password" && method === "POST") return handleForgotPassword(request, env);
    if (path === "/api/auth/reset-password" && method === "POST") return handleResetPassword(request, env);
    if (path === "/api/auth/me" && method === "GET") {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;
      return json({ user: auth.user });
    }

    // --- USERS ---
    if (path === "/api/users" && method === "GET") return handleGetUsers(request, env);
    if (path === "/api/users" && method === "POST") return handleRegisterUser(request, env);
    if (path.startsWith("/api/users/") && method === "PUT") return handleUpdateUser(request, env);
    if (path.startsWith("/api/users/") && method === "DELETE") return handleDeleteUser(request, env);

    // --- VEHICLES ---
    if (path === "/api/vehicles" && method === "GET") return handleGetVehicles(request, env);
    if (path === "/api/vehicles" && method === "POST") return handleCreateVehicle(request, env);
    if (path.match(/^\/api\/vehicles\/[^\/]+\/vendor-bid$/) && method === "PUT") return handleVendorBidUpdate(request, env);
    if (path.match(/^\/api\/vehicles\/[^\/]+\/parts-update$/) && method === "PUT") return handlePartsUpdate(request, env);
    if (path.startsWith("/api/vehicles/") && method === "PUT") return handleUpdateVehicle(request, env);
    if (path === "/api/vehicles/upload-csv" && method === "POST") return handleCSVUpload(request, env);

    // --- VENDORS ---
    if (path === "/api/vendors" && method === "GET") return handleGetVendors(request, env);
    if (path === "/api/vendors" && method === "POST") return handleCreateVendor(request, env);
    if (path.startsWith("/api/vendors/") && method === "PUT") return handleUpdateVendor(request, env);
    if (path.startsWith("/api/vendors/") && method === "DELETE") return handleDeleteVendor(request, env);

    // --- AUCTIONS ---
    if (path === "/api/auctions" && method === "GET") return handleGetAuctions(request, env);
    if (path === "/api/auctions" && method === "POST") return handleCreateAuction(request, env);

    // --- PARTS ---
    if (path === "/api/parts" && method === "GET") return handleGetParts(request, env);

    // --- EMAIL LOG ---
    if (path === "/api/email-log" && method === "GET") return handleGetEmailLog(request, env);

    // --- REPORTS ---
    if (path === "/api/reports" && method === "GET") return handleGetReports(request, env);

    // --- LEGACY EMAIL ENDPOINTS (preserved from v3) ---
    if (path === "/send" && method === "POST") {
      try {
        const { type, to, data } = await request.json();
        const fn = T[type];
        if (!fn) return err(`Unknown email type: ${type}`);

        // For vendor emails: look up buyer contact info so template can render contact card
        if (type.startsWith('vendor_') && data && data.vehicle) {
          try {
            const buyerName = data.buyer || data.vehicle.buyingBroker;
            if (buyerName && typeof buyerName === 'string' && buyerName.trim()) {
              const clean = buyerName.trim();
              const parts = clean.split(/\s+/);
              let buyerUser = null;
              if (parts.length >= 2) {
                buyerUser = await env.DB.prepare("SELECT first_name, last_name, phone, email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = LOWER(?) AND LOWER(TRIM(last_name)) = LOWER(?) LIMIT 1").bind(parts[0], parts.slice(1).join(' ')).first();
              }
              if (!buyerUser) {
                buyerUser = await env.DB.prepare("SELECT first_name, last_name, phone, email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = LOWER(?) LIMIT 1").bind(parts[0]).first();
              }
              if (buyerUser) {
                data.buyerContact = { name: (buyerUser.first_name + ' ' + (buyerUser.last_name || '')).trim(), phone: buyerUser.phone || '', email: buyerUser.email || '', registered: true };
              } else {
                data.buyerContact = { name: clean, phone: '', email: '', registered: false };
              }
            }
          } catch (e) { console.error('Buyer contact lookup failed:', e); }
        }

        // Resolve actual recipients (array, deduped). Falls back to `to` if nothing resolves.
        const recipients = await resolveRecipients(type, data, env, to);

        // Determine role for each recipient so templates can personalize wording
        const buyerName = (data?.buyer || data?.vehicle?.buyingBroker || '').toString().trim().toLowerCase();
        const sellerName = (data?.seller || data?.vehicle?.sellingBroker || '').toString().trim().toLowerCase();
        let buyerEmail = '', sellerEmail = '';
        try {
          if (buyerName) {
            const parts = buyerName.split(/\s+/);
            const b = parts.length >= 2
              ? await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ? LIMIT 1").bind(parts[0], parts.slice(1).join(' ')).first()
              : await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = ? LIMIT 1").bind(parts[0]).first();
            if (b?.email) buyerEmail = b.email.toLowerCase();
          }
          if (sellerName) {
            const parts = sellerName.split(/\s+/);
            const s = parts.length >= 2
              ? await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ? LIMIT 1").bind(parts[0], parts.slice(1).join(' ')).first()
              : await env.DB.prepare("SELECT email FROM users WHERE active = 1 AND LOWER(TRIM(first_name)) = ? LIMIT 1").bind(parts[0]).first();
            if (s?.email) sellerEmail = s.email.toLowerCase();
          }
        } catch (e) { console.error('Role email lookup failed:', e); }

        // Send to each recipient, render template per recipient for personalized wording
        const results = [];
        for (const r of recipients) {
          const rl = r.toLowerCase();
          // Tag recipient role so templates can pick correct wording
          data.recipientRole = rl === buyerEmail ? 'buyer' : rl === sellerEmail ? 'seller' : 'other';
          const result = fn(data);
          const res = await sendEmail(r, result.subject, result.html);
          await logEmail(env, type, r, data?.vehicle?.id || null, result.subject, res.ok ? 'sent' : 'failed', res.ok ? null : JSON.stringify(res));
          results.push({ to: r, ok: res.ok });
        }
        return json({ ok: results.some(x => x.ok), recipients, results }, results.some(x => x.ok) ? 200 : 500);
      } catch (e) { return err(e.message, 500); }
    }

    if (path === "/digest" && method === "POST") {
      try {
        const { type, to, data } = await request.json();
        const fn = digests[type];
        if (!fn) return err(`Unknown digest: ${type}`);
        const result = fn(data);
        if (!result) return json({ skipped: true, reason: "Nothing to report" });
        const res = await sendEmail(to, result.subject, result.html);
        await logEmail(env, 'digest_' + type, to, null, result.subject, res.ok ? 'sent' : 'failed', res.ok ? null : JSON.stringify(res));
        return json(res, res.ok ? 200 : 500);
      } catch (e) { return err(e.message, 500); }
    }

    return new Response("Not found", { status: 404, headers: cors });
    } catch (e) {
      // Global safety net — any uncaught error returns proper CORS headers
      // so the frontend can read the error instead of getting "Failed to fetch"
      console.error("Unhandled error:", e?.message, e?.stack);
      return json({ error: "Server error: " + (e?.message || "unknown"), stack: e?.stack || null }, 500);
    }
  },

  // ============================================================
  // CRON — DIGEST SCHEDULER (preserved from v3, enhanced with D1)
  // ============================================================
  async scheduled(event, env, ctx) {
    try { await initDB(env); } catch (e) { console.error("DB init in cron:", e); }

    const now = new Date();
    const azHour = getAZHour(now);
    const dallasHour = getDallasHour(now);

    console.log(`[Digest Cron] UTC=${now.toISOString()} AZ_hour=${azHour} Dallas_hour=${dallasHour}`);

    const tasks = [];

    if (azHour === 6 || azHour === 17) {
      const timeLabel = azHour === 6 ? "morning" : "evening";
      tasks.push({ type: "buyer_digest", time: timeLabel, label: "Buyer/Seller " + timeLabel });
    }

    if (azHour === 6 || azHour === 12 || azHour === 18) {
      const timeLabel = azHour === 6 ? "morning" : azHour === 12 ? "noon" : "evening";
      tasks.push({ type: "vendor_phx", time: timeLabel, market: "PHX", label: "Vendor PHX " + timeLabel });
    }

    if (dallasHour === 6 || dallasHour === 12 || dallasHour === 18) {
      const timeLabel = dallasHour === 6 ? "morning" : dallasHour === 12 ? "noon" : "evening";
      tasks.push({ type: "vendor_dallas", time: timeLabel, market: "Dallas", label: "Vendor Dallas " + timeLabel });
    }

    if (tasks.length === 0) {
      console.log("[Digest Cron] No digests this hour");
      return;
    }

    console.log(`[Digest Cron] Firing ${tasks.length} digest(s): ${tasks.map(t => t.label).join(", ")}`);

    // In v4, cron queries D1 for live vehicle data
    // TODO: Build digest data from D1 queries and send automatically
    for (const task of tasks) {
      console.log(`[Digest Cron] Would fire: ${task.label} at ${task.time}`);
    }
  }
};
