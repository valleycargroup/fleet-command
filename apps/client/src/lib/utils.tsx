import React from 'react';

export const fmtDate = (d: any) => d ? d.slice(5,7)+"/"+d.slice(8,10)+"/"+d.slice(2,4) : "—";

// Phase 4: auto-detect URLs in text and return spans/anchors for rendering.
// Usage: <>{linkifyText(someString)}</>
const URL_RE = /https?:\/\/[^\s<>"']+|(?<![a-zA-Z0-9@])([a-zA-Z0-9-]+\.(?:com|net|org|io|co|gov|edu|info|biz|us|app|dev)[^\s<>"']*)/g;
export function linkifyText(text: string): (string | React.ReactElement)[] {
  if (!text) return [text];
  const parts: (string | React.ReactElement)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const href = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    parts.push(
      <a key={m.index} href={href} target="_blank" rel="noopener noreferrer"
        style={{ color: '#3B82F6', textDecoration: 'underline', wordBreak: 'break-all' }}>
        {raw}
      </a>
    );
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export const smartDate = (val: any) => {
  if(!val) return "";
  const clean = val.replace(/[^0-9/]/g,"");
  const parts = clean.split("/");
  if(parts.length === 2) {
    const m = parseInt(parts[0]), d = parseInt(parts[1]);
    if(m>=1&&m<=12&&d>=1&&d<=31) {
      const now = new Date();
      let y = now.getFullYear();
      const candidate = new Date(y, m-1, d);
      if(candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y++;
      return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    }
  }
  return val;
};

export const stColor = (s: any) => ({
  complete:{bg:"#0D3B1E",text:"#34D399",bd:"#166534"},
  started:{bg:"#3B2F10",text:"#FBBF24",bd:"#78590A"},
  approved:{bg:"#1A2940",text:"#60A5FA",bd:"#1E3A5F"},
  estimated:{bg:"#3B2F10",text:"#FBBF24",bd:"#78590A"},
  assigned:{bg:"#3B3510",text:"#EAB308",bd:"#6B5F0A"},
  unassigned:{bg:"#3B1515",text:"#F87171",bd:"#7F1D1D"},
  declined:{bg:"#3B1515",text:"#FCA5A5",bd:"#7F1D1D"},
  na:{bg:"#1A1A2E",text:"#555",bd:"#2A2A3E"},
}[s as string] || {bg:"#1A1A2E",text:"#888",bd:"#333"});

export const stLabel = (s: any) => ({
  complete:"DONE",started:"IN PROGRESS",approved:"APPROVED",bid_submitted:"BID SUBMITTED",
  estimated:"ESTIMATE IN",assigned:"ASSIGNED",unassigned:"NEEDS ASSIGN",
  declined:"VENDOR DECLINED",na:"N/A",
}[s as string] || "—");

export const vData = (veh: any) => {
  const c = (x: any) => {
    if(!x) return "";
    const s = String(x).trim();
    return s.toLowerCase()==="null"||s.toLowerCase()==="undefined" ? "" : s;
  };
  return {
    id:veh.id, _dbId:veh._dbId, vin8:veh.vin8, fullVin:veh.fullVin||"", stockNumber:veh.stockNumber||"",
    year:veh.year, make:veh.make, model:veh.model, trim:veh.trim,
    miles:veh.miles, color:veh.color, location:veh.location,
    soldTo:c(veh.soldTo), soldDate:c(veh.soldDate),
    buyingBroker:c(veh.buyingBroker), sellingBroker:c(veh.sellingBroker),
  };
};

export const tryParse = (v: any, fallback: any = null) => {
  if(v === null || v === undefined) return fallback;
  if(typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
