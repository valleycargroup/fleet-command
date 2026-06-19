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
}

interface Props {
  onSave: (data: UserFormData) => void;
  onClose: () => void;
  initial?: Partial<UserFormData> & { role?: string };
}

function normalizeRole(r: any): string {
  if (!r) return 'Admin';
  const lc = String(r).toLowerCase();
  if (lc === 'admin') return 'Admin';
  if (lc === 'buyer/seller') return 'Buyer/Seller';
  if (lc === 'buyer') return 'Buyer';
  if (lc === 'seller') return 'Seller';
  return 'Admin';
}

export function AddUserForm({ onSave, onClose, initial }: Props) {
  const isEdit = !!initial;

  const [f, setF] = useState<UserFormData>(() =>
    initial
      ? { ...initial, role: normalizeRole(initial.role), password: '' } as UserFormData
      : { firstName: '', lastName: '', email: '', cell: '', role: 'Admin', location: LOCATIONS[0], password: '' }
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
    <div style={S.ov} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>

        <h2 style={{ color: '#E5E7EB', fontSize: 20, marginBottom: 12 }}>
          {isEdit ? '✏️ Edit User' : '👤 Register User / Admin'}
        </h2>

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
            <input style={fieldStyle} autoComplete="off" name="fc_email_reg" type="text"
              value={f.email} onChange={set('email')} disabled={isEdit} />
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
            </select>
          </label>

          <label style={S.fl}>Location
            <select style={fieldStyle} value={f.location} onChange={set('location')}>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </label>

        </div>

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
