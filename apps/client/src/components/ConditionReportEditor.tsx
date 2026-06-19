import { useState, useRef, useEffect, useCallback } from 'react';
import { S } from '../lib/styles';
import { API_URL } from '../lib/constants';
import { useStore } from '../lib/store';

type CRItem = { _id: string; description?: string; condition?: string; status?: string; additional_info?: string; image_urls?: string[]; };
type TireItem = { _id: string; position?: string; tread_depth?: string; tire_size?: string; condition_percent?: string; notes?: string; image_urls?: string[]; };
type DTCItem = { _id: string; description?: string; condition?: string; image_urls?: string[]; };

const isVideo = (url: string) => /\.(mp4|mov|avi|webm|mkv|m4v|ogg|ogv|3gp)(\?|$)/i.test(url);

async function uploadImage(file: File): Promise<string> {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(API_URL + '/api/uploads', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('fc_token') || '') },
      body: fd,
    });
    const j = await r.json();
    if (j.ok && j.data?.url) {
      const u = j.data.url as string;
      // ensure absolute URL so thumbnails load correctly
      return u.startsWith('http') ? u : API_URL + u;
    }
  } catch {}
  // fallback: embed as data URI (persists across sessions, fine for small images)
  return new Promise(resolve => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result as string);
    rd.readAsDataURL(file);
  });
}

// Module-level lightbox — avoids prop-drilling through DetailTable / DTC / tire sections
let _openLightbox: ((urls: string[], idx: number) => void) | null = null;
const openLightbox = (urls: string[], idx: number) => _openLightbox?.(urls, idx);

