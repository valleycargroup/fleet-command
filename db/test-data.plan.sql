-- =============================================================================
-- Fleet Command — QA Test Plan Seed Data  (full coverage, all 28 sections)
-- Password for ALL users: Fleet2024!
-- Real emails: michael.alanw@gmail.com (Admin), sales@rfdprint.com (Seller/Broker),
--              support@vehiclebuyers.com (payment dept email on Detail Pro PHX — §30 email tests)
-- All @fleettest.local addresses are fake — no real mail sent.
--
-- VEHICLE MAP (what each vehicle covers):
--   PHX-001  Ford F-150    Fresh, no recon. Login/search, edit, toggle Need, assign vendor,
--                          CR assign (no cr_assigned_to), transport from-scratch, full-width,
--                          deep link, seller=rfdprint (broker email trigger vehicle)
--   PHX-002  Toyota Camry  ALL 5 recon states assigned to Detail Pro PHX.
--                          Vendor portal (submit bid, approve, start, complete),
--                          bodyshop task has body of notes + URL for §13,
--                          interior task has priority=3 pre-set for §14,
--                          deep link ?cat=bodyshop test
--   PHX-003  Jeep Cherokee All recon complete, buyer approved ship, seller=rfdprint.
--                          Broker email §16, outbound transport set-then-mark-delivered §6
--   PHX-004  Honda Accord  status=delivered.  Delivered tab §2
--   PHX-005  BMW 3 Series  CR assigned to techsupport (status change §7), detail=approved
--                          (mark as started §4), photos §10
--   PHX-006  Chevy Equinox Expendable. DELETE test §3, transport from scratch §6 (empty '{}')
--   DFW-001  Ram 1500      Dallas, bid submitted by Phoenix Recon Group (buyer approves §4),
--                          vendor isolation §5 (vendor@fleettest.local must NOT see this)
--   DFW-002  GMC Sierra    Dallas, inbound transport set but NOT delivered.
--                          Mark-as-delivered §6, Dallas filter §2
-- =============================================================================

BEGIN;

-- ── AUCTIONS ─────────────────────────────────────────────────────────────────
INSERT INTO auctions (name) VALUES
  ('Manheim Express Phoenix'),
  ('Manheim Express Dallas'),
  ('ADESA Dallas'),
  ('ACV Auctions'),
  ('Openlane')
ON CONFLICT DO NOTHING;

-- ── VENDORS ──────────────────────────────────────────────────────────────────
-- Detail Pro PHX:  primary_user_id set after users; payment_dept_email pre-populated §25
-- Body Shop Pro:   no users — use for §24 "add user to vendor with no users"
-- Touch Up Pro:    one user linked (vendor3) but NO primary_user_id — use for §27 "no primary" card
-- Phoenix Recon:   no users — used for DFW-001 tasks (vendor isolation §5)

INSERT INTO vendors (name, location, categories, office_phone, active, payment_info, email_prefs)
VALUES
  -- Detail Pro: primary contact = Alex Reyes, payment email pre-filled, CC prefs ON
  ('Detail Pro PHX',
   'Phoenix, AZ', '["detail","pdr","interior","touchup","wheels","tires","windshield","electronics","blackwidow","parts"]', '602-555-0100', TRUE,
   '{}',
   '{"paymentDeptEmail":"support@vehiclebuyers.com","ccPayment":true,"ccBid":true,"ccDigest":false}'),

  -- Body Shop: no users at all — §24 "vendor with no assigned users"
  ('Body Shop Pro PHX',
   'Phoenix, AZ', '["bodyshop","pdr"]', '602-555-0120', TRUE,
   '{}', '{}'),

  -- Touch Up: vendor3 linked, primary_user_id=NULL — §27 card shows "No primary contact assigned"
  ('Touch Up Pro PHX',
   'Phoenix, AZ', '["touchup"]', '602-555-0110', TRUE,
   '{}', '{"ccPayment":true,"ccBid":true,"ccDigest":false}'),

  -- Phoenix Recon: no users — used for DFW-001 tasks only
  ('Phoenix Recon Group',
   'Phoenix, AZ', '["detail","touchup","mechanical","interior"]', '602-555-0200', TRUE,
   '{}', '{}');

