import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const limit = parseInt(String(req.query.limit || '50'));
    const emails = (await db.raw(
      `SELECT id, email_type, recipient, vehicle_id, subject, status, error,
              created_at, recipient_name, recipient_role, recipient_vendor,
              triggered_by, sendgrid_message_id
       FROM email_log ORDER BY created_at DESC LIMIT ?`,
      [limit]
    )).rows;
    res.json({ emails });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Purge endpoint — admin/tech_support only
router.delete('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const role = (user.role || '').toLowerCase().replace(/[_\s]/g, '');
    if (!['admin', 'techsupport'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const result = await db.raw(`DELETE FROM email_log`);
    res.json({ ok: true, deleted: result.rowCount ?? 0 });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Preview endpoint — returns the stored HTML body for a single log entry
router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const row = (await db.raw(
      `SELECT body_html, subject FROM email_log WHERE id = ? LIMIT 1`,
      [req.params.id]
    )).rows[0];

    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!row.body_html) return res.status(404).json({ error: 'No preview available for this email' });

    res.json({ subject: row.subject, html: row.body_html });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
