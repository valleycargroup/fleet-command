import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const auctions = (await db.raw('SELECT * FROM auctions WHERE active = TRUE ORDER BY name')).rows;
    res.json({ auctions });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    await db.raw('INSERT INTO auctions (name) VALUES (?)', [name]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