-- ── USERS ─────────────────────────────────────────────────────────────────────
-- Hash = bcrypt cost 12 of "Fleet2024!" (generated via bcryptjs in server container)
-- must_change_password=FALSE — testers log straight in

WITH
  detail_pro  AS (SELECT id FROM vendors WHERE name = 'Detail Pro PHX'),
  touchup_pro AS (SELECT id FROM vendors WHERE name = 'Touch Up Pro PHX')
INSERT INTO users
  (first_name, last_name, email, phone, role,
   is_buyer, is_seller, is_ap,
   location, vendor_id, vendor_tag,
   password_hash, must_change_password, active)
VALUES
  -- 1. Admin — real email (receives system / notification emails)
  ('Michael', 'Wainwright', 'michael.alanw@gmail.com',    '602-555-0001', 'admin',
   FALSE, FALSE, FALSE, 'PHX',    NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 2. Tech Support — §18 TechSupport role, §7 CR assigned-to
  ('Taylor', 'Support', 'techsupport@fleettest.local',     '602-555-0002', 'techsupport',
   FALSE, FALSE, FALSE, 'PHX',    NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 3. Buyer only — §4 approve bids, §9 no payment queue
  ('Darren', 'Cole', 'buyer@fleettest.local',              '602-555-0003', 'buyer',
   TRUE, FALSE, FALSE, 'PHX',     NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 4. Buyer + Seller (Dallas) — §4 approve DFW bids, §21 Seller access check
  ('James',   'Walsh', 'buyerseller@fleettest.local',      '214-555-0004', 'buyer',
   TRUE, TRUE, FALSE, 'Dallas',   NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 5. Seller / Broker — REAL email, receives broker notification emails §16
  ('Sales', 'Team',   'sales@rfdprint.com',                '602-555-0005', 'seller',
   FALSE, TRUE, FALSE, 'PHX',     NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 6. AP (Accounts Payable) — §9 Payment Queue visible
  ('Tony',  'Liu',   'ap@fleettest.local',                 '602-555-0006', 'ap',
   FALSE, FALSE, TRUE, 'PHX',     NULL, NULL,
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 7. Vendor A — Detail Pro PHX PRIMARY contact §27
  ('Alex',  'Reyes', 'vendor@fleettest.local',             '602-555-0007', 'vendor',
   FALSE, FALSE, FALSE, 'PHX',    (SELECT id FROM detail_pro), 'detail',
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 8. Vendor B — Detail Pro PHX 2nd user (for Set Primary swap §23/§27)
  ('Maria', 'Garcia', 'vendor2@fleettest.local',           '602-555-0008', 'vendor',
   FALSE, FALSE, FALSE, 'PHX',    (SELECT id FROM detail_pro), 'detail',
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE),

  -- 9. Vendor C — Touch Up Pro, NO primary_user_id on Touch Up Pro §27 "no primary" card
  ('Jordan', 'Kim',  'vendor3@fleettest.local',            '602-555-0009', 'vendor',
   FALSE, FALSE, FALSE, 'PHX',    (SELECT id FROM touchup_pro), 'touchup',
   '$2a$12$xCfUXznzCJgS5BsXsujtAejySjla./oS/esHfiahwK7EIhsek/hVy', FALSE, TRUE);

-- Set primary contacts:
--   Detail Pro PHX → Alex Reyes (primary set, Maria is secondary — swap test §23/§27)
--   Touch Up Pro   → primary_user_id stays NULL (§27 "No primary contact assigned" card)
UPDATE vendors
SET primary_user_id = (SELECT id FROM users WHERE email = 'vendor@fleettest.local')
WHERE name = 'Detail Pro PHX';

-- ── DEALERS ──────────────────────────────────────────────────────────────────
-- §17: 3 dealers pre-seeded (list loads), tester adds/edits/deletes a 4th
INSERT INTO dealers (name, email, phone, city, state, zip_code, responsible_for_pickup, active)
VALUES
  ('Premier Auto Group',     'fleet@premierauto.com', '602-555-9001', 'Scottsdale', 'AZ', '85251', FALSE, TRUE),
  ('DFW Direct Motors',      'fleet@dfwdirect.com',   '214-555-9002', 'Dallas',     'TX', '75201', TRUE,  TRUE),
  ('Valley Star Dealership', 'fleet@valleystar.com',  '480-555-9003', 'Mesa',       'AZ', '85201', FALSE, TRUE);

-- ── VEHICLES ─────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-001: Ford F-150 · Fresh, no recon · Transport inbound delivered
-- §1 Login  §2 Search ("FORD")  §3 Edit/CSV  §6 Transport view
-- §7 CR assign (cr_assigned_to=NULL)  §11 Deep link  §12 Notes add task
-- §15 Full-width  §16 Broker email (seller=rfdprint)  §28 WebSocket edit
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   cr_status, cr_assigned_to,
   recon_data, transport_data)
VALUES (
  '1HGCM82633A100001', 'PHX-001', 2024, 'Ford', 'F-150', 'XLT', 'White', 12400,
  'PHX', 'Manheim Express Phoenix', 'Darren Cole', 'sales@rfdprint.com',
  '2026-06-25', 'active',
  NULL, NULL,
  '{}',
  '{"inbound":{"set":true,"destination":"PHX","eta":"2026-06-28","cost":450,"delivered":true,"dateDelivered":"2026-06-29","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":false}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-002: Toyota Camry · ALL 5 recon states, all tasks assigned to Detail Pro PHX
-- Vendor portal: §5 vendor submits bid (detail=assigned,no bid), sees approved (touchup),
--                sees started (pdr), sees complete (interior)
-- Buyer flow:    §4 approve bodyshop bid, §4 start touchup task, §4 complete pdr task
-- §11 deep link ?cat=bodyshop    §12 Task Notes (bodyshop has notes pre-seeded)
-- §13 URL in notes (bodyshop note contains URLs)   §14 priority (interior priority=3)
-- CR section visible but cr_assigned_to=NULL — assign it fresh §7
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   cr_status, cr_assigned_to,
   recon_data, transport_data)
VALUES (
  '2T1BURHE0JC100002', 'PHX-002', 2023, 'Toyota', 'Camry', 'SE', 'Silver', 28500,
  'PHX', 'ACV Auctions', 'Darren Cole', '',
  '2026-06-16', 'active',
  NULL, NULL,
  '{
    "detail":{
      "needed":true,"status":"complete","dateAssigned":"2026-06-18","dateStarted":"2026-06-20","dateCompleted":"2026-07-02",
      "workTasks":[{"id":"wt1","desc":"Full Detail","isPart":false}],
      "completedRounds":[{"tasks":"Full Detail","cost":300,"date":"2026-07-02","vendor":"Detail Pro PHX"}],
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","estimate":300,"bidLocked":true,"selected":true,
        "lineItems":[{"id":"wt1","desc":"Full Detail","price":300,"accepted":true,"costType":"ws"}],
        "vendorPhotos":[]}]
    },
    "bodyshop":{
      "needed":true,"status":"complete","dateAssigned":"2026-06-18","dateStarted":"2026-06-24","dateCompleted":"2026-07-02",
      "notes":"Check paint match quality carefully on rear quarter panel.",
      "workTasks":[
        {"id":"li1","desc":"Front Bumper Repair","isPart":false},
        {"id":"li2","desc":"Paint Match & Blend","isPart":false}
      ],
      "completedRounds":[{"tasks":"Front Bumper Repair, Paint Match & Blend","cost":900,"date":"2026-07-02","vendor":"Detail Pro PHX"}],
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","estimate":900,"bidLocked":true,"selected":true,
        "lineItems":[
          {"id":"li1","desc":"Front Bumper Repair","price":600,"accepted":true,"costType":"ws"},
          {"id":"li2","desc":"Paint Match & Blend","price":300,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]
    },
    "touchup":{
      "needed":true,"status":"complete","dateAssigned":"2026-06-16","dateApproved":"2026-06-22","dateStarted":"2026-06-25","dateCompleted":"2026-07-02",
      "workTasks":[
        {"id":"li1","desc":"Hood Touch-Up","isPart":false},
        {"id":"li2","desc":"Door Edge Scratch","isPart":false}
      ],
      "completedRounds":[{"tasks":"Hood Touch-Up, Door Edge Scratch","cost":500,"date":"2026-07-02","vendor":"Detail Pro PHX"}],
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","estimate":500,"bidLocked":true,"selected":true,
        "lineItems":[
          {"id":"li1","desc":"Hood Touch-Up","price":300,"accepted":true,"costType":"ws"},
          {"id":"li2","desc":"Door Edge Scratch","price":200,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]
    },
    "pdr":{
      "needed":true,"status":"complete","dateAssigned":"2026-06-14","dateApproved":"2026-06-17","dateStarted":"2026-06-22","dateCompleted":"2026-07-02",
      "workTasks":[
        {"id":"li1","desc":"Hood Dents (3)","isPart":false},
        {"id":"li2","desc":"Driver Door Panel","isPart":false}
      ],
      "completedRounds":[{"tasks":"Hood Dents (3), Driver Door Panel","cost":450,"date":"2026-07-02","vendor":"Detail Pro PHX"}],
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","estimate":450,"bidLocked":true,"selected":true,
        "lineItems":[
          {"id":"li1","desc":"Hood Dents (3)","price":250,"accepted":true,"costType":"ws"},
          {"id":"li2","desc":"Driver Door Panel","price":200,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]
    },
    "interior":{
      "needed":true,"status":"started","priority":3,
      "dateAssigned":"2026-06-12","dateApproved":"2026-06-14","dateStarted":"2026-06-17",
      "workTasks":[
        {"id":"li1","desc":"Seat leather repair — driver & passenger","isPart":false},
        {"id":"li2","desc":"Carpet dye treatment — all mats & floor","isPart":false},
        {"id":"li3","desc":"Interior wipe-down & deodorize","isPart":false}
      ],
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","estimate":425,"bidLocked":true,"selected":true,
        "lineItems":[
          {"id":"li1","desc":"Seat Leather Repair","price":200,"accepted":true,"costType":"ws"},
          {"id":"li2","desc":"Carpet Dye","price":150,"accepted":true,"costType":"retail"},
          {"id":"li3","desc":"Interior Wipe-Down & Deodorize","price":75,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]
    },
    "cr":{"needed":false,"status":"na"},
    "tires":{"needed":false,"status":"na"},
    "wheels":{"needed":false,"status":"na"},
    "mechanical":{"needed":false,"status":"na"},
    "windshield":{"needed":false,"status":"na"},
    "electronics":{"needed":false,"status":"na"},
    "oemdealer":{"needed":false,"status":"na"},
    "blackwidow":{"needed":false,"status":"na"},
    "auction":{"needed":false,"status":"na"},
    "parts":{"needed":false,"status":"na"}
  }',
  '{"inbound":{"set":true,"destination":"PHX","eta":"2026-06-18","cost":400,"delivered":true,"dateDelivered":"2026-06-19","company":"Southwest Haul","phone":"602-555-3333","email":"sw@haul.com"},"outbound":{"set":false}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-003: Jeep Grand Cherokee · All recon complete, buyer approved ship
-- seller=sales@rfdprint.com → §16 broker email already triggered
-- Outbound transport NOT set → §6 tester sets carrier then marks delivered
-- §28 WebSocket: edit fields here and watch Tab 2 update
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   recon_data, transport_data)
VALUES (
  '3VWFE21C04M100003', 'PHX-003', 2024, 'Jeep', 'Grand Cherokee', 'Limited', 'Black', 8200,
  'PHX', 'Openlane', 'Darren Cole', 'sales@rfdprint.com',
  '2026-06-09', 'active',
  '{
    "detail":{"needed":true,"status":"complete","dateAssigned":"2026-06-12","dateCompleted":"2026-06-16",
      "approvedForPayment":true,"approvedBy":"Darren Cole","approvedPaymentDate":"2026-06-20",
      "lockedVendorName":"Detail Pro PHX","lockedTotal":350,"lockedWS":350,"lockedRetail":0,
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","selected":true,"estimate":350,"bidLocked":true,
        "lineItems":[{"id":"li1","desc":"Full Detail","price":350,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},
    "pdr":{"needed":true,"status":"complete","dateAssigned":"2026-06-12","dateCompleted":"2026-06-18",
      "approvedForPayment":true,"approvedBy":"Darren Cole","approvedPaymentDate":"2026-06-20",
      "lockedVendorName":"Phoenix Recon Group","lockedTotal":450,"lockedWS":450,"lockedRetail":0,
      "vendors":[{"id":"prg1","name":"Phoenix Recon Group","selected":true,"estimate":450,"bidLocked":true,
        "lineItems":[
          {"id":"li2","desc":"Hood Dents","price":250,"accepted":true,"costType":"ws"},
          {"id":"li3","desc":"Door Panel","price":200,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]},
    "bodyshop":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},
    "tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},
    "interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},
    "windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},
    "oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},
    "cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},
    "parts":{"needed":false,"status":"na"},
    "_buyerApprovedShip":true,"_buyerApprovedDate":"2026-06-28"
  }',
  '{"inbound":{"set":true,"destination":"PHX","eta":"2026-06-11","cost":600,"delivered":true,"dateDelivered":"2026-06-12","company":"National Auto Shipping","phone":"800-555-9999","email":"ship@national.com"},"outbound":{"set":false}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-004: Honda Accord · DELIVERED (sold) · §2 Delivered tab
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, sale_date, status, sold_to,
   recon_data, transport_data)
VALUES (
  '5XYKT3A16CG100005', 'PHX-004', 2022, 'Honda', 'Accord', 'Sport', 'Blue', 41200,
  'PHX', 'ADESA Dallas', 'Darren Cole', 'sales@rfdprint.com',
  '2026-05-16', '2026-06-20', 'delivered', 'Premier Auto Group',
  '{
    "detail":{"needed":true,"status":"complete","dateAssigned":"2026-05-21","dateCompleted":"2026-05-26",
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","selected":true,"estimate":300,"bidLocked":true,
        "lineItems":[{"id":"li1","desc":"Full Detail","price":300,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},
    "bodyshop":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},
    "pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},
    "wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},
    "mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},
    "electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},
    "blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},
    "auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}
  }',
  '{"inbound":{"set":true,"destination":"PHX","eta":"2026-05-18","cost":350,"delivered":true,"dateDelivered":"2026-05-19","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":true,"destination":"Premier Auto Group","eta":"2026-06-21","cost":500,"company":"National Auto Shipping","phone":"800-555-9999","email":"ship@national.com"}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-005: BMW 3 Series · CR assigned to Tech Support · detail=approved
-- §7 CR: cr_status=assigned, cr_assigned_to=techsupport (change status baseline→complete)
-- §7 CR deep link: use this vehicle ID in ?vehicle=<id>&cat=cr URL
-- §4 Mark as Started: detail=approved — tester clicks Start
-- §10 Photos: upload to this vehicle
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   cr_status, cr_assigned_to,
   recon_data, transport_data)
VALUES (
  '7SAYGDEE5NA100007', 'PHX-005', 2023, 'BMW', '3 Series', '330i', 'Gray', 19800,
  'PHX', 'Openlane', 'Darren Cole', '',
  '2026-06-12', 'active',
  'assigned',
  (SELECT id FROM users WHERE email = 'techsupport@fleettest.local'),
  '{
    "detail":{"needed":true,"status":"approved","dateAssigned":"2026-06-15","dateApproved":"2026-06-17",
      "vendors":[{"id":"dp1","name":"Detail Pro PHX","selected":true,"estimate":400,"bidLocked":true,
        "lineItems":[
          {"id":"li1","desc":"Full Detail","price":250,"accepted":true,"costType":"ws"},
          {"id":"li2","desc":"Engine Bay Clean","price":150,"accepted":true,"costType":"ws"}
        ],"vendorPhotos":[]}]},
    "interior":{"needed":true,"status":"approved","dateAssigned":"2026-06-15","dateApproved":"2026-06-17",
      "vendors":[{"id":"prg1","name":"Phoenix Recon Group","selected":true,"estimate":320,"bidLocked":true,
        "lineItems":[
          {"id":"li3","desc":"Seat Repair","price":200,"accepted":true,"costType":"ws"},
          {"id":"li4","desc":"Carpet Dye","price":120,"accepted":true,"costType":"retail"}
        ],"vendorPhotos":[]}]},
    "cr":{"needed":true,"status":"assigned","dateAssigned":"2026-06-14","vendors":[]},
    "bodyshop":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},
    "pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},
    "wheels":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},
    "windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},
    "oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},
    "auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}
  }',
  '{"inbound":{"set":true,"destination":"PHX","eta":"2026-06-14","cost":550,"delivered":true,"dateDelivered":"2026-06-15","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":false}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PHX-006: Chevy Equinox · EXPENDABLE — minimal data
-- §3 Delete this vehicle   §6 Transport from scratch (transport_data='{}')
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, purchase_date, status,
   recon_data, transport_data)
VALUES (
  '8AFACGFC2HX100008', 'PHX-006', 2025, 'Chevrolet', 'Equinox', 'LT', 'Red', 3100,
  'PHX', 'Manheim Express Phoenix', 'Darren Cole',
  '2026-06-29', 'active',
  '{}', '{}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DFW-001: Ram 1500 · Dallas · Phoenix Recon Group bid submitted, awaiting approval
-- §2 Dallas filter   §4 Buyer approves bid (James Walsh is buyer here)
-- §5 Vendor isolation — vendor@fleettest.local (Detail Pro) must NOT see this vehicle
--    because it only has Phoenix Recon Group tasks
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   recon_data, transport_data)
VALUES (
  '4T1BF3EK8AU100004', 'DFW-001', 2023, 'Ram', '1500', 'Big Horn', 'White', 33100,
  'Dallas', 'Manheim Express Dallas', 'James Walsh', '',
  '2026-06-21', 'active',
  '{
    "mechanical":{"needed":true,"status":"assigned","dateAssigned":"2026-06-24",
      "vendors":[{"id":"prg1","name":"Phoenix Recon Group","estimate":750,"bidLocked":true,
        "lineItems":[
          {"id":"li1","desc":"Brake Service (all four)","price":400,"accepted":false,"costType":"ws"},
          {"id":"li2","desc":"Oil Change & Filters","price":200,"accepted":false,"costType":"ws"},
          {"id":"li3","desc":"Tire Rotation","price":150,"accepted":false,"costType":"ws"}
        ],"vendorPhotos":[]}]},
    "detail":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},
    "touchup":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},
    "tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},
    "interior":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},
    "electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},
    "blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},
    "auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}
  }',
  '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-06-24","cost":800,"delivered":true,"dateDelivered":"2026-06-25","company":"Lone Star Transport","phone":"214-555-4444","email":"ls@transport.com"},"outbound":{"set":false}}'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DFW-002: GMC Sierra · Dallas · Inbound transport set but NOT yet delivered
-- §2 Dallas filter   §6 Mark inbound as Picked Up (delivered=false)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO vehicles
  (vin, stock_number, year, make, model, trim, color, miles,
   location, source, buyer, seller, purchase_date, status,
   recon_data, transport_data)
VALUES (
  '6FPAAAJ32JH100006', 'DFW-002', 2024, 'GMC', 'Sierra', 'SLE', 'Gray', 5800,
  'Dallas', 'ACV Auctions', 'James Walsh', '',
  '2026-06-27', 'active',
  '{}',
  '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-07-03","cost":900,"delivered":false,"company":"National Auto Shipping","phone":"800-555-9999","email":"ship@national.com"},"outbound":{"set":false}}'
);

COMMIT;