function Lightbox({ urls, startIdx, onClose }: { urls: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(urls.length - 1, i + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <button onClick={onClose}
        style={{ position: 'absolute', top: 14, right: 18, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', borderRadius: 4, padding: '3px 10px', zIndex: 1 }}>✕</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
        {urls.length > 1 && (
          <button onClick={prev} disabled={idx === 0}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, cursor: idx === 0 ? 'default' : 'pointer', borderRadius: 4, padding: '6px 14px', opacity: idx === 0 ? 0.3 : 1 }}>‹</button>
        )}
        {isVideo(urls[idx]) ? (
          <video key={urls[idx]} src={urls[idx]} controls autoPlay muted
            style={{ maxWidth: '82vw', maxHeight: '85vh', borderRadius: 6, display: 'block', background: '#111' }} />
        ) : (
          <img src={urls[idx]} alt=''
            style={{ maxWidth: '82vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 6, display: 'block', background: '#111' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        {urls.length > 1 && (
          <button onClick={next} disabled={idx === urls.length - 1}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 28, cursor: idx === urls.length - 1 ? 'default' : 'pointer', borderRadius: 4, padding: '6px 14px', opacity: idx === urls.length - 1 ? 0.3 : 1 }}>›</button>
        )}
      </div>
      {urls.length > 1 && <div style={{ color: '#6B7280', fontSize: 12, marginTop: 10 }}>{idx + 1} / {urls.length}</div>}
      <a href={urls[idx]} target='_blank' rel='noreferrer'
        style={{ color: '#60A5FA', fontSize: 12, marginTop: 8, textDecoration: 'underline' }}
        onClick={e => e.stopPropagation()}>Open original ↗</a>
    </div>
  );
}

function Thumb({ url, allUrls, idx, onRemove }: { url: string; allUrls: string[]; idx: number; onRemove: () => void }) {
  const [broken, setBroken] = useState(false);
  const view = () => openLightbox(allUrls, idx);
  const video = isVideo(url);
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {video ? (
        <div style={{ position: 'relative', width: 48, height: 48, cursor: 'pointer', borderRadius: 4, overflow: 'hidden', border: '1px solid #2A2A3E', background: '#0D0D1A' }} onClick={view}>
          <video src={url} preload='metadata' muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', fontSize: 16, color: '#fff' }}>▶</div>
        </div>
      ) : broken ? (
        <div title='Click to view' onClick={view}
          style={{ width: 48, height: 48, borderRadius: 4, border: '1px solid #2A2A3E', background: '#0D0D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>
          🔗
        </div>
      ) : (
        <img src={url} alt='' onError={() => setBroken(true)}
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid #2A2A3E', display: 'block' }}
          onClick={view} />
      )}
      <button style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#7F1D1D', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 9, lineHeight: '14px', textAlign: 'center', padding: 0 }}
        onClick={onRemove}>✕</button>
    </div>
  );
}
export type CRMeta = {
  source?: 'crm' | 'manual';
  crm_imported_at?: string;
  last_saved_at?: string;
  last_saved_by?: string;
  assigned_to?: { id: number; name: string; email: string } | null;
};
export type ConditionReport = {
  overall_rating?: string; inspector_name?: string; inspection_date?: string;
  engine_notes?: string; transmission_notes?: string; exterior_notes?: string;
  interior_notes?: string; tires_brakes_notes?: string; additional_notes?: string;
  condition_details?: { exterior?: CRItem[]; interior?: CRItem[]; other?: CRItem[]; };
  tires_and_wheels?: { dual_rear_wheels?: boolean; spare_tire?: boolean; tires?: TireItem[]; };
  diagnostic_trouble_codes?: { notes?: string; codes?: string[]; items?: DTCItem[]; };
  meta?: CRMeta;
};

const uid = () => `_${Math.random().toString(36).slice(2, 9)}`;

// Predefined categories matching the CRM / Auction format
const PRESETS: Record<'exterior' | 'interior' | 'other', string[]> = {
  exterior: ['Moonroof / Sunroof', 'Prior Paint Work / Replaced Panels', 'Body Damage', 'Windshield', 'Truck Bed', 'Paint', 'Glass', 'Bumper', 'Fenders', 'Hood', 'Doors', 'Tailgate', 'Roof'],
  interior: ['Interior Features', 'Keys', 'Seats', 'Headliner', 'Dashboard', 'Carpet / Floor Mats', 'Odor', 'Navigation / Screens'],
  other: ['Dashboard Mileage', 'Mechanical Issues', 'Frame Check', 'Jack And Tools', 'Walk Around Video', 'Additional Video', 'Transmission', 'Suspension', 'Brakes', 'Coolant / Fluids'],
};
const DTC_PRESETS = ['Scan Codes / VIN Match', 'Check Engine', 'ABS / Traction', 'Airbag / SRS', 'Emissions'];
const STATUS_OPTS = ['OK', 'Attention', 'Critical'];
const NOTE_FIELDS: [keyof ConditionReport, string][] = [
  ['engine_notes', '🔧 Engine'], ['transmission_notes', '⚙️ Transmission'],
  ['exterior_notes', '🚗 Exterior'], ['interior_notes', '💺 Interior'],
  ['tires_brakes_notes', '🛞 Tires & Brakes'],
];

// Recon → CR mapping for import
const KEY_LABELS: Record<string, string> = {
  detail: 'Detail / Cleaning', touchup: 'Touch Up Paint', bodyshop: 'Body Shop', pdr: 'PDR / Dent Repair',
  windshield: 'Windshield', blackwidow: 'Black Widow / Photos', interior: 'Interior', electronics: 'Electronics / AV',
  mechanical: 'Mechanical Issues', oemdealer: 'OEM / Dealer Service', parts: 'Parts', tires: 'Tires', wheels: 'Wheels',
};
const KEY_ICONS: Record<string, string> = {
  detail: '✨', touchup: '🖌️', bodyshop: '🔨', pdr: '🪛', windshield: '🪟',
  blackwidow: '📸', interior: '💺', electronics: '📻', mechanical: '🔧',
  oemdealer: '🏭', parts: '📦', tires: '🛞', wheels: '⚙️', cr: '📋',
};
const NOTE_MAP: Record<string, string> = {
  mechanical: 'engine_notes', oemdealer: 'engine_notes',
  detail: 'exterior_notes', touchup: 'exterior_notes', bodyshop: 'exterior_notes',
  pdr: 'exterior_notes', windshield: 'exterior_notes', blackwidow: 'exterior_notes',
  interior: 'interior_notes', electronics: 'interior_notes',
  tires: 'skip', wheels: 'skip',
  cr: 'additional_notes', parts: 'additional_notes',
};
const ITEM_MAP: Record<string, 'exterior' | 'interior' | 'other'> = {
  detail: 'exterior', touchup: 'exterior', bodyshop: 'exterior', pdr: 'exterior',
  windshield: 'exterior', blackwidow: 'exterior',
  interior: 'interior', electronics: 'interior',
  mechanical: 'other', oemdealer: 'other', parts: 'other',
};
// CR Category name to use when importing from each recon key (separate from KEY_LABELS which is just the source label)
const ITEM_DESC_MAP: Record<string, string> = {
  tires: 'Tires and Wheels', wheels: 'Tires and Wheels',
  windshield: 'Windshield', bodyshop: 'Body Damage', pdr: 'Body Damage',
  touchup: 'Prior Paint Work / Replaced Panels',
  interior: 'Interior Features', electronics: 'Interior Features',
  mechanical: 'Mechanical Issues',
};
const NOTE_TARGETS = [
  { value: 'engine_notes', label: '🔧 Engine Notes' },
  { value: 'transmission_notes', label: '⚙️ Transmission Notes' },
  { value: 'exterior_notes', label: '🚗 Exterior Notes' },
  { value: 'interior_notes', label: '💺 Interior Notes' },
  { value: 'tires_brakes_notes', label: '🛞 Tires & Brakes Notes' },
  { value: 'additional_notes', label: '📋 Additional Notes' },
  { value: 'skip', label: '— Skip —' },
];
const ITEM_TARGETS = [
  { value: 'exterior', label: '🚗 Exterior' },
  { value: 'interior', label: '💺 Interior' },
  { value: 'other', label: '🔩 Other' },
  { value: 'skip', label: '— Skip —' },
];

type NoteRow = { id: string; icon: string; label: string; text: string; target: string; };
type ItemRow = { id: string; icon: string; label: string; description: string; condition: string; target: string; };

function buildReconRows(rt: Record<string, any>): { noteRows: NoteRow[]; itemRows: ItemRow[] } {
  const noteRows: NoteRow[] = [];
  const itemRows: ItemRow[] = [];
  Object.entries(rt).forEach(([k, task]: [string, any]) => {
    if (!task?.needed) return;
    if (task.notes?.trim()) {
      noteRows.push({ id: uid(), icon: KEY_ICONS[k] || '📌', label: KEY_LABELS[k] || k, text: task.notes.trim(), target: NOTE_MAP[k] || 'additional_notes' });
    }
    if (ITEM_MAP[k]) {
      const wt: any[] = (task.workTasks || []).filter((w: any) => w.desc?.trim());
      const crDesc = ITEM_DESC_MAP[k] || KEY_LABELS[k] || k;
      if (wt.length > 0) {
        wt.forEach((w: any) => itemRows.push({ id: uid(), icon: KEY_ICONS[k] || '📌', label: KEY_LABELS[k] || k, description: crDesc, condition: w.desc, target: ITEM_MAP[k] }));
      } else if (task.notes?.trim() && ITEM_MAP[k]) {
        itemRows.push({ id: uid(), icon: KEY_ICONS[k] || '📌', label: KEY_LABELS[k] || k, description: crDesc, condition: task.notes.trim(), target: ITEM_MAP[k] });
      }
    }
  });
  return { noteRows, itemRows };
}

function printCR(cr: ConditionReport, vehicle: any) {
  const RC: Record<string, string> = { Excellent: '#166534', Good: '#1e40af', Fair: '#78350f', Poor: '#7f1d1d' };
  const SC: Record<string, string> = { OK: '#166534', Attention: '#d97706', Critical: '#dc2626' };
  const badge = (v: string, m: Record<string, string>) =>
    `<span style="background:${m[v]||'#374151'};color:#fff;padding:1px 7px;border-radius:4px;font-size:11px">${v}</span>`;
  const thumbs = (urls: string[] = []) => urls.length
    ? urls.map(u => `<img src="${u}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;margin-right:4px;border:1px solid #e5e7eb">`).join('')
    : '—';
  const detSec = (lbl: string, items: CRItem[] = []) => !items.length ? '' :
    `<div style="margin-bottom:18px"><div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:5px 10px;border-radius:4px 4px 0 0;text-transform:uppercase;letter-spacing:0.05em">${lbl} (${items.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb">
    <th style="padding:6px 10px;text-align:left">Category</th><th style="padding:6px 10px;text-align:left">Condition</th><th style="padding:6px 10px;text-align:left;width:70px">Status</th><th style="padding:6px 10px;text-align:left;width:120px">Image</th></tr></thead><tbody>
    ${items.map(it => `<tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:6px 10px;font-weight:600">${it.description||'—'}</td>
      <td style="padding:6px 10px">${it.condition||''}</td>
      <td style="padding:6px 10px">${it.status?badge(it.status,SC):''}</td>
      <td style="padding:6px 10px">${thumbs(it.image_urls)}</td></tr>`).join('')}</tbody></table></div>`;
  const taw = cr.tires_and_wheels || {};
  const dtc = cr.diagnostic_trouble_codes || {};
  const hasNotes = NOTE_FIELDS.some(([f]) => cr[f]) || cr.additional_notes;
  const html = `<!DOCTYPE html><html><head><title>Condition Report</title>
  <style>body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px}@media print{body{padding:0}}</style></head><body>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 4px">Condition Report</h1>
  <div style="font-size:11px;color:#6b7280;margin-bottom:20px">Dealership: VEHICLE BUYERS AUTO AUCTION LLC</div>
  <div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:4px 4px 0 0;text-transform:uppercase;letter-spacing:0.05em">Vehicle Information</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:12px;margin-bottom:18px"><tbody>
    <tr><td style="padding:6px 10px;width:50%;vertical-align:top"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">Title</div>${vehicle?.year||''} ${vehicle?.make||''} ${vehicle?.model||''} ${vehicle?.trim||''}</td>
    <td style="padding:6px 10px;vertical-align:top"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">Year / Make / Model / Trim</div>${vehicle?.year||''} / ${vehicle?.make||''} / ${vehicle?.model||''} / ${vehicle?.trim||''}</td></tr>
    <tr><td style="padding:6px 10px"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">VIN</div>${vehicle?.vin||'—'}</td>
    <td style="padding:6px 10px"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">Stock</div>${vehicle?.stockNumber||'—'}</td></tr>
    <tr><td style="padding:6px 10px"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">Mileage</div>${vehicle?.miles||'—'}</td>
    <td style="padding:6px 10px"><div style="color:#6b7280;font-size:10px;text-transform:uppercase">Exterior Color</div>${vehicle?.color||'N/A'}</td></tr>
  </tbody></table>
  <div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:4px 4px 0 0;text-transform:uppercase;letter-spacing:0.05em">Condition Details</div>
  <div style="border:1px solid #e5e7eb;padding:10px;margin-bottom:18px;font-size:12px">
    <span style="margin-right:16px">Inspection Date &nbsp;<strong>${cr.inspection_date||'—'}</strong></span>
    <span style="margin-right:16px">Inspector &nbsp;<strong>${cr.inspector_name||'—'}</strong></span>
    <span>Overall Rating &nbsp;<strong>${cr.overall_rating||'—'}</strong></span>
  </div>
  ${detSec('Exterior', cr.condition_details?.exterior)}
  ${detSec('Interior', cr.condition_details?.interior)}
  ${detSec('Other', cr.condition_details?.other)}
  ${(dtc.items||[]).length||(dtc.codes||[]).length||dtc.notes?`
  <div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:4px 4px 0 0;text-transform:uppercase;margin-bottom:0">Diagnostic Trouble Codes</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e5e7eb;margin-bottom:18px"><thead>
  <tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Category</th><th style="padding:6px 10px;text-align:left">Condition</th><th style="padding:6px 10px;text-align:left;width:120px">Image</th></tr></thead><tbody>
  ${(dtc.items||[]).map(it=>`<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 10px;font-weight:600">${it.description||'—'}</td><td style="padding:6px 10px">${it.condition||''}</td><td style="padding:6px 10px">${thumbs(it.image_urls)}</td></tr>`).join('')}</tbody></table>`:'' }
  ${(taw.tires||[]).length?`
  <div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:4px 4px 0 0;text-transform:uppercase">Tires and Wheels</div>
  <div style="font-size:11px;padding:4px 10px;border:1px solid #e5e7eb;border-top:none">Spare Tire: ${taw.spare_tire?'Yes':'No'}</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e5e7eb;border-top:none;margin-bottom:18px"><thead>
  <tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Category</th><th style="padding:6px 10px;text-align:left">Condition Percent</th><th style="padding:6px 10px;text-align:left">Tread</th><th style="padding:6px 10px;text-align:left">Size</th></tr></thead><tbody>
  ${(taw.tires||[]).map(t=>`<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 10px;font-weight:600">${t.position||'—'}</td><td style="padding:6px 10px">${t.condition_percent?t.condition_percent+'%':'N/A'}</td><td style="padding:6px 10px">${t.tread_depth||'—'}</td><td style="padding:6px 10px">${t.tire_size||'—'}</td></tr>`).join('')}</tbody></table>`:'' }
  ${hasNotes?`<div style="background:#1e3a5f;color:#fff;font-weight:700;font-size:12px;padding:6px 10px;border-radius:4px 4px 0 0;text-transform:uppercase;margin-bottom:0">Notes</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e5e7eb;margin-bottom:18px">
  ${NOTE_FIELDS.map(([f,lbl])=>cr[f]?`<tr><td style="padding:5px 10px;font-weight:600;width:160px;color:#374151">${lbl}</td><td style="padding:5px 10px">${cr[f]}</td></tr>`:'').join('')}
  ${cr.additional_notes?`<tr><td style="padding:5px 10px;font-weight:600;color:#374151">Additional</td><td style="padding:5px 10px">${cr.additional_notes}</td></tr>`:''}</table>`:''}
  <div style="margin-top:24px;font-size:10px;color:#9ca3af;text-align:right">Generated at ${new Date().toLocaleString()}</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Shared sub-component: Condition Detail Items Table ──────────────────
function DetailTable({ items, onUpdate, onRemove, onAdd, bucket, presets }: {
  items: CRItem[]; bucket: string; presets: string[];
  onUpdate: (i: number, patch: Partial<CRItem>) => void;
  onRemove: (i: number) => void;
  onAdd: (description?: string) => void;
}) {
  const [uploading, setUploading] = useState<Record<number, boolean>>({});

  const handleImageUpload = async (i: number, file: File) => {
    setUploading(u => ({ ...u, [i]: true }));
    const url = await uploadImage(file);
    onUpdate(i, { image_urls: [...(items[i].image_urls || []), url] });
    setUploading(u => ({ ...u, [i]: false }));
  };

  return (
    <div>
      {/* Preset chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {presets.map(p => (
          <button key={p} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', color: '#9CA3AF', cursor: 'pointer' }}
            onClick={() => onAdd(p)}>{p}</button>
        ))}
        <button style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#1E3A5F', border: '1px solid #3B82F6', color: '#93C5FD', cursor: 'pointer', fontWeight: 700 }}
          onClick={() => onAdd()}>+ Custom</button>
      </div>

      {/* Header row */}
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 88px 68px 22px', gap: 6, marginBottom: 4, padding: '0 2px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Category</div>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Condition</div>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Status</div>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>IMG</div>
          <div />
        </div>
      )}

      {/* Item rows */}
      {items.map((item, i) => (
        <div key={item._id} style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 88px 68px 22px', gap: 6, alignItems: 'center' }}>
            <input style={{ ...S.fi, fontSize: 13, minWidth: 0 }} placeholder={`e.g. ${presets[0] || 'Category'}`}
              value={item.description || ''}
              onChange={e => onUpdate(i, { description: e.target.value })} />
            <input style={{ ...S.fi, fontSize: 13, minWidth: 0 }} placeholder='Condition / finding...'
              value={item.condition || ''}
              onChange={e => onUpdate(i, { condition: e.target.value })} />
            <select style={{ ...S.fi, fontSize: 12 }} value={item.status || ''}
              onChange={e => onUpdate(i, { status: e.target.value || undefined })}>
              <option value=''>—</option>
              {STATUS_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
            {/* IMG cell: view button (opens images) + upload button (adds more) */}
            <div style={{ display: 'flex', gap: 3 }}>
              {(item.image_urls || []).length > 0 ? (
                <button
                  title='View images'
                  onClick={() => openLightbox(item.image_urls || [], 0)}
                  style={{ flex: 1, height: 32, borderRadius: 6, border: '1px solid #166534', background: '#0D3B1E', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#34D399' }}>
                  +{item.image_urls!.length}
                </button>
              ) : null}
              <label
                title='Upload image'
                style={{ flex: item.image_urls?.length ? '0 0 28px' : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 6, border: '1px dashed #2A2A3E', background: '#0D0D1A', cursor: 'pointer', fontSize: 11, color: uploading[i] ? '#FBBF24' : '#6B7280' }}>
                <input type='file' accept='image/*,video/*' style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(i, f); e.target.value = ''; }} />
                {uploading[i] ? '…' : '+'}
              </label>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, padding: 0 }} onClick={() => onRemove(i)}>✕</button>
          </div>
          {(item.image_urls || []).length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: 2, flexWrap: 'wrap' }}>
              {(item.image_urls || []).map((url, j) => (
                <Thumb key={j} url={url} allUrls={item.image_urls!} idx={j} onRemove={() => onUpdate(i, { image_urls: (item.image_urls || []).filter((_, jj) => jj !== j) })} />
              ))}
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ fontSize: 13, color: '#4B5563', textAlign: 'center', padding: '10px 0' }}>
          Click a preset above or + Custom to add an item
        </div>
      )}
    </div>
  );
}

const CR_STATUS_OPTS = [
  { value: 'baseline', label: 'Baseline (pre-repair)', color: '#93C5FD', bg: '#1E3A5F' },
  { value: 'in_progress', label: 'In Progress', color: '#FBBF24', bg: '#78350F' },
  { value: 'complete', label: 'Complete', color: '#34D399', bg: '#064E3B' },
];

export function ConditionReportEditor({ startMode = 'edit' }: { startMode?: 'edit' | 'view' }) {
  const vehicle = useStore((s: any) => s.selV);
  const upd = useStore((s: any) => s.upd);
  const currentUser = useStore((s: any) => s.currentUser);
  const allUsers = useStore((s: any) => s.allUsers);

  const [cr, setCr] = useState<ConditionReport>(() => vehicle?.conditionReport || {});
  const [mode, setMode] = useState<'edit' | 'view'>(startMode);
  const [detTab, setDetTab] = useState<'exterior' | 'interior' | 'other'>('exterior');
  const [showNotes, setShowNotes] = useState(false);
  const [dtcInput, setDtcInput] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importNotes, setImportNotes] = useState<NoteRow[]>([]);
  const [importItems, setImportItems] = useState<ItemRow[]>([]);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const crRef = useRef<ConditionReport>(cr);

  // Register the module-level openLightbox trigger with this component's setter
  const setLightboxCb = useCallback((urls: string[], idx: number) => setLightbox({ urls, idx }), []);
  useEffect(() => { _openLightbox = setLightboxCb; return () => { _openLightbox = null; }; }, [setLightboxCb]);

  useEffect(() => { crRef.current = cr; }, [cr]);
  useEffect(() => {
    const fresh = vehicle?.conditionReport || {};
    setCr(fresh);
    crRef.current = fresh;
  }, [vehicle?.id, vehicle?.crAssignedTo]);

  // Inject tracking meta on every save
  const save = (next: ConditionReport) => {
    const existingMeta = next.meta || crRef.current?.meta || {};
    const withMeta: ConditionReport = {
      ...next,
      meta: {
        ...existingMeta,
        source: existingMeta.source || 'manual',
        last_saved_at: new Date().toISOString(),
        last_saved_by: (currentUser?.firstName || currentUser?.first_name || currentUser?.name || 'unknown'),
      },
    };
    crRef.current = withMeta;
    setCr(withMeta);
    upd(vehicle?.id, { conditionReport: withMeta });
  };

  const changeCrStatus = (status: string) => {
    const next = { ...crRef.current, meta: { ...(crRef.current?.meta || {}), source: crRef.current?.meta?.source || 'manual', status } };
    crRef.current = next;
    setCr(next);
    const update: any = { conditionReport: next, crStatus: status };
    const t = { ...(vehicle?.reconTasks || {}) };
    if (status === 'complete' && t.cr?.needed && t.cr?.status !== 'complete') {
      t.cr = { ...t.cr, status: 'complete', dateCompleted: new Date().toISOString().split('T')[0] };
      update.reconTasks = t;
    } else if (status !== 'complete' && t.cr?.needed && t.cr?.status === 'complete') {
      t.cr = { ...t.cr, status: 'started', dateCompleted: null };
      update.reconTasks = t;
    }
    upd(vehicle?.id, update);
  };

  const changeCrAssignment = (user: any) => {
    const assignedTo = user ? { id: user.id, name: user.name || `${user.firstName} ${user.lastName}`.trim(), email: user.email } : null;
    const next = { ...crRef.current, meta: { ...(crRef.current?.meta || {}), source: crRef.current?.meta?.source || 'manual', assigned_to: assignedTo } };
    crRef.current = next;
    setCr(next);
    upd(vehicle?.id, { conditionReport: next, crAssignedTo: user?.id || null });
  };

  const meta = cr.meta || {};
  const isFromCrm = meta.source === 'crm';
  const isModified = !!(meta.last_saved_at && meta.crm_imported_at && meta.last_saved_at > meta.crm_imported_at);
  const crStatus = vehicle?.crStatus || (meta as any).status || null;
  const crStatusOpt = CR_STATUS_OPTS.find(o => o.value === crStatus);
  const assignableUsers = (allUsers || []).filter((u: any) => u.role !== 'vendor');
  const assignedUser = meta.assigned_to;

  const detIs = (s: 'exterior' | 'interior' | 'other') => cr.condition_details?.[s] || [];
  const saveDet = (s: 'exterior' | 'interior' | 'other', items: CRItem[]) =>
    save({ ...cr, condition_details: { ...(cr.condition_details || {}), [s]: items } });
  const updDet = (s: 'exterior' | 'interior' | 'other', i: number, patch: Partial<CRItem>) => {
    const its = [...detIs(s)]; its[i] = { ...its[i], ...patch }; saveDet(s, its);
  };
  const addDet = (s: 'exterior' | 'interior' | 'other', description?: string) =>
    saveDet(s, [...detIs(s), { _id: uid(), description: description || '' }]);

  const taw = cr.tires_and_wheels || {};
  const saveTaw = (p: Partial<typeof taw>) => save({ ...cr, tires_and_wheels: { ...taw, ...p } });
  const dtc = cr.diagnostic_trouble_codes || {};
  const saveDtc = (p: Partial<typeof dtc>) => save({ ...cr, diagnostic_trouble_codes: { ...dtc, ...p } });

  const openImport = () => {
    const { noteRows, itemRows } = buildReconRows(vehicle?.reconTasks || {});
    setImportNotes(noteRows); setImportItems(itemRows); setShowImport(true);
  };
  const applyImport = () => {
    const next = { ...cr };
    importNotes.forEach(row => {
      if (row.target === 'skip') return;
      const f = row.target as keyof ConditionReport;
      const existing = (next[f] as string) || '';
      (next as any)[f] = existing ? `${existing} | ${row.text}` : row.text;
    });
    const ext = [...(next.condition_details?.exterior || [])];
    const int_ = [...(next.condition_details?.interior || [])];
    const oth = [...(next.condition_details?.other || [])];
    importItems.forEach(row => {
      if (row.target === 'skip') return;
      const item: CRItem = { _id: uid(), description: row.description, condition: row.condition };
      if (row.target === 'exterior') ext.push(item);
      else if (row.target === 'interior') int_.push(item);
      else oth.push(item);
    });
    next.condition_details = { exterior: ext, interior: int_, other: oth };
    save(next); setShowImport(false);
  };

  const totalItems = detIs('exterior').length + detIs('interior').length + detIs('other').length;
  const secStyle = { marginBottom: 10, border: '1px solid #2A2A3E', borderRadius: 8, overflow: 'hidden' };
  const secHead = (lbl: string, onClick?: () => void, open?: boolean) => (
    <div style={{ background: '#0F1F3D', padding: '8px 14px', fontWeight: 700, color: '#93C5FD', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' as const, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span>{lbl}</span>
      {onClick && <span style={{ color: '#6B7280', fontSize: 11 }}>{open ? '▲' : '▼'}</span>}
    </div>
  );

  // ── Shared CR metadata bar ─────────────────────────────────────────────
  const CrMetaBar = ({ editable }: { editable: boolean }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#080818', border: '1px solid #1A1A2E', borderRadius: 8, marginBottom: 10 }}>
      {isFromCrm
        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#1E3A5F', color: '#93C5FD', fontWeight: 700, border: '1px solid #3B82F6' }}>
            📥 From CRM {meta.crm_imported_at ? new Date(meta.crm_imported_at).toLocaleDateString() : ''}
          </span>
        : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#1A1A2E', color: '#6B7280', fontWeight: 700, border: '1px solid #2A2A3E' }}>✏️ Manual</span>
      }
      {isModified
        ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#78350F', color: '#FBBF24', fontWeight: 700, border: '1px solid #B45309' }}>
            ✏️ Modified {meta.last_saved_at ? new Date(meta.last_saved_at).toLocaleDateString() : ''}{meta.last_saved_by ? ` by ${meta.last_saved_by}` : ''}
          </span>
        : meta.last_saved_at
          ? <span style={{ fontSize: 11, color: '#4B5563' }}>Saved {new Date(meta.last_saved_at).toLocaleDateString()}{meta.last_saved_by ? ` by ${meta.last_saved_by}` : ''}</span>
          : null
      }
      <div style={{ flex: 1 }} />
      {editable ? (
        <select value={crStatus || ''} onChange={e => changeCrStatus(e.target.value)}
          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: crStatusOpt?.bg || '#1A1A2E', color: crStatusOpt?.color || '#9CA3AF', border: `1px solid ${crStatusOpt?.color || '#374151'}`, fontWeight: 700, cursor: 'pointer' }}>
          <option value=''>— Status —</option>
          {CR_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : crStatusOpt ? (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: crStatusOpt.bg, color: crStatusOpt.color, fontWeight: 700 }}>{crStatusOpt.label}</span>
      ) : null}
      {editable ? (
        <select value={assignedUser?.id?.toString() || ''} onChange={e => {
          const u = assignableUsers.find((x: any) => String(x.id) === e.target.value);
          changeCrAssignment(u || null);
        }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#0D0D1A', color: '#E5E7EB', border: '1px solid #374151', cursor: 'pointer' }}>
          <option value=''>— Assign to... —</option>
          {assignableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name || (`${u.firstName || ''} ${u.lastName || ''}`).trim()}</option>)}
        </select>
      ) : assignedUser ? (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#1A1A2E', color: '#E5E7EB', border: '1px solid #2A2A3E' }}>👤 {assignedUser.name}</span>
      ) : null}
    </div>
  );

  // ── VIEW MODE ──────────────────────────────────────────────────────────
  if (mode === 'view') {
    const RC: Record<string, string> = { Excellent: '#166534', Good: '#1E40AF', Fair: '#78350F', Poor: '#7F1D1D' };
    const SC: Record<string, string> = { OK: '#166534', Attention: '#D97706', Critical: '#DC2626' };
    const badge = (val: string, m: Record<string, string>) =>
      <span style={{ background: m[val] || '#374151', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{val}</span>;
    const detSection = (lbl: string, tab: 'exterior' | 'interior' | 'other') => {
      const items = detIs(tab); if (!items.length) return null;
      return <div key={tab}>
        <div style={{ background: '#0D1F3D', padding: '5px 14px', fontSize: 11, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase' as const, borderBottom: '1px solid #1A1A2E' }}>{lbl} ({items.length})</div>
        <div style={{ background: '#0A0A1E' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 80px 60px', gap: 0, borderBottom: '1px solid #1A1A2E', padding: '4px 14px' }}>
            {['Category', 'Condition', 'Status', 'Image'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' as const }}>{h}</div>)}
          </div>
          {items.map(item => (
            <div key={item._id} style={{ borderBottom: '1px solid #1A1A2E' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 80px 60px', gap: 0, padding: '7px 14px', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description || '—'}</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.condition || ''}</div>
                <div>{item.status ? badge(item.status, SC) : ''}</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(item.image_urls || []).length > 0
                    ? <button onClick={() => openLightbox(item.image_urls!, 0)}
                        style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: '#0D3B1E', border: '1px solid #166534', color: '#34D399', cursor: 'pointer', fontWeight: 700 }}>
                        +{item.image_urls!.length}
                      </button>
                    : <span style={{ fontSize: 11, color: '#4B5563' }}>—</span>
                  }
                </div>
              </div>
              {(item.image_urls || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, padding: '0 14px 8px', flexWrap: 'wrap' }}>
                  {(item.image_urls || []).map((url, j) => (
                    isVideo(url) ? (
                      <div key={j} style={{ position: 'relative', width: 48, height: 48, cursor: 'pointer', borderRadius: 4, overflow: 'hidden', border: '1px solid #2A2A3E', background: '#0D0D1A', flexShrink: 0 }}
                        onClick={() => openLightbox(item.image_urls!, j)}>
                        <video src={url} preload='metadata' muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', fontSize: 16, color: '#fff' }}>▶</div>
                      </div>
                    ) : (
                      <img key={j} src={url} alt='' onClick={() => openLightbox(item.image_urls!, j)}
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid #2A2A3E', flexShrink: 0 }}
                        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>;
    };
    const hasDet = totalItems > 0;
    const hasTires = (taw.tires || []).length > 0;
    const hasDTC = !!(dtc.notes || (dtc.codes || []).length || (dtc.items || []).length);
    const hasNoteData = NOTE_FIELDS.some(([f]) => cr[f]) || cr.additional_notes;
    const isEmpty = !cr.overall_rating && !hasDet && !hasTires && !hasDTC && !hasNoteData;

    return (
      <>
      {lightbox && <Lightbox urls={lightbox.urls} startIdx={lightbox.idx} onClose={() => setLightbox(null)} />}
      <div style={{ borderTop: '2px solid #1E3A5F', paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#60A5FA' }}>📋 Condition Report</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...S.sm, background: '#0F2940', color: '#93C5FD', border: '1px solid #1E3A5F' }} onClick={() => setMode('edit')}>✏️ Edit</button>
            <button style={{ ...S.sm, background: '#0D3B1E', color: '#34D399', border: '1px solid #166534' }} onClick={() => printCR(cr, vehicle)}>🖨️ Print / PDF</button>
          </div>
        </div>
        <CrMetaBar editable={false} />

        {/* Header */}
        <div style={{ background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#E5E7EB' }}>{vehicle?.year} {vehicle?.make} {vehicle?.model} {vehicle?.trim}</div>
              {vehicle?.vin && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>VIN: {vehicle.vin}</div>}
            </div>
            {cr.overall_rating && <div style={{ background: RC[cr.overall_rating] || '#374151', color: '#fff', padding: '4px 14px', borderRadius: 6, fontWeight: 800, fontSize: 14 }}>{cr.overall_rating}</div>}
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#9CA3AF' }}>
            {cr.inspection_date && <span>Date: <span style={{ color: '#E5E7EB' }}>{cr.inspection_date}</span></span>}
            {cr.inspector_name && <span>Inspector: <span style={{ color: '#E5E7EB' }}>{cr.inspector_name}</span></span>}
          </div>
        </div>

        {isEmpty && <div style={{ textAlign: 'center', padding: '24px 0', color: '#4B5563', fontSize: 14 }}>No condition report data yet. <button style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }} onClick={() => setMode('edit')}>Switch to edit.</button></div>}

        {hasDet && <div style={secStyle}>
          {secHead('🔍 Condition Details')}
          {detSection('Exterior', 'exterior')}
          {detSection('Interior', 'interior')}
          {detSection('Other', 'other')}
        </div>}

        {hasDTC && <div style={secStyle}>
          {secHead('⚡ Diagnostic Trouble Codes')}
          <div style={{ background: '#0A0A1E', padding: '8px 14px' }}>
            {dtc.notes && <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>{dtc.notes}</div>}
            {(dtc.codes || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {(dtc.codes || []).map((c, i) => <span key={i} style={{ background: '#1E3A5F', color: '#93C5FD', padding: '2px 9px', borderRadius: 10, fontSize: 12, fontWeight: 700 }}>{c}</span>)}
            </div>}
            {(dtc.items || []).length > 0 && <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 0', borderBottom: '1px solid #1A1A2E', marginBottom: 4 }}>
                {['Category', 'Condition'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' as const }}>{h}</div>)}
              </div>
              {(dtc.items || []).map(item => (
                <div key={item._id} style={{ borderBottom: '1px solid #1A1A2E' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '5px 0' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB' }}>{item.description || '—'}</div>
                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>{item.condition || ''}</div>
                  </div>
                  {(item.image_urls || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, paddingBottom: 6, flexWrap: 'wrap' }}>
                      {(item.image_urls || []).map((url, j) => (
                        isVideo(url) ? (
                          <div key={j} style={{ position: 'relative', width: 48, height: 48, cursor: 'pointer', borderRadius: 4, overflow: 'hidden', border: '1px solid #2A2A3E', background: '#0D0D1A', flexShrink: 0 }}
                            onClick={() => openLightbox(item.image_urls!, j)}>
                            <video src={url} preload='metadata' muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', fontSize: 16, color: '#fff' }}>▶</div>
                          </div>
                        ) : (
                          <img key={j} src={url} alt='' onClick={() => openLightbox(item.image_urls!, j)}
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid #2A2A3E', flexShrink: 0 }}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>}
          </div>
        </div>}

        {hasTires && <div style={secStyle}>
          {secHead('🛞 Tires & Wheels')}
          <div style={{ background: '#0A0A1E', padding: '10px 14px' }}>
            {(taw.dual_rear_wheels || taw.spare_tire) && <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
              {taw.dual_rear_wheels && <span style={{ color: '#34D399' }}>✓ Dual Rear Wheels</span>}
              {taw.spare_tire && <span style={{ color: '#34D399' }}>✓ Spare Tire</span>}
            </div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 100px', gap: 0, padding: '4px 0', borderBottom: '1px solid #1A1A2E', marginBottom: 4 }}>
              {['Category', 'Cond %', 'Tread', 'Size'].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' as const }}>{h}</div>)}
            </div>
            {(taw.tires || []).map(t => (
              <div key={t._id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 100px', padding: '6px 0', borderBottom: '1px solid #1A1A2E', alignItems: 'center', fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: '#E5E7EB' }}>{t.position || '—'}</div>
                <div style={{ color: t.condition_percent ? '#FBBF24' : '#6B7280' }}>{t.condition_percent ? t.condition_percent + '%' : 'N/A'}</div>
                <div style={{ color: '#9CA3AF' }}>{t.tread_depth || '—'}</div>
                <div style={{ color: '#9CA3AF' }}>{t.tire_size || '—'}</div>
              </div>
            ))}
          </div>
        </div>}

        {hasNoteData && <div style={secStyle}>
          {secHead('📝 Notes')}
          <div style={{ background: '#0A0A1E' }}>
            {NOTE_FIELDS.map(([f, lbl]) => cr[f] ? (
              <div key={String(f)} style={{ display: 'flex', gap: 10, padding: '7px 14px', borderBottom: '1px solid #1A1A2E' }}>
                <div style={{ width: 130, fontSize: 12, fontWeight: 700, color: '#6B7280', flexShrink: 0 }}>{lbl}</div>
                <div style={{ fontSize: 13, color: '#E5E7EB' }}>{cr[f] as string}</div>
              </div>
            ) : null)}
            {cr.additional_notes && <div style={{ display: 'flex', gap: 10, padding: '7px 14px' }}>
              <div style={{ width: 130, fontSize: 12, fontWeight: 700, color: '#6B7280', flexShrink: 0 }}>📋 Additional</div>
              <div style={{ fontSize: 13, color: '#E5E7EB' }}>{cr.additional_notes}</div>
            </div>}
          </div>
        </div>}
      </div>
      </>
    );
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────
  return (
    <>
    {lightbox && <Lightbox urls={lightbox.urls} startIdx={lightbox.idx} onClose={() => setLightbox(null)} />}
    <div style={{ borderTop: '2px solid #1E3A5F', paddingTop: 12, marginTop: 4 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#60A5FA' }}>📋 Condition Report</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ ...S.sm, background: '#1A2E1A', color: '#6EE7B7', border: '1px solid #166534' }} onClick={openImport}>📥 Import from Recon</button>
          <button style={{ ...S.sm, background: '#0F1F3D', color: '#93C5FD', border: '1px solid #1E3A5F' }} onClick={() => setMode('view')}>👁 Preview / Print</button>
        </div>
      </div>
      <CrMetaBar editable={true} />

      {/* Import modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }} onClick={() => setShowImport(false)}>
          <div style={{ background: '#12122A', border: '2px solid #1E3A5F', borderRadius: 12, padding: 24, width: '95%', maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, color: '#E5E7EB', fontSize: 16 }}>📥 Import from Recon</span>
              <button style={S.sm} onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Review each item — change the target field or skip it. Notes are appended; condition items are added to the chosen bucket.</div>
            {importNotes.length === 0 && importItems.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: '#4B5563', fontSize: 14 }}>No recon notes or work tasks found to import.</div>}
            {importNotes.length > 0 && <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>📝 Notes → CR Field</div>
              {importNotes.map((row, i) => (
                <div key={row.id} style={{ background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' as const }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', marginBottom: 4 }}>{row.icon} {row.label}</div>
                      <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.4 }}>{row.text}</div>
                    </div>
                    <select style={{ ...S.fi, flex: '0 0 185px', fontSize: 12, background: row.target === 'skip' ? '#1A0A0A' : '#0F1F3D', color: row.target === 'skip' ? '#6B7280' : '#93C5FD', border: `1px solid ${row.target === 'skip' ? '#4B5563' : '#3B82F6'}` }}
                      value={row.target} onChange={e => { const rows = [...importNotes]; rows[i] = { ...rows[i], target: e.target.value }; setImportNotes(rows); }}>
                      {NOTE_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </>}
            {importItems.length > 0 && <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8, marginTop: importNotes.length ? 14 : 0 }}>🔍 Work Tasks → Condition Detail Bucket</div>
              {importItems.map((row, i) => (
                <div key={row.id} style={{ background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', marginRight: 6 }}>{row.icon} {row.label}</span>
                    <span style={{ fontSize: 13, color: '#D1D5DB' }}>{row.condition}</span>
                  </div>
                  <select style={{ ...S.fi, flex: '0 0 140px', fontSize: 12, background: row.target === 'skip' ? '#1A0A0A' : '#0D3B1E', color: row.target === 'skip' ? '#6B7280' : '#34D399', border: `1px solid ${row.target === 'skip' ? '#4B5563' : '#166534'}` }}
                    value={row.target} onChange={e => { const rows = [...importItems]; rows[i] = { ...rows[i], target: e.target.value }; setImportItems(rows); }}>
                    {ITEM_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              ))}
            </>}
            {(importNotes.length > 0 || importItems.length > 0) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ ...S.btn, flex: 1, background: '#166534', color: '#6EE7B7', fontSize: 14, fontWeight: 700 }} onClick={applyImport}>✅ Apply Import</button>
                <button style={{ ...S.btn, background: 'transparent', color: '#6B7280', border: '1px solid #374151' }} onClick={() => setShowImport(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10, padding: 12, background: '#0D0D1A', borderRadius: 8, border: '1px solid #2A2A3E' }}>
        <label style={S.fl}>Inspector Name
          <input style={S.fi} value={cr.inspector_name || ''} placeholder='Inspector...'
            onChange={e => { const v = e.target.value; setCr(p => ({ ...p, inspector_name: v || undefined })); }}
            onBlur={() => upd(vehicle?.id, { conditionReport: crRef.current })} />
        </label>
        <label style={S.fl}>Inspection Date
          <input style={S.fi} type='date' value={cr.inspection_date || ''}
            onChange={e => save({ ...cr, inspection_date: e.target.value || undefined })} />
        </label>
        <label style={S.fl}>Overall Rating
          <select style={S.fi} value={cr.overall_rating || ''} onChange={e => save({ ...cr, overall_rating: e.target.value || undefined })}>
            <option value=''>— Not Rated —</option>
            {['Excellent', 'Good', 'Fair', 'Poor'].map(r => <option key={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {/* ── Condition Details (PRIMARY) ── */}
      <div style={secStyle}>
        {secHead(`🔍 Condition Details (${totalItems} items)`)}
        <div style={{ padding: 12, background: '#0A0A1E' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['exterior', 'interior', 'other'] as const).map(t => (
              <button key={t} style={{ ...S.sm, background: detTab === t ? '#1E3A5F' : 'transparent', color: detTab === t ? '#93C5FD' : '#6B7280', border: `1px solid ${detTab === t ? '#3B82F6' : '#2A2A3E'}`, textTransform: 'capitalize', fontWeight: detTab === t ? 700 : 400 }} onClick={() => setDetTab(t)}>
                {t === 'exterior' ? '🚗' : t === 'interior' ? '💺' : '🔩'} {t} ({detIs(t).length})
              </button>
            ))}
          </div>
          <DetailTable
            key={detTab}
            items={detIs(detTab)}
            bucket={detTab}
            presets={PRESETS[detTab]}
            onUpdate={(i, patch) => updDet(detTab, i, patch)}
            onRemove={i => saveDet(detTab, detIs(detTab).filter((_, j) => j !== i))}
            onAdd={desc => addDet(detTab, desc)}
          />
        </div>
      </div>

      {/* ── DTC ── */}
      <div style={secStyle}>
        {secHead(`⚡ Diagnostic Trouble Codes (${(dtc.items || []).length} items)`)}
        <div style={{ padding: 12, background: '#0A0A1E' }}>
          {/* DTC preset chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {DTC_PRESETS.map(p => (
              <button key={p} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', color: '#9CA3AF', cursor: 'pointer' }}
                onClick={() => saveDtc({ items: [...(dtc.items || []), { _id: uid(), description: p }] })}>{p}</button>
            ))}
            <button style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#1E3A5F', border: '1px solid #3B82F6', color: '#93C5FD', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => saveDtc({ items: [...(dtc.items || []), { _id: uid() }] })}>+ Custom</button>
          </div>
          {/* DTC code tags */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {(dtc.codes || []).map((code, i) => (
                <span key={i} style={{ background: '#1E3A5F', color: '#93C5FD', padding: '3px 8px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {code}<button style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', padding: '0 2px', fontSize: 12 }} onClick={() => saveDtc({ codes: (dtc.codes || []).filter((_, j) => j !== i) })}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...S.fi, flex: 1, fontSize: 13 }} placeholder='DTC code (e.g. P0300)...' value={dtcInput}
                onChange={e => setDtcInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && dtcInput.trim()) { saveDtc({ codes: [...(dtc.codes || []), dtcInput.trim()] }); setDtcInput(''); e.preventDefault(); } }} />
              <button style={{ ...S.btn, fontSize: 12 }} onClick={() => { if (dtcInput.trim()) { saveDtc({ codes: [...(dtc.codes || []), dtcInput.trim()] }); setDtcInput(''); } }}>+ Add Code</button>
            </div>
          </div>
          {/* DTC items */}
          {(dtc.items || []).length > 0 && <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 44px 22px', gap: 6, padding: '0 2px', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Category</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Condition</div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>Img</div>
              <div />
            </div>
            {(dtc.items || []).map((item, i) => (
              <div key={item._id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 44px 22px', gap: 6, alignItems: 'center' }}>
                  <input style={{ ...S.fi, fontSize: 13, minWidth: 0 }} placeholder='Code / System' value={item.description || ''}
                    onChange={e => { const its = [...(dtc.items || [])]; its[i] = { ...its[i], description: e.target.value }; saveDtc({ items: its }); }} />
                  <input style={{ ...S.fi, fontSize: 13, minWidth: 0 }} placeholder='Finding / condition...' value={item.condition || ''}
                    onChange={e => { const its = [...(dtc.items || [])]; its[i] = { ...its[i], condition: e.target.value }; saveDtc({ items: its }); }} />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 6, border: '1px dashed #2A2A3E', background: '#0D0D1A', cursor: 'pointer', fontSize: 11, color: item.image_urls?.length ? '#34D399' : '#6B7280' }}>
                    <input type='file' accept='image/*,video/*' style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); const its = [...(dtc.items || [])]; its[i] = { ...its[i], image_urls: [...(its[i].image_urls || []), url] }; saveDtc({ items: its }); e.target.value = ''; }} />
                    {item.image_urls?.length ? `+${item.image_urls.length}` : '+'}
                  </label>
                  <button style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, padding: 0 }} onClick={() => saveDtc({ items: (dtc.items || []).filter((_, j) => j !== i) })}>✕</button>
                </div>
                {(item.image_urls || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {(item.image_urls || []).map((url, j) => (
                      <Thumb key={j} url={url} allUrls={item.image_urls || []} idx={j} onRemove={() => { const its = [...(dtc.items || [])]; its[i] = { ...its[i], image_urls: (its[i].image_urls || []).filter((_, jj) => jj !== j) }; saveDtc({ items: its }); }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>}
        </div>
      </div>

      {/* ── Tires & Wheels ── */}
      <div style={secStyle}>
        {secHead(`🛞 Tires & Wheels (${(taw.tires || []).length} tires)`)}
        <div style={{ padding: 12, background: '#0A0A1E' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#E5E7EB', cursor: 'pointer' }}>
              <input type='checkbox' checked={!!taw.dual_rear_wheels} onChange={e => saveTaw({ dual_rear_wheels: e.target.checked })} /> Dual Rear Wheels
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#E5E7EB', cursor: 'pointer' }}>
              <input type='checkbox' checked={!!taw.spare_tire} onChange={e => saveTaw({ spare_tire: e.target.checked })} /> Spare Tire
            </label>
          </div>
          {(taw.tires || []).length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 58px 96px 66px 44px 22px', gap: 6, padding: '0 2px', marginBottom: 4 }}>
            {['Position', 'Cond %', 'Size', 'Tread', 'Img', ''].map((h, i) => <div key={i} style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' as const }}>{h}</div>)}
          </div>}
          {(taw.tires || []).map((t, i) => (
            <div key={t._id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 58px 96px 66px 44px 22px', gap: 6, alignItems: 'center' }}>
                <input style={{ ...S.fi, fontSize: 13, minWidth: 0 }} placeholder='e.g. Front Left' value={t.position || ''}
                  onChange={e => { const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], position: e.target.value }; saveTaw({ tires: ts }); }} />
                <input style={{ ...S.fi, fontSize: 13 }} placeholder='%' type='number' min={0} max={100} value={t.condition_percent || ''}
                  onChange={e => { const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], condition_percent: e.target.value }; saveTaw({ tires: ts }); }} />
                <input style={{ ...S.fi, fontSize: 12, minWidth: 0 }} placeholder='265/65R18' value={t.tire_size || ''}
                  onChange={e => { const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], tire_size: e.target.value }; saveTaw({ tires: ts }); }} />
                <input style={{ ...S.fi, fontSize: 12, minWidth: 0 }} placeholder='4/32"' value={t.tread_depth || ''}
                  onChange={e => { const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], tread_depth: e.target.value }; saveTaw({ tires: ts }); }} />
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 6, border: '1px dashed #2A2A3E', background: '#0D0D1A', cursor: 'pointer', fontSize: 11, color: (t.image_urls || []).length ? '#34D399' : '#6B7280' }}>
                  <input type='file' accept='image/*,video/*' style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadImage(f);
                    const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], image_urls: [...(ts[i].image_urls || []), url] }; saveTaw({ tires: ts }); e.target.value = '';
                  }} />
                  {(t.image_urls || []).length ? `+${t.image_urls!.length}` : '+'}
                </label>
                <button style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, padding: 0 }} onClick={() => saveTaw({ tires: (taw.tires || []).filter((_, j) => j !== i) })}>✕</button>
              </div>
              {(t.image_urls || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: 2, flexWrap: 'wrap' }}>
                  {(t.image_urls || []).map((url, j) => (
                    <Thumb key={j} url={url} allUrls={t.image_urls || []} idx={j} onRemove={() => { const ts = [...(taw.tires || [])]; ts[i] = { ...ts[i], image_urls: (ts[i].image_urls || []).filter((_, jj) => jj !== j) }; saveTaw({ tires: ts }); }} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Front Left', 'Front Right', 'Rear Left', 'Rear Right', 'Spare'].map(pos => (
              <button key={pos} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', color: '#9CA3AF', cursor: 'pointer' }}
                onClick={() => saveTaw({ tires: [...(taw.tires || []), { _id: uid(), position: pos }] })}>{pos}</button>
            ))}
            <button style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: '#1E3A5F', border: '1px solid #3B82F6', color: '#93C5FD', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => saveTaw({ tires: [...(taw.tires || []), { _id: uid() }] })}>+ Custom</button>
          </div>
        </div>
      </div>

      {/* ── Notes (secondary, collapsed) ── */}
      <div style={secStyle}>
        {secHead('📝 General Notes (optional)', () => setShowNotes(v => !v), showNotes)}
        {showNotes && <div style={{ padding: 12, background: '#0A0A1E' }}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>These general note fields are optional and rarely used. Use Condition Details above for specific findings.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {NOTE_FIELDS.map(([f, lbl]) => (
              <label key={String(f)} style={S.fl}>{lbl} Notes
                <textarea style={{ ...S.fi, minHeight: 54, resize: 'vertical' }}
                  value={(cr[f] as string) || ''} placeholder={`${lbl} notes...`}
                  onChange={e => { const v = e.target.value; setCr(p => ({ ...p, [f]: v || undefined })); }}
                  onBlur={() => upd(vehicle?.id, { conditionReport: crRef.current })} />
              </label>
            ))}
            <label style={{ ...S.fl, gridColumn: '1 / -1' }}>📋 Additional Notes
              <textarea style={{ ...S.fi, minHeight: 54, resize: 'vertical' }}
                value={cr.additional_notes || ''} placeholder='Additional notes...'
                onChange={e => { const v = e.target.value; setCr(p => ({ ...p, additional_notes: v || undefined })); }}
                onBlur={() => upd(vehicle?.id, { conditionReport: crRef.current })} />
            </label>
          </div>
        </div>}
      </div>
    </div>
    </>
  );
}
