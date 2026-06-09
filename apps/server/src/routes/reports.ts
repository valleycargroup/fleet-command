import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor' || user.role === 'parts') return res.status(403).json({ error: 'Forbidden' });

    const type = String(req.query.type || 'overview');

    if (type === 'overview') {
      const total    = Number((await db.raw(`SELECT COUNT(*) as c FROM vehicles WHERE status != 'delivered'`)).rows[0].c);
      const inRecon  = Number((await db.raw(`SELECT COUNT(*) as c FROM vehicles WHERE status IN ('active','in_recon')`)).rows[0].c);
      const sold     = Number((await db.raw(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'sold'`)).rows[0].c);
      const delivered = Number((await db.raw(`SELECT COUNT(*) as c FROM vehicles WHERE status = 'delivered'`)).rows[0].c);
      return res.json({ overview: { total, in_recon: inRecon, sold, delivered } });
    }

    res.json({ message: `Report type: ${type}` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
