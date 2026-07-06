import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/constants';
import { useStore, selectRoles } from '../lib/store';
import { S } from '../lib/styles';

const TYPE_LABEL: Record<string, string> = {
  buyer_work_complete:              'Work Complete',
  buyer_recon_complete:             'Recon Complete',
  buyer_bid_submitted:              'Bid Submitted',
  buyer_vendor_declined:            'Vendor Declined',
  buyer_approved_shipping:          'Shipping Approved',
  shipping_hold:                    'Shipping Hold',
  transport_inbound_set:            'Inbound Set',
  vehicle_grounded:                 'Vehicle Grounded',
  driveway_inbound_pickedup:        'Driveway Pickup',
  driveway_outbound_shipped:        'Driveway Shipped',
  driveway_outbound_delivered:      'Driveway Delivered',
  retail_vehicle_shipped:           'Retail Shipped',
  retail_vehicle_delivered:         'Retail Delivered',
  dealer_vehicle_shipped:           'Dealer Shipped',
  dealer_vehicle_delivered:         'Dealer Delivered',
  seller_vehicle_sold:              'Seller — Sold',
  seller_vehicle_kicked:            'Seller — Kicked',
  buyer_vehicle_kicked:             'Buyer — Kicked',
  parts_quoted_to_buyer:            'Parts Quoted',
  vendor_work_assigned:             'Vendor: Assigned',
  vendor_work_reminder:             'Vendor: Reminder',
  vendor_bid_requested:             'Vendor: Bid Request',
  vendor_bid_accepted:              'Vendor: Bid Accepted',
  vendor_payment_pending_digest:    'Vendor: Payment Digest',
  vendor_payment_receipt:           'Vendor: Payment Receipt',
  password_reset:                   'Password Reset',
  forgot_password:                  'Password Reset',
  welcome_user:                     'Welcome (User)',
  welcome_vendor:                   'Welcome (Vendor)',
};

// Email types that should be grouped when sent to multiple recipients at once
const BATCH_TYPES = new Set(['vendor_payment_pending_digest', 'vendor_payment_receipt']);

