import { useMemo, useState, useRef, useEffect } from 'react';
import { VCAT } from '../lib/constants';
import { useStore } from '../lib/store';

function SearchSelect({ value, onChange, options, allLabel }: { value: string; onChange: (v: string) => void; options: string[]; allLabel: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(o => o === 'All' || o.toLowerCase().includes(q.toLowerCase()));
  const label = value === 'All' ? allLabel : value;
  const isActive = value !== 'All';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); setQ(''); }}
        style={{ background: '#12122A', border: `1px solid ${isActive ? '#F59E0B' : '#2A2A3E'}`, color: isActive ? '#FDE68A' : '#E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label} ▾
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4, background: '#12122A', border: '1px solid #2A2A3E', borderRadius: 8, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', boxSizing: 'border-box', background: '#0D0D1A', border: 'none', borderBottom: '1px solid #2A2A3E', color: '#E5E7EB', padding: '8px 10px', fontSize: 13, borderRadius: '8px 8px 0 0', outline: 'none' }} />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map(o => (
              <div key={o} onClick={() => { onChange(o); setOpen(false); }}
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: o === value ? '#FDE68A' : '#E5E7EB', background: o === value ? '#1E1E3A' : 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1A1A2E')}
                onMouseLeave={e => (e.currentTarget.style.background = o === value ? '#1E1E3A' : 'transparent')}>
                {o === 'All' ? allLabel : o}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: '#4B5563' }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

type Job = {
  vehicleId: string;
  vehicleLabel: string;
  fullVin: string;
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

function jobStatus(vn: any, taskStatus: string, hasPendingFindings: boolean): string {
  if (vn.canceled) return 'Canceled';
  if (taskStatus === 'complete') return 'Complete';
  if (hasPendingFindings) return 'Awaiting Approval';
  if (vn.bidLocked && vn.etaDone) return 'In Progress';
  if (vn.bidLocked) return 'Accepted';
  if (vn.bidSubmitted) return 'Awaiting Approval';
  if (vn.selected) return 'Bid Requested';
  return 'Assigned';
}

const STATUS_ORDER = ['Awaiting Approval','In Progress','Bid Requested','Assigned','Accepted','Complete','Canceled'];
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  'Complete':          { bg: '#0A2E18', color: '#34D399' },
  'In Progress':       { bg: '#1E3A5F', color: '#93C5FD' },
  'Accepted':          { bg: '#1E3A5F', color: '#60A5FA' },
  'Awaiting Approval': { bg: '#2D1500', color: '#FB923C' },
  'Bid Requested':     { bg: '#1A1A2E', color: '#9CA3AF' },
  'Assigned':          { bg: '#1A1A2E', color: '#6B7280' },
  'Canceled':          { bg: '#1A0808', color: '#F87171' },
};

const S: any = {
  sel: { background: '#12122A', border: '1px solid #2A2A3E', color: '#E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 4, background: '#0D0D1A', border: '1px solid #1E1E32', cursor: 'pointer' },
  badge: (st: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' as const, ...(STATUS_COLOR[st] || STATUS_COLOR['Assigned']) }),
  stat: { textAlign: 'center' as const, padding: '8px 14px', borderRadius: 8, background: '#0D0D1A', border: '1px solid #1E1E32' },
};

export function JobsPage() {
  const vehicles = useStore((s: any) => s.vehicles);
  const allUsers  = useStore((s: any) => s.allUsers);
  const setSelV       = useStore((s: any) => s.setSelV);
  const setTab        = useStore((s: any) => s.setTab);
  const setReturnTab  = useStore((s: any) => s.setReturnTab);
  const setDeepLinkCat = useStore((s: any) => s.setDeepLinkCat);

  const jobsFilters    = useStore((s: any) => s.jobsFilters);
  const setJobsFilters = useStore((s: any) => s.setJobsFilters);
  const fVendor = jobsFilters.vendor;
  const fCat    = jobsFilters.cat;
  const fStatus = jobsFilters.status;
  const fLoc    = jobsFilters.loc;
  const fSearch = jobsFilters.search || '';
  const fBuyer  = jobsFilters.buyer || 'All';
  const setFVendor = (vendor: string) => setJobsFilters({ ...jobsFilters, vendor });
  const setFCat    = (cat: string)    => setJobsFilters({ ...jobsFilters, cat });
  const setFStatus = (status: string) => setJobsFilters({ ...jobsFilters, status });
  const setFLoc    = (loc: string)    => setJobsFilters({ ...jobsFilters, loc });
  const setFBuyer  = (buyer: string)  => setJobsFilters({ ...jobsFilters, buyer });
  const setFSearch = (search: string) => setJobsFilters({ ...jobsFilters, search });

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCat = (key: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const buyers = useMemo(() => {
    const names = (allUsers || [])
      .filter((u: any) => u.isBuyer || u.is_buyer || (u.role || '').toLowerCase() === 'buyer' || (u.role || '').toLowerCase() === 'admin')
      .map((u: any) => ((u.firstName || u.first_name || '') + ' ' + (u.lastName || u.last_name || '')).trim())
      .filter(Boolean);
    return ['All', ...Array.from(new Set(names)).sort()];
  }, [allUsers]);

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
            location: v.location || 'PHX',
            buyer: v.buyingBroker || '',
            catKey: cat.key,
            catLabel: cat.label,
            catIcon: cat.icon,
            vendor: vn.name,
            status: jobStatus(vn, task.status, hasPendingFindings),
            bid,
            fullVin: v.fullVin || '',
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

  const ACTIVE_STATUSES = new Set(['Awaiting Approval','In Progress','Bid Requested','Assigned','Accepted']);
  const filtered = useMemo(() => {
    const q = fSearch.toLowerCase();
    const f = jobs.filter(j => {
      if (fVendor !== 'All' && j.vendor !== fVendor) return false;
      if (fCat    !== 'All' && j.catKey !== fCat) return false;
      if (fStatus !== 'All' && !(fStatus === 'Active' ? ACTIVE_STATUSES.has(j.status) : j.status === fStatus)) return false;
      if (fLoc    !== 'All' && j.location !== fLoc) return false;
      if (fBuyer  !== 'All' && j.buyer !== fBuyer) return false;
      if (q && ![j.vendor, j.vehicleLabel, j.fullVin, j.buyer, j.catLabel, j.status].some(s => s.toLowerCase().includes(q))) return false;
      return true;
    });
    // Sort by VCAT order first, then status within each category
    const catOrder = VCAT.reduce((m, c, i) => { m[c.key] = i; return m; }, {} as Record<string,number>);
    f.sort((a, b) => {
      const catDiff = (catOrder[a.catKey] ?? 99) - (catOrder[b.catKey] ?? 99);
      if (catDiff !== 0) return catDiff;
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    });
    return f;
  }, [jobs, fVendor, fCat, fStatus, fLoc, fBuyer, fSearch]);

  const openVehicle = (vehicleId: string, catKey: string) => {
    const v = vehicles.find((x: any) => x.id === vehicleId);
    if (v) { setTab('active'); setReturnTab('jobs'); setDeepLinkCat(catKey); setSelV(v); }
  };

  const activeCount   = (statCounts['Awaiting Approval'] || 0) + (statCounts['In Progress'] || 0) + (statCounts['Bid Requested'] || 0) + (statCounts['Assigned'] || 0);
  const acceptedCount = statCounts['Accepted'] || 0;
  const completeCount = statCounts['Complete'] || 0;
  const canceledCount = statCounts['Canceled'] || 0;

  return (
    <div style={{ padding: 10, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Awaiting',  value: statCounts['Awaiting Approval'] || 0, color: '#FB923C', filter: 'Awaiting Approval' },
          { label: 'Open',      value: activeCount,                           color: '#F59E0B', filter: 'Active' },
          { label: 'Accepted',  value: acceptedCount,                         color: '#60A5FA', filter: 'Accepted' },
          { label: 'Complete',  value: completeCount,                         color: '#34D399', filter: 'Complete' },
          { label: 'Canceled',  value: canceledCount,                         color: '#F87171', filter: 'Canceled' },
          { label: 'Total',     value: jobs.length,                           color: '#E5E7EB', filter: 'All' },
        ].map(({ label, value, color, filter }) => {
          const active = fStatus === filter;
          return (
            <div key={label}
              onClick={() => setFStatus(active ? 'All' : filter)}
              onMouseEnter={(e: any) => e.currentTarget.style.background = '#1A1A2E'}
              onMouseLeave={(e: any) => e.currentTarget.style.background = active ? '#12122A' : '#0D0D1A'}
              style={{ ...S.stat, cursor: 'pointer', background: active ? '#12122A' : '#0D0D1A', ...(active ? { border: `1px solid ${color}` } : {}), borderBottom: `3px solid ${color}`, transition: 'background 0.15s' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 10, color: active ? color : '#6B7280', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      {(() => {
        const isFiltered = fVendor !== 'All' || fCat !== 'All' || fStatus !== 'All' || fLoc !== 'All' || fBuyer !== 'All' || !!fSearch;
        const act = (active: boolean) => active ? { ...S.sel, borderColor: '#F59E0B', color: '#FDE68A' } : S.sel;
        return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <SearchSelect value={fVendor} onChange={setFVendor} options={vendors} allLabel="All Vendors" />
            <select style={act(fCat !== 'All')} value={fCat} onChange={(e: any) => setFCat(e.target.value)}>
              <option value="All">All Categories</option>
              {VCAT.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
            <select style={act(fStatus !== 'All')} value={fStatus} onChange={(e: any) => setFStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Active">Active (open)</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{s}{statCounts[s] ? ` (${statCounts[s]})` : ''}</option>)}
            </select>
            <select style={act(fLoc !== 'All')} value={fLoc} onChange={(e: any) => setFLoc(e.target.value)}>
              <option value="All">All Locations</option>
              <option value="PHX">PHX</option>
              <option value="Dallas">Dallas</option>
            </select>
            <SearchSelect value={fBuyer} onChange={setFBuyer} options={buyers} allLabel="All Buyers" />
            <input
              style={{ ...act(!!fSearch), minWidth: 180, flex: 1 }}
              placeholder="Search vendor, vehicle, VIN..."
              value={fSearch}
              onChange={(e: any) => setFSearch(e.target.value)}
            />
            {isFiltered &&
              <button style={{ ...S.sel, color: '#F87171', borderColor: '#7F1D1D', cursor: 'pointer' }}
                onClick={() => setJobsFilters({ vendor: 'All', cat: 'All', status: 'Active', loc: 'All', buyer: 'All', search: '' })}>
                ✕ Clear
              </button>}
            <span style={{ fontSize: 12, color: isFiltered ? '#F59E0B' : '#6B7280', alignSelf: 'center', marginLeft: 4, whiteSpace: 'nowrap' }}>
              {isFiltered ? `${filtered.length} of ${jobs.length} jobs` : `${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        );
      })()}

      {/* Job rows */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>No jobs match the current filters</div>
      )}
      {filtered.map((j, i) => {
        const showHeader = i === 0 || filtered[i - 1].catKey !== j.catKey;
        return (<>
          {showHeader && (
            <div key={`hdr-${j.catKey}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginTop: i > 0 ? 14 : 0, marginBottom: 4, background: '#12122A', borderRadius: 8, borderLeft: '3px solid #3B82F6', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => toggleCat(j.catKey)}>
              <span style={{ fontSize: 18 }}>{j.catIcon}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', letterSpacing: 0.3 }}>{j.catLabel}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', background: '#1E3A5F', padding: '2px 8px', borderRadius: 10 }}>
                {filtered.filter(x => x.catKey === j.catKey).length} job{filtered.filter(x => x.catKey === j.catKey).length !== 1 ? 's' : ''}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4B5563' }}>{collapsed.has(j.catKey) ? '▶' : '▼'}</span>
            </div>
          )}
          {!collapsed.has(j.catKey) && <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr 70px 100px 65px 110px',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            borderRadius: 8,
            marginBottom: 4,
            background: '#0D0D1A',
            border: `1px solid ${j.hasPendingFindings ? '#92400E' : '#1E1E32'}`,
            cursor: 'pointer',
          }}
            onClick={() => openVehicle(j.vehicleId, j.catKey)}
            onMouseEnter={(e: any) => e.currentTarget.style.background = '#12122A'}
            onMouseLeave={(e: any) => e.currentTarget.style.background = '#0D0D1A'}>

            {/* Vendor — first and prominent */}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E5E7EB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.vendor}</span>

            {/* Vehicle */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.vehicleLabel}</div>
              <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.fullVin} · {j.buyer || '—'}</div>
            </div>

            {/* Location */}
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>📍 {j.location}</span>

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
          </div>}
        </>);
      })}
    </div>
  );
}
