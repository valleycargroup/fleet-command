import { useState, useEffect } from 'react';
import { S } from '../lib/styles';
import { useStore, selectRoles } from '../lib/store';

const EMPTY = { name:'', email:'', phone:'', address:'', city:'', state:'', zip_code:'', responsible_for_pickup:false };

export function DealersPage() {
  const dealers     = useStore((s: any) => s.dealers);
  const fetchDealers = useStore((s: any) => s.fetchDealers);
  const api         = useStore((s: any) => s.api);
  const notify      = useStore((s: any) => s.notify);
  const { isAdmin } = useStore(selectRoles);
  const search      = useStore((s: any) => s.search);

  const [form, setForm] = useState<any>(null);   // null=closed, {} or dealer=editing
  const [importing, setImporting] = useState(false);

  // Auto-import from Auction on first open if the list is empty
  useEffect(() => {
    if (isAdmin && dealers.length === 0) importFromAuction();
  }, []);

  const q = (search || '').toUpperCase().trim();
  const visible = q
    ? dealers.filter((d: any) => (d.name||'').toUpperCase().includes(q) || (d.city||'').toUpperCase().includes(q) || (d.state||'').toUpperCase().includes(q))
    : dealers;

  async function togglePickup(d: any) {
    try {
      await api(`/api/dealers/${d.id}`, 'PUT', { ...d, responsible_for_pickup: !d.responsible_for_pickup });
      await fetchDealers();
    } catch (e: any) { notify('⚠️ ' + e.message); }
  }

  async function saveForm() {
    if (!form?.name?.trim()) { notify('Name is required'); return; }
    try {
      if (form.id) {
        await api(`/api/dealers/${form.id}`, 'PUT', form);
      } else {
        await api('/api/dealers', 'POST', form);
      }
      await fetchDealers();
      setForm(null);
      notify(form.id ? 'Dealer updated' : 'Dealer added');
    } catch (e: any) { notify('⚠️ ' + e.message); }
  }

  async function deleteDealer(d: any) {
    if (!confirm(`Delete "${d.name}"?`)) return;
    try {
      await api(`/api/dealers/${d.id}`, 'DELETE');
      await fetchDealers();
      notify('Dealer removed');
    } catch (e: any) { notify('⚠️ ' + e.message); }
  }

  async function importFromAuction() {
    setImporting(true);
    try {
      const res = await api('/api/dealers/import-from-auction', 'POST');
      await fetchDealers();
      notify(`✅ Import complete — ${res.imported} new, ${res.updated} updated (${res.total} total)`);
    } catch (e: any) { notify('⚠️ Import failed: ' + e.message); }
    setImporting(false);
  }

  const field = (label: string, key: string, type = 'text') => (
    <label style={S.fl}>
      {label}
      <input
        style={S.fi}
        type={type}
        value={form?.[key] ?? ''}
        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: '#6B7280', fontSize: 13 }}>{visible.length} dealer{visible.length !== 1 ? 's' : ''}</span>
        {isAdmin && <>
          <button style={S.btn} onClick={() => setForm({ ...EMPTY })}>+ Add Dealer</button>
          <button
            style={{ ...S.btn, background: importing ? '#374151' : '#1D4ED8' }}
            onClick={importFromAuction}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import from Auction'}
          </button>
        </>}
      </div>

      {/* table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Name', 'Phone', 'Email', 'City', 'State', 'Pickup Responsible', ...(isAdmin ? [''] : [])].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ ...S.td, color: '#6B7280', textAlign: 'center', padding: 24 }}>
                {importing ? '⏳ Importing dealers from Auction…'
                  : dealers.length === 0 ? 'No dealers found — add one or click Import from Auction'
                  : 'No dealers match your search'}
              </td></tr>
            )}
            {visible.map((d: any) => (
              <tr key={d.id} style={{ borderBottom: '1px solid #1E1E32' }}>
                <td style={S.td}>{d.name}</td>
                <td style={{ ...S.td, color: '#9CA3AF' }}>{d.phone || '—'}</td>
                <td style={{ ...S.td, color: '#9CA3AF' }}>{d.email || '—'}</td>
                <td style={{ ...S.td, color: '#9CA3AF' }}>{d.city || '—'}</td>
                <td style={{ ...S.td, color: '#9CA3AF' }}>{d.state || '—'}</td>
                <td style={S.td}>
                  {isAdmin ? (
                    <button
                      onClick={() => togglePickup(d)}
                      style={{
                        ...S.sm,
                        background: d.responsible_for_pickup ? '#14532D' : 'transparent',
                        border: `1px solid ${d.responsible_for_pickup ? '#16A34A' : '#2A2A3E'}`,
                        color: d.responsible_for_pickup ? '#4ADE80' : '#6B7280',
                        fontWeight: d.responsible_for_pickup ? 700 : 400,
                      }}
                    >
                      {d.responsible_for_pickup ? 'Yes' : 'No'}
                    </button>
                  ) : (
                    <span style={{
                      ...S.badge,
                      background: d.responsible_for_pickup ? '#14532D' : '#1A1A2E',
                      color: d.responsible_for_pickup ? '#4ADE80' : '#6B7280',
                    }}>
                      {d.responsible_for_pickup ? 'Yes' : 'No'}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                    <button style={S.sm} onClick={() => setForm({ ...d })}>Edit</button>
                    {' '}
                    <button style={{ ...S.sm, color: '#F87171' }} onClick={() => deleteDealer(d)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* add / edit modal */}
      {form && (
        <div style={S.ov} onClick={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div style={{ ...S.modal, maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#F1F5F9', marginBottom: 16 }}>
              {form.id ? 'Edit Dealer' : 'Add Dealer'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('Name *', 'name')}
              {field('Phone', 'phone')}
              {field('Email', 'email', 'email')}
              {field('Address', 'address')}
              {field('City', 'city')}
              {field('State', 'state')}
              {field('Zip Code', 'zip_code')}
              <label style={{ ...S.fl, justifyContent: 'flex-end' }}>
                Responsible for Pickup
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={!!form.responsible_for_pickup}
                    onChange={e => setForm((f: any) => ({ ...f, responsible_for_pickup: e.target.checked }))}
                  />
                  <span style={{ fontSize: 13, color: '#E5E7EB' }}>Dealer picks up vehicle</span>
                </label>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={S.sm} onClick={() => setForm(null)}>Cancel</button>
              <button style={S.btn} onClick={saveForm}>{form.id ? 'Save Changes' : 'Add Dealer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