function fmtType(t: string) {
  return TYPE_LABEL[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtTime(ts: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const TH: any = { padding: '8px 12px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 1, whiteSpace: 'nowrap' as const, borderBottom: '1px solid #2A2A3E' };
const TD: any = { padding: '8px 12px', fontSize: 12, color: '#E5E7EB', borderBottom: '1px solid #1A1A2E', verticalAlign: 'top' as const };

interface EmailRow {
  id: string;
  email_type: string;
  recipient: string;
  vehicle_id: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
  recipient_name: string | null;
  recipient_role: string | null;
  recipient_vendor: string | null;
  triggered_by: string | null;
  sendgrid_message_id: string | null;
}

interface Group {
  key: string;
  email_type: string;
  subject: string | null;
  triggered_by: string | null;
  created_at: string;
  rows: EmailRow[];
}

function buildGroups(rows: EmailRow[]): Group[] {
  const groups: Group[] = [];
  const map = new Map<string, Group>();

  for (const row of rows) {
    if (BATCH_TYPES.has(row.email_type)) {
      // Bucket by type+subject+minute so sends within the same minute cluster together
      const minute = Math.floor(new Date(row.created_at).getTime() / 60000);
      const key = `${row.email_type}||${row.subject || ''}||${minute}`;
      if (map.has(key)) {
        map.get(key)!.rows.push(row);
      } else {
        const g: Group = { key, email_type: row.email_type, subject: row.subject, triggered_by: row.triggered_by, created_at: row.created_at, rows: [row] };
        map.set(key, g);
        groups.push(g);
      }
    } else {
      // Non-batch: unique key per row
      groups.push({ key: row.id, email_type: row.email_type, subject: row.subject, triggered_by: row.triggered_by, created_at: row.created_at, rows: [row] });
    }
  }

  return groups;
}

function RecipientCell({ row }: { row: EmailRow }) {
  return (
    <div>
      {row.recipient_name && <div style={{ fontSize: 12, fontWeight: 600, color: '#E5E7EB' }}>{row.recipient_name}</div>}
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: row.recipient_name ? '#6B7280' : '#E5E7EB' }}>{row.recipient}</div>
      {row.recipient_role && (
        <div style={{ fontSize: 10, marginTop: 2 }}>
          <span style={{ padding: '1px 6px', borderRadius: 4, background: '#1A1A2E', color: '#9CA3AF', fontWeight: 600, textTransform: 'capitalize' }}>{row.recipient_role}</span>
          {row.recipient_vendor && <span style={{ marginLeft: 4, color: '#6B7280' }}>{row.recipient_vendor}</span>}
        </div>
      )}
    </div>
  );
}

function StatusCell({ row }: { row: EmailRow }) {
  const isFailed = row.status === 'failed';
  return isFailed
    ? <div>
        <span style={{ padding: '2px 8px', borderRadius: 4, background: '#7F1D1D', color: '#FCA5A5', fontSize: 11, fontWeight: 700 }}>FAILED</span>
        {row.error && <div style={{ fontSize: 10, color: '#F87171', marginTop: 4, maxWidth: 200 }}>{row.error}</div>}
      </div>
    : <span style={{ padding: '2px 8px', borderRadius: 4, background: '#0D3B1E', color: '#34D399', fontSize: 11, fontWeight: 700 }}>SENT</span>;
}

function EmailPreviewModal({ row, onClose }: { row: EmailRow; onClose: () => void }) {
  const [html, setHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('fc_token') || '';
    fetch(`${API_URL}/api/email-log/${row.id}/preview`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); } else { setHtml(d.html || ''); setSubject(d.subject || ''); }
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [row.id]);

  const sentAt = row.created_at
    ? new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={onClose}>
      <div style={{ background: '#1C1C28', border: '1px solid #2A2A3E', borderRadius: 12, width: '96vw', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
           onClick={(e: any) => e.stopPropagation()}>

        {/* Title bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #2A2A3E', flexShrink: 0, gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: .5 }}>Email Preview</div>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 6px', borderRadius: 4 }}>✕</button>
          </div>
        </div>

        {/* Email client chrome */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #2A2A3E', flexShrink: 0, background: '#16162A' }}>
          {/* Subject */}
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E5E7EB', marginBottom: 14, lineHeight: 1.3 }}>
            {subject || row.subject || '(no subject)'}
          </div>
          {/* Sender row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#166534,#15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: .5 }}>
              FC
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E7EB' }}>Fleet Command</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                to{' '}
                <span style={{ color: '#9CA3AF' }}>{row.recipient_name ? `${row.recipient_name} <${row.recipient}>` : row.recipient}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', flexShrink: 0, textAlign: 'right' }}>
              <div>{sentAt}</div>
              {row.triggered_by && (
                <div style={{ fontSize: 10, marginTop: 2, color: row.triggered_by === 'cron' ? '#F59E0B' : '#6B7280', fontWeight: 600 }}>
                  {row.triggered_by === 'cron' ? '⏰ automated' : '✋ manual'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, background: '#0D0D0D' }}>
          {loading && <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>Loading…</div>}
          {err && <div style={{ padding: 24, color: '#FCA5A5', fontSize: 13 }}>{err}</div>}
          {!loading && !err && html && (
            <iframe
              srcDoc={html}
              style={{ width: '100%', height: '100%', minHeight: '55vh', border: 'none', display: 'block', background: 'transparent' }}
              sandbox="allow-same-origin"
              title="Email preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function EmailLogPage() {
  const vehicles = useStore((s: any) => s.vehicles);
  const { isAdmin, isTechSupport } = useStore(selectRoles);
  const showSendgridId = isAdmin || isTechSupport;

  const showConfirm = useStore((s: any) => s.showConfirm);

  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<'all'|'sent'|'failed'>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewRow, setPreviewRow] = useState<EmailRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const token = localStorage.getItem('fc_token') || '';
      const r = await fetch(`${API_URL}/api/email-log?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(data.emails || []);
    } catch (e: any) { setErr(e.message || 'Failed to load'); }
    setLoading(false);
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  function purgeLog() {
    showConfirm(
      `This will permanently delete all ${rows.length} email log entries. This cannot be undone.`,
      async () => {
        const token = localStorage.getItem('fc_token') || '';
        await fetch(`${API_URL}/api/email-log`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        load();
      },
      'Purge Email Log?',
      true,
      'Purge All',
    );
  }

  const vehicleMap = Object.fromEntries(vehicles.map((v: any) => [v._dbId, v]));

  const filtered = rows.filter(r => {
    if (filter === 'sent' && r.status !== 'sent') return false;
    if (filter === 'failed' && r.status !== 'failed') return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.email_type||'').includes(q) || (r.recipient||'').toLowerCase().includes(q) ||
             (r.subject||'').toLowerCase().includes(q) ||
             (r.recipient_name||'').toLowerCase().includes(q) ||
             (r.recipient_vendor||'').toLowerCase().includes(q);
    }
    return true;
  });

  const groups = buildGroups(filtered);
  const failCount = rows.filter(r => r.status === 'failed').length;

  const toggleGroup = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const colCount = showSendgridId ? 7 : 6;

  return (
    <div style={{ color: '#E5E7EB' }}>
      {previewRow && <EmailPreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#E5E7EB' }}>📧 Email Audit Log</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            {rows.length} entries{failCount > 0 && <span style={{ color: '#F87171', marginLeft: 8 }}>⚠️ {failCount} failed</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...S.fi, minWidth: 200, fontSize: 12 }}
            placeholder="Search recipient, type, subject..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
          />
          {(['all','sent','failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? (f === 'failed' ? '#7F1D1D' : f === 'sent' ? '#0D3B1E' : '#1A1A2E') : 'transparent',
                color: filter === f ? (f === 'failed' ? '#FCA5A5' : f === 'sent' ? '#34D399' : '#9CA3AF') : '#6B7280',
                borderColor: filter === f ? (f === 'failed' ? '#7F1D1D' : f === 'sent' ? '#166534' : '#2A2A3E') : '#2A2A3E',
              }}>
              {f === 'all' ? 'All' : f === 'sent' ? '✅ Sent' : '❌ Failed'}
            </button>
          ))}
          <select style={{ ...S.fi, fontSize: 12, width: 'auto' }} value={limit} onChange={(e: any) => setLimit(Number(e.target.value))}>
            {[50, 100, 250, 500].map(n => <option key={n} value={n}>Last {n}</option>)}
          </select>
          <button style={{ ...S.btn, fontSize: 12, padding: '6px 14px' }} onClick={load} disabled={loading}>
            {loading ? '⏳' : '↻ Refresh'}
          </button>
          {(isAdmin || isTechSupport) && (
            <button
              onClick={purgeLog}
              disabled={loading || rows.length === 0}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #7F1D1D', background: 'transparent', color: '#F87171', fontSize: 12, fontWeight: 700, cursor: rows.length === 0 ? 'default' : 'pointer', opacity: rows.length === 0 ? 0.4 : 1 }}
            >
              🗑 Purge Log
            </button>
          )}
        </div>
      </div>

      {err && <div style={{ padding: '8px 12px', background: '#3B1515', border: '1px solid #7F1D1D', borderRadius: 6, color: '#FCA5A5', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #2A2A3E' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#0D0D1A' }}>
            <tr>
              <th style={TH}>Time</th>
              <th style={TH}>Type</th>
              <th style={TH}>Recipient</th>
              <th style={TH}>Vehicle</th>
              <th style={TH}>Subject</th>
              <th style={TH}>Status</th>
              {showSendgridId && <th style={TH}>SendGrid ID</th>}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={colCount} style={{ ...TD, textAlign: 'center', color: '#4B5563', padding: 32 }}>
                {loading ? 'Loading…' : 'No entries found'}
              </td></tr>
            )}
            {groups.map((group) => {
              const isBatch = BATCH_TYPES.has(group.email_type) && group.rows.length > 1;
              const isOpen = expanded.has(group.key);
              const failedCount = group.rows.filter(r => r.status === 'failed').length;
              const sentCount = group.rows.filter(r => r.status === 'sent').length;

              if (!isBatch) {
                // Single row — render normally
                const row = group.rows[0];
                const veh = vehicleMap[row.vehicle_id || ''];
                const isFailed = row.status === 'failed';
                return (
                  <tr key={row.id} style={{ background: isFailed ? 'rgba(127,29,29,0.15)' : 'transparent' }}>
                    <td style={{ ...TD, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {fmtTime(row.created_at)}
                      <button onClick={() => setPreviewRow(row)}
                        title="Preview email"
                        style={{ display: 'block', marginTop: 4, padding: '1px 6px', fontSize: 10, background: '#1A1A2E', border: '1px solid #2A2A3E', borderRadius: 4, color: '#93C5FD', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        👁 preview
                      </button>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#93C5FD' }}>{fmtType(row.email_type)}</span>
                      {row.triggered_by === 'cron' && <span style={{ display: 'block', fontSize: 10, color: '#F59E0B', fontWeight: 700, marginTop: 2 }}>⏰ auto</span>}
                    </td>
                    <td style={TD}><RecipientCell row={row} /></td>
                    <td style={TD}>
                      {veh
                        ? <span style={{ fontSize: 11 }}>
                            <span style={{ color: '#E5E7EB', fontWeight: 600 }}>{veh.year} {veh.make} {veh.model}</span>
                            <br/>
                            <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>{veh.fullVin || veh.vin8 || '—'}</span>
                          </span>
                        : row.vehicle_id
                          ? <span style={{ color: '#4B5563', fontSize: 11, fontFamily: 'monospace' }}>{row.vehicle_id.slice(0, 8)}…</span>
                          : <span style={{ color: '#4B5563' }}>—</span>
                      }
                    </td>
                    <td style={{ ...TD, color: '#9CA3AF', maxWidth: 300 }}>{row.subject || '—'}</td>
                    <td style={TD}><StatusCell row={row} /></td>
                    {showSendgridId && (
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 10, color: '#6B7280', maxWidth: 180, wordBreak: 'break-all' }}>
                        {row.sendgrid_message_id || '—'}
                      </td>
                    )}
                  </tr>
                );
              }

              // Batch group — summary row + expandable sub-rows
              return [
                <tr key={group.key} style={{ background: '#0D1520', cursor: 'pointer' }} onClick={() => toggleGroup(group.key)}>
                  <td style={{ ...TD, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtTime(group.created_at)}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#93C5FD' }}>{fmtType(group.email_type)}</span>
                    {group.triggered_by === 'cron' && <span style={{ display: 'block', fontSize: 10, color: '#F59E0B', fontWeight: 700, marginTop: 2 }}>⏰ auto</span>}
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{isOpen ? '▼' : '▶'}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#1E3A5F', color: '#93C5FD', fontSize: 11, fontWeight: 700 }}>
                        {group.rows.length} recipients
                      </span>
                      {failedCount > 0 && <span style={{ padding: '2px 6px', borderRadius: 4, background: '#7F1D1D', color: '#FCA5A5', fontSize: 10, fontWeight: 700 }}>{failedCount} failed</span>}
                      {sentCount > 0 && failedCount === 0 && <span style={{ padding: '2px 6px', borderRadius: 4, background: '#0D3B1E', color: '#34D399', fontSize: 10, fontWeight: 700 }}>all sent</span>}
                    </div>
                  </td>
                  <td style={{ ...TD, color: '#4B5563' }}>—</td>
                  <td style={{ ...TD, color: '#9CA3AF', maxWidth: 300 }}>{group.subject || '—'}</td>
                  <td style={TD}>
                    {failedCount > 0
                      ? <span style={{ padding: '2px 8px', borderRadius: 4, background: '#7F1D1D', color: '#FCA5A5', fontSize: 11, fontWeight: 700 }}>PARTIAL</span>
                      : <span style={{ padding: '2px 8px', borderRadius: 4, background: '#0D3B1E', color: '#34D399', fontSize: 11, fontWeight: 700 }}>SENT</span>
                    }
                  </td>
                  {showSendgridId && <td style={{ ...TD, color: '#4B5563' }}>—</td>}
                </tr>,
                ...(isOpen ? group.rows.map(row => (
                  <tr key={row.id} style={{ background: row.status === 'failed' ? 'rgba(127,29,29,0.12)' : '#060610' }}>
                    <td style={{ ...TD, color: '#4B5563', paddingLeft: 32, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {fmtTime(row.created_at)}
                      <button onClick={() => setPreviewRow(row)}
                        title="Preview email"
                        style={{ display: 'block', marginTop: 4, padding: '1px 6px', fontSize: 10, background: '#1A1A2E', border: '1px solid #2A2A3E', borderRadius: 4, color: '#93C5FD', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        👁 preview
                      </button>
                    </td>
                    <td style={{ ...TD, color: '#4B5563', fontSize: 11 }}>↳</td>
                    <td style={{ ...TD, paddingLeft: 32 }}><RecipientCell row={row} /></td>
                    <td style={{ ...TD, color: '#4B5563' }}>—</td>
                    <td style={{ ...TD, color: '#4B5563' }}>—</td>
                    <td style={TD}><StatusCell row={row} /></td>
                    {showSendgridId && (
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 10, color: '#6B7280', maxWidth: 180, wordBreak: 'break-all' }}>
                        {row.sendgrid_message_id || '—'}
                      </td>
                    )}
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
