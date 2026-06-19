import { APP_URL } from './email';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(x: any): string | null {
  return x && typeof x === 'string' && x.trim() &&
    x.trim().toLowerCase() !== 'null' &&
    x.trim().toLowerCase() !== 'undefined'
    ? x.trim() : null;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const p = d.split('-');
  return p.length === 3 ? `${p[1]}/${p[2]}/${p[0].slice(2)}` : d;
}

function vLink(id: any, cat?: string): string {
  return `${APP_URL}?vehicle=${id}${cat ? '&cat=' + cat : ''}`;
}

function vBlock(v: any): string {
  const soldTo  = clean(v.soldTo) || clean(v.sold_to);
  const soldDate = clean(v.soldDate) || clean(v.sale_date);
  const trim    = clean(v.trim) || '';
  const color   = clean(v.color) || '—';
  const location = clean(v.location) || '—';
  const vinLabel = clean(v.vin8) || clean(v.stock_number) || '—';
  return `<div style="padding:12px 16px;background:#0D0D1A;border-radius:8px;border:1px solid #2A2A3E;margin-bottom:20px"><b style="color:#FFF;font-size:16px">${v.year || ''} ${v.make || ''} ${v.model || ''} ${trim}</b><br><span style="font-size:14px;color:#9CA3AF">VIN: ${vinLabel} • ${color} • ${(v.miles || 0).toLocaleString()} mi • ${location}</span>${soldTo ? `<br><span style="color:#34D399;font-weight:600">Sold to: ${soldTo}${soldDate ? ' — ' + fmtDate(soldDate) : ''}</span>` : ''}</div>`;
}

function cta(text: string, id: any, bg: string, tc: string, cat?: string): string {
  return `<div style="text-align:center;margin-top:24px"><a href="${vLink(id, cat)}" style="display:inline-block;padding:14px 44px;background:${bg};color:${tc};font-size:16px;font-weight:700;border-radius:10px;text-decoration:none;font-family:'DM Sans',sans-serif">${text}</a><div style="font-size:12px;color:#6B7280;margin-top:8px">Opens directly in Fleet Command</div></div>`;
}

function soldBnr(v: any): string {
  const soldTo = clean(v.soldTo) || clean(v.sold_to);
  return soldTo ? `<div style="background:#7F1D1D;padding:10px 28px;text-align:center;font-size:14px;font-weight:700;color:#FCA5A5;letter-spacing:1px">🔴 SOLD VEHICLE — Priority</div>` : '';
}

function wsrt(ct: string): string {
  const w = (ct || 'ws') === 'ws';
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:${w ? '#1E3A5F' : '#78590A'};color:${w ? '#93C5FD' : '#FDE68A'}">${w ? 'WS' : 'RT'}</span>`;
}

function liRow(li: any, bc: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;border-left:3px solid ${bc || '#3B82F6'}"><span style="font-size:14px;color:#E5E7EB">${li.desc} ${wsrt(li.costType)}${li.isPart ? ' <span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:#4C1D95;color:#DDD6FE">PART</span>' : ''}</span><span style="font-size:15px;font-weight:700;color:#E5E7EB">$${li.price || 0}</span></div>`;
}

function totBar(l: string, a: number, bg: string, tc: string): string {
  return `<div style="display:flex;justify-content:space-between;padding:14px;background:${bg};border-radius:8px;margin-top:10px"><span style="font-size:14px;font-weight:700;color:${tc}">${l}</span><span style="font-size:20px;font-weight:700;color:#FFF">$${(a || 0).toLocaleString()}</span></div>`;
}

function shell(hBg: string, bBg: string, bC: string, bBd: string, bI: string, bT: string, body: string, extra?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans',sans-serif;background:#0A0A14;color:#E5E7EB;min-height:100vh;display:flex;justify-content:center;padding:20px}.email{max-width:600px;width:100%;background:#12121E;border-radius:16px;overflow:hidden;border:1px solid #2A2A3E}</style></head><body><div class="email"><div style="background:linear-gradient(135deg,${hBg} 0%,#0D0D1A 100%);padding:28px;text-align:center"><div style="font-size:26px;font-weight:700;color:#FFF">Fleet<span style="color:#3B82F6">Command</span></div><div style="display:inline-block;margin-top:12px;padding:8px 22px;border-radius:20px;font-size:15px;font-weight:700;background:${bBg};color:${bC};border:2px solid ${bBd}">${bI} ${bT}</div></div>${extra || ''}<div style="padding:28px">${body}</div><div style="padding:20px 28px;background:#0A0A14;text-align:center;border-top:1px solid #2A2A3E"><div style="font-size:12px;color:#4B5563;line-height:1.6">Valley Car Group — PHX &bull; Dallas</div></div></div></body></html>`;
}

function dRow(v: any, rHtml: string, bc: string): string {
  return `<a href="${vLink(v.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;text-decoration:none;border-left:3px solid ${bc || '#3B82F6'}"><div><b style="color:#FFF;font-size:13px">${v.year} ${v.make} ${v.model}</b><br><span style="font-size:11px;color:#6B7280">VIN: ${v.vin8 || v.stock_number}${v.soldTo || v.sold_to ? ' • Sold to: ' + (v.soldTo || v.sold_to) : ''}</span></div><div style="text-align:right">${rHtml}</div></a>`;
}

function dSec(t: string, c: string, n: number, rows: string): string {
  if (!rows) return '';
  return `<div style="margin-bottom:22px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:13px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:1px">${t}</span><span style="font-size:10px;padding:3px 10px;border-radius:10px;font-weight:600;background:${c}22;color:${c}">${n}</span></div>${rows}</div>`;
}

function dTag(t: string, bg: string, c: string): string {
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;background:${bg};color:${c}">${t}</span>`;
}

