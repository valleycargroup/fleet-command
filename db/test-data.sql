-- Fleet Command — full test dataset
-- Run via: createTestData.js (which runs test-data-purge.sql first, then this file)

-- ============ USERS ============
-- Passwords must be set via the /setup or /change-password flow (SHA-256 salt:hash)
-- Insert admin user with a known hash: password = "Admin1234"
-- (salt = 'testsalt0000000a', hash = sha256('testsalt0000000a' + 'Admin1234'))
-- Use the /api/auth/setup endpoint on first run instead of hardcoding hashes here.
-- These users are inserted with must_change_password=TRUE so they set their own password on first login.

INSERT INTO users (first_name, last_name, email, phone, role, location, must_change_password, active)
VALUES
  ('Darren', 'C', 'darren@valleycargroup.com', '602-555-0001', 'Admin', 'PHX', TRUE, TRUE),
  ('Mike', 'W', 'mike@valleycargroup.com', '602-555-0002', 'Admin', 'PHX', TRUE, TRUE),
  ('Sarah', 'T', 'sarah@valleycargroup.com', '480-555-0010', 'Buyer/Seller', 'PHX', TRUE, TRUE),
  ('James', 'W', 'james@valleycargroup.com', '214-555-0011', 'Buyer/Seller', 'Dallas', TRUE, TRUE),
  ('Carlos', 'M', 'carlos@valleycargroup.com', '214-555-0012', 'Buyer', 'Dallas', TRUE, TRUE),
  ('Dana', 'P', 'dana@valleycargroup.com', '602-555-0013', 'Seller', 'PHX', TRUE, TRUE),
  ('Tony', 'L', 'tony@valleycargroup.com', '602-555-0014', 'AP', 'PHX', TRUE, TRUE);

-- ============ AUCTIONS ============
-- These match the seeds.sql defaults but are safe to re-insert (seeds already handles this)
-- Skipping here to avoid duplicates — seeds.sql covers auction data.

