import { useState } from 'react';
import { LOCATIONS } from '../lib/constants';
import { S } from '../lib/styles';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  cell: string;
  role: string;
  location: string;
  password: string;
  vendorId?: string;
  makePrimary?: boolean;
}

interface Props {
  onSave: (data: UserFormData) => void;
  onClose: () => void;
  initial?: Partial<UserFormData> & { role?: string; vendorId?: any; id?: any };
  vendorList?: Array<{ id: any; company: string; primaryUserId?: any }>;
  canEditEmail?: boolean;
}

function normalizeRole(r: any): string {
  if (!r) return 'Admin';
  const lc = String(r).toLowerCase();
  if (lc === 'admin') return 'Admin';
  if (lc === 'buyer/seller') return 'Buyer/Seller';
  if (lc === 'buyer') return 'Buyer';
  if (lc === 'seller') return 'Seller';
  if (lc === 'ap') return 'Accounts Payable';
  if (lc === 'techsupport' || lc === 'tech support' || lc === 'tech_support') return 'TechSupport';
  if (lc === 'vendor') return 'Vendor';
  return 'Admin';
}

export function AddUserForm({ onSave, onClose, initial, vendorList, canEditEmail }: Props) {
  const isEdit = !!initial;

  const initVendorId = initial?.vendorId ? String(initial.vendorId) : '';
  const initIsPrimary = !!(initVendorId && vendorList?.find(v => String(v.id) === initVendorId && String(v.primaryUserId) === String(initial?.id)));

  const [f, setF] = useState<UserFormData>(() =>
    initial
      ? { ...initial, role: normalizeRole(initial.role), password: '', vendorId: initVendorId, makePrimary: initIsPrimary } as UserFormData
      : { firstName: '', lastName: '', email: '', cell: '', role: 'Admin', location: LOCATIONS[0], password: '', vendorId: '', makePrimary: false }
  );

  const set = (field: keyof UserFormData) => (e: { target: { value: string } }) =>
    setF(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = () => {
    const missing: string[] = [];
    if (!f.firstName.trim()) missing.push('First Name');
    if (!f.lastName.trim()) missing.push('Last Name');
    if (!f.email.trim()) missing.push('Email');
    if (!f.cell.trim()) missing.push('Cell #');
    if (!isEdit && !f.password.trim()) missing.push('Password');
    if (missing.length) { alert('Please fill in: ' + missing.join(', ')); return; }
    onSave(f);
  };

  const fieldStyle = { ...S.fi, fontSize: 16, padding: 10 };

  return (
    <div style={S.ov}>
      <div style={{ ...S.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ color: '#E5E7EB', fontSize: 20, margin: 0 }}>{isEdit ? '✏️ Edit User' : '👤 Register User / Admin'}</h2>
          <button style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          <label style={S.fl}>First Name *
            <input style={fieldStyle} autoComplete="off" name="fc_first"
              value={f.firstName} onChange={set('firstName')} />
          </label>

          <label style={S.fl}>Last Name *
            <input style={fieldStyle} autoComplete="off" name="fc_last"
              value={f.lastName} onChange={set('lastName')} />
          </label>

          <label style={S.fl}>Email (Username) *
            <input style={{...fieldStyle,...(isEdit&&!canEditEmail?{opacity:0.5,cursor:"not-allowed"}:{})}} autoComplete="off" name="fc_email_reg" type="text"
              value={f.email} onChange={set('email')} disabled={isEdit && !canEditEmail} />
            {isEdit&&canEditEmail&&<span style={{fontSize:10,color:"#F59E0B",marginTop:2}}>⚠️ Changing email changes their login</span>}
          </label>

          <label style={S.fl}>Cell # *
            <input style={fieldStyle} autoComplete="off" name="fc_phone" type="tel"
              value={f.cell} onChange={set('cell')} />
          </label>

          <label style={S.fl}>Password {isEdit ? '(leave blank to keep current)' : '*'}
            <input style={fieldStyle} autoComplete="new-password" name="fc_pw_reg" type="password"
              value={f.password || ''} onChange={set('password')}
              placeholder={isEdit ? 'Leave blank' : 'Login password'} />
          </label>

          <label style={S.fl}>Role
            <select style={fieldStyle} value={f.role} onChange={set('role')}>
              <option>Admin</option>
              <option>Buyer</option>
              <option>Seller</option>
              <option>Buyer/Seller</option>
              <option>Accounts Payable</option>
              <option>TechSupport</option>
              <option>Vendor</option>
            </select>
          </label>

          <label style={S.fl}>Location
            <select style={fieldStyle} value={f.location} onChange={set('location')}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>

        </div>

        {f.role === 'Vendor' && vendorList && vendorList.length > 0 && (
          <div style={{ marginTop: 10, padding: 12, background: '#0D0D1A', borderRadius: 8, border: '1px solid #2A2A3E' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8, letterSpacing: '.5px', textTransform: 'uppercase' }}>Vendor Shop Assignment</div>
            <select style={{ ...fieldStyle, width: '100%' }} value={f.vendorId || ''}
              onChange={e => {
                const newVid = e.target.value;
                const nowPrimary = !!(newVid && vendorList?.find(v => String(v.id) === newVid && String(v.primaryUserId) === String(initial?.id)));
                setF(p => ({ ...p, vendorId: newVid, makePrimary: nowPrimary }));
              }}>
              <option value="">— Unassigned —</option>
              {vendorList.map((v: any) => <option key={v.id} value={String(v.id)}>{v.company}</option>)}
            </select>
            {f.vendorId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!f.makePrimary}
                  onChange={e => setF(p => ({ ...p, makePrimary: e.target.checked }))}
                  style={{ accentColor: '#3B82F6', width: 15, height: 15 }} />
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>Primary contact for this shop</span>
                {initIsPrimary && f.vendorId === initVendorId && (
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#1E3A5F', color: '#60A5FA', fontWeight: 700 }}>current</span>
                )}
              </label>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button style={{ ...S.btn, flex: 1, fontSize: 16, padding: 12 }} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Register User'}
          </button>
          <button style={{ ...S.sm, padding: 12 }} onClick={onClose}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
