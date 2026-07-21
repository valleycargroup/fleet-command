import { useMemo, useState } from 'react';
import { VCAT } from '../lib/constants';
import { useStore } from '../lib/store';

type Job = {
  vehicleId: string;
  vehicleLabel: string;
  vin8: string;
  location: string;
  buyer: string;
  catKey: string;
  catLabel: string;
  catIcon: string;
  vendor: string;
  status: string;
  bid: number;
  hasPendingFindings: boolean;
};

function jobStatus(vn: any, taskStatus: string): string {
  if (vn.canceled) return 'Canceled';
  if (taskStatus === 'complete') return 'Complete';
  if (vn.bidLocked && vn.etaDone) return 'In Progress';
  if (vn.bidLocked) return 'Accepted';
  if (vn.bidSubmitted) return 'Bid Submitted';
  if (vn.selected) return 'Bid Requested';
  return 'Assigned';
}

const STATUS_ORDER = ['In Progress','Bid Submitted','Bid Requested','Assigned','Accepted','Complete','Canceled'];
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Complete':      { bg: '#0A2E18', color: '#34D399' },
  'In Progress':   { bg: '#1E3A5F', color: '#93C5FD' },
  'Accepted':      { bg: '#1E3A5F', color: '#60A5FA' },
  'Bid Submitted': { bg: '#1E1800', color: '#F59E0B' },
  'Bid Requested': { bg: '#1A1A2E', color: '#9CA3AF' },
  'Assigned':      { bg: '#1A1A2E', color: '#6B7280' },
  'Canceled':      { bg: '#1A0808', color: '#F87171' },
};

