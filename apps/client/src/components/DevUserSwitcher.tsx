import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { API_URL } from '../lib/constants';

function roleColor(u: any): { color: string; bg: string } {
  const r = (u.role || '').toLowerCase().replace(/[_\s]/g, '');
  if (r === 'admin')                          return { color: '#FBBF24', bg: '#1C1500' };
  if (r === 'techsupport')                    return { color: '#A78BFA', bg: '#140D2A' };
  if (u.is_buyer && u.is_seller)              return { color: '#22D3EE', bg: '#081E28' };
  if (r === 'buyer'  || u.is_buyer)           return { color: '#60A5FA', bg: '#0C1828' };
  if (r === 'seller' || u.is_seller)          return { color: '#34D399', bg: '#051810' };
  if (r === 'ap'     || u.is_ap)              return { color: '#F59E0B', bg: '#1C1000' };
  if (r === 'vendor')                         return { color: '#FB923C', bg: '#1C0D00' };
  return { color: '#9CA3AF', bg: '#12122A' };
}

function roleLabel(u: any): string {
  const r = (u.role || '').toLowerCase().replace(/[_\s]/g, '');
  if (r === 'admin')       return 'Admin';
  if (r === 'techsupport') return 'TechSup';
  if (u.is_buyer && u.is_seller) return 'Buy+Sell';
  if (r === 'buyer'  || u.is_buyer)  return 'Buyer';
  if (r === 'seller' || u.is_seller) return 'Seller';
  if (r === 'ap'     || u.is_ap)     return 'AP';
  if (r === 'vendor') return u.vendor_tag ? u.vendor_tag.slice(0, 12) : 'Vendor';
  return u.role || '?';
}

