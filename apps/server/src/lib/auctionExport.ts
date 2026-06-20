// Builds the payload Fleet Command sends to the Auction app's
// POST /api/integrations/fleet-command/vehicle-media endpoint and posts it.
import { getAuctionBaseUrl, getApiKey } from './integrationConfig';

type ReconTask = {
  notes?: string;
  photos?: Array<{ data?: string; type?: string; name?: string }>;
  vendors?: Array<{
    vendorPhotos?: any[]; beforePhotos?: any[]; afterPhotos?: any[]; progressPhotos?: any[];
  }>;
};

const AUCTION_FUEL_TYPE_MAP: Record<string, string> = {
  gasoline: 'gas',
  unleaded: 'gas',
  'flex-fuel': 'ethanol',
  'plug-in hybrid': 'hybrid',
  phev: 'hybrid',
  bev: 'electric',
  'fuel cell': 'hydrogen',
};
const AUCTION_FUEL_TYPES = new Set(['diesel', 'electric', 'ethanol', 'gas', 'hybrid', 'hydrogen', 'petrol', 'other']);

function normalizeAuctionFuelType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (AUCTION_FUEL_TYPES.has(lower)) return lower;
  return AUCTION_FUEL_TYPE_MAP[lower] ?? 'other';
}

const EXTERIOR_KEYS = ['detail', 'touchup', 'bodyshop', 'pdr', 'windshield', 'blackwidow'];
const INTERIOR_KEYS = ['interior', 'electronics'];
const TIRES_KEYS = ['tires', 'wheels'];
const MECHANICAL_KEYS = ['mechanical', 'oemdealer'];

// Remove internal _id fields added by ConditionReportEditor before sending to Auction
function stripInternalIds(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripInternalIds);
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== '_id') out[k] = stripInternalIds(v);
    }
    return out;
  }
  return obj;
}

function notesFor(reconData: Record<string, ReconTask>, keys: string[]): string {
  return keys
    .map((k) => reconData[k]?.notes)
    .filter((n): n is string => !!n && n.trim().length > 0)
    .join(' | ');
}

// Only real http(s) URLs can be forwarded — recon photos uploaded inline as
// base64 data URIs (see ReconCategory.tsx's image upload path) have no URL
// the Auction app can fetch, so they're skipped rather than sent as garbage.
function collectMediaUrls(task: ReconTask | undefined): string[] {
  if (!task) return [];
  const urls: string[] = [];
  const pushPhotoList = (list?: any[]) => {
    (list || []).forEach((p) => {
      const url = typeof p === 'string' ? p : p?.data;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) urls.push(url);
    });
  };
  pushPhotoList(task.photos);
  (task.vendors || []).forEach((vn) => {
    pushPhotoList(vn.vendorPhotos);
    pushPhotoList(vn.beforePhotos);
    pushPhotoList(vn.afterPhotos);
    pushPhotoList(vn.progressPhotos);
  });
  return urls;
}

// When running locally both Fleet Command and the Auction app are in Docker.
// Photo URLs stored with localhost are unreachable from inside the Auction container,
// so we rewrite localhost → host.docker.internal in the payload only.
function toAuctionReachableUrl(url: string): string {
  return url.replace(/^(https?:\/\/)localhost(:\d+)/i, '$1host.docker.internal$2');
}

