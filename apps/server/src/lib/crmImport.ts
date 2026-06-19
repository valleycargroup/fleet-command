export function driveToDriveline(drive: string): string {
  const d = (drive || '').trim().toLowerCase();
  if (!d) return '';
  if (/\b(4x4|4wd|four.?wheel)\b/.test(d)) return '4WD';
  if (/\b(awd|all.?wheel)\b/.test(d)) return 'AWD';
  if (/\b(fwd|front.?wheel)\b/.test(d)) return 'FWD';
  if (/\b(rwd|rear.?wheel)\b/.test(d)) return 'RWD';
  if (/\b(2x4|2wd|two.?wheel)\b/.test(d)) return '2WD';
  return '';
}

// Fetches a vehicle's data from the CRM's Fleet-Command-facing export endpoint
// (GET /external/fleet-command-vehicle/:vin on the CRM app) for the
// "Import from CRM" feature.
import { getCrmBaseUrl, getApiKey } from './integrationConfig';

export type CrmVehicle = {
  vin: string;
  year?: number | null;
  make?: string;
  model?: string;
  trim?: string;
  drive?: string;
  mileage?: number | null;
  source?: string;
  fuel_type?: string;
  transmission?: string;
  motor_trailer?: string;
  buyer?: { email?: string; first_name?: string; last_name?: string } | null;
  contact?: { email?: string; first_name?: string; last_name?: string; phone?: string };
  location?: { city?: string; state?: string; zip?: string };
  media?: string[];
  reconMedia?: string[];
  reconChecklist?: Record<string, any>;
  reconConditions?: Array<{ id: string; category: string; subCategory?: string; images: string[] }>;
};

export async function fetchCrmVehicle(vin: string): Promise<CrmVehicle> {
  const baseUrl = getCrmBaseUrl();
  const apiKey = await getApiKey('CRM_FLEET_COMMAND_API_KEY', '/prod/external/fleet-command/api-key');

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/external/fleet-command-vehicle/${encodeURIComponent(vin)}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (res.status === 404) throw new Error(`No vehicle found in CRM for VIN ${vin}`);
  if (!res.ok) throw new Error(`CRM lookup failed (${res.status})`);
  return res.json();
}

function locationToFleetLocation(loc?: { city?: string; state?: string }): string {
  const state = (loc?.state || '').toUpperCase();
  const city = (loc?.city || '').toUpperCase();
  if (state === 'AZ' || city.includes('PHOENIX') || city === 'PHX') return 'PHX';
  if (state === 'TX' || city.includes('DALLAS')) return 'Dallas';
  return loc?.city || 'PHX';
}

type FleetUser = { id: number; first_name: string; last_name: string; email: string };