export function DevUserSwitcher() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [devUsers, setDevUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [digestStatus, setDigestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const currentUser = useStore(s => s.currentUser);
  const authToken   = useStore(s => s.authToken);
  const handleLogin = useStore(s => s.handleLogin);
  const showConfirm = useStore((s: any) => s.showConfirm);

  const canTriggerDigest = (() => {
    const r = (currentUser?.role || '').toLowerCase().replace(/[_\s]/g, '');
    return r === 'admin' || r === 'techsupport';
  })();

  function triggerDigest(force: boolean) {
    if (digestBusy) return;
    const modeLabel = force
      ? 'Force All — sends to every vendor with pending work, bypassing the schedule.'
      : 'Live Schedule — only sends to vendors whose isDue=true right now.';
    showConfirm(
      `Mode: ${modeLabel}\n\nThis will send real emails if SendGrid is configured.`,
      () => doTriggerDigest(force),
      'Send Digest Emails?',
      false,
      'Send',
    );
  }

  async function doTriggerDigest(force: boolean) {
    setDigestBusy(true);
    setDigestStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/payments/trigger-digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ force }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDigestStatus({ ok: true, msg: body.message || 'Digest triggered ✓' });
      } else {
        setDigestStatus({ ok: false, msg: body.error || `Error ${res.status}` });
      }
    } catch {
      setDigestStatus({ ok: false, msg: 'Server unreachable' });
    } finally {
      setDigestBusy(false);
      setTimeout(() => setDigestStatus(null), 4000);
    }
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API_URL}/api/dev/users`)
      .then(r => r.json())
      .then(d => setDevUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  async function switchTo(email: string) {
    if (busy) return;
    setBusy(email);
    try {
      const res = await fetch(`${API_URL}/api/dev/switch-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Switch failed: ' + (err.error || res.status));
        setBusy(null);
        return;
      }
      const { token, user } = await res.json();
      handleLogin(user, token);
      window.location.reload();
    } catch (e) {
      alert('Switch failed — is the server running?');
      setBusy(null);
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999, fontFamily: 'system-ui, sans-serif' }}>
      {open && (
        <div style={{
          marginBottom: 8,
          background: '#0D0D1A',
          border: '1px solid #2A2A3E',
          borderRadius: 10,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          width: 280,
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', letterSpacing: '.5px', marginBottom: 8, textTransform: 'uppercase' }}>
            🔀 Dev — Switch User
          </div>
          {loading
            ? <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', padding: 10 }}>Loading…</div>
            : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {devUsers.map(u => {
                  const isCurrent = currentUser?.email === u.email;
                  const isLoading = busy === u.email;
                  const { color, bg } = roleColor(u);
                  return (
                    <button
                      key={u.id}
                      title={u.email}
                      disabled={isCurrent || !!busy}
                      onClick={() => switchTo(u.email)}
                      style={{
                        background: isCurrent ? bg : '#12122A',
                        border: `1px solid ${isCurrent ? color : '#2A2A3E'}`,
                        borderRadius: 6,
                        padding: '5px 4px',
                        cursor: isCurrent ? 'default' : busy ? 'wait' : 'pointer',
                        opacity: busy && !isLoading ? 0.5 : 1,
                        textAlign: 'center',
                        transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? color : '#9CA3AF', letterSpacing: '.2px', wordBreak: 'break-word' }}>
                        {isLoading ? '…' : u.role?.toLowerCase().replace(/[_\s]/g,'') === 'vendor' ? u.first_name : roleLabel(u)}
                      </div>
                      <div style={{ fontSize: 10, color: isCurrent ? color : '#4B5563', marginTop: 1 }}>
                        {u.role?.toLowerCase().replace(/[_\s]/g,'') === 'vendor' ? (u.vendor_name||u.vendor_tag||'Vendor') : u.first_name}
                      </div>
                    </button>
                  );
                })}
              </div>
          }
          {canTriggerDigest && (
            <div style={{ marginTop: 10, borderTop: '1px solid #1A1A2E', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 6 }}>
                📧 Email
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button
                  disabled={digestBusy}
                  onClick={() => triggerDigest(true)}
                  title="Force-sends to all vendors with pending work regardless of schedule"
                  style={{
                    flex: 1,
                    background: digestBusy ? '#0D0D1A' : '#0B1F12',
                    border: '1px solid #14532D',
                    borderRadius: 6,
                    padding: '5px 4px',
                    color: digestBusy ? '#374151' : '#34D399',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: digestBusy ? 'wait' : 'pointer',
                    letterSpacing: '.2px',
                    transition: 'all .15s',
                    lineHeight: 1.3,
                  }}
                >
                  {digestBusy ? '…' : '📧 Force (bypass schedule)'}
                </button>
                <button
                  disabled={digestBusy}
                  onClick={() => triggerDigest(false)}
                  title="Runs the digest but only sends to vendors whose isDue=true right now"
                  style={{
                    flex: 1,
                    background: digestBusy ? '#0D0D1A' : '#0D1020',
                    border: '1px solid #1E3A5F',
                    borderRadius: 6,
                    padding: '5px 4px',
                    color: digestBusy ? '#374151' : '#60A5FA',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: digestBusy ? 'wait' : 'pointer',
                    letterSpacing: '.2px',
                    transition: 'all .15s',
                    lineHeight: 1.3,
                  }}
                >
                  {digestBusy ? '…' : '📧 Run (live schedule)'}
                </button>
              </div>
              {digestStatus && (
                <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, textAlign: 'center', color: digestStatus.ok ? '#34D399' : '#F87171' }}>
                  {digestStatus.msg}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: '#374151', textAlign: 'center' }}>
            {currentUser?.email}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev: switch test user"
        style={{
          background: open ? '#1A1A2E' : '#0D0D1A',
          border: '1px solid ' + (open ? '#4B5563' : '#2A2A3E'),
          borderRadius: 8,
          padding: '6px 12px',
          color: '#6B7280',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '.3px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        🔀 <span style={{ color: '#4B5563' }}>DEV</span>
      </button>
    </div>
  );
}