-- ============ VENDORS ============
INSERT INTO vendors (name, contact_name, email, phone, office_phone, location, categories, active)
VALUES
  ('Detail Pro PHX',       'Alex R.',    'phx@detail.com',        '602-555-0100', '602-555-0101', 'Phoenix, AZ',   '["detail"]',                    TRUE),
  ('Detail Pro DFW',       'Brandon K.', 'dfw@detail.com',        '214-555-0100', '214-555-0101', 'Dallas, TX',    '["detail"]',                    TRUE),
  ('Touch Up Pro PHX',     'Carmen L.',  'phx@touchup.com',       '602-555-0110', '602-555-0111', 'Phoenix, AZ',   '["touchup"]',                   TRUE),
  ('Touch Up Pro DFW',     'Derek M.',   'dfw@touchup.com',       '214-555-0110', '214-555-0111', 'Dallas, TX',    '["touchup"]',                   TRUE),
  ('Body Shop Pro PHX',    'Elena S.',   'phx@bodyshop.com',      '602-555-0120', '602-555-0121', 'Phoenix, AZ',   '["bodyshop"]',                  TRUE),
  ('Body Shop Pro DFW',    'Frank T.',   'dfw@bodyshop.com',      '214-555-0120', '214-555-0121', 'Dallas, TX',    '["bodyshop"]',                  TRUE),
  ('PDR Pro PHX',          'Grace H.',   'phx@pdr.com',           '602-555-0130', '602-555-0131', 'Phoenix, AZ',   '["pdr"]',                       TRUE),
  ('PDR Pro DFW',          'Henry J.',   'dfw@pdr.com',           '214-555-0130', '214-555-0131', 'Dallas, TX',    '["pdr"]',                       TRUE),
  ('Tires Pro PHX',        'Iris K.',    'phx@tires.com',         '602-555-0140', '602-555-0141', 'Phoenix, AZ',   '["tires"]',                     TRUE),
  ('Tires Pro DFW',        'Jake L.',    'dfw@tires.com',         '214-555-0140', '214-555-0141', 'Dallas, TX',    '["tires"]',                     TRUE),
  ('Wheels Pro PHX',       'Kim M.',     'phx@wheels.com',        '602-555-0150', '602-555-0151', 'Phoenix, AZ',   '["wheels"]',                    TRUE),
  ('Wheels Pro DFW',       'Leo N.',     'dfw@wheels.com',        '214-555-0150', '214-555-0151', 'Dallas, TX',    '["wheels"]',                    TRUE),
  ('Interior Pro PHX',     'Mia O.',     'phx@interior.com',      '602-555-0160', '602-555-0161', 'Phoenix, AZ',   '["interior"]',                  TRUE),
  ('Interior Pro DFW',     'Nick P.',    'dfw@interior.com',      '214-555-0160', '214-555-0161', 'Dallas, TX',    '["interior"]',                  TRUE),
  ('Mechanical Pro PHX',   'Olivia Q.',  'phx@mechanical.com',    '602-555-0170', '602-555-0171', 'Phoenix, AZ',   '["mechanical"]',                TRUE),
  ('Mechanical Pro DFW',   'Paul R.',    'dfw@mechanical.com',    '214-555-0170', '214-555-0171', 'Dallas, TX',    '["mechanical"]',                TRUE),
  ('Windshield Pro PHX',   'Quinn S.',   'phx@windshield.com',    '602-555-0180', '602-555-0181', 'Phoenix, AZ',   '["windshield"]',                TRUE),
  ('Windshield Pro DFW',   'Rachel T.',  'dfw@windshield.com',    '214-555-0180', '214-555-0181', 'Dallas, TX',    '["windshield"]',                TRUE),
  ('AZ Auto Electronics PHX', 'Steve U.','info@azautoelec.com',   '602-555-0190', '602-555-0191', 'Phoenix, AZ',   '["electronics"]',               TRUE),
  ('DFW Car Audio & Tech', 'Tina V.',    'info@dfwcaraudio.com',  '214-555-0190', '214-555-0191', 'Dallas, TX',    '["electronics"]',               TRUE),
  ('Larry H Miller Toyota PHX', 'Ursula W.', 'service@lhmtoyota.com', '602-555-0200', '602-555-0201', 'Phoenix, AZ', '["oemdealer"]',              TRUE),
  ('AutoNation Ford Dallas', 'Victor X.', 'service@anford.com',   '214-555-0200', '214-555-0201', 'Dallas, TX',    '["oemdealer"]',                 TRUE),
  ('Black Widow Photo PHX', 'Wendy Y.',  'photos@blackwidow.com', '602-555-0210', '602-555-0211', 'Phoenix, AZ',   '["blackwidow"]',                TRUE),
  ('Black Widow Photo DFW', 'Xander Z.', 'dfw@blackwidow.com',   '214-555-0210', '214-555-0211', 'Dallas, TX',    '["blackwidow"]',                TRUE),
  ('Auction Dept',         'Yvonne A.',  'auction@vcg.com',       '602-555-0220', '602-555-0221', 'Phoenix, AZ',   '["auction"]',                   TRUE),
  ('CR Writer PHX',        'Zach B.',    'cr@vcg.com',            '602-555-0230', '602-555-0231', 'Phoenix, AZ',   '["cr"]',                        TRUE),
  ('CR Writer DFW',        'Amy C.',     'crdfw@vcg.com',         '214-555-0230', '214-555-0231', 'Dallas, TX',    '["cr"]',                        TRUE),
  ('Parts Pro PHX',        'Bob D.',     'phx@parts.com',         '602-555-0240', '602-555-0241', 'Phoenix, AZ',   '["parts"]',                     TRUE),
  ('Parts Pro DFW',        'Carol E.',   'dfw@parts.com',         '214-555-0240', '214-555-0241', 'Dallas, TX',    '["parts"]',                     TRUE);

-- ============ VEHICLES ============
-- A representative set covering all statuses and recon states

INSERT INTO vehicles (vin, stock_number, year, make, model, trim, color, miles, location, source, buyer, seller, purchase_date, status, sale_date, sold_to, kicked, notes, recon_data, transport_data)
VALUES

