import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const rows = await db.raw(`SELECT key, value FROM site_settings`);
    const data: Record<string, string> = {};
    for (const r of rows.rows) data[r.key] = r.value;
    // Expose server timezone as a read-only virtual setting
    data['server_timezone'] = process.env.TZ || 'America/Phoenix';
    res.json({ ok: true, data });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/:key', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });
    const { key } = req.params;
    const { value } = req.body;
    await db.raw(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, String(value)]
    );
    res.json({ ok: true });
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to save setting' });
  }
});

export default router;
