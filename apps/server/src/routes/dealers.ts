import { Router, Request, Response } from 'express';
import db from '../lib/db';
import { requireAuth } from '../lib/auth';
import { getAuctionBaseUrl, getApiKey } from '../lib/integrationConfig';

const router = Router();

const DEALER_COLUMNS = `
  id, name, email, phone, address, city, state, zip_code,
  fax, website, country, working_hours, yard_address,
  payment_department_first_name, payment_department_last_name,
  payment_department_email, payment_department_phone,
  responsible_for_pickup, auction_id, created_at
`;

function pickFields(body: any) {
  const {
    name, email, phone, address, city, state, zip_code,
    fax, website, country, working_hours, yard_address,
    payment_department_first_name, payment_department_last_name,
    payment_department_email, payment_department_phone,
    responsible_for_pickup,
  } = body;
  return {
    name: name || '',
    email: email || null,
    phone: phone || null,
    address: address || null,
    city: city || null,
    state: state || null,
    zip_code: zip_code || null,
    fax: fax || null,
    website: website || null,
    country: country || null,
    working_hours: working_hours || null,
    yard_address: yard_address || null,
    payment_department_first_name: payment_department_first_name || null,
    payment_department_last_name: payment_department_last_name || null,
    payment_department_email: payment_department_email || null,
    payment_department_phone: payment_department_phone || null,
    responsible_for_pickup: !!responsible_for_pickup,
  };
}

// GET /api/dealers
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const rows = (await db.raw(`SELECT ${DEALER_COLUMNS} FROM dealers WHERE active = TRUE ORDER BY name`)).rows;
    res.json({ dealers: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dealers — create
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });
    const f = pickFields(req.body);
    if (!f.name.trim()) return res.status(400).json({ error: 'Name required' });
    const row = (await db.raw(`
      INSERT INTO dealers (
        name, email, phone, address, city, state, zip_code,
        fax, website, country, working_hours, yard_address,
        payment_department_first_name, payment_department_last_name,
        payment_department_email, payment_department_phone,
        responsible_for_pickup
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
    `, [
      f.name.trim(), f.email, f.phone, f.address, f.city, f.state, f.zip_code,
      f.fax, f.website, f.country, f.working_hours, f.yard_address,
      f.payment_department_first_name, f.payment_department_last_name,
      f.payment_department_email, f.payment_department_phone,
      f.responsible_for_pickup,
    ])).rows[0];
    res.json({ dealer: row });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/dealers/:id — update (must come before /import-from-auction)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });
    const f = pickFields(req.body);
    await db.raw(`
      UPDATE dealers
         SET name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?, zip_code = ?,
             fax = ?, website = ?, country = ?, working_hours = ?, yard_address = ?,
             payment_department_first_name = ?, payment_department_last_name = ?,
             payment_department_email = ?, payment_department_phone = ?,
             responsible_for_pickup = ?, updated_at = NOW()
       WHERE id = ? AND active = TRUE
    `, [
      f.name, f.email, f.phone, f.address, f.city, f.state, f.zip_code,
      f.fax, f.website, f.country, f.working_hours, f.yard_address,
      f.payment_department_first_name, f.payment_department_last_name,
      f.payment_department_email, f.payment_department_phone,
      f.responsible_for_pickup, req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/dealers/:id — soft delete
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });
    await db.raw(`UPDATE dealers SET active = FALSE, updated_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dealers/import-from-auction — pull dealership list from Auction system
router.post('/import-from-auction', async (req: Request, res: Response) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!['admin','tech support','tech_support','techsupport'].includes(user.role?.toLowerCase())) return res.status(403).json({ error: 'Admin only' });

    const baseUrl = getAuctionBaseUrl();
    const apiKey = await getApiKey('FLEET_COMMAND_API_KEY', '/prod/fleet-command/fleet-command-api-key');

    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/fleet-command/dealerships`, {
      headers: { 'x-fleet-command-api-key': apiKey },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return res.status(502).json({ error: `Auction returned ${r.status}: ${body.slice(0, 200)}` });
    }

    const { dealerships = [] } = await r.json() as { dealerships: any[] };
    let imported = 0, updated = 0;

    for (const d of dealerships) {
      const result = await db.raw(`
        INSERT INTO dealers (
          name, email, phone, address, city, state, zip_code,
          fax, website, country, working_hours, yard_address,
          payment_department_first_name, payment_department_last_name,
          payment_department_email, payment_department_phone,
          auction_id
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (auction_id) DO UPDATE
          SET name                           = EXCLUDED.name,
              email                          = EXCLUDED.email,
              phone                          = EXCLUDED.phone,
              address                        = EXCLUDED.address,
              city                           = EXCLUDED.city,
              state                          = EXCLUDED.state,
              zip_code                       = EXCLUDED.zip_code,
              fax                            = EXCLUDED.fax,
              website                        = EXCLUDED.website,
              country                        = EXCLUDED.country,
              working_hours                  = EXCLUDED.working_hours,
              yard_address                   = EXCLUDED.yard_address,
              payment_department_first_name  = EXCLUDED.payment_department_first_name,
              payment_department_last_name   = EXCLUDED.payment_department_last_name,
              payment_department_email       = EXCLUDED.payment_department_email,
              payment_department_phone       = EXCLUDED.payment_department_phone,
              active                         = TRUE,
              updated_at                     = NOW()
        RETURNING (xmax = 0) AS is_new
      `, [
        d.name, d.email||null, d.phone||null, d.address||null, d.city||null, d.state||null, d.zip_code||null,
        d.fax||null, d.website||null, d.country||null, d.working_hours||null, d.yard_address||null,
        d.payment_department_first_name||null, d.payment_department_last_name||null,
        d.payment_department_email||null, d.payment_department_phone||null,
        String(d.id),
      ]);

      if (result.rows[0]?.is_new) imported++; else updated++;
    }

    res.json({ ok: true, total: dealerships.length, imported, updated });
  } catch (e: any) {
    console.error('[dealers/import-from-auction]', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
