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
    const emails = (await db.raw('SELECT * FROM email_log ORDER BY created_at DESC LIMIT ?', [limit])).rows;
    res.json({ emails });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
