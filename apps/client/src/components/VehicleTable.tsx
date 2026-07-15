import { useState, useMemo, useEffect, useRef } from 'react';
import { VCAT } from '../lib/constants';
import { fmtDate, stColor, stLabel } from '../lib/utils';
import { S } from '../lib/styles';
import { useStore, selectRoles } from '../lib/store';
import { useIsMobile } from '../lib/useIsMobile';

const CR_STATUS_BADGE: Record<string, { bg: string; color: string; bd: string; label: string }> = {
  baseline:    { bg: '#1E3A5F', color: '#93C5FD', bd: '#3B82F6', label: '📋 CR' },
  in_progress: { bg: '#78350F', color: '#FBBF24', bd: '#B45309', label: '📋 CR+' },
  complete:    { bg: '#064E3B', color: '#34D399', bd: '#059669', label: '📋 CR ✓' },
};

export function VehicleTable() {
const isMobile = useIsMobile();
const vehicles = useStore((s: any) => s.vehicles);
const tab = useStore((s: any) => s.tab);
const fLoc = useStore((s: any) => s.fLoc);
const search = useStore((s: any) => s.search);
const currentUser = useStore((s: any) => s.currentUser);
const regVendors = useStore((s: any) => s.regVendors);
const setSelV = useStore((s: any) => s.setSelV);
const setDeepLinkCr = useStore((s: any) => s.setDeepLinkCr);
const { isVendor } = useStore(selectRoles);
const onSelect = setSelV;
const [myCrOnly,setMyCrOnly]=useState(false);

const list = useMemo(() => {
  let l = [...vehicles];
  if (tab === "delivered") l = l.filter((v: any) => v.status === "delivered");
  else l = l.filter((v: any) => v.status !== "delivered");
  if (isVendor && currentUser) {
    // Primary: vendor_id FK on currentUser
    const myVendorId = currentUser.vendor_id ? 'vn_' + currentUser.vendor_id : null;
    const ce = (currentUser.email||"").toLowerCase();
    const vtag = (currentUser.vendor_tag||"").toLowerCase();
    // Resolve vendor company name — used as name-based fallback for seeded/legacy data
    const myReg = (regVendors||[]).find((rv: any) =>
      (myVendorId && ('vn_' + rv.id) === myVendorId) ||
      (!myVendorId && ((ce && (rv.email||"").toLowerCase() === ce) || (vtag && (rv.company||rv.name||"").toLowerCase() === vtag)))
    );
    const resolvedVendorId = myVendorId || (myReg ? 'vn_' + myReg.id : null);
    const myVendorName = (myReg?.company || myReg?.name || "").toLowerCase();

    l = l.filter((v: any) => {
      const myTasks = VCAT.filter(c => {
        const t = v.reconTasks[c.key];
        if (!t?.needed) return false;
        return (t.vendors||[]).some((vn: any) =>
          (resolvedVendorId && vn.id === resolvedVendorId) ||
          (ce && (vn.email||"").toLowerCase() === ce) ||
          (myVendorName && (vn.name||"").toLowerCase() === myVendorName)
        );
      });
      if (!myTasks.length) return false;
      return myTasks.some(c => v.reconTasks[c.key].status !== "complete");
    });
  }
  if (currentUser?.role === "Buyer") { const fn=currentUser.first_name||currentUser.firstName||""; const ln=currentUser.last_name||currentUser.lastName||""; const full=(fn+" "+ln).trim(); const em=currentUser.email||""; l = l.filter((v: any) => (full&&v.buyingBroker===full)||(em&&v.buyingBroker===em)); }
  if (currentUser?.role === "Seller") { const fn=currentUser.first_name||currentUser.firstName||""; const ln=currentUser.last_name||currentUser.lastName||""; const full=(fn+" "+ln).trim(); const em=currentUser.email||""; l = l.filter((v: any) => (full&&v.sellingBroker===full)||(em&&v.sellingBroker===em)); }
  if (currentUser?.role === "Buyer/Seller") { const fn=currentUser.first_name||currentUser.firstName||""; const ln=currentUser.last_name||currentUser.lastName||""; const full=(fn+" "+ln).trim(); const em=currentUser.email||""; l = l.filter((v: any) => (full&&(v.buyingBroker===full||v.sellingBroker===full))||(em&&(v.buyingBroker===em||v.sellingBroker===em))); }
  if (fLoc !== "All") l = l.filter((v: any) => v.location === fLoc);
  if (search) { const q = search.toLowerCase(); l = l.filter((v: any) => (v.fullVin||v.vin8||"").toLowerCase().includes(q)||v.vin8.toLowerCase().includes(q)||`${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q)||v.buyingBroker.toLowerCase().includes(q)||(v.sellingBroker||"").toLowerCase().includes(q)||(v.soldTo||"").toLowerCase().includes(q)); }
  if (myCrOnly) l = l.filter((v: any) => v.crAssignedTo && Number(v.crAssignedTo) === Number(currentUser?.id) && !isCrDone(v));
  // Phase 3 sort — priority tiers agreed 2026-06-29:
  // 1. Kicked + Delivered (returned after delivery — pulled back to main tab)
  // 2. Kicked + Not Yet Resold
  // 3. Sold + Active/Incomplete Recon (buyer waiting — oldest sale date first)
  // 4. Sold + No Pending Recon (ready to ship)
  // 5. Active + Past-Due Recon (ETA missed, not sold)
  // 6. Active + Incomplete Recon — On Ground
  // 7. Active + Incomplete Recon — Inbound (by ETA)
  // Delivered tab: newest delivered date first (unchanged)
  l.sort((a: any, b: any) => {
    if (tab === "delivered") { const da=a.deliveredDate||"",db=b.deliveredDate||""; return da>db?-1:da<db?1:0; }
    const vehicleSortPriority = (v: any): number => {
      const hasKickHistory = (v.kickedReturn||(v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV));
      const isDelivered = v.status==="delivered";
      const isSold = v.status==="sold";
      // Tier 1: kicked AND delivered (came back after delivery)
      if (hasKickHistory && isDelivered) return 1;
      // Tier 2: kicked, not yet resold (no sold status)
      if (hasKickHistory && !isSold && !isDelivered) return 2;
      // Tiers 3-4: sold vehicles
      if (isSold) {
        const rc = VCAT.filter(c => v.reconTasks[c.key]?.needed);
        const hasIncompleteRecon = rc.some(c => v.reconTasks[c.key]?.status !== "complete");
        return hasIncompleteRecon ? 3 : 4; // 3=buyer waiting on recon, 4=ready to ship
      }
      // Tier 5: active + past-due recon (ETA set and missed)
      const rc = VCAT.filter(c => v.reconTasks[c.key]?.needed);
      const isPastDue = rc.some(c => {
        const t = v.reconTasks[c.key];
        if (!t || t.status === "complete") return false;
        const sv2 = (t.vendors||[]).find((x: any) => x.selected);
        const eta = sv2?.etaDone || t.etaComplete;
        if (!eta) return false;
        let d = new Date(eta);
        if (d.getFullYear() < 100) d.setFullYear(d.getFullYear() + 2000);
        return d < new Date();
      });
      if (isPastDue) return 5;
      // Tier 6: on ground (inbound delivered)
      if (v.transport?.inbound?.delivered) return 6;
      // Tier 7: inbound transport set (not yet arrived)
      if (v.transport?.inbound?.set && !v.transport?.inbound?.delivered) return 7;
      // Tier 8: everything else
      return 8;
    };
    const pa = vehicleSortPriority(a), pb = vehicleSortPriority(b);
    if (pa !== pb) return pa - pb;
    // Secondary sort within each tier
    if (pa === 1 || pa === 2) {
      // Kicked: most recently kicked first
      const ka=(a.kickedHistory||[]).slice(-1)[0]?.kickedDate||"";
      const kb=(b.kickedHistory||[]).slice(-1)[0]?.kickedDate||"";
      return ka>kb?-1:ka<kb?1:0;
    }
    if (pa === 3 || pa === 4) {
      // Sold: oldest sale date first (longest waiting buyer)
      const sa=a.soldDate||"9999",sb=b.soldDate||"9999";
      return sa<sb?-1:sa>sb?1:0;
    }
    if (pa === 7) {
      // Inbound: soonest ETA first
      const ea=a.transport?.inbound?.eta||"9999",eb=b.transport?.inbound?.eta||"9999";
      return ea<eb?-1:ea>eb?1:0;
    }
    // Default: oldest purchase date first
    const da=a.purchaseDate||"9999",db=b.purchaseDate||"9999";
    return da<db?-1:da>db?1:0;
  });
  return l;
}, [vehicles, tab, fLoc, search, currentUser, myCrOnly]);
const [sortCol,setSortCol]=useState("");const [sortDir,setSortDir]=useState("asc");
const toggleSort=(col: any)=>{if(sortCol===col)setSortDir(sortDir==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("asc");}};
const isCrDone=(v: any)=>v.crStatus==="complete"||v.reconTasks?.cr?.status==="complete";
// getPriority mirrors vehicleSortPriority tiers for column-sort consistency
const getPriority=(v: any)=>{const hasKick=(v.kickedReturn||(v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV));if(hasKick&&v.status==="delivered")return 1;if(hasKick&&v.status!=="sold"&&v.status!=="delivered")return 2;if(v.status==="sold"){const rc2=VCAT.filter(c=>v.reconTasks[c.key]?.needed);return rc2.some(c=>v.reconTasks[c.key]?.status!=="complete")?3:4;}const rc=VCAT.filter(c=>v.reconTasks[c.key]?.needed);const pastDue=rc.some(c=>{const t=v.reconTasks[c.key];if(!t||t.status==="complete")return false;const sv2=(t.vendors||[]).find((x: any)=>x.selected);const eta=sv2?.etaDone||t.etaComplete;if(!eta)return false;let d=new Date(eta);if(d.getFullYear()<100)d.setFullYear(d.getFullYear()+2000);return d<new Date();});if(pastDue)return 5;if(v.transport?.inbound?.delivered)return 6;if(v.transport?.inbound?.set&&!v.transport?.inbound?.delivered)return 7;return 8;};

// Memoised column sort — only re-runs when list or sort column/dir changes
const sorted2=useMemo(()=>{
  if(!sortCol)return list;
  return [...list].sort((a: any,b: any)=>{const pa=getPriority(a),pb=getPriority(b);if(pa!==pb)return pa-pb;let av: any,bv: any;
  if(sortCol==="Vehicle")av=a.year+" "+a.make+" "+a.model,bv=b.year+" "+b.make+" "+b.model;
  else if(sortCol==="Purchased")av=a.purchaseDate||"",bv=b.purchaseDate||"";
  else if(sortCol==="Buyer")av=a.buyingBroker||"",bv=b.buyingBroker||"";
  else if(sortCol==="Seller")av=a.sellingBroker||"",bv=b.sellingBroker||"";
  else if(sortCol==="Location")av=a.location||"",bv=b.location||"";
  else if(sortCol==="Miles")av=a.miles||0,bv=b.miles||0;
  else if(sortCol==="Sold To")av=a.soldTo||"",bv=b.soldTo||"";
  else if(sortCol==="Color")av=a.color||"",bv=b.color||"";
  else if(sortCol==="Source")av=a.source||"",bv=b.source||"";
  else if(sortCol==="Sold")av=a.soldDate||"",bv=b.soldDate||"";
  else if(sortCol==="Stock #")av=a.stockNumber||"",bv=b.stockNumber||"";
  else if(sortCol==="VIN#")av=a.fullVin||a.vin8||"",bv=b.fullVin||b.vin8||"";
  else return 0;
  if(typeof av==="number")return sortDir==="asc"?av-bv:bv-av;
  return sortDir==="asc"?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));});
},[list,sortCol,sortDir]);

// Single-pass stat computation — avoids 10 separate filter passes over 2000+ vehicles
const stats=useMemo(()=>{
  let sold=0,recon=0,r2s=0,inbound=0,onGround=0,outSet=0,pickedUp=0,kicked=0,myCr=0;
  for(const v of list){
    const rc2=VCAT.filter(c=>v.reconTasks[c.key]?.needed);
    const dn2=rc2.filter(c=>v.reconTasks[c.key]?.status==="complete");
    if(v.status==="sold"||v.status==="delivered")sold++;
    if(rc2.length>0&&rc2.some(c=>v.reconTasks[c.key]?.status!=="complete"))recon++;
    if(v.noReconNeeded||(rc2.length>0&&dn2.length===rc2.length))r2s++;
    if(v.transport?.inbound?.set&&!v.transport?.inbound?.delivered)inbound++;
    if(v.transport?.inbound?.delivered&&v.status!=="delivered")onGround++;
    if(v.transport?.outbound?.set&&!v.transport?.outbound?.pickedUp&&!v.transport?.outbound?.delivered)outSet++;
    if(v.transport?.outbound?.pickedUp&&!v.transport?.outbound?.delivered)pickedUp++;
    if((v.kicked||v.kickedFromCSV||v.kickedReturn)&&v.status!=="sold"&&v.status!=="delivered")kicked++;
    if(v.crAssignedTo&&Number(v.crAssignedTo)===Number(currentUser?.id)&&!isCrDone(v))myCr++;
  }
  return {sold,recon,r2s,inbound,onGround,outSet,pickedUp,kicked,myCr};
},[list,currentUser]);
const {sold:soldCount,recon:reconCount,r2s:r2sCount,inbound:inboundCount,onGround:onGroundCount,outSet:outSetCount,pickedUp:pickedUpCount,kicked:kickedCount,myCr:myCrCount}=stats;

// Virtual render — only mount visible rows; expand on scroll
// Must be declared before any early return (Rules of Hooks)
const [renderLimit,setRenderLimit]=useState(150);
const sentinelRef=useRef<any>(null);
useEffect(()=>{setRenderLimit(150);},[list.length,tab,search,fLoc]);
useEffect(()=>{
  if(!sentinelRef.current)return;
  const obs=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)setRenderLimit(n=>n+100);},{threshold:0.1});
  obs.observe(sentinelRef.current);
  return()=>obs.disconnect();
},[sentinelRef.current,sorted2.length]);

if(!list.length)return <div style={{textAlign:"center",padding:60,color:"#4B5563",fontSize:17}}>No vehicles found.</div>;

const isMyVendorRecord=(vn: any)=>{
  if(!isVendor||!currentUser)return false;
  const ce=(currentUser.email||"").toLowerCase();
  const vtag=(currentUser.vendor_tag||"").toLowerCase();
  const myVid=currentUser.vendor_id?'vn_'+currentUser.vendor_id:null;
  const myReg=(regVendors||[]).find((rv: any)=>
    (myVid&&('vn_'+rv.id)===myVid)||
    (!myVid&&((ce&&(rv.email||"").toLowerCase()===ce)||(vtag&&(rv.company||rv.name||"").toLowerCase()===vtag)))
  );
  if(myVid&&myReg)return vn.id===myVid||(vn.name||"").toLowerCase()===(myReg.company||myReg.name||"").toLowerCase();
  if(myReg)return vn.id==='vn_'+myReg.id||(vn.name||"").toLowerCase()===(myReg.company||myReg.name||"").toLowerCase();
  return ce&&(vn.email||"").toLowerCase()===ce;
};
const getVendorStatus=(v: any)=>{if(!isVendor||!currentUser)return null;const myTasks=VCAT.filter(c=>{const t=v.reconTasks[c.key];return t?.needed&&(t.vendors||[]).some(isMyVendorRecord);});if(!myTasks.length)return null;let bidPending=false,working=false,done=true;for(const c of myTasks){const t=v.reconTasks[c.key];const me=(t.vendors||[]).find(isMyVendorRecord);if(!me)continue;if(t.status==="complete"){continue;}done=false;if(me.bidLocked&&me.selected){working=true;}else if(!me.bidLocked){bidPending=true;}}if(bidPending)return{key:"bid_pending",label:"⏳ BID PENDING",bg:"#3B2F10",color:"#FDE68A",border:"#78590A"};if(working)return{key:"working",label:"🔧 WORKING",bg:"#1E3A5F",color:"#93C5FD",border:"#3B82F6"};if(done)return{key:"done",label:"✅ DONE",bg:"#0D3B1E",color:"#6EE7B7",border:"#166534"};return{key:"awaiting",label:"⏳ AWAITING BUYER",bg:"#3B2F10",color:"#FDE68A",border:"#78590A"};};
const visibleRows=sorted2.slice(0,renderLimit);

if(isMobile) return <span style={{display:"contents"}}>
  <div style={{display:"flex",gap:8,marginBottom:10,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:4}}>
    {isVendor?<>
      <div style={{padding:"6px 12px",borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#9CA3AF"}}>Total</div><div style={{fontSize:16,fontWeight:800,color:"#E5E7EB"}}>{sorted2.length}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"#3B2F10",border:"1px solid #78590A",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#FBBF24"}}>Pending</div><div style={{fontSize:16,fontWeight:800,color:"#FDE68A"}}>{list.filter((v: any)=>getVendorStatus(v)?.key==="bid_pending").length}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"#1E3A5F",border:"1px solid #3B82F6",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#93C5FD"}}>Working</div><div style={{fontSize:16,fontWeight:800,color:"#BFDBFE"}}>{list.filter((v: any)=>getVendorStatus(v)?.key==="working").length}</div></div>
    </>:<>
      <div style={{padding:"6px 12px",borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#9CA3AF"}}>Total</div><div style={{fontSize:16,fontWeight:800,color:"#E5E7EB"}}>{list.length}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(52,211,153,0.1)",border:"1px solid #166534",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#34D399"}}>Sold</div><div style={{fontSize:16,fontWeight:800,color:"#34D399"}}>{soldCount}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(96,165,250,0.1)",border:"1px solid #1E3A5F",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#60A5FA"}}>Inbound</div><div style={{fontSize:16,fontWeight:800,color:"#60A5FA"}}>{inboundCount}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(52,211,153,0.1)",border:"1px solid #0D3B1E",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#34D399"}}>Ground</div><div style={{fontSize:16,fontWeight:800,color:"#34D399"}}>{onGroundCount}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(251,191,36,0.1)",border:"1px solid #78590A",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#FBBF24"}}>Recon</div><div style={{fontSize:16,fontWeight:800,color:"#FBBF24"}}>{reconCount}</div></div>
      <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(239,68,68,0.1)",border:"1px solid #7F1D1D",textAlign:"center",flexShrink:0}}><div style={{fontSize:10,color:"#F87171"}}>Kicked</div><div style={{fontSize:16,fontWeight:800,color:"#F87171"}}>{kickedCount}</div></div>
    </>}
  </div>
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    {visibleRows.map((v: any)=>{
      const rc=VCAT.filter(c=>v.reconTasks[c.key]?.needed),dn=rc.filter(c=>v.reconTasks[c.key]?.status==="complete");
      const sold=v.status==="sold"||v.status==="delivered";
      const inb=v.transport?.inbound;
      const vPriority=getPriority(v);
      const borderClr=v.arb?.open?"#EF4444":vPriority===0?"#EF4444":vPriority===1?"#F59E0B":sold?"#34D399":dn.length===rc.length&&rc.length>0?"#06B6D4":rc.length>0&&rc.some(c=>v.reconTasks[c.key]?.status==="started")?"#FBBF24":rc.length>0?"#F97316":"#4B5563";
      const inbStatus=inb?.delivered?{label:"ON GROUND",bg:"#166534",color:"#6EE7B7"}:inb?.eta?{label:"ETA "+fmtDate(inb.eta),bg:"#78590A",color:"#FDE68A"}:inb?.set?{label:"INBOUND",bg:"#1E3A5F",color:"#93C5FD"}:{label:"NOT SET",bg:"#3B1515",color:"#F87171"};
      const vendorSt=isVendor?getVendorStatus(v):null;
      return <div key={v.id} onClick={()=>onSelect(v)} style={{background:"#12122A",border:"1px solid #1E1E32",borderLeft:`4px solid ${borderClr}`,borderRadius:8,padding:"12px 14px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,color:"#F1F5F9",fontSize:15,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.year} {v.make} {v.model}</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{v.stockNumber||v.vin8}{v.color?` • ${v.color}`:""}{v.miles?` • ${v.miles.toLocaleString()}mi`:""}</div>
          </div>
          <div style={{flexShrink:0}}>
            {sold?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>SOLD</span>
            :vendorSt?<span style={{...S.badge,background:vendorSt.bg,color:vendorSt.color,border:`1px solid ${vendorSt.border}`}}>{vendorSt.label}</span>
            :<span style={{...S.badge,background:inbStatus.bg,color:inbStatus.color,fontSize:10}}>{inbStatus.label}</span>}
          </div>
        </div>
        {!isVendor&&<div style={{fontSize:12,color:"#9CA3AF",marginBottom:rc.length>0?6:0}}>{v.buyingBroker||"—"} • {v.location}{v.source?` • ${v.source}`:""}</div>}
        {rc.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
          {rc.slice(0,6).map((c: any)=>{const t=v.reconTasks[c.key],cl=stColor(t.status);return<span key={c.key} style={{padding:"2px 6px",borderRadius:4,background:cl.bg,border:`1px solid ${cl.bd}`,fontSize:10,fontWeight:600,color:cl.text}}>{t.status==="complete"?"✓ ":""}{c.label}</span>;})}
          {rc.length>6&&<span style={{padding:"2px 6px",borderRadius:4,background:"#1A1A2E",border:"1px solid #2A2A3E",fontSize:10,color:"#6B7280"}}>+{rc.length-6}</span>}
        </div>}
      </div>;
    })}
    {sorted2.length>renderLimit&&<div ref={sentinelRef} style={{height:20}}/>}
  </div>
</span>;

return <span style={{display:"contents"}}><div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
{isVendor?<>
<div style={{padding:"8px 16px",borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E",textAlign:"center"}}><span style={{fontSize:11,color:"#9CA3AF"}}>Total Active</span> <span style={{fontSize:18,fontWeight:800,color:"#E5E7EB"}}>{sorted2.length}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"#3B2F10",border:"1px solid #78590A",textAlign:"center"}}><span style={{fontSize:11,color:"#FBBF24"}}>Bid Pending</span> <span style={{fontSize:18,fontWeight:800,color:"#FDE68A"}}>{list.filter((v: any)=>getVendorStatus(v)?.key==="bid_pending").length}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"#1E3A5F",border:"1px solid #3B82F6",textAlign:"center"}}><span style={{fontSize:11,color:"#93C5FD"}}>Working</span> <span style={{fontSize:18,fontWeight:800,color:"#BFDBFE"}}>{list.filter((v: any)=>getVendorStatus(v)?.key==="working").length}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"#3B2F10",border:"1px solid #78590A",textAlign:"center"}}><span style={{fontSize:11,color:"#FBBF24"}}>Awaiting Buyer</span> <span style={{fontSize:18,fontWeight:800,color:"#FDE68A"}}>{list.filter((v: any)=>getVendorStatus(v)?.key==="awaiting").length}</span></div>
</>:<>
<div style={{padding:"8px 16px",borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E",textAlign:"center"}}><span style={{fontSize:11,color:"#9CA3AF"}}>Total</span> <span style={{fontSize:18,fontWeight:800,color:"#E5E7EB"}}>{list.length}</span></div>
{myCrCount>0&&<div onClick={()=>setMyCrOnly(v=>!v)} style={{padding:"8px 16px",borderRadius:8,background:myCrOnly?"#134E4A":"rgba(20,184,166,0.1)",border:`1px solid #0D9488`,textAlign:"center",cursor:"pointer",userSelect:"none"}} title="Filter to my pending CRs"><span style={{fontSize:11,color:"#2DD4BF"}}>Pending CRs</span> <span style={{fontSize:18,fontWeight:800,color:"#2DD4BF"}}>{myCrCount}</span></div>}
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(52,211,153,0.1)",border:"1px solid #166534",textAlign:"center"}}><span style={{fontSize:11,color:"#34D399"}}>Sold</span> <span style={{fontSize:18,fontWeight:800,color:"#34D399"}}>{soldCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(96,165,250,0.1)",border:"1px solid #1E3A5F",textAlign:"center"}}><span style={{fontSize:11,color:"#60A5FA"}}>Inbound</span> <span style={{fontSize:18,fontWeight:800,color:"#60A5FA"}}>{inboundCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(52,211,153,0.1)",border:"1px solid #0D3B1E",textAlign:"center"}}><span style={{fontSize:11,color:"#34D399"}}>On Ground</span> <span style={{fontSize:18,fontWeight:800,color:"#34D399"}}>{onGroundCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(251,191,36,0.1)",border:"1px solid #78590A",textAlign:"center"}}><span style={{fontSize:11,color:"#FBBF24"}}>In Recon</span> <span style={{fontSize:18,fontWeight:800,color:"#FBBF24"}}>{reconCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(6,182,212,0.1)",border:"1px solid #06B6D4",textAlign:"center"}}><span style={{fontSize:11,color:"#06B6D4"}}>R2-Ship</span> <span style={{fontSize:18,fontWeight:800,color:"#06B6D4"}}>{r2sCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(168,85,247,0.1)",border:"1px solid #7C3AED",textAlign:"center"}}><span style={{fontSize:11,color:"#A78BFA"}}>Outbound Set</span> <span style={{fontSize:18,fontWeight:800,color:"#A78BFA"}}>{outSetCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(249,115,22,0.1)",border:"1px solid #C2410C",textAlign:"center"}}><span style={{fontSize:11,color:"#F97316"}}>Picked Up</span> <span style={{fontSize:18,fontWeight:800,color:"#F97316"}}>{pickedUpCount}</span></div>
<div style={{padding:"8px 16px",borderRadius:8,background:"rgba(239,68,68,0.1)",border:"1px solid #7F1D1D",textAlign:"center"}}><span style={{fontSize:11,color:"#F87171"}}>Kicked</span> <span style={{fontSize:18,fontWeight:800,color:"#F87171"}}>{kickedCount}</span></div>
</>}
</div>
<div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",minWidth:isVendor?760:1480,borderCollapse:"collapse",fontSize:14}}><thead><tr>
{(isVendor?["Stock #","VIN#","Vehicle","Color","Miles","Location","Days on Ground","Sold","Status"]:["Buyer","Source","Inbound","Location","Stock #","VIN#","Purchased","Vehicle","Miles","Color","Days on Ground","Sold","Sold To","Seller","R2-Ship","Outbound","Recon"]).map((h: any)=><th key={h} style={{...S.th,cursor:"pointer",userSelect:"none"}} onClick={()=>toggleSort(h)}>{h}{sortCol===h?sortDir==="asc"?" ▲":" ▼":""}</th>)}
</tr></thead><tbody>{visibleRows.map((v: any)=>{const rc=VCAT.filter(c=>v.reconTasks[c.key]?.needed),dn=rc.filter(c=>v.reconTasks[c.key]?.status==="complete"),sold=v.status==="sold"||v.status==="delivered";const inb=v.transport?.inbound,outb=v.transport?.outbound;
const allDone=rc.length>0&&dn.length===rc.length;
const allApproved=rc.length>0&&rc.every(c=>{const s=v.reconTasks[c.key]?.status;return s==="complete"||s==="approved";});
const readyToShip=allDone&&allApproved;
const noReconOnGround=v.noReconNeeded&&inb?.delivered;
const lastComplete=readyToShip?rc.reduce((latest: any,c: any)=>{const d=v.reconTasks[c.key]?.dateCompleted;return d&&d>latest?d:latest;},""):null;
const outbReady=outb?.readyDate;
const rowIdx=sorted2.indexOf(v);const vPriority=getPriority(v);const stripe=rowIdx%2===0?"rgba(255,255,255,0.02)":"transparent";const borderClr=v.arb?.open?"#EF4444":vPriority===0?"#EF4444":vPriority===1?"#F59E0B":sold?"#34D399":readyToShip||v.noReconNeeded?"#06B6D4":rc.length>0&&rc.some(c=>v.reconTasks[c.key]?.status==="started")?"#FBBF24":rc.length>0?"#F97316":"#4B5563";
return <tr key={v.id} style={{borderBottom:"1px solid #1A1A2E",cursor:"pointer",borderLeft:"4px solid "+borderClr,background:sold?"rgba(52,211,153,0.06)":stripe}}
onClick={()=>onSelect(v)} onMouseEnter={(e: any)=>e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={(e: any)=>e.currentTarget.style.background=sold?"rgba(52,211,153,0.06)":stripe}>
{isVendor?<>
<td style={{...S.td,fontFamily:"monospace",letterSpacing:.5,color:"#9CA3AF"}}>{v.stockNumber||"—"}</td>
<td style={{...S.td,fontFamily:"monospace",letterSpacing:1}}>{v.fullVin?<span style={{display:"contents"}}>{v.fullVin.slice(0,-8)}<b>{v.fullVin.slice(-8)}</b></span>:v.vin8||"—"}</td>
<td style={{...S.td,fontWeight:600}}>{v.year} {v.make} {v.model} {v.trim}</td>
<td style={S.td}>{v.color}</td>
<td style={S.td}>{v.miles.toLocaleString()}</td>
<td style={S.td}>{v.location}</td>
<td style={S.td}>{(()=>{const gDate=v.transport?.inbound?.dateDelivered;if(!gDate||!v.transport?.inbound?.delivered)return "—";const d=Math.max(0,Math.floor((new Date() as any-new Date(gDate) as any)/864e5));return <span style={{fontWeight:700,color:d>14?"#F87171":d>7?"#FBBF24":"#34D399"}}>{d}d</span>;})()}</td>
<td style={S.td}>{sold?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>SOLD {fmtDate(v.soldDate)}</span>:"—"}</td>
<td style={S.td}>{(()=>{const st=getVendorStatus(v);return st?<span style={{...S.badge,background:st.bg,color:st.color,border:"1px solid "+st.border,fontWeight:700}}>{st.label}</span>:"—";})()}</td>
</>:<>
<td style={S.td}>{v.buyingBroker}</td><td style={S.td}>{v.source}</td>
<td style={S.td}><div style={{display:"flex",flexDirection:"column",gap:3}}>
{inb?.drivewayPickedUp?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>🏠 PICKED UP {inb.drivewayPickedUpDate?fmtDate(inb.drivewayPickedUpDate):""}</span>
:inb?.drivewayDest?<span style={{...S.badge,background:"#7C3AED",color:"#DDD6FE"}}>🏠 DW→{inb.drivewayDest}{inb.driverwayClearDate?" Clear to P/U "+fmtDate(inb.driverwayClearDate):""}{inb.drivewayEta?" ETA "+fmtDate(inb.drivewayEta):""}</span>
:inb?.drivewayEta?<span style={{...S.badge,background:"#4C1D95",color:"#C4B5FD"}}>🏠 DW ETA {fmtDate(inb.drivewayEta)}</span>
:inb?.delivered?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>ON GROUND {inb.dateDelivered?fmtDate(inb.dateDelivered):""}</span>
:inb?.eta?<span style={{...S.badge,background:"#78590A",color:"#FDE68A"}}>ETA {inb.destination||""} {fmtDate(inb.eta)}</span>
:<span style={{...S.badge,background:"#3B1515",color:"#F87171"}}>NOT SET</span>}
</div></td>
<td style={S.td}>{v.location}</td>
<td style={{...S.td,fontFamily:"monospace",letterSpacing:.5,color:"#9CA3AF"}}>{v.stockNumber||"—"}</td>
<td style={{...S.td,fontFamily:"monospace",letterSpacing:1}}>{v.fullVin?<span style={{display:"contents"}}>{v.fullVin.slice(0,-8)}<b>{v.fullVin.slice(-8)}</b></span>:v.vin8||"—"}</td>
<td style={S.td}>{fmtDate(v.purchaseDate)}</td><td style={{...S.td,fontWeight:600}}>{v.year} {v.make} {v.model} {v.trim}</td>
<td style={S.td}>{v.miles.toLocaleString()}</td><td style={S.td}>{v.color}</td>
<td style={S.td}>{(()=>{const gDate=v.transport?.inbound?.dateDelivered;if(!gDate||!v.transport?.inbound?.delivered)return "—";const d=Math.max(0,Math.floor((new Date() as any-new Date(gDate) as any)/864e5));return <span style={{fontWeight:700,color:d>14?"#F87171":d>7?"#FBBF24":"#34D399"}}>{d}d</span>;})()}</td>
<td style={S.td}><div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
{(v.kickedHistory||[]).length>0&&<span style={{...S.badge,background:"#7C2D12",color:"#FDBA74",fontSize:10}}>🔄 KICKED {fmtDate((v.kickedHistory||[]).slice(-1)[0]?.kickedDate)}</span>}
{(v.kicked||v.kickedFromCSV)&&(v.kickedHistory||[]).length===0&&v.status!=="sold"&&<span style={{...S.badge,background:"#7C2D12",color:"#FDBA74",fontSize:10}}>🔄 KICKED</span>}
{v.arb?.open&&<span style={{...S.badge,background:"#7F1D1D",color:"#FCA5A5",fontSize:10}}>🔴 IN ARB — {v.arb.source||"?"} {fmtDate(v.arb.openDate)}</span>}
{v.arb?.resolved&&!v.arb?.open&&<span style={{...S.badge,background:"#166534",color:"#6EE7B7",fontSize:10}}>✅ ARB RESOLVED {fmtDate(v.arb.resolvedDate)}</span>}
{(v.kicked||v.kickedFromCSV)&&v.status!=="sold"?<span style={{...S.badge,background:"#7F1D1D",color:"#FCA5A5"}}>KICKED</span>:v.status==="sold"||v.status==="delivered"?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>{(v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV)?"RE-SOLD":"SOLD"} {fmtDate(v.soldDate)}</span>:"—"}
</div></td>
<td style={S.td}>{(v.soldTo&&v.soldTo!=="null")?v.soldTo:v.kickedFromDealer||(v.kickedHistory||[]).slice(-1)[0]?.dealer||"—"}</td><td style={S.td}>{v.sellingBroker||"—"}</td>
<td style={S.td}>{outbReady?<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontWeight:800,fontSize:11}}>🚀 R2-SHIP {fmtDate(outbReady)}</span>
:readyToShip?<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontWeight:800,fontSize:11}}>🚀 R2-SHIP {lastComplete?fmtDate(lastComplete):""}</span>
:noReconOnGround?<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontWeight:800,fontSize:11}}>🚀 R2-SHIP {inb.dateDelivered?fmtDate(inb.dateDelivered):""}</span>
:v.noReconNeeded?<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontWeight:800,fontSize:11}}>🚀 R2-SHIP {v.noReconSetDate?fmtDate(v.noReconSetDate):""}</span>
:sold&&(allDone||v.noReconNeeded)&&!v.buyerApprovedShip&&!outb?.readyDate?<span style={{...S.badge,background:"#78590A",color:"#FDE68A",fontWeight:800,fontSize:11}}>⏳ WAITING ON BUYER {allDone&&lastComplete?fmtDate(lastComplete):v.noReconNeeded&&v.noReconSetDate?fmtDate(v.noReconSetDate):""}</span>
:"—"}</td>
<td style={S.td}><div style={{display:"flex",flexDirection:"column",gap:3}}>
{outb?.delivered?<span style={{...S.badge,background:"#166534",color:"#6EE7B7"}}>{outb.isRetail?"🏪 RETAIL DELIVERED":outb.isDriveway?"🏠 DELIVERED":"DELIVERED"} {outb.dateDelivered?fmtDate(outb.dateDelivered):""}</span>
:outb?.pickedUp?<span style={{...S.badge,background:outb.isRetail?"#164E63":"#1E3A5F",color:outb.isRetail?"#67E8F9":"#93C5FD"}}>{outb.isRetail?"🏪 RETAIL SHIPPED":outb.isDriveway?"🏠 SHIPPED":"P/U"} {outb.datePickedUp?fmtDate(outb.datePickedUp):""}</span>
:outb?.eta?<span style={{...S.badge,background:outb.isRetail?"#164E63":outb.isDriveway?"#4C1D95":"#78590A",color:outb.isRetail?"#67E8F9":outb.isDriveway?"#DDD6FE":"#FDE68A"}}>{outb.isRetail?"🏪 RETAIL ETA P/U "+(outb.shippingFrom||""):outb.isDriveway?"🏠 ETA DW":"ETA"} {fmtDate(outb.eta)}</span>
:outb?.readyDate?<span style={{...S.badge,background:outb.isRetail?"#164E63":"#78590A",color:outb.isRetail?"#67E8F9":"#FDE68A"}}>{outb.isRetail?"🏪 RETAIL READY TO SHIP":outb.isDriveway?"🏠 CLEAR P/U":"TRANS SET"} {fmtDate(outb.readyDate)}</span>
:outb?.isRetail?<span style={{...S.badge,background:"#164E63",color:"#67E8F9"}}>🏪 RETAIL DELIVERY</span>
:outb?.set||outb?.isDriveway?<span style={{...S.badge,background:"#78590A",color:"#FDE68A"}}>{outb.isDriveway?"🏠 DW":"TRANS"} → SET</span>
:sold?<span style={{...S.badge,background:"#3B1515",color:"#F87171"}}>NOT SET</span>
:<span style={{color:"#4B5563"}}>—</span>}
</div></td>
<td style={{...S.td,whiteSpace:"normal",minWidth:240}}>{(()=>{const crBadge=CR_STATUS_BADGE[v.crStatus];return (crBadge&&v.crStatus!=="complete")?<span onClick={(e: any)=>{e.stopPropagation();setSelV(v);setDeepLinkCr(true);}} style={{...S.badge,background:crBadge.bg,color:crBadge.color,border:`1px solid ${crBadge.bd}`,fontSize:11,cursor:"pointer",marginBottom:4,display:"inline-block"}} title="View Condition Report">{crBadge.label}{v.crAssignedTo?" 👤":""}</span>:null;})()}{v.noReconNeeded?<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontWeight:800,fontSize:12}}>✅ NO RECON {v.noReconSetDate?fmtDate(v.noReconSetDate):""}</span>
:<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{[...rc].sort((a: any,b: any)=>{const ao=v.reconTasks[a.key]?.order;const bo=v.reconTasks[b.key]?.order;if(ao&&bo)return ao-bo;if(ao&&!bo)return -1;if(!ao&&bo)return 1;return 0;}).map((c: any)=>{const t=v.reconTasks[c.key],cl=stColor(t.status);return <div key={c.key} title={`#${t.order||"—"} ${c.label}: ${stLabel(t.status)}`}
onClick={(e: any)=>{e.stopPropagation();onSelect(v);}}
style={{padding:"2px 6px",borderRadius:4,background:cl.bg,border:`1px solid ${cl.bd}`,fontSize:11,fontWeight:600,color:cl.text,cursor:"pointer",transition:"transform 0.1s"}}
onMouseEnter={(e: any)=>e.currentTarget.style.transform="scale(1.1)"} onMouseLeave={(e: any)=>e.currentTarget.style.transform="scale(1)"}>
<span style={{color:"#FFF",background:"rgba(255,255,255,0.15)",borderRadius:3,padding:"0 3px",marginRight:3,fontSize:10}}>{t.order||"—"}</span>{t.status==="complete"?"✓ ":""}{c.label}
{c.key==="oemdealer"&&t.oemDropDate&&t.status!=="complete"&&<span style={{fontSize:9,display:"block",color:"#FDE68A"}}>AT OEM {fmtDate(t.oemDropDate)}</span>}
{c.key==="oemdealer"&&t.oemWorkStarted&&t.status!=="complete"&&<span style={{fontSize:8,display:"block",color:"#FBBF24"}}>WORK STARTED {t.oemWorkStartedDate?fmtDate(t.oemWorkStartedDate):""}</span>}
{c.key==="oemdealer"&&t.oemPickedUp&&<span style={{fontSize:9,display:"block",color:"#34D399"}}>PICKED UP {t.oemPickedUpDate?fmtDate(t.oemPickedUpDate):""} ✅ COMPLETED {t.dateCompleted?fmtDate(t.dateCompleted):""}</span>}
{c.key!=="oemdealer"&&(t.completedRounds||[]).length>0&&t.status!=="complete"&&<span style={{fontSize:9,display:"block",color:"#F97316"}}>🔄 Round {(t.completedRounds||[]).length+1}</span>}
{c.key!=="oemdealer"&&(t.completedRounds||[]).length>0&&t.status==="complete"&&<span style={{fontSize:9,display:"block",color:"#34D399"}}>✅ {(t.completedRounds||[]).length+1} rounds done</span>}
{c.key!=="oemdealer"&&!(t.completedRounds||[]).length&&t.status==="approved"&&<span style={{fontSize:9,display:"block",color:"#FDE68A"}}>RECON NOT STARTED {t.dateApproved?fmtDate(t.dateApproved):""}</span>}
{c.key!=="oemdealer"&&!(t.completedRounds||[]).length&&t.status==="started"&&<span style={{fontSize:9,display:"block",color:"#FBBF24"}}>{c.key==="cr"?"REQUESTED":c.key==="blackwidow"?"PICS REQUESTED":"WORK STARTED"} {t.dateStarted?fmtDate(t.dateStarted):""}</span>}
{c.key!=="oemdealer"&&!(t.completedRounds||[]).length&&t.status==="complete"&&<span style={{fontSize:9,display:"block"}}>{fmtDate(t.dateCompleted)}</span>}
{t.status==="declined"&&<span style={{fontSize:9,display:"block",color:"#FCA5A5"}}>DECLINED {(t.vendors||[]).filter((v2: any)=>v2.declined).map((v2: any)=>fmtDate(v2.declinedDate)).pop()||""}</span>}
{c.key==="parts"&&t.vendors&&(()=>{const sv2=(t.vendors||[]).find((x: any)=>x.selected);if(!sv2)return null;const wt2=t.workTasks||[];const pts2=wt2.filter((w: any)=>{const li9=(sv2.lineItems||[]).find((x: any)=>x.id===w.id)||{};return (w.isPart||c.key==="parts")&&!li9.declined&&li9.accepted;});if(!pts2.length)return null;const allInstalled=pts2.every((w: any)=>{const li2=(sv2.lineItems||[]).find((x: any)=>x.id===w.id)||{};return li2.partInstalled;});if(allInstalled)return <span style={{fontSize:8,display:"block",color:"#34D399"}}>ALL INSTALLED</span>;return pts2.map((w: any)=>{const li2=(sv2.lineItems||[]).find((x: any)=>x.id===w.id)||{};const st=li2.partInstalled?"✅":li2.partArrived?"📦":li2.partOrdered?"🔄":"⏳";const dt=li2.partInstalled?li2.partInstalledDate:li2.partArrived?li2.partArrivedDate:li2.partOrdered?li2.partOrderedDate:"";const lbl=li2.partInstalled?"Done":li2.partArrived?"Arrived":li2.partOrdered?"Ordered":"Pending";return <span key={w.id} style={{fontSize:8,display:"block",color:li2.partInstalled?"#34D399":li2.partArrived?"#60A5FA":li2.partOrdered?"#FBBF24":"#6B7280"}}>{st} {w.desc}: {lbl}{dt?" "+fmtDate(dt):""}</span>;});})()}
{c.key!=="oemdealer"&&(t.completedRounds||[]).length>0&&t.status!=="complete"&&t.status==="approved"&&<span style={{fontSize:8,display:"block",color:"#FDE68A"}}>NOT STARTED</span>}
{c.key!=="oemdealer"&&(t.completedRounds||[]).length>0&&t.status!=="complete"&&t.status==="started"&&<span style={{fontSize:8,display:"block",color:"#FBBF24"}}>STARTED {t.dateStarted?fmtDate(t.dateStarted):""}</span>}
</div>;})}
{vPriority===0&&<span style={{...S.badge,background:"#EF4444",color:"#FFF",fontSize:9,padding:"2px 5px"}}>🔴 PAST DUE</span>}
{vPriority===1&&<span style={{...S.badge,background:"#F59E0B",color:"#000",fontSize:9,padding:"2px 5px"}}>⚡ SOLD</span>}
{rc.length>0&&<span style={{color:"#E5E7EB",fontSize:11,alignSelf:"center"}}>{dn.length}/{rc.length}</span>}
{rc.length===0&&<span style={{color:"#4B5563",fontSize:11}}>None</span>}</div>}
</td>
</>}
</tr>;})}
</tbody></table>
{sorted2.length>renderLimit&&<div ref={sentinelRef} style={{textAlign:"center",padding:"16px 0",color:"#6B7280",fontSize:13}}>
  Showing {renderLimit} of {sorted2.length} — scrolling loads more…
</div>}
{sorted2.length<=renderLimit&&sorted2.length>0&&<div style={{textAlign:"center",padding:"8px 0",color:"#374151",fontSize:12}}>
  {sorted2.length} vehicle{sorted2.length!==1?"s":""}
</div>}
</div>
</span>;
}
