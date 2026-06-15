import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

// GET /api/vehicles
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const vehicles = (await db.raw(
      `SELECT * FROM vehicles
       ORDER BY CASE WHEN status='sold' THEN 0 WHEN kicked=TRUE THEN 1 ELSE 2 END,
                updated_at DESC`
    )).rows;

    res.json({ vehicles });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vehicles
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const v = req.body;
    const result = await db.raw(
      `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source,
        origin, buyer, seller, sold_to, sale_date, enter_date, purchase_date, grounded_date, status, notes, recon_data, transport_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [v.vin, v.stock_number, v.year, v.make, v.model, v.trim || '', v.color, v.miles,
       v.location, v.source || '', v.origin || '', v.buyer || '', v.seller || '',
       v.sold_to || null, v.sale_date || null, v.enter_date || null,
       v.purchase_date || null, v.grounded_date || null,
       v.sold_to ? 'sold' : 'active', v.notes || '',
       JSON.stringify(v.recon_data || {}), JSON.stringify(v.transport_data || {})]
    );

    res.json({ ok: true, id: result.rows[0].id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vehicles/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const vehicleId = req.params.id;
    const body = req.body;

    // Vendors can only update recon_data
    if (user.role === 'vendor') {
      if (body.recon_data === undefined) return res.status(403).json({ error: 'Vendors can only update recon data' });
      await db.raw('UPDATE vehicles SET recon_data = ?, updated_at = NOW() WHERE id = ?', [
        typeof body.recon_data === 'string' ? body.recon_data : JSON.stringify(body.recon_data),
        vehicleId,
      ]);
      return res.json({ ok: true });
    }

    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['vin', 'stock_number', 'year', 'make', 'model', 'trim', 'color', 'miles',
                     'location', 'source', 'origin', 'buyer', 'seller', 'sold_to', 'sale_date',
                     'enter_date', 'purchase_date', 'grounded_date', 'status', 'kicked', 'notes',
                     'recon_data', 'transport_data'];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(typeof body[key] === 'object' && body[key] !== null ? JSON.stringify(body[key]) : body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    fields.push('updated_at = NOW()');
    values.push(vehicleId);

    await db.raw(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    await db.raw('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vehicles/:id/vendor-bid
router.post('/:id/vendor-bid', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const vehicleId = req.params.id;
    const { categoryKey, vendorUpdates, taskStatusChange } = req.body;
    if (!categoryKey || !vendorUpdates) return res.status(400).json({ error: 'categoryKey and vendorUpdates required' });

    const vehicle = (await db.raw('SELECT recon_data FROM vehicles WHERE id = ?', [vehicleId])).rows[0];
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    let reconData: any;
    try { reconData = vehicle.recon_data || {}; } catch { return res.status(500).json({ error: 'Recon data corrupted' }); }

    const task = reconData[categoryKey];
    if (!task) return res.status(404).json({ error: 'Recon category not found on this vehicle' });
    if (!Array.isArray(task.vendors)) return res.status(404).json({ error: 'No vendors assigned to this category' });

    const userEmail = (user.email || '').toLowerCase();
    const userFirst = (user.first_name || '').toLowerCase();
    const userFull = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
    const myVendorIdx = task.vendors.findIndex((vn: any) => {
      const vnEmail = (vn.email || '').toLowerCase();
      const vnName = (vn.name || '').toLowerCase();
      if (vnEmail && userEmail && vnEmail === userEmail) return true;
      if (vnName && userFull && vnName === userFull) return true;
      return false;
    });
    if (myVendorIdx < 0) return res.status(403).json({ error: 'You are not assigned to this recon task' });

    const allowedVendorFields = ['lineItems', 'bidLocked', 'estimate', 'etaDone', 'vendorPhotos',
      'vendorFindings', 'findingsSubmitted', 'findingsSubmittedDate', 'findingsDecisionSent',
      'declined', 'declinedDate', 'cancellationSent', 'dateStarted', 'dateCompleted',
      'beforePhotos', 'afterPhotos', 'progressPhotos'];
    const safeUpdates: any = {};
    for (const key of allowedVendorFields) {
      if (vendorUpdates[key] !== undefined) safeUpdates[key] = vendorUpdates[key];
    }
    task.vendors[myVendorIdx] = { ...task.vendors[myVendorIdx], ...safeUpdates };

    const totalEst = task.vendors.reduce((s: number, vn: any) => s + (Number(vn.estimate) || 0), 0);
    if (totalEst) task.estimate = totalEst;

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
    await db.raw('UPDATE vehicles SET recon_data = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(reconData), vehicleId]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vehicles/:id/parts-update
router.put('/:id/parts-update', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role !== 'parts_manager' && user.role !== 'admin' && !user.is_buyer)
      return res.status(403).json({ error: 'Only Parts Manager or admin can update parts' });

    const vehicleId = req.params.id;
    const { categoryKey, lineItemId, vendorId, partUpdates } = req.body;
    if (!categoryKey || !lineItemId || !partUpdates) return res.status(400).json({ error: 'categoryKey, lineItemId, and partUpdates required' });

    const vehicle = (await db.raw('SELECT recon_data FROM vehicles WHERE id = ?', [vehicleId])).rows[0];
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    const reconData: any = vehicle.recon_data || {};
    const task = reconData[categoryKey];
    if (!task) return res.status(404).json({ error: 'Recon category not found' });
    if (!Array.isArray(task.vendors)) return res.status(404).json({ error: 'No vendors on this category' });

    const targetVendor = vendorId
      ? task.vendors.find((v: any) => v.id === vendorId)
      : task.vendors.find((v: any) => v.selected) || task.vendors[0];
    if (!targetVendor) return res.status(404).json({ error: 'Target vendor not found' });

    const lineItems = targetVendor.lineItems || [];
    const liIdx = lineItems.findIndex((li: any) => li.id === lineItemId);
    if (liIdx < 0) return res.status(404).json({ error: 'Line item not found' });

    const allowedFields = ['partStatus', 'partPrice', 'partETA', 'partTracking', 'partCarrier',
      'partReceivedDate', 'partRejectedReason', 'partApproved', 'partApprovedDate',
      'partQuotedBy', 'partQuotedDate', 'partOrderedDate', 'partShippedDate', 'partNotes',
      'partOrdered', 'partArrived', 'partArrivedDate', 'partInstalled', 'partInstalledDate',
      'partCanceled', 'partCanceledDate'];
    const allowedStatusValues = ['needs_quote', 'quoted', 'approved', 'ordered', 'shipped', 'received', 'rejected', 'backorder'];

    const safe: any = {};
    for (const k of allowedFields) {
      if (partUpdates[k] !== undefined) {
        if (k === 'partStatus' && !allowedStatusValues.includes(partUpdates[k])) continue;
        safe[k] = partUpdates[k];
      }
    }

    lineItems[liIdx] = { ...lineItems[liIdx], ...safe };
    targetVendor.lineItems = lineItems;
    reconData[categoryKey] = task;

    await db.raw('UPDATE vehicles SET recon_data = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(reconData), vehicleId]);
    const partItems = lineItems.filter((li: any) => li.isPart);
    res.json({ ok: true, partStatus: safe.partStatus, totalParts: partItems.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vehicles/upload-csv
router.post('/upload-csv', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Vendors cannot upload inventory' });

    const { csv_data } = req.body;
    if (!csv_data) return res.status(400).json({ error: 'No CSV data provided' });

    const lines = csv_data.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const headers = parseCSVRow(lines[0]).map((h: string) => h.trim().toUpperCase());
    const colMap: Record<string, number> = {};
    headers.forEach((h: string, i: number) => { colMap[h] = i; });

    if (colMap['STOCK #'] === undefined) return res.status(400).json({ error: 'Missing required column: STOCK #' });

    let imported = 0, updated = 0, skipped = 0, kickedCount = 0;
    const errors: string[] = [];

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
        const rawMiles = String(getCol(row, colMap, 'MILES') || '0');
        let miles = parseInt(rawMiles.replace(/[^0-9]/g, '')) || 0;
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
        const isKicked = !!kickedDate;
        const status = isKicked ? 'active' : (soldTo ? 'sold' : 'active');
        if (isKicked) kickedCount++;

        const existing = (await db.raw('SELECT id, recon_data, status FROM vehicles WHERE stock_number = ?', [stockNum])).rows[0];

        if (existing) {
          if (existing.status === 'delivered') { skipped++; continue; }
          await db.raw(
            `UPDATE vehicles SET vin=?, year=?, make=?, model=?, trim=?, color=?, miles=?, location=?, source=?,
             origin=?, buyer=?, seller=?, sold_to=?, sale_date=?, enter_date=?, grounded_date=?, status=?, notes=?, updated_at=NOW()
             WHERE stock_number=?`,
            [vin, year, make, model, trim, color, miles, location, source, origin, buyer, seller,
             soldTo, saleDate, enterDate, dogDate, status, notes, stockNum]
          );
          updated++;
        } else {
          await db.raw(
            `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source,
             origin, buyer, seller, sold_to, sale_date, enter_date, grounded_date, status, notes, recon_data, transport_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}')`,
            [vin, stockNum, year, make, model, trim, color, miles, location, source, origin, buyer, seller,
             soldTo, saleDate, enterDate, dogDate, status, notes]
          );
          imported++;
        }
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    res.json({ ok: true, imported, updated, skipped, kicked: kickedCount, errors, total: imported + updated });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
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

function getCol(row: string[], colMap: Record<string, number>, name: string): string {
  const idx = colMap[name];
  return idx !== undefined && idx < row.length ? row[idx].replace(/^"|"$/g, '').trim() : '';
}

function parseDate(val: string): string | null {
  if (!val) return null;
  const clean = val.replace(/[^0-9/\-]/g, '');
  const parts = clean.split('/');
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return clean || null;
}

export default router;
