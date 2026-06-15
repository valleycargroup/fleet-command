import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const parts = (await db.raw(
      `SELECT p.*, v.year, v.make, v.model, v.stock_number
       FROM parts_requests p JOIN vehicles v ON p.vehicle_id = v.id
       ORDER BY p.created_at DESC`
    )).rows;
    res.json({ parts });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const { vehicle_id, recon_task_id, description, vendor_name, category, supplier, cost, eta, requested_by } = req.body;
    if (!vehicle_id || !description) return res.status(400).json({ error: 'vehicle_id and description required' });

    const result = await db.raw(
      `INSERT INTO parts_requests (vehicle_id, recon_task_id, description, vendor_name, category, supplier, cost, eta, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [vehicle_id, recon_task_id || null, description, vendor_name || null, category || null, supplier || null, cost || null, eta || null, requested_by || null]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['status', 'supplier', 'cost', 'tracking_number', 'eta', 'ordered_date', 'received_date'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    await db.raw(`UPDATE parts_requests SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
