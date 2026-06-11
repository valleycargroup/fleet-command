import https from 'https';
import db from './db';

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'notifications@fleetcommandrecon.net';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Fleet Command';
const APP_URL = process.env.APP_URL || 'https://fleetcommandrecon.net';

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping send');
    return { ok: false, error: 'SENDGRID_API_KEY not configured' };
  }

  const payload = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    content: [{ type: 'text/html', value: html }],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.sendgrid.com',
        path: '/v3/mail/send',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const ok = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
        if (!ok) console.error('[email] SendGrid responded with status', res.statusCode);
        res.resume();
        resolve({ ok });
      }
    );

    req.on('error', (err) => {
      console.error('[email] SendGrid request failed:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

export async function logEmail(
  emailType: string,
  recipient: string,
  vehicleId: number | null,
  subject: string | null,
  status: string,
  error: string | null = null
) {
  try {
    await db.raw(
      `INSERT INTO email_log (email_type, recipient, vehicle_id, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)`,
      [emailType, recipient, vehicleId, subject, status, error]
    );
  } catch (e) {
    console.error('[email] log failed:', e);
  }
}

// ── Email Templates ──────────────────────────────────────────────────────────

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',sans-serif;background:#0A0A14;color:#E5E7EB;padding:20px;">
<div style="max-width:520px;margin:0 auto;background:#12121E;border-radius:16px;border:1px solid #2A2A3E;overflow:hidden;">
  <div style="padding:24px;text-align:center;background:#1E3A5F">
    <div style="font-size:24px;font-weight:700;color:#FFF">Fleet<span style="color:#3B82F6">Command</span></div>
    <div style="margin-top:6px;font-size:13px;color:#93C5FD">${title}</div>
  </div>
  <div style="padding:24px">${body}</div>
</div></body></html>`;
}

export function welcomeUserEmail(firstName: string, email: string, password: string, role: string, location: string) {
  const subject = 'Welcome to Fleet Command';
  const body = `<p>Hi ${firstName},</p>
<p style="margin:12px 0;color:#9CA3AF">Your Fleet Command account has been created.</p>
<div style="background:#0D0D1A;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;">
  <div><b style="color:#6B7280">Email:</b> <span>${email}</span></div>
  <div style="margin-top:6px"><b style="color:#6B7280">Password:</b> <span>${password}</span></div>
  <div style="margin-top:6px"><b style="color:#6B7280">Role:</b> <span>${role} — ${location}</span></div>
</div>
<div style="text-align:center;margin:20px 0">
  <a href="${APP_URL}" style="display:inline-block;padding:12px 40px;background:#3B82F6;color:#FFF;font-weight:700;border-radius:8px;text-decoration:none">Log In</a>
</div>
<p style="font-size:12px;color:#6B7280">Change your password after first login.</p>`;
  return { subject, html: baseLayout('Welcome', body) };
}

export function welcomeVendorEmail(vendorName: string, contactName: string, email: string, password: string, categories: string[]) {
  const subject = `${vendorName} — Fleet Command Access`;
  const body = `<p>Hi ${contactName},</p>
<p style="margin:12px 0;color:#9CA3AF">You've been set up as a recon vendor on Fleet Command.</p>
<div style="background:#0D0D1A;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;">
  <div><b style="color:#6B7280">Email:</b> <span>${email}</span></div>
  <div style="margin-top:6px"><b style="color:#6B7280">Password:</b> <span>${password}</span></div>
  <div style="margin-top:6px"><b style="color:#6B7280">Categories:</b> <span>${categories.join(', ')}</span></div>
</div>
<div style="text-align:center;margin:20px 0">
  <a href="${APP_URL}" style="display:inline-block;padding:12px 40px;background:#3B82F6;color:#FFF;font-weight:700;border-radius:8px;text-decoration:none">Log In</a>
</div>`;
  return { subject, html: baseLayout('Vendor Access', body) };
}

export function passwordResetEmail(firstName: string, resetUrl: string) {
  const subject = 'Reset your Fleet Command password';
  const body = `<p>Hi ${firstName},</p>
<p style="margin:12px 0;color:#9CA3AF">Click below to reset your password. This link expires in 1 hour.</p>
<div style="text-align:center;margin:24px 0">
  <a href="${resetUrl}" style="display:inline-block;padding:14px 44px;background:#3B82F6;color:#FFF;font-size:16px;font-weight:700;border-radius:10px;text-decoration:none">Reset Password</a>
</div>
<p style="font-size:12px;color:#6B7280">If you didn't request this, ignore this email.</p>`;
  return { subject, html: baseLayout('Password Reset', body) };
}