-- V1: Sold, fully reconned, outbound set
('1HGCM82633A000001', 'A000001', 2024, 'Toyota', 'Camry', 'SE', 'White', 12500, 'PHX',
 'Manheim Phoenix', 'Darren', 'Mike', '2026-03-05', 'sold', '2026-03-18', 'Premier Motors', FALSE, '',
 '{"detail":{"needed":true,"status":"complete","dateCompleted":"2026-03-14","dateAssigned":"2026-03-10","vendors":[{"id":"va0","name":"Detail Pro PHX","selected":true,"estimate":350,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Full Detail","price":350,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"touchup":{"needed":true,"status":"complete","dateCompleted":"2026-03-16","dateAssigned":"2026-03-11","vendors":[{"id":"va1","name":"Touch Up Pro PHX","selected":true,"estimate":450,"bidLocked":true,"lineItems":[{"id":"wt2","desc":"Front Bumper","price":250,"accepted":true,"costType":"ws"},{"id":"wt3","desc":"Rear Quarter","price":200,"accepted":true,"costType":"retail"}],"vendorPhotos":[]}]},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-08","cost":650,"delivered":true,"dateDelivered":"2026-03-09","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":true,"destination":"Premier Motors","eta":"2026-03-22","readyDate":"2026-03-19","cost":800,"company":"National Auto Shipping","phone":"800-555-9999","email":"ship@national.com"}}'),

