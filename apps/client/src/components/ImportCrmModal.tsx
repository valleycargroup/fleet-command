import { useState } from 'react';
import { SOURCES, COLORS, LOCATIONS, FUEL_TYPES, DRIVE_TYPES, driveToDriveline, driveToLongForm, fuelNormalize } from '../lib/constants';
import { S } from '../lib/styles';
import { useStore } from '../lib/store';

export function ImportCrmModal({ onClose }: { onClose: () => void }) {
  const lookupCrmVehicle = useStore((s: any) => s.lookupCrmVehicle);
  const importFromCrm = useStore((s: any) => s.importFromCrm);
  const allUsers = useStore((s: any) => s.allUsers);
  const buyerList = ((allUsers || []).filter((u: any) => u.isBuyer || (u.role || '').toLowerCase() === "buyer" || (u.role || '').toLowerCase() === "admin")
    .map((u: any) => u.firstName + (u.lastName ? " " + u.lastName : ""))).filter((n: any, i: any, a: any) => n && a.indexOf(n) === i);

  const [vin, setVin] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null as any);
  const [existingVehicleId, setExistingVehicleId] = useState(null as any);
  const [f, setF] = useState({} as any);
  const [submitted, setSubmitted] = useState(false);
  const [includeCR, setIncludeCR] = useState(true);
  // 'include' (new) | 'skip' (update default) | 'merge' | 'replace'
  const [photoImport, setPhotoImport] = useState<'include'|'skip'|'merge'|'replace'>('include');

  const required = ['buyingBroker', 'source', 'zipCode', 'fuelType', 'transmission', 'drive', 'motorTrailer'];
  const missing = required.filter((k) => !String(f[k] || '').trim());
  const fieldErr = (key: string) => submitted && required.includes(key) && !String(f[key] || '').trim();

  const hasCrData = (draft?.reconMedia || []).length > 0 || Object.keys(draft?.reconChecklist || {}).length > 0;

  const lookUp = async () => {
    if (!vin.trim()) return;
    setLooking(true); setErr("");
    try {
      const res = await lookupCrmVehicle(vin.trim().toUpperCase());
      setDraft(res.draft);
      setExistingVehicleId(res.existingVehicleId);
      // New import: include CR by default. Update: exclude by default (protect existing).
      setIncludeCR(!res.existingVehicleId);
      // New import: always include photos. Update: skip by default (safest).
      setPhotoImport(!res.existingVehicleId ? 'include' : 'skip');
      setF({
        vin: res.draft.vin, year: res.draft.year, make: res.draft.make, model: res.draft.model, trim: res.draft.trim,
        miles: res.draft.miles, color: "", location: res.draft.location || LOCATIONS[0],
        zipCode: res.draft.zipCode, fuelType: fuelNormalize(res.draft.fuelType || ''),
        transmission: res.draft.transmission, driveline: driveToDriveline(res.draft.drive || ''),
        drive: driveToLongForm(res.draft.drive || '') || '', motorTrailer: res.draft.motorTrailer,
        source: SOURCES.includes(res.draft.source) ? res.draft.source : (res.draft.source || SOURCES[0]),
        buyingBroker: buyerList.includes(res.draft.buyingBroker) ? res.draft.buyingBroker : (buyerList[0] || ''),
        media: res.draft.media, reconMedia: res.draft.reconMedia,
        reconChecklist: res.draft.reconChecklist, reconConditions: res.draft.reconConditions,
      });
    } catch (e: any) { setErr(e.message || 'Lookup failed'); }
    setLooking(false);
  };

  const confirm = async () => {
    setSubmitted(true);
    if (missing.length) { setErr(`Fill in required fields: ${missing.join(', ')}`); return; }
    setSaving(true); setErr("");
    try {
      // Strip CR data if user opted out, or pass overwriteCR flag if updating
      const payload = includeCR
        ? { ...f, overwriteCR: !!existingVehicleId, photoImport }
        : { ...f, reconChecklist: {}, reconConditions: [], reconMedia: [], overwriteCR: false, photoImport };
      await importFromCrm(payload);
      onClose();
    } catch (e: any) { setErr(e.message || 'Import failed'); }
    setSaving(false);
  };

  const Fld = (label: string, key: string, opts?: string[], placeholder?: string) => {
    const hasErr = fieldErr(key);
    const style = { ...S.fi, ...(hasErr ? { borderColor: '#DC2626', boxShadow: '0 0 0 1px #DC2626' } : {}) };
    return (
      <label style={S.fl}>{label}{required.includes(key) ? <span style={{ color: '#F87171' }}> *</span> : ''}
        {opts
          ? <select style={style} value={f[key] || ''} onChange={(e: any) => setF({ ...f, [key]: e.target.value })}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          : <input style={style} value={f[key] || ''} onChange={(e: any) => setF({ ...f, [key]: e.target.value })} placeholder={placeholder}/>}
      </label>
    );
  };

  return <div style={S.ov} onClick={() => !looking && !saving && onClose()}><div style={{ ...S.modal, maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e: any) => e.stopPropagation()}>
    <h2 style={{ color: "#93C5FD", fontSize: 18, marginBottom: 4 }}>⬇️ Import from CRM</h2>

    {!draft && <>
      <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 12 }}>Look up a vehicle by VIN, review its details, then confirm the import.</div>
      <label style={S.fl}>VIN<input style={{ ...S.fi, fontFamily: "monospace", letterSpacing: 1 }} value={vin} onChange={(e: any) => setVin(e.target.value.toUpperCase())} placeholder="e.g. 1FTFW1E83MFA56515" maxLength={17}/></label>
      {err && <div style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...S.btn, flex: 1, opacity: looking || !vin.trim() ? 0.6 : 1 }} disabled={looking || !vin.trim()} onClick={lookUp}>{looking ? "Looking up…" : "🔍 Look Up"}</button>
        <button style={S.sm} onClick={onClose} disabled={looking}>Cancel</button>
      </div>
    </>}

    {draft && <>
      {existingVehicleId && <div style={{ fontSize: 13, color: "#FBBF24", marginBottom: 10, padding: "8px 12px", background: "#3B2F10", borderRadius: 6 }}>⚠️ VIN already exists in Fleet Command (#{existingVehicleId}) — importing will update it.</div>}
      {draft.crmBuyerHint && <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>CRM buyer on file: <b style={{ color: "#E5E7EB" }}>{draft.crmBuyerHint.name || '—'}</b>{draft.crmBuyerHint.email ? ` (${draft.crmBuyerHint.email})` : ''} — confirm or pick the right match below.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {Fld("Year", "year")}{Fld("Make", "make")}{Fld("Model", "model")}{Fld("Trim", "trim")}
        {Fld("Miles", "miles")}{Fld("Color", "color", COLORS)}{Fld("Location", "location", LOCATIONS)}{Fld("Zip Code", "zipCode")}
        {Fld("Source", "source", SOURCES)}
        <label style={S.fl}><span style={{ color: '#F87171' }}>Buyer *</span><select style={{ ...S.fi, ...(fieldErr('buyingBroker') ? { borderColor: '#DC2626', boxShadow: '0 0 0 1px #DC2626' } : {}) }} value={f.buyingBroker || ''} onChange={(e: any) => setF({ ...f, buyingBroker: e.target.value })}>{buyerList.length ? buyerList.map((b: any) => <option key={b} value={b}>{b}</option>) : <option value="">— No buyers registered —</option>}</select></label>
        {Fld("Fuel Type", "fuelType", FUEL_TYPES)}{Fld("Transmission", "transmission")}
        {Fld("Driveline", "driveline", undefined, "4WD, AWD, FWD...")}
        <label style={S.fl}><span style={{ color: '#F87171' }}>Drive *</span>
          <select style={{ ...S.fi, ...(fieldErr('drive') ? { borderColor: '#DC2626', boxShadow: '0 0 0 1px #DC2626' } : {}) }} value={f.drive || ''} onChange={(e: any) => { const d = e.target.value; setF({ ...f, drive: d, driveline: driveToDriveline(d) || f.driveline }); }}>
            <option value="">— select —</option>
            {DRIVE_TYPES.map((d: string) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {Fld("Engine / Motor", "motorTrailer", undefined, "3.5L V6")}
      </div>

      {/* CR import toggle */}
      {hasCrData && <div style={{ marginTop: 10, borderTop: '1px solid #2A2A3E', paddingTop: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={includeCR} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
            onChange={(e: any) => setIncludeCR(e.target.checked)}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: includeCR ? '#34D399' : '#9CA3AF' }}>
              📋 Import Condition Report from CRM
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              {(draft.reconMedia || []).length} photo(s) · {Object.keys(draft.reconChecklist || {}).length} checklist item(s)
            </div>
          </div>
        </label>
        {includeCR && existingVehicleId && <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#3B1515', border: '1px solid #7F1D1D', fontSize: 12, color: '#FCA5A5' }}>
          ⚠️ This will <b>overwrite</b> the existing Condition Report in Fleet Command. Any manual edits made since the last import will be lost.
        </div>}
        {!includeCR && !existingVehicleId && <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
          Vehicle will be imported without a Condition Report. You can create one manually later.
        </div>}
      </div>}

      {!hasCrData && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>No condition-report data found in CRM for this vehicle.</div>}

      {/* Photo import section */}
      {(draft.media || []).length > 0 && <div style={{ marginTop: 10, borderTop: '1px solid #2A2A3E', paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#93C5FD', marginBottom: 6 }}>
          📷 CRM Photos ({(draft.media || []).length})
        </div>
        {!existingVehicleId ? (
          <div style={{ fontSize: 12, color: '#34D399' }}>All {(draft.media || []).length} CRM photo(s) will be saved with this vehicle.</div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>This vehicle already has photos in Fleet Command. Choose how to handle CRM photos on reimport:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                { val: 'skip',    label: 'Skip — keep existing Fleet photos', color: '#9CA3AF' },
                { val: 'merge',   label: 'Merge — add new CRM photos (skip duplicates)', color: '#FBBF24' },
                { val: 'replace', label: 'Replace — overwrite all with CRM photos', color: '#F87171' },
              ] as const).map(opt => (
                <label key={opt.val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="photoImport" value={opt.val} checked={photoImport === opt.val}
                    onChange={() => setPhotoImport(opt.val)} style={{ cursor: 'pointer' }}/>
                  <span style={{ fontSize: 12, color: opt.color, fontWeight: photoImport === opt.val ? 700 : 400 }}>{opt.label}</span>
                </label>
              ))}
            </div>
            {photoImport === 'replace' && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#3B1515', border: '1px solid #7F1D1D', fontSize: 12, color: '#FCA5A5' }}>
              ⚠️ All existing Fleet photos for this vehicle will be removed and replaced with the {(draft.media || []).length} CRM photo(s).
            </div>}
            {photoImport === 'merge' && <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
              CRM photos with URLs not already in Fleet will be appended. Duplicates (same URL) will be skipped.
            </div>}
          </>
        )}
      </div>}

      {err && <div style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={{ ...S.btn, flex: 1, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={confirm}>{saving ? "Importing…" : existingVehicleId ? "✅ Confirm Update" : "✅ Confirm Import"}</button>
        <button style={S.sm} onClick={() => setDraft(null)} disabled={saving}>← Back</button>
        <button style={S.sm} onClick={onClose} disabled={saving}>Cancel</button>
      </div>
    </>}
  </div></div>;
}
