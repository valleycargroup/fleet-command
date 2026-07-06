import { useState } from 'react';
import { VCAT } from '../lib/constants';
import { S } from '../lib/styles';
import { useStore } from '../lib/store';

const PAYMENT_METHODS = [
  { key: 'check', label: '🖊️ Check', desc: 'Physical check mailed or handed' },
  { key: 'ach',   label: '🏦 ACH',   desc: 'Bank transfer (routing + account)' },
  { key: 'zelle', label: '⚡ Zelle',  desc: 'Instant transfer via Zelle' },
];

export function AddVendorForm({ onSave, onClose, initial }: any) {
  const allUsers   = useStore((s: any) => s.allUsers);
  const regVendors = useStore((s: any) => s.regVendors);
  const isEdit = !!initial;
  const [linkMode, setLinkMode] = useState<'new'|'existing'>('new');
  const [linkUserId, setLinkUserId] = useState('');

  const [f, setF] = useState(initial || {
    company: '', contact: '', firstName: '', lastName: '', email: '', cell: '', officePhone: '',
    address: '', categories: [], password: '',
    paymentTerms: 'weekly', cutoffDay: 'Friday', cutoffTime: '5 PM',
    deliveryMethod: 'USPS Mail',
    paymentInfo: {}, emailPrefs: {},
  });

  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[]>([]);
  const [pendingAddIds,    setPendingAddIds]    = useState<string[]>([]);
  const [addPickerId,      setAddPickerId]      = useState('');

  // Base list of users currently assigned to this vendor (from store)
  const assignedUsers = isEdit
    ? (allUsers || []).filter((u: any) => u.vendorId === f.id)
    : [];

  // Effective list after pending add/remove operations
  const effectiveUsers = isEdit ? [
    ...assignedUsers.filter((u: any) => !pendingRemoveIds.includes(u.id)),
    ...(allUsers || []).filter((u: any) => pendingAddIds.includes(u.id)),
  ] : [];

  const effectivePrimaryId = (isEdit && f.primaryUserId && !pendingRemoveIds.includes(f.primaryUserId))
    ? f.primaryUserId : null;

  const availableToAdd = (allUsers || []).filter(
    (u: any) => u.role?.toLowerCase() === 'vendor' && !effectiveUsers.find((eu: any) => eu.id === u.id)
  );

  const pi = f.paymentInfo || {};
  const ep = f.emailPrefs  || {};
  const payMethod = pi.method || 'check';

  const setPi = (patch: any) => setF((p: any) => ({ ...p, paymentInfo: { ...p.paymentInfo, ...patch } }));
  const setEp = (patch: any) => setF((p: any) => ({ ...p, emailPrefs:  { ...p.emailPrefs,  ...patch } }));

  const catBtn = (c: any) => {
    const cats = Array.isArray(f.categories) ? f.categories : [];
    const on = cats.includes(c.key);
    return (
      <button key={c.key} type="button"
        style={{ padding: '8px 14px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          border: on ? '2px solid #3B82F6' : '2px solid #2A2A3E',
          background: on ? '#1E3A5F' : '#0D0D1A', color: on ? '#93C5FD' : '#6B7280' }}
        onClick={() => setF((p: any) => {
          const prev = Array.isArray(p.categories) ? [...p.categories] : [];
          return { ...p, categories: prev.includes(c.key) ? prev.filter((k: any) => k !== c.key) : [...prev, c.key] };
        })}>
        {c.icon} {c.label}
      </button>
    );
  };

  const handleSave = () => {
    const missing: string[] = [];
    if (!f.company?.trim()) missing.push('Company Name');
    if (!isEdit) {
      if (linkMode === 'existing') {
        if (!linkUserId) missing.push('a user to link');
      } else {
        if (!f.firstName?.trim()) missing.push('First Name');
        if (!f.lastName?.trim())  missing.push('Last Name');
        if (!f.email?.trim())     missing.push('Email');
        if (!f.cell?.trim())      missing.push('Cell #');
        if (!f.password?.trim())  missing.push('Password');
      }
    }
    if (isEdit && effectiveUsers.length === 0) { missing.push('at least one linked user (vendor cannot receive emails without one)'); }
    if (missing.length) { alert('Please fill in: ' + missing.join(', ')); return; }
    const extra = !isEdit && linkMode === 'existing' ? { link_user_id: linkUserId } : {};
    onSave({ ...f, addUserIds: pendingAddIds, removeUserIds: pendingRemoveIds, ...extra });
  };

  return (
    <div style={S.ov}>
      <div style={{ ...S.modal, maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: '#E5E7EB', fontSize: 20, margin: 0 }}>{isEdit ? '✏️ Edit Recon Vendor' : '🔧 Register Recon Vendor'}</h2>
          <button style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>

        {/* ── Company Info ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <label style={S.fl}>Company Name *
            <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off"
              value={f.company} onChange={(e: any) => setF({ ...f, company: e.target.value })} />
          </label>
          <label style={S.fl}>Office Phone
            <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off" type="tel"
              value={f.officePhone || ''} onChange={(e: any) => setF({ ...f, officePhone: e.target.value })} />
          </label>
          <label style={{ ...S.fl, gridColumn: '1/3' }}>Address
            <input style={{ ...S.fi, fontSize: 16, padding: 10 }}
              value={f.address || ''} onChange={(e: any) => setF({ ...f, address: e.target.value })}
              placeholder="Street, City, State ZIP" />
          </label>
          <label style={{ ...S.fl, gridColumn: '1/3' }}>Payment Department Email
            <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off" type="text"
              placeholder="e.g. billing@vendor.com — always included on payment emails"
              value={ep.paymentDeptEmail || ''}
              onChange={(e: any) => setEp({ paymentDeptEmail: e.target.value })} />
          </label>
        </div>

        {/* ── New vendor only: login account ───────────────────────── */}
        {!isEdit && (
          <div style={{ marginBottom: 12, padding: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              👤 Vendor Login Account
            </div>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['existing', 'new'] as const).map(m => (
                <button key={m} type="button"
                  style={{ flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: linkMode === m ? '1px solid #3B82F6' : '1px solid #2A2A3E',
                    background: linkMode === m ? '#1E3A5F' : 'transparent',
                    color: linkMode === m ? '#93C5FD' : '#6B7280' }}
                  onClick={() => setLinkMode(m)}>
                  {m === 'existing' ? '🔗 Link Existing User' : '➕ Create New Login'}
                </button>
              ))}
            </div>

            {linkMode === 'existing' ? (() => {
              const sel = (allUsers || []).find((u: any) => String(u.id) === linkUserId);
              const otherVendorName = sel?.vendorId
                ? (regVendors || []).find((v: any) => String(v.id) === String(sel.vendorId))?.company || sel.vendorTag
                : null;
              return (
                <>
                  <select style={{ ...S.fi, fontSize: 14, padding: 10, width: '100%' }}
                    value={linkUserId}
                    onChange={(e: any) => setLinkUserId(e.target.value)}>
                    <option value="">— Select a user —</option>
                    {(allUsers || []).filter((u: any) => u.role?.toLowerCase() === 'vendor').map((u: any) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.firstName} {u.lastName} · {u.email}{u.vendorTag ? ` (${u.vendorTag})` : ''}
                      </option>
                    ))}
                  </select>
                  {otherVendorName && (
                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#2D1A00', border: '1px solid #92400E', fontSize: 12, color: '#FBBF24' }}>
                      ⚠️ This user is currently assigned to <strong>{otherVendorName}</strong> — saving will move them to this vendor.
                    </div>
                  )}
                  {sel && !otherVendorName && (
                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#051810', border: '1px solid #065F46', fontSize: 12, color: '#34D399' }}>
                      ✓ {sel.firstName} {sel.lastName} · {sel.email} · {sel.role}
                    </div>
                  )}
                </>
              );
            })() : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={S.fl}>First Name *
                  <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off"
                    value={f.firstName || ''} onChange={(e: any) => setF({ ...f, firstName: e.target.value })} />
                </label>
                <label style={S.fl}>Last Name *
                  <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off"
                    value={f.lastName || ''} onChange={(e: any) => setF({ ...f, lastName: e.target.value })} />
                </label>
                <label style={S.fl}>Cell # *
                  <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off" type="tel"
                    value={f.cell} onChange={(e: any) => setF({ ...f, cell: e.target.value })} />
                </label>
                <label style={S.fl}>Email (Login) *
                  <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="off" type="text"
                    value={f.email} onChange={(e: any) => setF({ ...f, email: e.target.value })} />
                </label>
                <label style={S.fl}>Password *
                  <input style={{ ...S.fi, fontSize: 16, padding: 10 }} autoComplete="new-password" type="password"
                    value={f.password || ''} onChange={(e: any) => setF({ ...f, password: e.target.value })}
                    placeholder="Login password" />
                </label>
              </div>
            )}
          </div>
        )}

        {/* ── Edit: linked users ────────────────────────────────────── */}
        {isEdit && (
          <div style={{ marginBottom: 12, padding: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              👤 Linked Users
            </div>

            {effectiveUsers.length === 0 && (
              <><div style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic', marginBottom: 4 }}>No users assigned to this vendor yet</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginBottom: 8 }}>⚠️ Vendor cannot receive digest or bid emails without a linked user</div></>

            )}

            {effectiveUsers.map((u: any) => {
              const isPrimary = u.id === effectivePrimaryId;
              const isPending = pendingAddIds.includes(u.id);
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', marginBottom: 4,
                  background: isPrimary ? '#0F2940' : '#111122', borderRadius: 6,
                  border: `1px solid ${isPrimary ? '#1E3A5F' : '#1A1A2E'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E5E7EB' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{u.email}{u.cell ? ' • ' + u.cell : ''}{u.role ? ` • ${u.role}` : ''}</div>
                  </div>
                  {isPrimary ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#1E3A5F', color: '#60A5FA', flexShrink: 0 }}>Primary</span>
                  ) : (
                    <button type="button"
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'transparent', border: '1px solid #2A2A3E', color: '#6B7280', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => setF((p: any) => ({ ...p, primaryUserId: u.id }))}>
                      Set Primary
                    </button>
                  )}
                  {isPending && <span style={{ fontSize: 10, color: '#34D399', flexShrink: 0 }}>+new</span>}
                  <button type="button" title="Remove from vendor"
                    style={{ background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', fontSize: 15, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                    onClick={() => {
                      if (isPending) {
                        setPendingAddIds(prev => prev.filter(id => id !== u.id));
                      } else {
                        setPendingRemoveIds(prev => [...prev, u.id]);
                      }
                      if (isPrimary) setF((p: any) => ({ ...p, primaryUserId: null }));
                    }}>✕</button>
                </div>
              );
            })}

            {effectiveUsers.length > 0 && !effectivePrimaryId && (
              <div style={{ fontSize: 12, color: '#FBBF24', background: '#2D1F00', border: '1px solid #78350F', borderRadius: 6, padding: '6px 10px', marginBottom: 6, marginTop: 4 }}>
                ⚠️ No primary contact set — click "Set Primary" on a user above
              </div>
            )}

            {/* Add user picker */}
            {availableToAdd.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <select style={{ ...S.sel, flex: 1, fontSize: 13 }}
                  value={addPickerId}
                  onChange={(e: any) => setAddPickerId(e.target.value)}>
                  <option value="">— Add a user —</option>
                  {availableToAdd.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <button type="button" disabled={!addPickerId}
                  style={{ ...S.btn, padding: '6px 14px', fontSize: 13, opacity: addPickerId ? 1 : 0.4 }}
                  onClick={() => {
                    if (!addPickerId) return;
                    setPendingAddIds(prev => [...prev, addPickerId]);
                    setAddPickerId('');
                  }}>+ Add</button>
              </div>
            )}
          </div>
        )}

        {/* ── Categories ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#E5E7EB', marginBottom: 8 }}>
            Assign to Recon Categories *{' '}
            <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>({(f.categories || []).length} selected)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{VCAT.map(catBtn)}</div>
        </div>

        {/* ── Email CC Preferences (edit only) ─────────────────────── */}
        {isEdit && (
          <div style={{ marginBottom: 12, padding: 12, background: '#0D0D1A', border: '1px solid #2A2A3E', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              📧 Email Notifications
            </div>

            {[
              { key: 'ccPrimaryOnPayments', label: 'CC primary contact on payment emails',              defaultOn: true },
              { key: 'ccPrimaryOnBids',     label: 'CC primary contact on bid assignment notifications', defaultOn: true },
              { key: 'notifyAllOnBids',     label: 'Send bid notifications to all assigned users',       defaultOn: false },
              { key: 'ccAllOnDigest',       label: 'CC all assigned users on weekly payment digest',     defaultOn: false },
            ].map(opt => (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#9CA3AF', marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={ep[opt.key] === undefined ? opt.defaultOn : !!ep[opt.key]}
                  onChange={(e: any) => setEp({ [opt.key]: e.target.checked })} />
                {opt.label}
              </label>
            ))}
          </div>
        )}

        {/* ── Payment Terms ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 12, padding: 12, background: '#0D3B1E', border: '1px solid #166534', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399', marginBottom: 10 }}>💸 Payment Terms *</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { val: 'weekly',     icon: '📅', label: 'Weekly Batch',  sub: 'One check per week' },
              { val: 'completion', icon: '⚡', label: 'On Completion', sub: 'Pay per job' },
            ].map(opt => (
              <button key={opt.val} type="button"
                style={{ padding: 12, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                  border: (f.paymentTerms || 'weekly') === opt.val ? '2px solid #34D399' : '1px solid #2A2A3E',
                  background: (f.paymentTerms || 'weekly') === opt.val ? '#166534' : 'transparent',
                  color: (f.paymentTerms || 'weekly') === opt.val ? '#FFF' : '#9CA3AF' }}
                onClick={() => setF({ ...f, paymentTerms: opt.val })}>
                {opt.icon} {opt.label}
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{opt.sub}</div>
              </button>
            ))}
          </div>
          {(f.paymentTerms || 'weekly') === 'weekly' && (
            <div style={{ background: '#0D0D1A', borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3 }}>Cutoff day</div>
                  <select style={{ ...S.sel, width: '100%', fontSize: 12, padding: 6 }} value={f.cutoffDay || 'Friday'} onChange={(e: any) => setF({ ...f, cutoffDay: e.target.value })}>
                    <option>Thursday</option><option>Friday</option><option>Monday</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3 }}>Cutoff time (AZ)</div>
                  <select style={{ ...S.sel, width: '100%', fontSize: 12, padding: 6 }} value={f.cutoffTime || '5 PM'} onChange={(e: any) => setF({ ...f, cutoffTime: e.target.value })}>
                    <option>9 AM</option><option>12 PM</option><option>5 PM</option><option>6 PM</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 3 }}>Default delivery method</div>
                <select style={{ ...S.sel, width: '100%', fontSize: 12, padding: 6 }} value={f.deliveryMethod || 'USPS Mail'} onChange={(e: any) => setF({ ...f, deliveryMethod: e.target.value })}>
                  <option>USPS Mail</option><option>Handed at PHX</option><option>Handed at Dallas</option><option>FedEx/UPS</option><option>Other</option>
                </select>
              </div>
            </div>
          )}
          {f.paymentTerms === 'completion' && (
            <div style={{ padding: 8, background: '#0D0D1A', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#6EE7B7' }}>⚡ Vendor will be paid per approved job — AP gets an immediate alert when the buyer approves.</div>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#6B7280', fontStyle: 'italic' }}>🔒 Vendor only paid for jobs the buyer has approved.</div>
        </div>

        {/* Payment Details hidden — coming soon */}

        {/* ── Actions ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button style={{ ...S.btn, flex: 1, fontSize: 16, padding: 12 }} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Register Vendor'}
          </button>
          <button style={{ ...S.sm, padding: 12 }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