-- V2: In recon, bodyshop + tires complete, ready to ship
('2T1BURHE0JC000002', 'A000002', 2024, 'Ford', 'F-150', 'XLT', 'Silver', 8900, 'PHX',
 'Rental', 'Mike', '', '2026-03-03', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":true,"status":"complete","dateCompleted":"2026-03-17","dateAssigned":"2026-03-10","vendors":[{"id":"va2","name":"Body Shop Pro PHX","selected":true,"estimate":1200,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Front Bumper Replace","price":800,"accepted":true,"costType":"ws"},{"id":"wt2","desc":"Blend Paint","price":400,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"pdr":{"needed":false,"status":"na"},"tires":{"needed":true,"status":"complete","dateCompleted":"2026-03-15","dateAssigned":"2026-03-10","vendors":[{"id":"va4","name":"Tires Pro PHX","selected":true,"estimate":600,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"4 New Tires","price":600,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"},"_buyerApprovedShip":true,"_buyerApprovedDate":"2026-03-18"}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-06","cost":450,"delivered":true,"dateDelivered":"2026-03-07","company":"Southwest Haul","phone":"602-555-3333","email":"sw@haul.com"},"outbound":{"set":false}}'),

-- V3: In recon, vendors working (detail + touchup started)
('3VWFE21C04M000003', 'A000003', 2022, 'Chevrolet', 'Silverado', 'LT', 'Red', 45200, 'Dallas',
 'Manheim Phoenix', 'Darren', '', '2026-03-06', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":true,"status":"started","dateAssigned":"2026-03-12","dateStarted":"2026-03-14","vendors":[{"id":"va0","name":"Detail Pro PHX","selected":true,"estimate":400,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Full Detail","price":250,"accepted":true,"costType":"ws"},{"id":"wt2","desc":"Engine Bay","price":150,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"touchup":{"needed":true,"status":"started","dateAssigned":"2026-03-12","dateStarted":"2026-03-15","vendors":[{"id":"va1","name":"Touch Up Pro PHX","selected":true,"estimate":500,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Hood Respray","price":300,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":true,"status":"complete","dateCompleted":"2026-03-13","dateAssigned":"2026-03-10","vendors":[{"id":"va8","name":"Windshield Pro PHX","selected":true,"estimate":350,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Replace Windshield","price":350,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-03-09","cost":700,"delivered":true,"dateDelivered":"2026-03-10","company":"Lone Star Transport","phone":"214-555-4444","email":"ls@transport.com"},"outbound":{"set":false}}'),

-- V4: Bid approved, waiting on parts + recon start
('4T1BF3EK8AU000004', 'A000004', 2023, 'BMW', '3 Series', '330i', 'Gray', 19800, 'PHX',
 'ADESA Dallas', 'Mike', '', '2026-03-08', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":true,"status":"approved","dateAssigned":"2026-03-15","dateApproved":"2026-03-17","vendors":[{"id":"va2","name":"Body Shop Pro PHX","selected":true,"estimate":900,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Rear Bumper","price":500,"accepted":true,"costType":"ws"},{"id":"wt2","desc":"Paint Match","price":400,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":true,"status":"approved","dateAssigned":"2026-03-15","dateApproved":"2026-03-17","vendors":[{"id":"va6","name":"Interior Pro PHX","selected":true,"estimate":350,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Seat Repair","price":200,"accepted":true,"costType":"ws"},{"id":"wt2","desc":"Carpet Dye","price":150,"accepted":true,"costType":"retail"}],"vendorPhotos":[]}]},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-11","cost":550,"delivered":true,"dateDelivered":"2026-03-12","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":false}}'),

-- V5: Assigned, waiting on vendor bids
('5XYKT3A16CG000005', 'A000005', 2024, 'Jeep', 'Grand Cherokee', 'Limited', 'Blue', 5600, 'PHX',
 'ACV Auctions', 'Darren', '', '2026-03-10', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":true,"status":"assigned","dateAssigned":"2026-03-18","vendors":[{"id":"va3","name":"PDR Pro PHX","estimate":null,"bidLocked":false,"lineItems":[],"vendorPhotos":[]}]},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":true,"status":"assigned","dateAssigned":"2026-03-18","vendors":[{"id":"va7","name":"Mechanical Pro PHX","estimate":null,"bidLocked":false,"lineItems":[],"vendorPhotos":[]}]},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-13","cost":400,"delivered":true,"dateDelivered":"2026-03-14","company":"AZ Auto Transport","phone":"602-555-2222","email":"az@auto.com"},"outbound":{"set":false}}'),

-- V6: In inbound transport, no recon assigned yet
('6FPAAAJ32JH000006', 'A000006', 2023, 'RAM', '1500', 'Big Horn', 'White', 32100, 'Dallas',
 'Rental', 'Mike', '', '2026-03-15', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-03-22","cost":900,"company":"National Auto Shipping","phone":"800-555-9999","email":"ship@national.com"},"outbound":{"set":false}}'),

-- V7: Sold, no recon needed
('7JRBR4BG2EA000007', 'A000007', 2022, 'Toyota', 'Camry', 'XLE', 'Black', 41000, 'PHX',
 'Fleet/Lease', 'Darren', 'Mike', '2026-03-12', 'sold', '2026-03-17', 'AutoNation Dallas', FALSE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"},"_noReconNeeded":true,"_noReconSetBy":"Darren","_noReconSetDate":"2026-03-13"}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-14","cost":350,"delivered":true,"dateDelivered":"2026-03-14","company":"Southwest Haul","phone":"602-555-3333","email":"sw@haul.com"},"outbound":{"set":true,"destination":"AutoNation Dallas","eta":"2026-03-24","readyDate":"2026-03-18","cost":750,"company":"Lone Star Transport","phone":"214-555-4444","email":"ls@transport.com"}}'),

-- V8: Kicked vehicle — returned, now re-working
('8J3BE26W17H000008', 'A000008', 2024, 'Ford', 'F-150', 'Lariat', 'Silver', 3200, 'PHX',
 'Manheim Phoenix', 'Mike', 'Darren', '2026-03-01', 'sold', '2026-03-19', 'Carvana PHX', TRUE, '',
 '{"detail":{"needed":false,"status":"na"},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":true,"status":"started","dateAssigned":"2026-03-16","dateStarted":"2026-03-17","vendors":[{"id":"va7","name":"Mechanical Pro PHX","selected":true,"estimate":800,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"AC Compressor","price":500,"accepted":true,"costType":"ws"},{"id":"wt2","desc":"Labor","price":300,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"},"_kickedHistory":[{"dealer":"Larry H Miller","soldDate":"2026-03-10","kickedDate":"2026-03-14","sellingBroker":"Darren","reason":"Failed inspection - AC not working"}],"_kicked":true}',
 '{"inbound":{"set":true,"destination":"PHX","eta":"2026-03-04","cost":500,"delivered":true,"dateDelivered":"2026-03-05","company":"Fast Auto Transport","phone":"602-555-1234","email":"fast@transport.com"},"outbound":{"set":false}}'),

-- V9: Delivered — all done
('9BWZZZ3CZ5P000009', 'A000009', 2024, 'BMW', '3 Series', 'M340i', 'Black', 7400, 'Dallas',
 'Rental', 'Mike', 'Darren', '2026-02-25', 'delivered', '2026-03-10', 'Park Place Dallas', FALSE, '',
 '{"detail":{"needed":true,"status":"complete","dateCompleted":"2026-03-08","dateAssigned":"2026-03-03","vendors":[{"id":"vb0","name":"Detail Pro DFW","selected":true,"estimate":300,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Full Detail","price":300,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":false,"status":"na"},"wheels":{"needed":false,"status":"na"},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-03-01","cost":400,"delivered":true,"dateDelivered":"2026-03-02","company":"Lone Star Transport","phone":"214-555-4444","email":"ls@transport.com"},"outbound":{"set":true,"destination":"Park Place Dallas","eta":"2026-03-14","readyDate":"2026-03-11","pickedUp":true,"datePickedUp":"2026-03-12","delivered":true,"dateDelivered":"2026-03-14","cost":350,"company":"DFW Auto Move","phone":"214-555-5555","email":"dfw@move.com"}}'),

-- V10: Dallas, multi-category recon in various stages
('JHMGE8H39DC000010', 'A000010', 2023, 'Jeep', 'Grand Cherokee', 'Laredo', 'Green', 29600, 'Dallas',
 'ADESA Dallas', 'Mike', '', '2026-03-07', 'active', NULL, NULL, FALSE, '',
 '{"detail":{"needed":true,"status":"complete","dateCompleted":"2026-03-16","dateAssigned":"2026-03-12","vendors":[{"id":"vb0","name":"Detail Pro DFW","selected":true,"estimate":350,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Full Detail","price":350,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"touchup":{"needed":false,"status":"na"},"bodyshop":{"needed":false,"status":"na"},"pdr":{"needed":false,"status":"na"},"tires":{"needed":true,"status":"approved","dateAssigned":"2026-03-14","dateApproved":"2026-03-16","vendors":[{"id":"vb4","name":"Tires Pro DFW","selected":true,"estimate":700,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"4 New Tires","price":700,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"wheels":{"needed":true,"status":"started","dateAssigned":"2026-03-14","dateStarted":"2026-03-16","dateApproved":"2026-03-15","vendors":[{"id":"vb5","name":"Wheels Pro DFW","selected":true,"estimate":450,"bidLocked":true,"lineItems":[{"id":"wt1","desc":"Refinish 4 Wheels","price":450,"accepted":true,"costType":"ws"}],"vendorPhotos":[]}]},"interior":{"needed":false,"status":"na"},"mechanical":{"needed":false,"status":"na"},"windshield":{"needed":false,"status":"na"},"electronics":{"needed":false,"status":"na"},"oemdealer":{"needed":false,"status":"na"},"blackwidow":{"needed":false,"status":"na"},"cr":{"needed":false,"status":"na"},"auction":{"needed":false,"status":"na"},"parts":{"needed":false,"status":"na"}}',
 '{"inbound":{"set":true,"destination":"Dallas","eta":"2026-03-10","cost":300,"delivered":true,"dateDelivered":"2026-03-11","company":"Lone Star Transport","phone":"214-555-4444","email":"ls@transport.com"},"outbound":{"set":false}}');

-- ============ PARTS REQUESTS ============
INSERT INTO parts_requests (vehicle_id, requested_by, description, vendor_id, status, cost, notes)
SELECT v.id, 'Darren', 'Front Bumper Assembly', vn.id, 'ordered', 800.00, 'OEM part — ETA 3 days'
FROM vehicles v, vendors vn
WHERE v.stock_number = 'A000004' AND vn.name = 'Body Shop Pro PHX'
LIMIT 1;

INSERT INTO parts_requests (vehicle_id, requested_by, description, vendor_id, status, cost, notes)
SELECT v.id, 'Mike', '4x Michelin Defender Tires', vn.id, 'received', 700.00, 'Installed 2026-03-16'
FROM vehicles v, vendors vn
WHERE v.stock_number = 'A000010' AND vn.name = 'Tires Pro DFW'
LIMIT 1;
