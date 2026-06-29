/**
 * Payments Route — Phase 2
 *
 * GET  /api/payments/queue  — admin: full vendor payment queue with due status
 * POST /api/payments/trigger-digest — admin: manually trigger vendor digest now
 *
 * To revert this phase: remove this file and the mount from routes/index.ts.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../lib/auth';
import { buildVendorPaymentQueue, runVendorDigest } from '../lib/paymentBatch';

const router = Router();

// GET /api/payments/queue
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const queue = await buildVendorPaymentQueue();
    res.json({ queue });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/trigger-digest  (admin manual trigger)
router.post('/trigger-digest', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    await runVendorDigest();
    res.json({ ok: true, message: 'Vendor digest triggered' });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