export function buildAuctionPayload(vehicle: any, opts: { replaceExistingImages?: boolean } = {}) {
  const reconData: Record<string, ReconTask> = vehicle.recon_data || {};

  const conditionReport: Record<string, any> = {};
  const additionalNotes = notesFor(reconData, ['cr', 'parts']);
  const engineNotes = notesFor(reconData, MECHANICAL_KEYS);
  const exteriorNotes = notesFor(reconData, EXTERIOR_KEYS);
  const interiorNotes = notesFor(reconData, INTERIOR_KEYS);
  const tiresNotes = notesFor(reconData, TIRES_KEYS);
  if (additionalNotes) conditionReport.additional_notes = additionalNotes;
  if (engineNotes) { conditionReport.engine_notes = engineNotes; conditionReport.transmission_notes = engineNotes; }
  if (exteriorNotes) conditionReport.exterior_notes = exteriorNotes;
  if (interiorNotes) conditionReport.interior_notes = interiorNotes;
  if (tiresNotes) conditionReport.tires_brakes_notes = tiresNotes;

  // media_urls is the correct field — the Auction app downloads each URL and re-uploads
  // to its own storage. media_manifest is metadata-only (no url field) and is NOT used here.
  const mediaUrls: Array<Record<string, any>> = [];
  let skippedNonUrlMedia = 0;
  Object.entries(reconData).forEach(([key, task]) => {
    const urls = collectMediaUrls(task);
    urls.forEach((url) => {
      mediaUrls.push({
        url: toAuctionReachableUrl(url),
        type: /\.(mp4|mov|webm)$/i.test(url) ? 'video' : 'image',
        category: key === 'cr' ? 'condition-report' : 'gallery',
        label: key,
        hidden_from_gallery: key === 'cr',
        show_in_condition_report: key === 'cr',
        source: 'fleet_command',
      });
    });
    (task?.photos || []).forEach((p) => {
      const url = typeof p === 'string' ? p : p?.data;
      if (typeof url === 'string' && url && !/^https?:\/\//i.test(url)) skippedNonUrlMedia++;
    });
  });

  const payload: Record<string, any> = {
    tenant: 'us',
    vin: vehicle.vin,
    year: vehicle.year || undefined,
    make: vehicle.make || undefined,
    model: vehicle.model || undefined,
    trim: vehicle.trim || undefined,
    mileage: vehicle.miles || undefined,
    zip_code: vehicle.zip_code || undefined,
    fuel_type: normalizeAuctionFuelType(vehicle.fuel_type),
    transmission: vehicle.transmission || undefined,
    drive: vehicle.drive || vehicle.driveline || undefined,
    motor_trailer: vehicle.motor_trailer || undefined,
    create_vehicle_if_missing: true,
    replace_existing_images: !!opts.replaceExistingImages,
  };

  // Prefer the structured condition_report column (created via ConditionReportEditor) if it
  // has any data; fall back to the recon-notes assembly for vehicles that pre-date the editor.
  const structuredCR = vehicle.condition_report;
  if (structuredCR && typeof structuredCR === 'object' && Object.keys(structuredCR).length > 0) {
    payload.condition_report = stripInternalIds(structuredCR);
  } else if (Object.keys(conditionReport).length > 0) {
    payload.condition_report = conditionReport;
  }

  const vehiclePhotos: any[] = Array.isArray(vehicle.photos)
    ? vehicle.photos
    : (typeof vehicle.photos === 'string' ? JSON.parse(vehicle.photos) : []);
  vehiclePhotos.forEach((p: any) => {
    const url = typeof p === 'string' ? p : p?.url;
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      mediaUrls.push({
        url: toAuctionReachableUrl(url),
        type: /\.(mp4|mov|webm)$/i.test(url) ? 'video' : 'image',
        category: 'gallery',
        label: 'vehicle',
        hidden_from_gallery: false,
        show_in_condition_report: false,
        source: 'fleet_command',
      });
    }
  });

  if (mediaUrls.length > 0) payload.media_urls = mediaUrls;

  return { payload, skippedNonUrlMedia };
}

export async function sendVehicleToAuction(vehicle: any, opts: { replaceExistingImages?: boolean } = {}) {
  if (!vehicle.vin) throw new Error('Vehicle has no VIN — required to send to Auction');

  const baseUrl = getAuctionBaseUrl();
  const apiKey = await getApiKey('FLEET_COMMAND_API_KEY', '/prod/fleet-command/fleet-command-api-key');
  const { payload, skippedNonUrlMedia } = buildAuctionPayload(vehicle, opts);

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/fleet-command/vehicle-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-fleet-command-api-key': apiKey },
    body: JSON.stringify(payload),
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};
  const ok = res.ok && isJson;
  if (!ok) console.error(`[auction] Unexpected response ${res.status} content-type=${contentType} url=${res.url}`);
  return { ok, status: res.status, data, skippedNonUrlMedia };
}