const S: any = {
  sel: { background: '#12122A', border: '1px solid #2A2A3E', color: '#E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 4, background: '#0D0D1A', border: '1px solid #1E1E32', cursor: 'pointer' },
  badge: (st: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' as const, ...(STATUS_COLOR[st] || STATUS_COLOR['Assigned']) }),
  stat: { textAlign: 'center' as const, padding: '8px 14px', borderRadius: 8, background: '#0D0D1A', border: '1px solid #1E1E32' },
};

export function JobsPage() {
  const vehicles = useStore((s: any) => s.vehicles);
  const setSelV  = useStore((s: any) => s.setSelV);
  const setTab   = useStore((s: any) => s.setTab);

  const [fVendor, setFVendor] = useState('All');
  const [fCat,    setFCat]    = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [fLoc,    setFLoc]    = useState('All');

  const { jobs, vendors, statCounts } = useMemo(() => {
    const jobs: Job[] = [];
    const vendorSet = new Set<string>();

    vehicles.forEach((v: any) => {
      VCAT.forEach(cat => {
        const task = v.reconTasks?.[cat.key];
        if (!task?.needed) return;
        (task.vendors || []).forEach((vn: any) => {
          if (!vn.name) return;
          vendorSet.add(vn.name);
          const bid = (vn.lineItems || [])
            .filter((li: any) => li.accepted && !li.declined)
            .reduce((s: number, li: any) => s + (Number(li.price) || 0), 0)
            + (vn.bidAdjustment || 0);
          const hasPendingFindings = (vn.vendorFindings || []).some((f: any) => f.prevSubmitted && !f.approved && !f.declined);
          jobs.push({
            vehicleId: v.id,
            vehicleLabel: `${v.year} ${v.make} ${v.model}`,
            vin8: v.vin8 || '',
            location: v.location || 'PHX',
            buyer: v.buyingBroker || '',
            catKey: cat.key,
            catLabel: cat.label,
            catIcon: cat.icon,
            vendor: vn.name,
            status: jobStatus(vn, task.status),
            bid,
            hasPendingFindings,
          });
        });
      });
    });

    jobs.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

    const statCounts: Record<string, number> = {};
    jobs.forEach(j => { statCounts[j.status] = (statCounts[j.status] || 0) + 1; });

    return { jobs, vendors: ['All', ...Array.from(vendorSet).sort()], statCounts };
  }, [vehicles]);

  const filtered = useMemo(() => jobs.filter(j =>
    (fVendor === 'All' || j.vendor === fVendor) &&
    (fCat    === 'All' || j.catKey === fCat) &&
    (fStatus === 'All' || j.status === fStatus) &&
    (fLoc    === 'All' || j.location === fLoc)
  ), [jobs, fVendor, fCat, fStatus, fLoc]);

  const openVehicle = (vehicleId: string) => {
    const v = vehicles.find((x: any) => x.id === vehicleId);
    if (v) { setSelV(v); setTab('active'); }
  };

  const activeCount   = (statCounts['In Progress'] || 0) + (statCounts['Bid Submitted'] || 0) + (statCounts['Bid Requested'] || 0) + (statCounts['Assigned'] || 0);
  const acceptedCount = statCounts['Accepted'] || 0;
  const completeCount = statCounts['Complete'] || 0;
  const canceledCount = statCounts['Canceled'] || 0;

  return (
    <div style={{ padding: 10, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Open',     value: activeCount,   color: '#F59E0B' },
          { label: 'Accepted', value: acceptedCount,  color: '#60A5FA' },
          { label: 'Complete', value: completeCount,  color: '#34D399' },
          { label: 'Canceled', value: canceledCount,  color: '#F87171' },
          { label: 'Total',    value: jobs.length,    color: '#E5E7EB' },
        ].map(({ label, value, color }) => (
          <div key={label} style={S.stat}>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select style={S.sel} value={fVendor} onChange={(e: any) => setFVendor(e.target.value)}>
          {vendors.map(v => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
        </select>
        <select style={S.sel} value={fCat} onChange={(e: any) => setFCat(e.target.value)}>
          <option value="All">All Categories</option>
          {VCAT.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
        </select>
        <select style={S.sel} value={fStatus} onChange={(e: any) => setFStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{s}{statCounts[s] ? ` (${statCounts[s]})` : ''}</option>)}
        </select>
        <select style={S.sel} value={fLoc} onChange={(e: any) => setFLoc(e.target.value)}>
          <option value="All">All Locations</option>
          <option value="PHX">PHX</option>
          <option value="Dallas">Dallas</option>
        </select>
        {(fVendor !== 'All' || fCat !== 'All' || fStatus !== 'All' || fLoc !== 'All') &&
          <button style={{ ...S.sel, color: '#F87171', borderColor: '#7F1D1D', cursor: 'pointer' }}
            onClick={() => { setFVendor('All'); setFCat('All'); setFStatus('All'); setFLoc('All'); }}>
            ✕ Clear
          </button>}
        <span style={{ fontSize: 12, color: '#6B7280', alignSelf: 'center', marginLeft: 4 }}>
          {filtered.length} job{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Job rows */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>No jobs match the current filters</div>
      )}
      {filtered.map((j, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 70px 110px 160px 100px 65px 110px',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 8,
          marginBottom: 4,
          background: '#0D0D1A',
          border: `1px solid ${j.hasPendingFindings ? '#92400E' : '#1E1E32'}`,
          cursor: 'pointer',
        }}
          onClick={() => openVehicle(j.vehicleId)}
          onMouseEnter={(e: any) => e.currentTarget.style.background = '#12122A'}
          onMouseLeave={(e: any) => e.currentTarget.style.background = '#0D0D1A'}>

          {/* Category icon */}
          <span style={{ fontSize: 18 }}>{j.catIcon}</span>

          {/* Vehicle */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E7EB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {j.vehicleLabel}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.vin8} · {j.buyer || '—'}</div>
          </div>

          {/* Location */}
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>📍 {j.location}</span>

          {/* Category */}
          <span style={{ fontSize: 12, color: '#93C5FD', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.catLabel}</span>

          {/* Vendor */}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.vendor}</span>

          {/* Pending findings flag */}
          <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>
            {j.hasPendingFindings ? '🔍 Findings' : ''}
          </span>

          {/* Bid */}
          <span style={{ fontSize: 13, fontWeight: 700, color: j.bid > 0 ? '#FBBF24' : '#4B5563', textAlign: 'right' }}>
            {j.bid > 0 ? `$${j.bid.toLocaleString()}` : '—'}
          </span>

          {/* Status badge */}
          <span style={S.badge(j.status)}>{j.status}</span>
        </div>
      ))}
    </div>
  );
}
