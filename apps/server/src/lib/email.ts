import https from 'https';
import db from './db';

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'notifications@fleetcommandrecon.net';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Fleet Command';
export const APP_URL = process.env.APP_URL || 'https://fleetcommandrecon.net';

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping send');
    return { ok: false, error: 'SENDGRID_API_KEY not configured' };
  }

  try {
    const killRow = await db('site_settings').where({ key: 'notifications_disabled' }).first();
    if (killRow?.value === 'true') {
      const exRow = await db('site_settings').where({ key: 'notifications_exception_emails' }).first();
      const exceptions = (exRow?.value || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
      if (!exceptions.includes(to.toLowerCase())) {
        console.log(`[email] suppressed by kill switch: ${to}`);
        return { ok: false, error: 'notifications disabled' };
      }
      console.log(`[email] kill switch active but ${to} is on exception list — sending`);
    }
  } catch (e) {
    console.error('[email] kill switch check failed:', e);
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
        const messageId = res.headers['x-message-id'] as string | undefined;
        res.resume();
        resolve({ ok, messageId });
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
  error: string | null = null,
  meta?: { name?: string; role?: string; vendor?: string },
  triggeredBy: 'manual' | 'cron' = 'manual',
  sendgridId?: string,
  bodyHtml?: string
) {
  try {
    await db.raw(
      `INSERT INTO email_log (email_type, recipient, vehicle_id, subject, status, error, recipient_name, recipient_role, recipient_vendor, triggered_by, sendgrid_message_id, body_html)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emailType, recipient, vehicleId, subject, status, error,
       meta?.name || null, meta?.role || null, meta?.vendor || null, triggeredBy, sendgridId || null, bodyHtml || null]
    );
  } catch (e) {
    console.error('[email] log failed:', e);
  }
}

// ── Email Templates ──────────────────────────────────────────────────────────

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A14" style="background:#0A0A14;"><tr><td align="center" style="padding:20px;"><table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#12121E;border-radius:16px;border:1px solid #2A2A3E;overflow:hidden;"><tr><td align="center" bgcolor="#1E3A5F" style="background:#1E3A5F;padding:28px;"><div style="font-size:26px;font-weight:700;color:#FFF;font-family:Arial,sans-serif;">Fleet<span style="color:#3B82F6">Command</span></div><div style="margin-top:6px;font-size:13px;color:#93C5FD;font-family:Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${title}</div></td></tr><tr><td style="padding:28px;font-family:Arial,sans-serif;color:#E5E7EB;">${body}</td></tr><tr><td align="center" bgcolor="#0A0A14" style="background:#0A0A14;padding:20px 28px;border-top:1px solid #2A2A3E;"><div style="font-size:12px;color:#4B5563;line-height:1.8;font-family:Arial,sans-serif;">Valley Car Group &mdash; PHX &bull; Dallas<br>Questions? Contact your Fleet Command administrator.</div></td></tr></table></td></tr></table></body></html>`;
}

export function welcomeUserEmail(firstName: string, email: string, password: string, role: string, location: string) {
  const subject = 'Welcome to Fleet Command';
  const body = `<p style="font-size:18px;font-weight:700;color:#FFF;margin:0 0 8px;">Hi ${firstName},</p>
<p style="margin:0 0 20px;color:#9CA3AF;line-height:1.7;">Your Fleet Command account has been created and is ready to use. Below are your login credentials — please keep them secure.</p>
<div style="background:#0D0D1A;border-radius:10px;padding:18px;margin:0 0 24px;border:1px solid #2A2A3E;">
  <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-weight:700;">Your Credentials</div>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Email</td><td style="padding:6px 0;color:#E5E7EB;font-size:13px;text-align:right;">${email}</td></tr><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;border-top:1px solid #1E1E32;">Password</td><td style="padding:6px 0;color:#E5E7EB;font-size:13px;text-align:right;border-top:1px solid #1E1E32;font-family:monospace;">${password}</td></tr><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;border-top:1px solid #1E1E32;">Role</td><td style="padding:6px 0;color:#93C5FD;font-size:13px;text-align:right;border-top:1px solid #1E1E32;font-weight:700;">${role} &mdash; ${location}</td></tr></table>
</div>
<div style="text-align:center;margin:0 0 24px;">
  <a href="${APP_URL}" style="display:inline-block;padding:14px 48px;background:#3B82F6;color:#FFF;font-size:16px;font-weight:700;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;">Log In to Fleet Command</a>
</div>
<div style="background:#1A1A2E;border-radius:8px;padding:14px 16px;border-left:3px solid #3B82F6;">
  <div style="font-size:12px;font-weight:700;color:#93C5FD;margin-bottom:4px;">Next Steps</div>
  <div style="font-size:13px;color:#9CA3AF;line-height:1.7;">1. Log in using the credentials above.<br>2. You will be prompted to change your password on first login.<br>3. Contact your administrator if you need role or location changes.</div>
</div>`;
  return { subject, html: baseLayout('Welcome', body) };
}

export function welcomeVendorEmail(vendorName: string, contactName: string, email: string, password: string, categories: string[]) {
  const subject = `${vendorName} — Fleet Command Vendor Access`;
  const body = `<p style="font-size:18px;font-weight:700;color:#FFF;margin:0 0 8px;">Hi ${contactName},</p>
<p style="margin:0 0 20px;color:#9CA3AF;line-height:1.7;">You've been set up as a recon vendor on Fleet Command for <b style="color:#FFF;">${vendorName}</b>. Use the credentials below to log in and start receiving job assignments.</p>
<div style="background:#0D0D1A;border-radius:10px;padding:18px;margin:0 0 24px;border:1px solid #2A2A3E;">
  <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;font-weight:700;">Your Credentials</div>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Email</td><td style="padding:6px 0;color:#E5E7EB;font-size:13px;text-align:right;">${email}</td></tr><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;border-top:1px solid #1E1E32;">Password</td><td style="padding:6px 0;color:#E5E7EB;font-size:13px;text-align:right;border-top:1px solid #1E1E32;font-family:monospace;">${password}</td></tr><tr><td style="padding:6px 0;color:#6B7280;font-size:13px;border-top:1px solid #1E1E32;">Categories</td><td style="padding:6px 0;color:#93C5FD;font-size:13px;text-align:right;border-top:1px solid #1E1E32;font-weight:700;">${categories.join(', ')}</td></tr></table>
</div>
<div style="text-align:center;margin:0 0 24px;">
  <a href="${APP_URL}" style="display:inline-block;padding:14px 48px;background:#3B82F6;color:#FFF;font-size:16px;font-weight:700;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;">Log In to Fleet Command</a>
</div>
<div style="background:#1A1A2E;border-radius:8px;padding:14px 16px;border-left:3px solid #3B82F6;">
  <div style="font-size:12px;font-weight:700;color:#93C5FD;margin-bottom:4px;">How It Works</div>
  <div style="font-size:13px;color:#9CA3AF;line-height:1.7;">1. Log in and you'll see jobs assigned to your company.<br>2. Review each job, submit your bid, and await approval.<br>3. Once approved, complete the work and mark it done in the app.<br>4. Payment is issued per your agreed payment terms.</div>
</div>`;
  return { subject, html: baseLayout('Vendor Access', body) };
}

export function passwordResetEmail(firstName: string, resetUrl: string) {
  const subject = 'Reset your Fleet Command password';
  const body = `<p style="font-size:18px;font-weight:700;color:#FFF;margin:0 0 8px;">Hi ${firstName},</p>
<p style="margin:0 0 24px;color:#9CA3AF;line-height:1.7;">We received a request to reset the password for your Fleet Command account. Click the button below to choose a new password.</p>
<div style="text-align:center;margin:0 0 24px;">
  <a href="${resetUrl}" style="display:inline-block;padding:14px 48px;background:#3B82F6;color:#FFF;font-size:16px;font-weight:700;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;">Reset My Password</a>
</div>
<div style="background:#0D0D1A;border-radius:8px;padding:14px 16px;margin:0 0 20px;border:1px solid #2A2A3E;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#6B7280;font-size:13px;">Link expires</td><td style="color:#FBBF24;font-size:13px;font-weight:700;text-align:right;">1 hour from now</td></tr><tr><td style="color:#6B7280;font-size:13px;border-top:1px solid #1E1E32;padding-top:8px;margin-top:8px;">One-time use</td><td style="color:#E5E7EB;font-size:13px;text-align:right;border-top:1px solid #1E1E32;padding-top:8px;">Link becomes invalid after use</td></tr></table>
</div>
<div style="background:#2A1515;border-radius:8px;padding:12px 16px;border-left:3px solid #EF4444;">
  <div style="font-size:12px;font-weight:700;color:#FCA5A5;margin-bottom:3px;">Didn't request this?</div>
  <div style="font-size:13px;color:#9CA3AF;line-height:1.6;">You can safely ignore this email. Your password will not change unless you click the link above. If you're concerned, contact your administrator.</div>
</div>`;
  return { subject, html: baseLayout('Password Reset', body) };
}