function partyBlock(d: any): string {
  const buyer   = clean(d.buyer) || clean(d.vehicle?.buyingBroker);
  const seller  = clean(d.seller) || clean(d.vehicle?.sellingBroker);
  const soldTo  = clean(d.vehicle?.soldTo) || clean(d.vehicle?.sold_to) || clean(d.dealer);
  const soldDate = clean(d.vehicle?.soldDate) || clean(d.vehicle?.sale_date);
  const sameBS  = buyer && seller && buyer.toLowerCase() === seller.toLowerCase();

  const row = (label: string, value: string, vc?: string) =>
    `<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1E1E32">${label}</td><td style="padding:8px 0;text-align:right;color:${vc || '#E5E7EB'};font-size:14px;font-weight:700;border-bottom:1px solid #1E1E32">${value}</td></tr>`;
  const lastRow = (label: string, value: string, vc?: string) =>
    `<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px">${label}</td><td style="padding:8px 0;text-align:right;color:${vc || '#E5E7EB'};font-size:14px;font-weight:700">${value}</td></tr>`;

  const rows: { label: string; value: string; color?: string }[] = [];
  if (sameBS) {
    rows.push({ label: 'Buyer / Seller', value: buyer!, color: '#E5E7EB' });
  } else {
    if (buyer) rows.push({ label: 'Buyer', value: buyer, color: '#E5E7EB' });
    if (seller) rows.push({ label: 'Seller', value: seller, color: '#E5E7EB' });
  }
  if (soldTo)   rows.push({ label: 'Sold to',   value: soldTo,           color: '#34D399' });
  if (soldDate) rows.push({ label: 'Sale Date', value: fmtDate(soldDate), color: '#6EE7B7' });
  if (rows.length === 0) return '';

  const trs = rows.map((r, i) =>
    i === rows.length - 1 ? lastRow(r.label, r.value, r.color) : row(r.label, r.value, r.color)
  ).join('');
  return `<div style="background:#0D0D1A;border:1px solid #2A2A3E;border-radius:10px;padding:14px 16px;margin-bottom:16px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${trs}</table></div>`;
}

