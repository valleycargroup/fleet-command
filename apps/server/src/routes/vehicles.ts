import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';
import { sendVehicleToAuction } from '../lib/auctionExport';
import { fetchCrmVehicle, crmVehicleToDraft, crmImportFieldsToFleetRow, driveToDriveline } from '../lib/crmImport';
import { deleteFromStorage } from '../lib/storage';
import { broadcast } from '../lib/ws';

const router = Router();

// GET /api/vehicles
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const isPrivileged = user.is_buyer || ['admin','tech support','tech_support','techsupport','ap'].includes((user.role||'').toLowerCase().replace(/\s/g,''));
    const sellerOnly = !isPrivileged && user.is_seller;

    const vehicles = sellerOnly
      ? (await db.raw(
          `SELECT * FROM vehicles
           WHERE seller = ? OR seller = ?
           ORDER BY CASE WHEN status='sold' THEN 0 WHEN kicked=TRUE THEN 1 ELSE 2 END,
                    updated_at DESC`,
          [user.email, `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`]
        )).rows
      : (await db.raw(
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

    if (v.vin) {
      const existing = (await db.raw(
        'SELECT id FROM vehicles WHERE UPPER(TRIM(vin)) = UPPER(TRIM(?))', [v.vin]
      )).rows[0];
      if (existing) return res.status(409).json({ error: `A vehicle with VIN ${v.vin.toUpperCase()} already exists (ID ${existing.id})` });
    }

    const result = await db.raw(
      `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source,
        origin, buyer, seller, sold_to, sale_date, enter_date, purchase_date, grounded_date, status, notes,
        zip_code, fuel_type, transmission, driveline, drive, motor_trailer, condition_report, recon_data, transport_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [v.vin, v.stock_number || (v.vin ? v.vin.slice(-8).toUpperCase() : null), v.year, v.make, v.model, v.trim || '', v.color, v.miles,
       v.location, v.source || '', v.origin || '', v.buyer || '', v.seller || '',
       v.sold_to || null, v.sale_date || null, v.enter_date || null,
       v.purchase_date || null, v.grounded_date || null,
       v.sold_to ? 'sold' : 'active', v.notes || '',
       v.zip_code || null, v.fuel_type || null, v.transmission || null,
       v.driveline || driveToDriveline(v.drive || '') || null,
       v.drive || null, v.motor_trailer || null,
       v.condition_report ? JSON.stringify(v.condition_report) : null,
       JSON.stringify(v.recon_data || {}), JSON.stringify(v.transport_data || {})]
    );

    broadcast('VEHICLES_UPDATED');
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
      broadcast('VEHICLES_UPDATED');
      return res.json({ ok: true });
    }

    // Auto-derive driveline from drive when drive is updated but driveline isn't explicitly set
    if (body.drive !== undefined && body.driveline === undefined) {
      const derived = driveToDriveline(body.drive);
      if (derived) body.driveline = derived;
    }

    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['vin', 'stock_number', 'year', 'make', 'model', 'trim', 'color', 'miles',
                     'location', 'source', 'origin', 'buyer', 'seller', 'sold_to', 'sale_date',
                     'enter_date', 'purchase_date', 'grounded_date', 'status', 'kicked', 'notes',
                     'zip_code', 'fuel_type', 'transmission', 'driveline', 'drive', 'motor_trailer',
                     'condition_report', 'recon_data', 'transport_data',
                     'cr_status', 'cr_assigned_to', 'photos'];

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
    broadcast('VEHICLES_UPDATED');
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

    // Fetch the vehicle first so we can clean up stored files
    const row = (await db.raw('SELECT photos, recon_data FROM vehicles WHERE id = ?', [req.params.id])).rows[0];
    if (row) {
      const keys: string[] = [];

      // Vehicle gallery photos
      const photos = Array.isArray(row.photos) ? row.photos : (typeof row.photos === 'string' ? JSON.parse(row.photos || '[]') : []);
      for (const p of photos) {
        if (p?.key) keys.push(p.key);
      }

      // Recon task photos stored via the upload API (data field is an https URL)
      const recon: Record<string, any> = row.recon_data || {};
      for (const task of Object.values(recon)) {
        const collectFromList = (list: any[]) => {
          for (const p of (list || [])) {
            const url = typeof p === 'string' ? p : p?.data;
            if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
              // Extract key from URL path (everything after /images/ or /files/)
              const m = url.match(/\/(images|files|videos)\/.+$/);
              if (m) keys.push(m[0].replace(/^\//, ''));
            }
          }
        };
        collectFromList(task?.photos);
        for (const vn of (task?.vendors || [])) {
          collectFromList(vn?.vendorPhotos);
          collectFromList(vn?.beforePhotos);
          collectFromList(vn?.afterPhotos);
          collectFromList(vn?.progressPhotos);
        }
      }

      // Best-effort deletion — don't fail the vehicle delete if storage cleanup errors
      await Promise.allSettled(keys.map(k => deleteFromStorage(k)));
    }

    await db.raw('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    broadcast('VEHICLES_UPDATED');
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
    broadcast('VEHICLES_UPDATED');
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
    if (user.role !== 'parts_manager' && !['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase()) && !user.is_buyer)
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

// POST /api/vehicles/:id/send-to-auction
router.post('/:id/send-to-auction', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Forbidden' });

    const vehicle = (await db.raw('SELECT * FROM vehicles WHERE id = ?', [req.params.id])).rows[0];
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    // Client passes current photos from its Zustand state so we don't depend on the DB
    // column being populated (handles race conditions and missing migration edge cases).
    if (req.body?.photos && Array.isArray(req.body.photos) && req.body.photos.length > 0) {
      vehicle.photos = req.body.photos;
    }

    const result = await sendVehicleToAuction(vehicle, { replaceExistingImages: !!req.body?.replace_existing_images, buyerTransport: !!req.body?.buyer_transport });
    if (!result.ok) return res.status(result.status || 502).json({ error: 'Auction app rejected the request', details: result.data });
    res.json({ ok: true, auction: result.data, skippedNonUrlMedia: result.skippedNonUrlMedia });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/vehicles/import-from-crm/lookup?vin=...
// Read-only: fetches CRM's data and a suggested buyer match, for the
// importer to review/edit before anything is saved.
router.get('/import-from-crm/lookup', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Vendors cannot import vehicles' });

    const vin = String(req.query.vin || '').trim();
    if (!vin) return res.status(400).json({ error: 'VIN required' });

    const crmVehicle = await fetchCrmVehicle(vin);
    const fleetUsers = (await db.raw(
      `SELECT id, first_name, last_name, email FROM users WHERE role = 'buyer' OR role = 'admin' OR is_buyer = TRUE`
    )).rows;
    const draft = crmVehicleToDraft(crmVehicle, fleetUsers);

    const existing = (await db.raw('SELECT id FROM vehicles WHERE vin = ?', [vin.toUpperCase()])).rows[0];
    res.json({ ok: true, draft, existingVehicleId: existing?.id || null });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
});

// POST /api/vehicles/import-from-crm
// Saves the fields the importer reviewed and confirmed (not a fresh CRM
// fetch) — buyer and source are required here, same as manually adding a
// vehicle, since CRM's own buyer/source values aren't trusted automatically.
router.post('/import-from-crm', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role === 'vendor') return res.status(403).json({ error: 'Vendors cannot import vehicles' });

    const fields = req.body || {};
    const vin = String(fields.vin || '').trim().toUpperCase();
    if (!vin) return res.status(400).json({ error: 'VIN required' });

    const required = ['buyingBroker', 'source', 'zipCode', 'fuelType', 'transmission', 'drive'];
    const missing = required.filter((k) => !String(fields[k] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });

    const row = crmImportFieldsToFleetRow({ ...fields, vin });
    const overwriteCR = fields.overwriteCR === true;
    // 'include' (new vehicle default) | 'skip' (update default) | 'merge' | 'replace'
    const photoImportMode: string = fields.photoImport || 'skip';

    const existing = (await db.raw('SELECT id, photos FROM vehicles WHERE vin = ?', [vin])).rows[0];
    if (existing) {
      // overwriteCR=true: user explicitly asked to replace the existing CR (warned in UI).
      // overwriteCR=false (default): protect Fleet edits — only fill if currently null.
      const crJson = row.condition_report ? JSON.stringify(row.condition_report) : null;
      const crAssignment = overwriteCR
        ? 'condition_report=?::jsonb, cr_status=CASE WHEN ?::jsonb IS NOT NULL THEN \'baseline\' ELSE cr_status END,'
        : 'condition_report=COALESCE(condition_report, ?::jsonb), cr_status=CASE WHEN condition_report IS NULL AND ?::jsonb IS NOT NULL THEN \'baseline\' ELSE cr_status END,';

      let photosClause = '';
      let photosParams: any[] = [];

      if (photoImportMode === 'replace') {
        photosClause = 'photos=?::jsonb,';
        photosParams = [JSON.stringify(row.photos || [])];
      } else if (photoImportMode === 'merge') {
        const existingPhotos: any[] = Array.isArray(existing.photos) ? existing.photos : [];
        const existingUrls = new Set(existingPhotos.map((p: any) => p.url || ''));
        const incoming = (row.photos || []).filter((p: any) => p.url && !existingUrls.has(p.url));
        photosClause = 'photos=?::jsonb,';
        photosParams = [JSON.stringify([...existingPhotos, ...incoming])];
      }
      // 'skip' or anything else on update: leave photos column untouched

      await db.raw(
        `UPDATE vehicles SET stock_number=?, year=?, make=?, model=?, trim=?, miles=?, color=?, drive=?, zip_code=?,
         fuel_type=?, transmission=?, driveline=?, motor_trailer=?, location=?, source=?, buyer=?,
         ${crAssignment}
         recon_data=recon_data || ?::jsonb,
         ${photosClause}
         updated_at=NOW() WHERE id=?`,
        [row.stock_number, row.year, row.make, row.model, row.trim, row.miles, row.color, row.drive, row.zip_code,
         row.fuel_type, row.transmission, row.driveline, row.motor_trailer, row.location, row.source, row.buyer,
         crJson, crJson,
         JSON.stringify(row.recon_data),
         ...photosParams,
         existing.id]
      );
      broadcast('VEHICLES_UPDATED');
      return res.json({ ok: true, id: existing.id, updated: true });
    }

    const result = await db.raw(
      `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, miles, color, drive, zip_code,
        fuel_type, transmission, driveline, motor_trailer, location, source, buyer, status,
        condition_report, cr_status, recon_data, photos, transport_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, '{}') RETURNING id`,
      [row.vin, row.stock_number, row.year, row.make, row.model, row.trim, row.miles, row.color, row.drive, row.zip_code,
       row.fuel_type, row.transmission, row.driveline, row.motor_trailer, row.location, row.source, row.buyer,
       row.condition_report ? JSON.stringify(row.condition_report) : null,
       row.condition_report ? 'baseline' : null,
       JSON.stringify(row.recon_data),
       JSON.stringify(row.photos || [])]
    );
    broadcast('VEHICLES_UPDATED');
    res.json({ ok: true, id: result.rows[0].id, updated: false });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Internal server error' });
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

    if (colMap['VIN'] === undefined && colMap['STOCK #'] === undefined)
      return res.status(400).json({ error: 'CSV must have at least a VIN or STOCK # column' });

    let imported = 0, updated = 0, skipped = 0, kickedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVRow(lines[i]);
        const vin      = getCol(row, colMap, 'VIN')?.trim().toUpperCase() || '';
        const stockNum = getCol(row, colMap, 'STOCK #')?.trim() || (vin ? vin.slice(-8) : '');

        // Need at least a VIN or stock number to identify the vehicle
        if (!vin && !stockNum) continue;

        const year    = parseInt(getCol(row, colMap, 'YEAR')) || null;
        const make    = getCol(row, colMap, 'MAKE') || '';
        const model   = getCol(row, colMap, 'MODEL') || '';
        const trim    = getCol(row, colMap, 'TRIM') || '';
        const color   = getCol(row, colMap, 'COLOR') || '';
        const rawMiles = String(getCol(row, colMap, 'MILES') || '0');
        let miles = parseInt(rawMiles.replace(/[^0-9]/g, '')) || 0;
        if (miles > 999999) miles = Math.floor(miles / 100);
        const location  = getCol(row, colMap, 'LOCATION') || '';
        const source    = getCol(row, colMap, 'FROM') || '';
        const origin    = getCol(row, colMap, 'ORIGIN') || '';
        const buyer     = getCol(row, colMap, 'BUYER') || '';
        const seller    = getCol(row, colMap, 'SELLER') || '';
        const soldTo    = getCol(row, colMap, 'SOLD TO') || null;
        const saleDate  = parseDate(getCol(row, colMap, 'SALE DATE'));
        const enterDate = parseDate(getCol(row, colMap, 'ENTER DATE'));
        const dogDate   = parseDate(getCol(row, colMap, 'D.O.G.'));
        const kickedDate    = parseDate(getCol(row, colMap, 'KICKED'));
        const deliveredDate = parseDate(getCol(row, colMap, 'D-DELV'));
        const notes     = getCol(row, colMap, 'NOTES') || '';
        const isKicked  = !!kickedDate;
        const status    = isKicked ? 'active' : (deliveredDate ? 'delivered' : (soldTo ? 'sold' : 'active'));
        if (isKicked) kickedCount++;

        // VIN is the primary dedup key; fall back to stock number if no VIN
        let existing: any = null;
        if (vin) {
          existing = (await db.raw('SELECT id, status FROM vehicles WHERE UPPER(TRIM(vin)) = ? LIMIT 1', [vin])).rows[0];
        }
        if (!existing && stockNum) {
          existing = (await db.raw('SELECT id, status FROM vehicles WHERE stock_number = ? LIMIT 1', [stockNum])).rows[0];
        }

        if (existing) {
          if (existing.status === 'delivered') { skipped++; continue; }
          await db.raw(
            `UPDATE vehicles SET vin=?, stock_number=COALESCE(NULLIF(?, ''), stock_number),
             year=?, make=?, model=?, trim=?, color=?, miles=?, location=?, source=?,
             origin=?, buyer=?, seller=?, sold_to=?, sale_date=?, enter_date=?, grounded_date=?,
             status=?, notes=?, updated_at=NOW() WHERE id=?`,
            [vin, stockNum, year, make, model, trim, color, miles, location, source, origin, buyer, seller,
             soldTo, saleDate, enterDate, dogDate, status, notes, existing.id]
          );
          updated++;
        } else {
          await db.raw(
            `INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source,
             origin, buyer, seller, sold_to, sale_date, enter_date, grounded_date, status, notes, recon_data, transport_data)
             VALUES (?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}')`,
            [vin, stockNum, year, make, model, trim, color, miles, location, source, origin, buyer, seller,
             soldTo, saleDate, enterDate, dogDate, status, notes]
          );
          imported++;
        }
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }

    if (imported > 0 || updated > 0) broadcast('VEHICLES_UPDATED');
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