// CRM's buyer is a CRM-internal user id resolved to email/name — Fleet has no
// concept of that id, so match against Fleet's own users by email first
// (most reliable), then by full name. The importer always reviews this
// before saving, so a wrong/missing match is just an empty field, not data
// corruption.
export function matchCrmBuyer(
  crmBuyer: CrmVehicle['buyer'],
  fleetUsers: FleetUser[]
): { id: number; name: string } | null {
  if (!crmBuyer) return null;
  const email = (crmBuyer.email || '').trim().toLowerCase();
  const fullName = `${crmBuyer.first_name || ''} ${crmBuyer.last_name || ''}`.trim().toLowerCase();

  let match: FleetUser | undefined;
  if (email) match = fleetUsers.find((u) => (u.email || '').trim().toLowerCase() === email);
  if (!match && fullName) {
    match = fleetUsers.find((u) => `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase() === fullName);
  }
  if (!match) return null;
  return { id: match.id, name: `${match.first_name}${match.last_name ? ' ' + match.last_name : ''}` };
}

// Shapes the raw CRM response into the same field names Fleet's Add Vehicle
// form / store use (camelCase), for the reviewer UI to pre-fill and edit
// before anything is saved.
export function crmVehicleToDraft(crm: CrmVehicle, fleetUsers: FleetUser[]) {
  const matchedBuyer = matchCrmBuyer(crm.buyer, fleetUsers);
  return {
    vin: crm.vin,
    year: crm.year || '',
    make: crm.make || '',
    model: crm.model || '',
    trim: crm.trim || '',
    miles: crm.mileage || '',
    drive: crm.drive || '',
    zipCode: crm.location?.zip || '',
    location: locationToFleetLocation(crm.location),
    source: crm.source || '',
    fuelType: crm.fuel_type || '',
    transmission: crm.transmission || '',
    motorTrailer: crm.motor_trailer || '',
    buyingBroker: matchedBuyer?.name || '',
    crmBuyerHint: crm.buyer ? { email: crm.buyer.email || '', name: `${crm.buyer.first_name || ''} ${crm.buyer.last_name || ''}`.trim() } : null,
    media: crm.media || [],
    reconMedia: crm.reconMedia || [],
    reconChecklist: crm.reconChecklist || {},
    reconConditions: crm.reconConditions || [],
  };
}

export type CrmImportFields = {
  vin: string;
  year?: number | string | null;
  make?: string;
  model?: string;
  trim?: string;
  miles?: number | string | null;
  color?: string;
  location?: string;
  zipCode?: string;
  fuelType?: string;
  transmission?: string;
  driveline?: string;
  drive?: string;
  motorTrailer?: string;
  source?: string;
  buyingBroker?: string;
  media?: string[];
  reconMedia?: string[];
  reconChecklist?: Record<string, any>;
  reconConditions?: Array<{ id: string; category: string; subCategory?: string; images: string[] }>;
};

// Ported from CRM's SendToAuctionModal.jsx — same target definitions so the
// condition report produced here matches what the CRM sends directly to Auction.

type ConditionTarget = { key: string; checklistKey: string; notesKey: string; description: string };
type TireTarget = { key: string; checklistKey: string; description: string; label: string; position: string; sizeKey: string; dependsOn?: string };

const AUCTION_CONDITION_TARGETS: { exterior: ConditionTarget[]; interior: ConditionTarget[]; other: ConditionTarget[] } = {
  exterior: [
    { key: 'moonroof-category-id',    checklistKey: 'moonroof',              notesKey: 'moonroofExplanation',              description: 'Moonroof / Sunroof' },
    { key: 'paint-work-category-id',  checklistKey: 'paintWork',             notesKey: 'paintWorkExplanation',             description: 'Prior Paint Work / Replaced Panels' },
    { key: 'body-damage-category-id', checklistKey: 'bodyDamage',            notesKey: 'bodyDamageExplanation',            description: 'Body Damage' },
    { key: 'windshield-category-id',  checklistKey: 'windshieldInspector',   notesKey: 'windshieldInspectorExplanation',   description: 'Windshield' },
    { key: 'truck-bed-category-id',   checklistKey: 'truck',                 notesKey: 'truckExplanation',                 description: 'Truck Bed' },
  ],
  interior: [
    { key: 'features-category-id',    checklistKey: 'featuresInspector',     notesKey: 'featuresInspectorExplanation',     description: 'Interior Features' },
    { key: 'keys-category-id',        checklistKey: 'keys',                  notesKey: 'keysExplanation',                  description: 'Keys' },
  ],
  other: [
    { key: 'dashboard-mileage-category-id', checklistKey: 'dashboardMileage',            notesKey: 'dashboardMileageExplanation',            description: 'Dashboard Mileage' },
    { key: 'mechanical-category-id',        checklistKey: 'mechanicalIssuesInspector',   notesKey: 'mechanicalIssuesInspectorExplanation',   description: 'Mechanical Issues' },
    { key: 'frame-check-category-id',       checklistKey: 'frameCheck',                  notesKey: 'frameCheckExplanation',                  description: 'Frame Check' },
    { key: 'jack-tools-category-id',        checklistKey: 'jackAndTools',                notesKey: 'jackAndToolsExplanation',                description: 'Jack And Tools' },
    { key: 'walkaround-video-category-id',  checklistKey: 'videoUpload',                 notesKey: 'videoUploadExplanation',                 description: 'Walk Around Video' },
    { key: 'additional-video-category-id',  checklistKey: 'additionalVideo',             notesKey: 'additionalVideoExplanation',             description: 'Additional Video' },
  ],
};

const AUCTION_TIRE_TARGETS: TireTarget[] = [
  { key: 'front-left-tire-category-id',       checklistKey: 'frontLeftTire',      description: 'Front Left Tire',      label: 'Front Left',      position: 'Left Front',        sizeKey: 'frontLeftTireTireSize' },
  { key: 'front-right-tire-category-id',      checklistKey: 'frontRightTire',     description: 'Front Right Tire',     label: 'Front Right',     position: 'Right Front',       sizeKey: 'frontRightTireTireSize' },
  { key: 'rear-left-tire-category-id',        checklistKey: 'rearLeftTire',       description: 'Rear Left Tire',       label: 'Rear Left',       position: 'Left Rear Outer',   sizeKey: 'rearLeftTireTireSize' },
  { key: 'rear-right-tire-category-id',       checklistKey: 'rearRightTire',      description: 'Rear Right Tire',      label: 'Rear Right',      position: 'Right Rear Outer',  sizeKey: 'rearRightTireTireSize' },
  { key: 'inner-rear-left-tire-category-id',  checklistKey: 'innerRearLeftTire',  description: 'Inner Rear Left Tire', label: 'Inner Rear Left', position: 'Left Rear Inner',   sizeKey: 'innerRearLeftTireTireSize',  dependsOn: 'dualRearWheel' },
  { key: 'inner-rear-right-tire-category-id', checklistKey: 'innerRearRightTire', description: 'Inner Rear Right Tire',label: 'Inner Rear Right',position: 'Right Rear Inner',  sizeKey: 'innerRearRightTireTireSize', dependsOn: 'dualRearWheel' },
  { key: 'spare-tire-category-id',            checklistKey: 'spareTire',          description: 'Spare Tire',           label: 'Spare Tire',      position: 'Spare',             sizeKey: 'spareTireTireSize' },
];

// Same mapping as CRM's mapConditionToTargetKey — determines which condition item
// each photo category belongs to so images land on the right row.
function crmConditionToTargetKey(cond: { category: string; subCategory?: string }): string {
  const cat = (cond.category || '').toLowerCase();
  const sub = (cond.subCategory || '').toLowerCase();
  if (cat === 'moonroof') return 'moonroof-category-id';
  if (cat === 'body') return 'body-damage-category-id';
  if (cat === 'glass') return 'windshield-category-id';
  if (cat === 'truck' && sub === 'bed') return 'truck-bed-category-id';
  if (cat === 'dashboard mileage') return 'dashboard-mileage-category-id';
  if (cat === 'mechanical') return 'mechanical-category-id';
  if (cat === 'scan') return 'scan-codes';
  if (cat === 'walk around') return 'walkaround-video-category-id';
  if (cat === 'video') return 'additional-video-category-id';
  if (cat === 'tire/wheel' || cat === 'wheel') {
    if (sub === 'front left')       return 'front-left-tire-category-id';
    if (sub === 'front right')      return 'front-right-tire-category-id';
    if (sub === 'rear left')        return 'rear-left-tire-category-id';
    if (sub === 'rear right')       return 'rear-right-tire-category-id';
    if (sub === 'inner rear left')  return 'inner-rear-left-tire-category-id';
    if (sub === 'inner rear right') return 'inner-rear-right-tire-category-id';
    if (sub === 'spare')            return 'spare-tire-category-id';
  }
  return '';
}

function cleanConditionText(value: any): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (['see notes', 'see note', 'see notes.', 'see note.', 'n/a', 'na'].includes(lower)) return '';
  return raw;
}

function buildConditionValue(value: any, notes: any): string {
  const cleanNotes = cleanConditionText(notes);
  if (cleanNotes) return cleanNotes;
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === undefined || value === null || value === '') return '';
  return cleanConditionText(value);
}

function buildConditionPercent(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const raw = String(value).trim();
  const pct = raw.match(/^(\d{1,3})\s*%?$/);
  if (pct) { const n = Number(pct[1]); return Number.isNaN(n) ? null : n; }
  const map: Record<string, number> = { yes: 100, true: 100, no: 0, false: 0 };
  return map[raw.toLowerCase()] ?? null;
}

function hasMeaningfulValue(v: any): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function buildConditionReportFromCrm(
  reconChecklist: Record<string, any>,
  reconConditions: Array<{ id: string; category: string; subCategory?: string; images: string[] }>
): Record<string, any> | null {
  // Build a map of targetKey → image URL[] from the reconConditions photo buckets
  const imagesByTarget: Record<string, string[]> = {};
  for (const cond of reconConditions) {
    const targetKey = crmConditionToTargetKey(cond);
    if (!targetKey) continue;
    const urls = (cond.images || []).filter((u: string) => typeof u === 'string' && /^https?:\/\//i.test(u));
    if (!urls.length) continue;
    imagesByTarget[targetKey] = [...(imagesByTarget[targetKey] || []), ...urls];
  }

  const buildItem = (target: ConditionTarget) => {
    const condition = buildConditionValue(reconChecklist[target.checklistKey], reconChecklist[target.notesKey]);
    const images = imagesByTarget[target.key] || [];
    const include = hasMeaningfulValue(condition) || images.length > 0;
    return { _id: `crm_${target.key}`, key: target.key, description: target.description, condition, image_urls: images, include };
  };

  const condition_details = {
    exterior: AUCTION_CONDITION_TARGETS.exterior.map(buildItem),
    interior: AUCTION_CONDITION_TARGETS.interior.map(buildItem),
    other:    AUCTION_CONDITION_TARGETS.other.map(buildItem),
  };

  const scanCondition = buildConditionValue(reconChecklist.scanCodes, reconChecklist.scanCodesExplanation);
  const diagnostic_trouble_codes = {
    items: [{
      _id: 'crm_scan-codes',
      key: 'scan-codes',
      description: 'Scan Codes / VIN Match',
      condition: scanCondition,
      image_urls: imagesByTarget['scan-codes'] || [],
      include: hasMeaningfulValue(scanCondition) || (imagesByTarget['scan-codes'] || []).length > 0,
    }],
  };

  const dualRearWheel = reconChecklist.dualRearWheel === true || reconChecklist.dualRearWheel === 'yes';
  const tires = AUCTION_TIRE_TARGETS
    .filter((t) => !t.dependsOn || dualRearWheel)
    .map((target) => {
      const conditionPercent = buildConditionPercent(reconChecklist[target.checklistKey]);
      const tireSize = reconChecklist[target.sizeKey] || '';
      const images = imagesByTarget[target.key] || [];
      return {
        _id: `crm_${target.key}`,
        key: target.key,
        description: target.description,
        label: target.label,
        position: target.position,
        condition_percent: conditionPercent,
        tire_size: tireSize,
        image_urls: images,
        include: conditionPercent !== null || hasMeaningfulValue(tireSize) || images.length > 0,
      };
    });

  const hasAnyData =
    condition_details.exterior.some((i) => i.include) ||
    condition_details.interior.some((i) => i.include) ||
    condition_details.other.some((i) => i.include) ||
    diagnostic_trouble_codes.items.some((i) => i.include) ||
    tires.some((i) => i.include);

  if (!hasAnyData) return null;

  return {
    inspector_name: '',
    inspection_date: '',
    overall_rating: '',
    condition_details,
    diagnostic_trouble_codes,
    tires_and_wheels: {
      dual_rear_wheels: dualRearWheel,
      spare_tire: reconChecklist.spareTire === true || reconChecklist.spareTire === 'yes',
      tires,
    },
    meta: {
      source: 'crm',
      crm_imported_at: new Date().toISOString(),
    },
  };
}

export function crmImportFieldsToFleetRow(fields: CrmImportFields) {
  const stockNumber = `CRM-${(fields.vin || '').slice(-6).toUpperCase()}`;
  const conditionReport = buildConditionReportFromCrm(
    fields.reconChecklist || {},
    fields.reconConditions || []
  );
  return {
    vin: fields.vin,
    stock_number: stockNumber,
    year: fields.year ? Number(fields.year) : null,
    make: fields.make || '',
    model: fields.model || '',
    trim: fields.trim || '',
    miles: fields.miles ? Number(fields.miles) : 0,
    color: fields.color || '',
    location: fields.location || 'PHX',
    zip_code: fields.zipCode || null,
    fuel_type: fields.fuelType || null,
    transmission: fields.transmission || null,
    driveline: fields.driveline || driveToDriveline(fields.drive || '') || null,
    drive: fields.drive || null,
    motor_trailer: fields.motorTrailer || null,
    source: fields.source || '',
    buyer: fields.buyingBroker || '',
    condition_report: conditionReport,
    photos: (fields.media || []).map((url) => ({ key: url, url, source: 'crm' })),
    recon_data: {
      cr: {
        needed: (fields.reconMedia || []).length > 0,
        status: (fields.reconMedia || []).length > 0 ? 'complete' : 'na',
        notes: 'Imported from CRM',
        photos: (fields.reconMedia || []).map((url) => ({ data: url, name: url.split('/').pop() || '', type: 'image' })),
      },
      _crmReconChecklist: fields.reconChecklist || {},
    },
  };
}