function contactBlock(contact: any, seller?: string): string {
  if (!contact?.name) return '';
  const sellerName = clean(seller);

  const row = (label: string, value: string, vc?: string) =>
    `<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1E1E32">${label}</td><td style="padding:8px 0;text-align:right;color:${vc || '#E5E7EB'};font-size:14px;font-weight:700;border-bottom:1px solid #1E1E32;word-break:keep-all;overflow-wrap:anywhere">${value}</td></tr>`;
  const lastRow = (label: string, value: string, vc?: string) =>
    `<tr><td style="padding:8px 0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:1px">${label}</td><td style="padding:8px 0;text-align:right;color:${vc || '#E5E7EB'};font-size:14px;font-weight:700;word-break:keep-all;overflow-wrap:anywhere">${value}</td></tr>`;

  const rows: string[] = [];
  rows.push(row('Buyer', contact.name, '#93C5FD'));
  if (contact.phone) rows.push(row('Buyer phone', `<a href="tel:${contact.phone.replace(/[^0-9+]/g, '')}" style="color:#E5E7EB;text-decoration:none">${contact.phone}</a>`));
  if (contact.email) rows.push(row('Buyer email', `<a href="mailto:${contact.email}" style="color:#93C5FD;text-decoration:none">${contact.email}</a>`));
  if (sellerName) {
    rows.push(lastRow('Seller', sellerName, '#FCD34D'));
  } else if (rows.length > 0) {
    rows[rows.length - 1] = rows[rows.length - 1].replace('border-bottom:1px solid #1E1E32"', '"');
  }
  return `<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-bottom:20px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:12px">Deal contacts</div><table style="width:100%;border-collapse:collapse">${rows.join('')}</table></div>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type EmailTemplate = (d: any) => { subject: string; html: string } | null;

export const TEMPLATES: Record<string, EmailTemplate> = {

  vendor_assigned: (d) => {
    const orderInfo = d.reconOrder
      ? `<div style="padding:14px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-bottom:16px;text-align:center"><div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Recon Order</div><div style="font-size:28px;font-weight:800;color:#3B82F6">#${d.reconOrder} <span style="font-size:14px;font-weight:400;color:#6B7280">of ${d.totalReconSteps || '?'}</span></div>${(d.aheadTasks || []).length > 0 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #2A2A3E"><div style="font-size:11px;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">⏳ Ahead of You</div>${d.aheadTasks.map((a: any) => `<div style="font-size:13px;color:#E5E7EB;padding:4px 0">#${a.order} ${a.name} — <span style="color:${a.status === 'complete' ? '#34D399' : a.status === 'started' ? '#FBBF24' : '#6B7280'}">${a.status === 'complete' ? '✅ Done' : a.status === 'started' ? '🔧 In Progress' : '⏳ Pending'}</span></div>`).join('')}</div>` : `<div style="margin-top:6px;font-size:13px;color:#34D399;font-weight:600">🥇 You're first in line!</div>`}</div>`
      : '';
    const groundBanner = d.isGrounded
      ? `<div style="background:#0D3B1E;padding:12px 28px;text-align:center;font-size:15px;font-weight:700;color:#34D399;letter-spacing:1px;border-bottom:1px solid #166534">✅ VEHICLE ON GROUND — Ready for Work${d.groundedDate ? ' — ' + fmtDate(d.groundedDate) : ''}</div>`
      : '';
    return {
      subject: `🔧 New Job Assigned — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.category}`,
      html: shell('#1E3A5F', '#1E3A5F', '#93C5FD', '#3B82F6', '🔧', 'New Job Assigned',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">You've been assigned a new <b style="color:#93C5FD">${d.category}</b> job. Review and submit your bid.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller || d.vehicle?.sellingBroker)}${orderInfo}<div style="font-size:11px;color:#F59E0B;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">🛠️ Tasks to Bid</div>${(d.tasks || []).map((t: any) => `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1A1A2E;border-radius:8px;margin-bottom:6px;font-size:14px;color:#E5E7EB;border-left:3px solid #3B82F6">🔧 ${t.desc}${t.isPart ? ' (Part Needed)' : ''}</div>`).join('')}${cta('View Job & Submit Bid →', d.vehicle.id, '#3B82F6', '#FFF', d.categoryKey)}`,
        groundBanner + soldBnr(d.vehicle)),
    };
  },

  vendor_bid_accepted: (d) => ({
    subject: `✅ Bid Accepted — Start Work — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Bid Accepted — Start Work',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your bid has been accepted. Begin work immediately.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller || d.vehicle?.sellingBroker)}<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">✅ Approved Line Items</div>${(d.lineItems || []).map((li: any) => liRow(li, '#166534')).join('')}${totBar('Total Approved', d.totalApproved, '#166534', '#D1FAE5')}${cta('Open Job in Fleet Command →', d.vehicle.id, '#34D399', '#0D0D1A', d.categoryKey)}`,
      soldBnr(d.vehicle)),
  }),

  vendor_bid_declined: (d) => ({
    subject: `❌ Bid Declined — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '❌', 'Bid Declined',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your bid has been declined. No further action needed.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller || d.vehicle?.sellingBroker)}${d.reason ? `<div style="padding:14px;background:#3B1515;border:1px solid #7F1D1D;border-radius:8px"><div style="font-size:12px;color:#FCA5A5;font-weight:700;margin-bottom:4px">Reason</div><div style="font-size:14px;color:#FDBA74">${d.reason}</div></div>` : ''}`),
  }),

  vendor_work_canceled: (d) => {
    const activeCount = (d.lineItems || []).filter((li: any) => li.price > 0).length;
    const cancelCount = (d.lineItems || []).filter((li: any) => li.price === 0).length;
    const allCanceled = activeCount === 0;
    const hdrColor  = allCanceled ? '#3B1515' : '#3B2F10';
    const hdrBorder = allCanceled ? '#7F1D1D' : '#78590A';
    const hdrText   = allCanceled ? '#FCA5A5' : '#FDE68A';
    const hdrAccent = allCanceled ? '#EF4444' : '#F59E0B';
    const hdrIcon   = allCanceled ? '❌' : '⚠️';
    const hdrLabel  = allCanceled ? 'All work canceled' : `Work updated — ${cancelCount} item${cancelCount > 1 ? 's' : ''} canceled`;
    const bodyMsg   = allCanceled
      ? `All work has been canceled on this vehicle. <b style="color:#FCA5A5">No further action needed.</b>`
      : `${cancelCount} item${cancelCount > 1 ? 's have' : ' has'} been canceled. You still have <b style="color:#34D399">${activeCount} active task${activeCount > 1 ? 's' : ''}</b> remaining.`;
    return {
      subject: `${allCanceled ? '❌ All Work Canceled' : `⚠️ Work Updated — ${cancelCount} Item${cancelCount > 1 ? 's' : ''} Canceled`} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
      html: shell(hdrColor, hdrBorder, hdrText, hdrAccent, hdrIcon, hdrLabel,
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${bodyMsg}</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller || d.vehicle?.sellingBroker)}${activeCount > 0 ? `<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">✅ Active — continue work</div>${(d.lineItems || []).filter((li: any) => li.price > 0).map((li: any) => liRow(li, '#166534')).join('')}` : ''}<div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:16px 0 8px">❌ Canceled</div>${(d.lineItems || []).filter((li: any) => li.price === 0).map((li: any) => liRow(li, '#7F1D1D')).join('')}${totBar(allCanceled ? 'Total' : 'Remaining total', d.totalRemaining || 0, allCanceled ? '#7F1D1D' : '#166534', allCanceled ? '#FCA5A5' : '#D1FAE5')}${activeCount > 0 ? cta('View remaining work →', d.vehicle.id, '#F59E0B', '#0D0D1A') : ''}`),
    };
  },

  vendor_part_approved: (d) => ({
    subject: `📦 Part Approved — ${d.part.desc} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#1E3A5F', '#1E3A5F', '#93C5FD', '#3B82F6', '📦', 'Part Approved — Order Now',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor.name},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part has been approved. Order ASAP.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller || d.vehicle?.sellingBroker)}<div style="background:#0D0D1A;border-radius:12px;border:2px solid #3B82F6;padding:20px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:20px;font-weight:700;color:#FFF">${d.part.desc}</span><span style="font-size:22px;font-weight:700;color:#FBBF24">$${d.part.price}</span></div><div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#0D3B1E;border-radius:8px;border:1px solid #166534"><span style="font-size:20px">✅</span><div><div style="font-size:15px;font-weight:600;color:#34D399">Approved by ${d.part.approvedBy || 'Buyer'}</div><div style="font-size:12px;color:#6EE7B7">${fmtDate(d.part.approvedDate)}</div></div></div></div>${cta('Open Job & Mark Ordered →', d.vehicle.id, '#3B82F6', '#FFF', d.categoryKey)}`,
      soldBnr(d.vehicle)),
  }),

  vendor_work_started: (d) => ({
    subject: `🔧 Work Started — ${d.vendor.name} — ${d.category} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '🔧', 'Work Started',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> has started work on <b style="color:#93C5FD">${d.category}</b>.</div>${vBlock(d.vehicle)}${(d.lineItems || []).map((li: any) => liRow(li, '#78590A')).join('')}${totBar('Approved Total', d.totalApproved, '#78590A', '#FDE68A')}<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;margin-top:16px;text-align:center"><div style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">Started</div><div style="font-size:18px;font-weight:700;color:#FBBF24">${fmtDate(d.startedDate)}</div>${d.etaComplete ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">ETA Complete: <b style="color:#60A5FA">${fmtDate(d.etaComplete)}</b></div>` : ''}</div>${cta('View Progress →', d.vehicle.id, '#F59E0B', '#0D0D1A')}`,
      soldBnr(d.vehicle)),
  }),

  buyer_bid_submitted: (d) => {
    const ws = (d.lineItems || []).filter((l: any) => l.costType === 'ws').reduce((s: number, l: any) => s + (l.price || 0), 0);
    const rt = (d.lineItems || []).filter((l: any) => l.costType !== 'ws').reduce((s: number, l: any) => s + (l.price || 0), 0);
    return {
      subject: `📩 Bid Submitted — ${d.vendor.name} — $${d.totalBid || 0} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
      html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '📩', 'Vendor Bid Submitted',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> submitted a bid for <b style="color:#93C5FD">${d.category}</b>.</div>${vBlock(d.vehicle)}<div style="padding:14px;background:#0D0D1A;border-radius:10px 10px 0 0;border:1px solid #2A2A3E;border-bottom:none;display:flex;justify-content:space-between;align-items:center"><span style="font-size:16px;font-weight:700;color:#FFF">🔧 ${d.vendor.name}</span><span style="font-size:18px;font-weight:700;color:#FBBF24">$${d.totalBid || 0}</span></div><div style="border:1px solid #2A2A3E;border-top:none;border-radius:0 0 10px 10px;padding:10px">${(d.lineItems || []).map((li: any) => liRow(li, '#78590A')).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><div style="text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase">WS</div><div style="font-size:18px;font-weight:700;color:#93C5FD">$${ws}</div></div><div style="text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase">RT</div><div style="font-size:18px;font-weight:700;color:#FDE68A">$${rt}</div></div></div>${cta('Review & Accept/Decline →', d.vehicle.id, '#F59E0B', '#0D0D1A', d.categoryKey)}`,
        soldBnr(d.vehicle)),
    };
  },

  buyer_vendor_declined: (d) => ({
    subject: `❌ Vendor Declined — ${d.vendor.name} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '❌', 'Vendor Declined Job',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FCA5A5">${d.vendor.name}</b> declined the <b>${d.category}</b> job. Reassign to another vendor.</div>${vBlock(d.vehicle)}${d.reason ? `<div style="padding:14px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:16px;text-align:center"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;font-weight:700;margin-bottom:4px">Reason</div><div style="font-size:15px;color:#FDBA74">"${d.reason}"</div></div>` : ''}${cta('Reassign Vendor →', d.vehicle.id, '#EF4444', '#FFF', d.categoryKey)}`,
      soldBnr(d.vehicle)),
  }),

  buyer_work_complete: (d) => ({
    subject: `⚠️ ACTION NEEDED — Approve Payment — ${d.vendor.name} — ${d.category} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '⚠️', 'Work Complete — Approval Needed',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px"><b style="color:#FDE68A">${d.vendor.name}</b> marked <b>${d.category}</b> complete. <b style="color:#FDE68A">Review and approve for payment</b> — accounting cannot cut a check until you approve.</div>${vBlock(d.vehicle)}${(d.lineItems || []).map((li: any) => liRow(li, '#78590A')).join('')}${totBar('Total to Approve', d.totalCost, '#78590A', '#FDE68A')}<div style="padding:14px;background:#3B2F10;border:2px solid #F59E0B;border-radius:10px;margin-bottom:16px;text-align:center"><div style="font-size:13px;color:#FDE68A;font-weight:700">⚠️ APPROVAL REQUIRED TO RELEASE PAYMENT</div><div style="font-size:11px;color:#FBBF24;margin-top:4px">Click below to review the finished work and approve or dispute.</div></div>${cta('Review & Approve →', d.vehicle.id, '#F59E0B', '#0D0D1A', d.categoryKey)}`,
      soldBnr(d.vehicle)),
  }),

  buyer_recon_complete: (d) => {
    const role  = d.recipientRole || 'other';
    const greet = role === 'seller' ? (clean(d.seller) || clean(d.buyer) || 'Team') : (clean(d.buyer) || clean(d.seller) || 'Team');
    const msg   = role === 'seller' ? 'A vehicle you sold has finished recon. Ready for transport.'
      : role === 'buyer' ? 'Your vehicle has finished recon. Ready for transport.'
      : 'All recon tasks are complete. Ready for transport.';
    return {
      subject: `✅ All Recon Complete — Ready to Ship — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
      html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'All Recon Done — Ready to Ship',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">✅ Completed Tasks</div>${(d.reconSummary || []).map((r: any) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;border-left:3px solid #166534"><div><div style="font-size:13px;color:#E5E7EB">${r.icon || '🔧'} ${r.category}</div><div style="font-size:11px;color:#6B7280">${r.vendor}</div></div><div style="font-size:14px;font-weight:700;color:#34D399">$${r.cost || 0}</div></div>`).join('')}${totBar('Total Recon Cost', d.totalReconCost, '#166534', '#D1FAE5')}${cta('Set Up Transport →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
    };
  },

  buyer_vehicle_kicked: (d) => ({
    subject: `🔄 URGENT — Vehicle Kicked — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.kickedBy}`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '🔄', 'Vehicle Kicked Back',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A vehicle has been kicked back. Immediate attention needed.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:20px"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔴 Reason</div><div style="font-size:16px;font-weight:600;color:#FDBA74">${d.kickReason}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Kicked by: ${d.kickedBy} • ${fmtDate(d.kickDate)}</div></div><div style="padding:14px;background:#3B2F10;border:1px solid #78590A;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:700;color:#FDE68A">📍 Back in Inventory — ${d.vehicle.location}</div></div>${cta('View Vehicle →', d.vehicle.id, '#EF4444', '#FFF')}`),
  }),

  buyer_approved_shipping: (d) => ({
    subject: `✅ Shipping Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.dealer}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Shipping Approved',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Shipping has been approved. Ready to set up outbound transport.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:14px;color:#6EE7B7;text-transform:uppercase;letter-spacing:2px;font-weight:700">Ready to Ship</div><div style="font-size:22px;font-weight:700;color:#34D399;margin-top:4px">${d.dealer || 'Buyer'}</div><div style="font-size:13px;color:#6EE7B7;margin-top:4px">Approved: ${fmtDate(d.approvedDate)}</div></div>${cta('Set Up Transport →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
  }),

  shipping_hold: (d) => ({
    subject: `🛑 SHIPPING ON HOLD — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '🛑', 'Shipping On Hold',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Shipping has been put on hold for this vehicle.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">🛑</div><div style="font-size:18px;font-weight:700;color:#FCA5A5">SHIPPING ON HOLD</div><div style="font-size:14px;color:#FDBA74;margin-top:8px">${d.reason || 'Buyer unapproved shipping'}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Held by: ${d.holdBy || 'Buyer'} • ${fmtDate(d.holdDate)}</div></div>${cta('View Vehicle →', d.vehicle.id, '#EF4444', '#FFF')}`),
  }),

  vehicle_grounded: (d) => {
    const role  = d.recipientRole || 'other';
    const greet = role === 'seller' ? (clean(d.seller) || clean(d.buyer) || 'Team') : (clean(d.buyer) || clean(d.seller) || 'Team');
    const msg   = role === 'seller' ? 'A vehicle you sold is on the ground and ready for work.'
      : role === 'buyer' ? 'Your vehicle is on the ground and ready for work.'
      : 'Vehicle is on the ground and ready for action.';
    return {
      subject: `📍 GROUNDED — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.location}`,
      html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '📍', 'GROUNDED',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">📍</div><div style="font-size:24px;font-weight:700;color:#34D399">GROUNDED — ${d.location}</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.groundedDate)}</div></div>${cta('Open Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
    };
  },

  transport_inbound_set: (d) => ({
    subject: `🚛 Inbound Transport Set — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ETA ${fmtDate(d.transport?.eta)}`,
    html: shell('#1E3A5F', '#1E3A5F', '#93C5FD', '#3B82F6', '🚛', 'Inbound Transport Set',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Inbound transport has been arranged. Vehicle is on the way.</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:20px;background:#1E3A5F;border:2px solid #3B82F6;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:#93C5FD;text-transform:uppercase;letter-spacing:2px;font-weight:700">ETA Arrival</div><div style="font-size:28px;font-weight:700;color:#FFF;margin-top:4px">${fmtDate(d.transport?.eta)}</div><div style="font-size:14px;color:#93C5FD;margin-top:4px">→ ${d.transport?.destination || 'TBD'}</div></div><div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport Details</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.company || '—'}</b></div><div>Phone<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.phone || '—'}</b></div><div>Email<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.email || '—'}</b></div><div>Cost<br><b style="color:#FBBF24;font-size:14px">${d.transport?.cost ? '$' + d.transport.cost : '—'}</b></div></div></div>${cta('View Vehicle →', d.vehicle.id, '#3B82F6', '#FFF')}`),
  }),

  driveway_inbound_pickedup: (d) => ({
    subject: `🏠 Driveway Picked Up — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.destination}`,
    html: shell('#4C1D95', '#4C1D95', '#DDD6FE', '#7C3AED', '🏠', 'Driveway — Picked Up',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway buy has been picked up and is headed to <b style="color:#DDD6FE">${d.destination}</b>.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#4C1D95;border:2px solid #7C3AED;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">🏠</div><div style="font-size:18px;font-weight:700;color:#DDD6FE">PICKED UP</div><div style="font-size:14px;color:#C4B5FD;margin-top:4px">${d.dwCompany || 'Transport'} • ${fmtDate(d.pickedUpDate)}</div><div style="font-size:16px;font-weight:700;color:#FFF;margin-top:8px">→ ${d.destination}</div></div>${cta('Track Vehicle →', d.vehicle.id, '#7C3AED', '#FFF')}`),
  }),

  driveway_outbound_shipped: (d) => ({
    subject: `🏠 Driveway Shipped — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.destination}`,
    html: shell('#4C1D95', '#4C1D95', '#DDD6FE', '#7C3AED', '🏠', 'Driveway — Shipped',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway delivery has been picked up and shipped to <b style="color:#DDD6FE">${d.destination || d.dealer}</b>.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#4C1D95;border:2px solid #7C3AED;border-radius:12px;text-align:center"><div style="font-size:36px;margin-bottom:6px">🚛</div><div style="font-size:18px;font-weight:700;color:#DDD6FE">SHIPPED — DRIVEWAY</div><div style="font-size:16px;font-weight:700;color:#FFF;margin-top:8px">→ ${d.destination || d.dealer}</div></div>${cta('Track Vehicle →', d.vehicle.id, '#7C3AED', '#FFF')}`),
  }),

  driveway_outbound_delivered: (d) => ({
    subject: `✅ Driveway Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Driveway — Delivered',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Driveway delivery has been completed to <b style="color:#34D399">${d.destination || d.dealer}</b>.</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">DELIVERED</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.deliveredDate)}</div></div>${cta('View Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
  }),

  retail_vehicle_shipped: (d) => ({
    subject: `🚛 Retail Delivery Shipped — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} → ${d.customerName}`,
    html: shell('#164E63', '#164E63', '#67E8F9', '#06B6D4', '🚛', 'Retail Delivery Shipped',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Retail delivery is on the way to the customer.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#164E63;border:2px solid #06B6D4;border-radius:12px;margin-bottom:16px"><div style="font-size:11px;color:#67E8F9;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Customer</div><div style="font-size:18px;font-weight:700;color:#FFF">${d.customerName || '—'}</div><div style="font-size:13px;color:#67E8F9;margin-top:4px">${d.customerPhone || ''} • ${d.customerEmail || ''}</div><div style="font-size:13px;color:#67E8F9;margin-top:2px">📍 ${d.deliveryAddress || '—'}</div></div>${d.transport ? `<div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${d.transport.company || '—'}</b></div><div>ETA<br><b style="color:#67E8F9;font-size:14px">${fmtDate(d.transport.eta)}</b></div></div></div>` : ''}<div style="font-size:13px;color:#6B7280;margin-top:12px;text-align:center">Picked up: ${fmtDate(d.pickedUpDate)}</div>${cta('View Vehicle →', d.vehicle.id, '#06B6D4', '#FFF')}`),
  }),

  retail_vehicle_delivered: (d) => ({
    subject: `✅ Retail Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.customerName}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Retail Delivery Complete',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Retail delivery has been completed.</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">DELIVERED TO CUSTOMER</div><div style="font-size:16px;font-weight:600;color:#6EE7B7;margin-top:6px">${d.customerName || 'Customer'}</div><div style="font-size:13px;color:#6EE7B7;margin-top:2px">📍 ${d.deliveryAddress || '—'}</div><div style="font-size:14px;color:#6EE7B7;margin-top:8px">${fmtDate(d.deliveredDate)}</div></div>${cta('View Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
  }),

  seller_vehicle_sold: (d) => {
    const role  = d.recipientRole || 'other';
    const greet = role === 'seller' ? (clean(d.seller) || clean(d.buyer) || 'Team') : (clean(d.buyer) || clean(d.seller) || 'Team');
    const dealer = clean(d.vehicle.soldTo) || '—';
    const msg   = role === 'seller' ? `You sold this vehicle to <b style="color:#6EE7B7">${dealer}</b>.`
      : role === 'buyer' ? `Your vehicle sold to <b style="color:#6EE7B7">${dealer}</b>.`
      : 'This vehicle has been sold.';
    return {
      subject: `💰 Vehicle Sold — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.vehicle.soldTo}`,
      html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '💰', 'Vehicle Sold',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px;text-align:center"><div style="font-size:20px;font-weight:700;color:#34D399">Sold to: ${d.vehicle.soldTo}</div><div style="font-size:14px;color:#6EE7B7;margin-top:4px">Sale Date: ${fmtDate(d.vehicle.soldDate)}</div></div>${cta('View Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
    };
  },

  seller_vehicle_kicked: (d) => {
    const role  = d.recipientRole || 'other';
    const greet = role === 'seller' ? (clean(d.seller) || clean(d.buyer) || 'Team') : (clean(d.buyer) || clean(d.seller) || 'Team');
    const msg   = role === 'seller' ? 'A vehicle you sold has been kicked back and is returning to inventory.'
      : role === 'buyer' ? 'Your vehicle has been kicked back and is returning to inventory.'
      : 'A vehicle has been kicked back and is returning to inventory.';
    return {
      subject: `🔄 Vehicle Kicked — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.kickedBy}`,
      html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '🔄', 'Vehicle Kicked Back',
        `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${greet},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${msg}</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#3B1515;border:2px solid #7F1D1D;border-radius:10px;margin-bottom:20px"><div style="font-size:11px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔴 Reason</div><div style="font-size:16px;font-weight:600;color:#FDBA74">${d.kickReason || '—'}</div><div style="font-size:12px;color:#6B7280;margin-top:6px">Kicked by: ${d.kickedBy || '—'}${d.kickDate ? ' • ' + fmtDate(d.kickDate) : ''}</div></div><div style="padding:14px;background:#3B2F10;border:1px solid #78590A;border-radius:10px;text-align:center"><div style="font-size:15px;font-weight:700;color:#FDE68A">📍 Back in Inventory — ${d.vehicle.location || '—'}</div></div>${cta('View Vehicle →', d.vehicle.id, '#EF4444', '#FFF')}`),
    };
  },

  seller_progress: (d) => ({
    subject: `📋 Update — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.statusText}`,
    html: shell('#1E3A5F', '#1E3A5F', '#93C5FD', '#3B82F6', '📋', d.statusText,
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.seller},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Update on a vehicle you sold:</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E"><div style="font-size:13px;font-weight:700;color:#93C5FD;margin-bottom:8px">📋 STATUS</div><div style="font-size:16px;font-weight:700;color:#FFF">${d.statusText}</div>${d.detail ? `<div style="font-size:13px;color:#9CA3AF;margin-top:4px">${d.detail}</div>` : ''}</div>${cta('View Vehicle →', d.vehicle.id, '#3B82F6', '#FFF')}`),
  }),

  dealer_vehicle_shipped: (d) => ({
    subject: `🚛 Vehicle Shipped — ETA ${fmtDate(d.transport?.eta)} — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '🚛', 'Your Vehicle Has Shipped',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.dealer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your vehicle is on its way.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:20px"><div style="font-size:12px;color:#6EE7B7;text-transform:uppercase;letter-spacing:2px;font-weight:700">Estimated Arrival</div><div style="font-size:28px;font-weight:700;color:#34D399;margin-top:4px">${fmtDate(d.transport?.eta)}</div></div><div style="background:#0D0D1A;border-radius:10px;border:1px solid #2A2A3E;padding:16px"><div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">🚛 Transport</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#6B7280"><div>Company<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.company || '—'}</b></div><div>Phone<br><b style="color:#E5E7EB;font-size:14px">${d.transport?.phone || '—'}</b></div></div></div><div style="font-size:13px;color:#6B7280;margin-top:12px;text-align:center">Picked up: ${fmtDate(d.pickedUpDate)}</div>`),
  }),

  dealer_vehicle_delivered: (d) => ({
    subject: `✅ Vehicle Delivered — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Vehicle Delivered',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.dealer},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your vehicle has been delivered. Thank you!</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">Delivered Successfully</div><div style="font-size:14px;color:#6EE7B7;margin-top:6px">${fmtDate(d.deliveredDate)}</div></div>`),
  }),

  parts_request_to_pm: (d) => ({
    subject: `📦 Parts Request — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.partCount} parts`,
    html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '📦', 'New Parts Request',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.partsManager || 'Parts Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Vendor <b style="color:#FDE68A">${d.vendor?.name || '—'}</b> has flagged parts needed on this vehicle. Please source and quote each part.</div>${vBlock(d.vehicle)}${partyBlock(d)}<div style="padding:16px;background:#3B2F10;border:2px solid #78590A;border-radius:10px;margin-bottom:16px"><div style="font-size:11px;color:#FBBF24;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Parts needed (${d.partCount || 0})</div>${(d.parts || []).map((p: any) => `<div style="padding:10px;background:#0D0D1A;border-radius:8px;border-left:3px solid #FBBF24;margin-bottom:6px"><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div></div>`).join('')}</div>${cta('Quote Parts →', d.vehicle.id, '#F59E0B', '#0D0D1A')}`),
  }),

  parts_quoted_to_buyer: (d) => ({
    subject: `💰 Parts Quoted — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — $${(d.totalQuote || 0).toLocaleString()}`,
    html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '💰', 'Parts Quote Ready',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.buyer || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Parts manager has quoted prices. Review and approve each part to proceed.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#3B2F10;border:2px solid #78590A;border-radius:10px;margin-bottom:16px"><div style="font-size:11px;color:#FBBF24;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Quoted parts</div>${(d.parts || []).map((p: any) => `<div style="padding:10px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div><div style="font-size:11px;color:#6B7280;margin-top:2px">ETA: ${fmtDate(p.partETA)}</div></div><div style="font-size:16px;font-weight:700;color:#FBBF24">$${(p.partPrice || 0).toLocaleString()}</div></div>`).join('')}<div style="border-top:1px solid #78590A;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between"><span style="font-size:13px;color:#FDE68A;font-weight:700">Total quote</span><span style="font-size:18px;color:#FDE68A;font-weight:700">$${(d.totalQuote || 0).toLocaleString()}</span></div></div>${cta('Review & Approve →', d.vehicle.id, '#F59E0B', '#0D0D1A')}`),
  }),

  parts_approved_to_pm: (d) => ({
    subject: `✅ Parts Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — Order now`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Parts Approved — Place Order',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.partsManager || 'Parts Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Buyer has approved parts pricing. Please place orders.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px"><div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Approved parts (${(d.parts || []).length})</div>${(d.parts || []).map((p: any) => `<div style="padding:10px;background:#0D0D1A;border-radius:8px;margin-bottom:6px"><div style="font-size:14px;font-weight:600;color:#E5E7EB">${p.desc}</div><div style="font-size:11px;color:#6B7280;margin-top:2px">$${(p.partPrice || 0).toLocaleString()} • ETA ${fmtDate(p.partETA)}</div></div>`).join('')}</div>${cta('Order Parts →', d.vehicle.id, '#34D399', '#0D0D1A')}`),
  }),

  parts_approved_to_vendor: (d) => ({
    subject: `✅ Parts Approved — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'Parts Approved — Ordering',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name || 'Vendor'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Buyer approved the parts. Parts manager is placing the order. You'll get an email when each part arrives.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px"><div style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px">Parts being ordered</div>${(d.parts || []).map((p: any) => `<div style="padding:8px;background:#0D0D1A;border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between"><span style="font-size:13px;color:#E5E7EB">${p.desc}</span><span style="font-size:11px;color:#6B7280">ETA ${fmtDate(p.partETA)}</span></div>`).join('')}</div>${cta('View Job →', d.vehicle.id, '#34D399', '#0D0D1A', d.categoryKey)}`),
  }),

  part_received: (d) => ({
    subject: `📦 Part Received — ${d.partDesc} — ${d.receivedCount} of ${d.totalParts} in`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '📦', 'Part Received',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part has arrived for this vehicle.</div>${vBlock(d.vehicle)}<div style="padding:20px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:36px;margin-bottom:6px">📦</div><div style="font-size:18px;font-weight:700;color:#34D399">${d.partDesc}</div><div style="font-size:13px;color:#6EE7B7;margin-top:4px">Received ${fmtDate(d.partReceivedDate)}</div></div><div style="padding:14px;background:#0D0D1A;border:1px solid #2A2A3E;border-radius:8px;text-align:center"><div style="font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px">Progress</div><div style="font-size:22px;font-weight:700;color:#FFF;margin-top:4px">${d.receivedCount} of ${d.totalParts} parts in</div>${d.remainingParts?.length ? `<div style="margin-top:10px;font-size:12px;color:#6B7280">Still waiting on: ${d.remainingParts.map((p: any) => p.desc + ' (ETA ' + fmtDate(p.partETA) + ')').join(', ')}</div>` : ''}</div>${cta('View Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A', d.categoryKey)}`),
  }),

  all_parts_received: (d) => ({
    subject: `✅ ALL Parts In — Resume Work — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '✅', 'All Parts Received — Resume Work',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">All parts have arrived. ${d.recipientRole === 'vendor' ? 'You can now resume work on this vehicle.' : 'Vendor has been notified to resume work.'}</div>${vBlock(d.vehicle)}<div style="padding:24px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;text-align:center;margin-bottom:16px"><div style="font-size:48px;margin-bottom:8px">✅</div><div style="font-size:22px;font-weight:700;color:#34D399">ALL PARTS IN</div><div style="font-size:13px;color:#6EE7B7;margin-top:6px">${(d.parts || []).length} parts received</div></div><div style="padding:14px;background:#0D0D1A;border:1px solid #2A2A3E;border-radius:8px">${(d.parts || []).map((p: any) => `<div style="padding:6px 0;font-size:13px;color:#E5E7EB;border-bottom:1px solid #1E1E32">✓ ${p.desc} <span style="color:#6B7280;font-size:11px">— ${fmtDate(p.partReceivedDate)}</span></div>`).join('')}</div>${cta(d.recipientRole === 'vendor' ? 'Resume Work →' : 'View Vehicle →', d.vehicle.id, '#34D399', '#0D0D1A', d.categoryKey)}`),
  }),

  part_rejected: (d) => ({
    subject: `❌ Part Rejected — ${d.partDesc} — Re-ordering`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '❌', 'Part Rejected',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part arrived but was rejected. Parts manager is sourcing a replacement.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#FCA5A5;margin-bottom:6px">❌ ${d.partDesc}</div><div style="font-size:12px;color:#FDBA74;margin-bottom:6px">Reason: ${d.rejectedReason || 'Not specified'}</div><div style="font-size:11px;color:#6B7280">Rejected ${fmtDate(d.rejectedDate)}</div></div><div style="padding:12px;background:#0D0D1A;border-radius:8px;text-align:center"><div style="font-size:13px;color:#FBBF24">⏳ Re-ordering — new ETA will be provided</div></div>${cta('View Vehicle →', d.vehicle.id, '#EF4444', '#FFF', d.categoryKey)}`),
  }),

  part_backorder: (d) => ({
    subject: `⏳ Part Backordered — ${d.partDesc} — New ETA ${fmtDate(d.newETA)}`,
    html: shell('#3B2F10', '#78590A', '#FDE68A', '#F59E0B', '⏳', 'Part Backordered',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.recipient || 'Team'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">A part is on backorder. ETA has been extended.</div>${vBlock(d.vehicle)}<div style="padding:18px;background:#3B2F10;border:2px solid #78590A;border-radius:12px;margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#FDE68A;margin-bottom:6px">⏳ ${d.partDesc}</div><div style="font-size:12px;color:#FBBF24;margin-top:8px">Original ETA: ${fmtDate(d.originalETA)}</div><div style="font-size:14px;color:#FDE68A;margin-top:4px;font-weight:700">New ETA: ${fmtDate(d.newETA)}</div></div>${cta('View Vehicle →', d.vehicle.id, '#F59E0B', '#0D0D1A', d.categoryKey)}`),
  }),

  recon_approved_for_payment: (d) => ({
    subject: `💸 Approved for Payment — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — $${(d.lockedTotal || 0).toLocaleString()} to ${d.vendor?.name}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '💸', 'Approved for Payment',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">Team,</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${d.approvedBy || 'Buyer'} has approved this completed recon work for payment. Amount is locked.</div>${vBlock(d.vehicle)}<div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:10px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:11px;color:#34D399;text-transform:uppercase;letter-spacing:1px;font-weight:700">${d.category}</span><span style="padding:3px 8px;background:#1E3A5F;color:#93C5FD;border-radius:4px;font-size:10px;font-weight:700">📍 ${d.location || 'PHX'}</span></div><div style="font-size:18px;font-weight:700;color:#FFF;margin-bottom:6px">${d.vendor?.name}</div>${(d.lineItems || []).map((li: any) => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#E5E7EB;border-bottom:1px solid #1E1E32"><span>${li.desc}</span><span><span style="color:${li.costType === 'retail' ? '#67E8F9' : '#93C5FD'};font-size:10px;margin-right:6px">${li.costType === 'retail' ? 'Retail' : 'W/S'}</span><span style="color:#FBBF24;font-weight:700">$${Number(li.price) || 0}</span></span></div>`).join('')}<div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:8px;border-top:1px solid #166534"><span style="color:#34D399;font-weight:700">LOCKED TOTAL</span><span style="color:#34D399;font-weight:700;font-size:20px">$${(d.lockedTotal || 0).toLocaleString()}</span></div>${(d.lockedWS > 0 || d.lockedRetail > 0) ? `<div style="font-size:11px;color:#6B7280;text-align:right;margin-top:4px">W/S: $${(d.lockedWS || 0).toLocaleString()} • Retail: $${(d.lockedRetail || 0).toLocaleString()}</div>` : ''}</div><div style="padding:12px;background:#0D0D1A;border:1px dashed #166534;border-radius:8px;text-align:center;margin-bottom:16px"><div style="font-size:12px;color:#9CA3AF">Approved by</div><div style="font-size:14px;color:#FFF;font-weight:700;margin-top:2px">${d.approvedBy || 'Buyer'} on ${fmtDate(d.approvedDate)}</div></div>${cta('Open Payment Queue →', d.vehicle.id, '#34D399', '#0D0D1A', d.categoryKey)}`),
  }),

  recon_disputed: (d) => ({
    subject: `⚠️ Work Disputed — ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} — ${d.category}`,
    html: shell('#3B1515', '#7F1D1D', '#FCA5A5', '#EF4444', '⚠️', 'Work Disputed',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name || 'Vendor'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">${d.disputedBy || 'Buyer'} has disputed your completed work. Please review and address.</div>${vBlock(d.vehicle)}${contactBlock(d.buyerContact, d.seller)}<div style="padding:18px;background:#3B1515;border:2px solid #7F1D1D;border-radius:12px;margin-bottom:16px"><div style="font-size:12px;color:#FCA5A5;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px">Reason for dispute</div><div style="font-size:14px;color:#FFF;line-height:1.6;background:#0D0D1A;padding:12px;border-radius:8px;border-left:3px solid #EF4444">${d.reason}</div><div style="font-size:11px;color:#FDBA74;margin-top:10px">Disputed by ${d.disputedBy || 'Buyer'} on ${fmtDate(d.disputedDate)}</div></div><div style="padding:12px;background:#0D0D1A;border:1px dashed #7F1D1D;border-radius:8px;text-align:center"><div style="font-size:13px;color:#FCA5A5;font-weight:700">Work status reverted to "In Progress"</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px">Please address the issue and re-submit when complete</div></div>${cta('View Job →', d.vehicle.id, '#EF4444', '#FFF', d.categoryKey)}`),
  }),

  vendor_payment_receipt: (d) => ({
    subject: `💸 Payment Sent — Check #${d.checkNumber} — $${(d.totalPaid || 0).toLocaleString()} to ${d.vendor?.name || 'Vendor'}`,
    html: shell('#0D3B1E', '#166534', '#6EE7B7', '#34D399', '💸', 'Payment Sent',
      `<div style="font-size:18px;font-weight:500;color:#FFF;margin-bottom:8px;word-break:keep-all;overflow-wrap:anywhere">${d.vendor?.name || 'Vendor'},</div><div style="font-size:14px;color:#9CA3AF;line-height:1.7;margin-bottom:20px">Your payment has been issued. Below is the breakdown for your records.</div><div style="padding:16px;background:#0D3B1E;border:2px solid #166534;border-radius:12px;margin-bottom:16px"><div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1;text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">📝 Check written</div><div style="font-size:15px;color:#FFF;font-weight:700;margin-top:4px">${fmtDate(d.checkWrittenDate)}</div></div><div style="flex:1;text-align:center;padding:10px;background:#0D0D1A;border-radius:8px"><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">📬 Mailed</div><div style="font-size:15px;color:#FFF;font-weight:700;margin-top:4px">${fmtDate(d.checkMailedDate)}</div></div></div><div style="text-align:center;padding-top:10px;border-top:1px solid #166534"><div style="font-size:12px;color:#6EE7B7">Check #${d.checkNumber} via ${d.deliveryMethod || 'USPS Mail'}</div><div style="font-size:26px;font-weight:700;color:#34D399;margin-top:2px">$${(d.totalPaid || 0).toLocaleString()}</div></div></div><div style="font-size:12px;color:#9CA3AF;margin-bottom:10px;font-weight:600">Covered work (${(d.jobs || []).length} job${(d.jobs || []).length === 1 ? '' : 's'}):</div>${(d.jobs || []).map((j: any) => `<div style="padding:12px;background:#0D0D1A;border-radius:8px;border-left:3px solid #34D399;margin-bottom:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-size:13px;color:#FFF;font-weight:700">${j.vehicleYear} ${j.vehicleMake} ${j.vehicleModel} ${j.vehicleTrim || ''}</div><div style="font-size:13px;color:#FBBF24;font-weight:700">$${Number(j.total).toLocaleString()}</div></div><div style="font-size:10px;color:#6B7280;font-family:monospace">VIN ${j.vin8 || '—'} • ${j.categoryIcon || ''} ${j.categoryLabel?.toUpperCase()}</div><div style="font-size:11px;color:#9CA3AF;margin-top:6px;line-height:1.7;padding-left:8px">${(j.lineItems || []).map((li: any) => `• ${li.desc} — $${Number(li.price) || 0}${li.costType ? ` <span style="color:#6B7280">(${li.costType === 'retail' ? 'Retail' : 'W/S'})</span>` : ''}`).join('<br>')}</div><div style="font-size:10px;color:#6EE7B7;margin-top:6px;padding-top:6px;border-top:1px solid #166534">✅ Approved ${fmtDate(j.approvedDate)} by ${j.approvedBy || 'Buyer'}</div></div>`).join('')}<div style="margin-top:12px;padding:10px;background:#0D0D1A;border-radius:6px;text-align:center;font-size:11px;color:#6B7280">Issued by ${d.paidBy || 'Accounting'} • Fleet Command Recon</div>`),
  }),

};
