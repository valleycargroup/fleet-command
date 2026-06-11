import { useState } from 'react';
import { VCAT, ARB_SOURCES } from '../lib/constants';
import { fmtDate, vData } from '../lib/utils';
import { S } from '../lib/styles';
import { DateIn } from './DateIn';
import { ReconCategory } from './ReconCategory';
import { useStore, selectRoles } from '../lib/store';

export function VehicleDetail(){
const v = useStore((s: any) => s.selV);
const vendors = useStore((s: any) => s.vendors);
const allUsers = useStore((s: any) => s.allUsers);
const currentUser = useStore((s: any) => s.currentUser);
const notify = useStore((s: any) => s.notify);
const fireEmail = useStore((s: any) => s.fireEmail);
const upd = useStore((s: any) => s.upd);
const deleteVehicle = useStore((s: any) => s.deleteVehicle);
const setSelV = useStore((s: any) => s.setSelV);
const setDeepLinkCat = useStore((s: any) => s.setDeepLinkCat);
const deepLinkCat = useStore((s: any) => s.deepLinkCat);
const { isAdmin, isVendor } = useStore(selectRoles);
const onBack = () => { setSelV(null); setDeepLinkCat(null); };
const onUpdate = (u: any) => upd(v.id, u);
const onDelete = () => deleteVehicle(v);
const onClearDeepLink = () => setDeepLinkCat(null);
const [sm,setSm]=useState(false);const [sb,setSb]=useState(()=>{const names=((allUsers||[]).filter((u: any)=>u.role==="seller"||u.role==="admin"||u.is_seller===1).map((u: any)=>u.firstName+(u.lastName?" "+u.lastName:""))).filter((n: any)=>n);return names[0]||"";});const [st,setSt]=useState("");
const [showKick,setShowKick]=useState(false);const [kickReason,setKickReason]=useState("");const [lbImg2,setLbImg2]=useState(null as any);
const [editInb,setEditInb]=useState(true);const [editOut,setEditOut]=useState(true);const [editRetail,setEditRetail]=useState(false);const [retailForm,setRetailForm]=useState(v.transport?.retail||{});
const [showArbForm,setShowArbForm]=useState(false);const [arbSource,setArbSource]=useState(v.arb?.source||"");const [arbCustom,setArbCustom]=useState("");const [arbReason,setArbReason]=useState("");const [arbCloseReason,setArbCloseReason]=useState("");
const saveInb=(newInb: any)=>{setInbForm(newInb);const curOut=v.transport?.outbound||{};const syncOut=curOut.isDriveway?{...curOut,readyDate:newInb.driverwayClearDate||curOut.readyDate||"",eta:newInb.drivewayEta||curOut.eta||"",set:!!(newInb.driverwayClearDate||curOut.readyDate),pickedUp:newInb.drivewayPickedUp||curOut.pickedUp||false,datePickedUp:newInb.drivewayPickedUpDate||curOut.datePickedUp||""}:curOut;const locUp=newInb.destination?{location:newInb.destination}:{};onUpdate({...locUp,transport:{inbound:newInb,outbound:syncOut}});};
const saveOut=(newOut: any)=>{setOutForm(newOut);onUpdate({transport:{...v.transport,outbound:newOut}});};
const [inbForm,setInbForm]=useState(v.transport?.inbound||{});const [outForm,setOutForm]=useState(v.transport?.outbound||{});
const rcNeeded=VCAT.filter(c=>v.reconTasks[c.key]?.needed);
const rcDone=rcNeeded.filter(c=>v.reconTasks[c.key]?.status==="complete");
const rcApproved=rcNeeded.filter(c=>{const s=v.reconTasks[c.key]?.status;return s==="complete"||s==="approved";});
const allReconComplete=rcNeeded.length>0&&rcDone.length===rcNeeded.length;
const allReconApproved=rcNeeded.length>0&&rcApproved.length===rcNeeded.length&&rcApproved.every(c=>v.reconTasks[c.key]?.status==="complete");
const waitingBuyerApproval=(allReconComplete||v.noReconNeeded)&&!v.buyerApprovedShip;
const buyerApproved=v.buyerApprovedShip;
const allReconDone=buyerApproved;
const outboundLocked=!allReconDone;const isGrounded=v.transport?.inbound?.delivered||false;
const isInArb=v.arb?.open||false;
const canAssignVendors=isGrounded&&!isInArb;
const assign=(ck: any,vid: any)=>{const vl=vendors[ck]||[],vn=vl.find((x: any)=>x.id===vid);if(!vn)return;if(!isGrounded){notify("⚠️ Vehicle must be on ground before assigning vendors");return;}if(isInArb){notify("⚠️ Vehicle is in arbitration — recon paused");return;}const t={...v.reconTasks};
const existing=t[ck].vendors||[];if(existing.find((x: any)=>x.id===vn.id))return;const now=new Date().toISOString().split("T")[0];
const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;
const newVn={id:vn.id,name:vn.name,email:vn.email||"",phone:vn.phone||"",location:vn.location||"",estimate:null,etaDone:"",dateAssigned:now,dateCompleted:null,notes:"",selected:false,flaggedLate:false,reminderSent:false,
notifications:[{type:"assigned",date:now,msg:`Assigned to ${catName} on ${v.year} ${v.make} ${v.model} VIN:${v.vin8}`,sent:"sms+email"}]};
const newVendors=[...existing,newVn];
if(ck==="blackwidow"){newVn.selected=true;(newVn as any).bidLocked=true;newVn.estimate=0;(newVn as any).lineItems=[{id:"wt1",desc:"Advertising Photos",price:0,accepted:true,costType:"ws"}];
t[ck]={...t[ck],needed:true,status:"started",vendorId:vn.id,vendorName:vn.name,vendors:[newVn],dateAssigned:now,dateStarted:now,workTasks:[{id:"wt1",desc:"Advertising Photos",isPart:false}]};}
else if(ck==="cr"){newVn.selected=true;(newVn as any).bidLocked=true;newVn.estimate=0;(newVn as any).lineItems=[{id:"wt1",desc:"Condition Report",price:0,accepted:true,costType:"ws"}];
t[ck]={...t[ck],needed:true,status:"started",vendorId:vn.id,vendorName:vn.name,vendors:[newVn],dateAssigned:now,dateStarted:now,workTasks:[{id:"wt1",desc:"Condition Report",isPart:false}]};}
else{t[ck]={...t[ck],needed:true,status:t[ck].status==="unassigned"||t[ck].status==="na"?"assigned":t[ck].status,vendorId:vn.id,vendorName:newVendors.map((x: any)=>x.name).join(", "),vendors:newVendors,dateAssigned:t[ck].dateAssigned||now};}
onUpdate({reconTasks:t});notify(`📲 ${vn.name} notified via SMS & Email — ${catName} on ${v.year} ${v.make} ${v.model}`);
if(typeof fireEmail==="function"){const reconOrder=t[ck].order||null;const allOrdered=VCAT.filter(c2=>t[c2.key]?.needed&&t[c2.key]?.order).sort((a,b)=>(t[a.key].order||99)-(t[b.key].order||99));const aheadOfMe=allOrdered.filter(c2=>t[c2.key].order&&reconOrder&&t[c2.key].order<reconOrder).map(c2=>({name:c2.label,order:t[c2.key].order,status:t[c2.key].status||"unassigned"}));const totalOrdered=allOrdered.length;fireEmail("vendor_assigned",{vendor:{name:vn.name},vehicle:vData(v),category:catName,categoryKey:ck,tasks:(t[ck].workTasks||[]).map((w: any)=>({desc:w.desc,isPart:w.isPart})),reconOrder:reconOrder,totalReconSteps:totalOrdered,aheadTasks:aheadOfMe,isGrounded:true,groundedDate:v.transport?.inbound?.dateDelivered||""});}};
const updVendor=(ck: any,vid: any,updates: any,statusChange: any)=>{const t={...v.reconTasks};const vs=[...(t[ck].vendors||[])];const idx=vs.findIndex((x: any)=>x.id===vid);if(idx<0)return;
vs[idx]={...vs[idx],...updates};t[ck]={...t[ck],vendors:vs};
const totalEst=vs.reduce((s: any,vn: any)=>s+(Number(vn.estimate)||0),0);if(totalEst)t[ck].estimate=totalEst;
if(statusChange)t[ck]={...t[ck],...statusChange};
onUpdate({reconTasks:t});};
const selectVendor=(ck: any,vid: any)=>{const t={...v.reconTasks};const vs=[...(t[ck].vendors||[])];const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;const now=new Date().toISOString().split("T")[0];
vs.forEach((vn: any)=>{vn.selected=vn.id===vid;
if(vn.id===vid)vn.notifications=[...(vn.notifications||[]),{type:"selected",date:now,msg:`✅ You won the bid — start ${catName} work now`,sent:"sms+email"}];
});t[ck]={...t[ck],vendors:vs,status:"approved",dateApproved:now,estimate:vs.find((x: any)=>x.id===vid)?.estimate||t[ck].estimate};onUpdate({reconTasks:t});notify("📲 Bid Accepted — Approved");
const acceptedVn=vs.find((x: any)=>x.id===vid);
if(acceptedVn&&typeof fireEmail==="function"){const accItems=(acceptedVn.lineItems||[]).filter((x: any)=>x.accepted);const total=accItems.reduce((s: any,x: any)=>s+(Number(x.price)||0),0);fireEmail("vendor_bid_accepted",{vendor:{name:acceptedVn.name},vehicle:vData(v),category:VCAT.find(c2=>c2.key===ck)?.label||ck,categoryKey:ck,lineItems:accItems.map((x: any)=>({desc:x.desc,price:x.price,costType:x.costType||"ws"})),totalApproved:total,approvedBy:v.buyingBroker||"Buyer",approvedDate:new Date().toISOString().split("T")[0]});};};
const sendReminder=(ck: any,vid: any)=>{const t={...v.reconTasks};const vs=[...(t[ck].vendors||[])];const idx=vs.findIndex((x: any)=>x.id===vid);if(idx<0)return;const now=new Date().toISOString().split("T")[0];
vs[idx].notifications=[...(vs[idx].notifications||[]),{type:"reminder",date:now,msg:`⚠️ PAST DUE — ${VCAT.find(c2=>c2.key===ck)?.label||ck} on ${v.year} ${v.make} ${v.model}`,sent:"sms+email"}];
vs[idx].reminderSent=true;vs[idx].lastReminder=now;
t[ck]={...t[ck],vendors:vs};onUpdate({reconTasks:t});notify(`⚠️ Past-due reminder sent to ${vs[idx].name}`);
const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;
if(typeof fireEmail==="function")fireEmail("vendor_assigned",{vendor:{name:vs[idx].name},vehicle:vData(v),category:"⚠️ PAST DUE — "+catName,tasks:[{desc:"PAST DUE REMINDER — Complete "+catName+" ASAP",isPart:false}]});};
const reassignNext=(ck: any,vid: any)=>{const t={...v.reconTasks};const vs=[...(t[ck].vendors||[])];const now=new Date().toISOString().split("T")[0];
const cur=vs.findIndex((x: any)=>x.id===vid);if(cur<0)return;vs[cur].selected=false;vs[cur].flaggedLate=true;
vs[cur].notifications=[...(vs[cur].notifications||[]),{type:"removed",date:now,msg:`Job removed — reassigned to next vendor`,sent:"sms+email"}];
const next=vs.find((x: any,i: any)=>i!==cur&&!x.flaggedLate);
if(next){next.selected=true;next.notifications=[...(next.notifications||[]),{type:"reassigned",date:now,msg:`🔄 Job reassigned to you — previous vendor late`,sent:"sms+email"}];
t[ck]={...t[ck],vendors:vs};onUpdate({reconTasks:t});notify(`📲 Job reassigned to ${next.name} — both vendors notified`);
const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;
if(typeof fireEmail==="function")fireEmail("vendor_assigned",{vendor:{name:next.name},vehicle:vData(v),category:catName,tasks:[{desc:"🔄 REASSIGNED — Previous vendor removed (late)",isPart:false}]});}
else{t[ck]={...t[ck],vendors:vs};onUpdate({reconTasks:t});notify("⚠️ No other vendors to reassign — add a new vendor");};};
const est=(ck: any,a: any)=>{const t={...v.reconTasks};t[ck]={...t[ck],status:"estimated",estimate:Number(a)};onUpdate({reconTasks:t});};
const apr=(ck: any)=>{const t={...v.reconTasks};t[ck]={...t[ck],status:"approved"};onUpdate({reconTasks:t});};
const startRecon=(ck: any,eta: any)=>{const t={...v.reconTasks};
const sv6=(t[ck].vendors||[]).find((x: any)=>x.selected);if(sv6&&(sv6.lineItems||[]).length>0&&!(sv6.lineItems||[]).every((x: any)=>x.accepted||x.declined)){notify("⚠️ Buyer must accept/decline all bid items before work can start");return;}
const partsItems=(sv6?.lineItems||[]).filter((x: any)=>x.accepted&&x.isPart&&!x.declined);if(partsItems.length>0&&!partsItems.every((x: any)=>x.partArrived)){notify("⚠️ All accepted parts must arrive before starting work");return;}
if(ck==="parts"&&sv6){const allParts=(sv6.lineItems||[]).filter((x: any)=>x.accepted&&!x.declined);if(allParts.length>0&&!allParts.every((x: any)=>x.partArrived)){notify("⚠️ All accepted parts must arrive before starting work");return;}}
let fixedEta=eta;if(fixedEta&&fixedEta.startsWith("00"))fixedEta="20"+fixedEta.slice(2);t[ck]={...t[ck],status:"started",dateStarted:new Date().toISOString().split("T")[0],etaComplete:fixedEta};onUpdate({reconTasks:t});notify("🔧 Work started");
const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;
const sv=(t[ck].vendors||[]).find((x: any)=>x.selected);
if(typeof fireEmail==="function"&&sv){const items=(sv.lineItems||[]).filter((x: any)=>x.accepted);const total=items.reduce((s: any,x: any)=>s+(Number(x.price)||0),0);const findItems=(sv.vendorFindings||[]).filter((x: any)=>x.approved);const findTotal=findItems.reduce((s: any,x: any)=>s+(Number(x.price)||0),0);fireEmail("vendor_work_started",{buyer:v.buyingBroker||"Buyer",vendor:{name:sv.name},vehicle:vData(v),category:catName,lineItems:[...items.map((x: any)=>({desc:x.desc,price:x.price,costType:x.costType||"ws"})),...findItems.map((x: any)=>({desc:"🔍 "+x.desc,price:x.price,costType:x.findingCostType||"ws"}))],totalApproved:total+findTotal,startedDate:new Date().toISOString().split("T")[0],etaComplete:fixedEta||""});}};
const cmp=(ck: any)=>{const t={...v.reconTasks};const cur=t[ck];const sv=(cur.vendors||[]).find((x: any)=>x.selected);const taskDescs=(cur.workTasks||[]).map((w: any)=>w.desc).join(", ");const totalCost=sv?(sv.lineItems||[]).filter((x: any)=>x.accepted).reduce((s: any,x: any)=>s+(Number(x.price)||0),0):0;const findCost=sv?(sv.vendorFindings||[]).filter((x: any)=>x.approved).reduce((s: any,x: any)=>s+(Number(x.price)||0),0):0;const rounds=[...(cur.completedRounds||[]),{tasks:taskDescs,cost:totalCost+findCost,date:new Date().toISOString().split("T")[0],vendor:sv?.name||cur.vendorName||"",photoCount:(cur.photos||[]).length-(cur.roundPhotoStart||0)}];t[ck]={...t[ck],status:"complete",dateCompleted:new Date().toISOString().split("T")[0],completedRounds:rounds};
const catName=VCAT.find(c2=>c2.key===ck)?.label||ck;
const sv3=(t[ck].vendors||[]).find((x: any)=>x.selected);
const rcNeeded2=VCAT.filter(c=>t[c.key]?.needed);
const rcDone2=rcNeeded2.filter(c=>t[c.key]?.status==="complete");
const allDone=rcNeeded2.length>0&&rcDone2.length===rcNeeded2.length;
const updatePayload: any={reconTasks:t};
if(allDone&&!v.transport?.outbound?.readyDate){
  const today=new Date().toISOString().split("T")[0];
  updatePayload.transport={...(v.transport||{}),outbound:{...(v.transport?.outbound||{set:false}),readyDate:today}};
}
onUpdate(updatePayload);notify(allDone?"Complete ✅ — Ready to Ship":"Complete ✅");
if(typeof fireEmail==="function"){
  const items=(sv3?.lineItems||[]).filter((x: any)=>x.accepted);const total=items.reduce((s: any,x: any)=>s+(Number(x.price)||0),0);
  const findItems2=(sv3?.vendorFindings||[]).filter((x: any)=>x.approved);const findTotal2=findItems2.reduce((s: any,x: any)=>s+(Number(x.price)||0),0);
  fireEmail("buyer_work_complete",{buyer:v.buyingBroker||"Buyer",vendor:{name:sv3?.name||"Vendor"},vehicle:vData(v),category:catName,categoryKey:ck,lineItems:[...items.map((x: any)=>({desc:x.desc,price:x.price,costType:x.costType||"ws"})),...findItems2.map((x: any)=>({desc:"🔍 "+x.desc,price:x.price,costType:x.findingCostType||"ws"}))],totalCost:total+findTotal2});
  if(allDone){const summary=rcNeeded2.map(c=>{const ct=t[c.key];const sv2=(ct.vendors||[]).find((x: any)=>x.selected);const cost=(sv2?.lineItems||[]).filter((x: any)=>x.accepted).reduce((s: any,x: any)=>s+(Number(x.price)||0),0);const fCost=(sv2?.vendorFindings||[]).filter((x: any)=>x.approved).reduce((s: any,x: any)=>s+(Number(x.price)||0),0);return {icon:c.icon,category:c.label,vendor:sv2?.name||"—",cost:cost+fCost};});const totalRecon=summary.reduce((s: any,x: any)=>s+x.cost,0);fireEmail("buyer_recon_complete",{buyer:v.buyingBroker||"Buyer",seller:v.sellingBroker||"",vehicle:vData(v),reconSummary:summary,totalReconCost:totalRecon});}
}};
const tog=(ck: any)=>{const t={...v.reconTasks};const cur=t[ck]||{};if(cur.needed){t[ck]={...cur,needed:false,status:"na"};}else{t[ck]={...cur,needed:true,status:cur.completedRounds?.length>0?"unassigned":"unassigned",vendorId:null,vendorName:null,estimate:null,notes:"",photos:cur.photos||[]};}onUpdate({reconTasks:t});};
const inb=v.transport?.inbound,outb=v.transport?.outbound;
const reconCost=VCAT.reduce((s: any,c)=>{const t=v.reconTasks[c.key];if(!t?.needed)return s;if(t.status!=="approved"&&t.status!=="complete")return s;
const sel=(t.vendors||[]).find((vn: any)=>vn.selected);return s+(sel?Number(sel.estimate)||0:Number(t.estimate)||0);},0);
const inbCost=inb?.cost||0;const outbCost=outb?.cost||0;
return <div><div style={{display:"flex",gap:8,alignItems:"center"}}><button style={{padding:"10px 20px",fontSize:16,fontWeight:700,borderRadius:8,background:"#1E3A5F",color:"#93C5FD",border:"2px solid #3B82F6",cursor:"pointer"}} onClick={onBack}>← Back</button>
{isAdmin&&onDelete&&<button style={{padding:"10px 16px",fontSize:13,fontWeight:600,borderRadius:8,background:"transparent",color:"#F87171",border:"1px solid #7F1D1D",cursor:"pointer"}} onClick={onDelete}>🗑️ Delete</button>}</div>
{(v.status==="sold"||v.status==="delivered")?<div style={{margin:"10px 0",padding:"10px 14px",borderRadius:8,background:"#0D3B1E33",borderLeft:"4px solid #34D399",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div><div style={{fontSize:13,color:"#34D399",fontWeight:700,marginBottom:2}}>💰 SOLD — Customer waiting</div><div style={{fontSize:12,color:"#6EE7B7"}}>Sold to {v.soldTo||"—"}{v.soldDate?" on "+fmtDate(v.soldDate):""}</div></div><span style={{fontSize:11,padding:"6px 12px",borderRadius:6,background:"#166534",color:"#6EE7B7",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Priority</span></div>
:<div style={{margin:"10px 0",padding:"10px 14px",borderRadius:8,background:"#1A1A2E",borderLeft:"4px solid #6B7280",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><div><div style={{fontSize:13,color:"#9CA3AF",fontWeight:700,marginBottom:2}}>📦 IN INVENTORY — Not yet sold</div><div style={{fontSize:12,color:"#6B7280"}}>Standard turnaround</div></div><span style={{fontSize:11,padding:"6px 12px",borderRadius:6,background:"#2A2A3E",color:"#9CA3AF",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Standard</span></div>}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",margin:"12px 0",flexWrap:"wrap",gap:12}}>
<div><h2 style={{margin:0,fontSize:22,fontWeight:800,color:"#F1F5F9"}}>{v.year} {v.make} {v.model} {v.trim}</h2>
<div style={{display:"flex",gap:20,flexWrap:"wrap",color:"#E5E7EB",fontSize:17,marginTop:8}}>
<span>VIN: <b style={{fontFamily:"monospace"}}>{v.fullVin||v.vin8}</b></span><span>Color: <b>{v.color}</b></span><span>Miles: <b>{v.miles.toLocaleString()}</b></span>
<span>Location: <b>{v.location}</b></span><span>Buyer: <b>{v.buyingBroker}</b></span>
{v.sellingBroker&&<span>Seller: <b>{v.sellingBroker}</b></span>}</div></div>
<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
{v.status!=="sold"&&v.status!=="delivered"&&<button style={{...S.btn,background:"#7F1D1D"}} onClick={()=>setSm(true)}>Mark Sold</button>}
{v.status==="sold"&&<button style={{...S.btn,background:"#166534"}} onClick={()=>{onUpdate({status:"delivered",deliveredDate:new Date().toISOString().split("T")[0]});notify("On Ground");
if(typeof fireEmail==="function")fireEmail("vehicle_grounded",{buyer:v.buyingBroker||"",seller:v.sellingBroker||"",dealer:v.soldTo||"",vehicle:vData(v),location:v.location||"",groundedDate:new Date().toISOString().split("T")[0]});}}>Mark On Ground</button>}
{(v.status==="sold"||v.status==="delivered")&&<button style={{padding:"7px 16px",borderRadius:6,border:"2px solid #F97316",background:"#7C2D12",color:"#FDBA74",fontSize:14,cursor:"pointer",fontWeight:800}}
onClick={()=>{setShowKick(true);setKickReason("");}}>🔄 Kicked</button>}
{v.status==="sold"&&<button style={{padding:"7px 16px",borderRadius:6,border:"2px solid #6B7280",background:"#1A1A2E",color:"#9CA3AF",fontSize:14,cursor:"pointer",fontWeight:800}}
onClick={()=>{onUpdate({status:"in_recon",soldTo:null,soldDate:null,sellingBroker:"",
buyerApprovedShip:false,buyerApprovedDate:null,shippingHoldDate:null,shippingHoldBy:null,
transport:{...v.transport,outbound:{set:false,destination:"",eta:"",cost:0,pickedUp:false,datePickedUp:"",delivered:false,dateDelivered:"",readyDate:"",isDriveway:false}}
});notify("↩️ Sale reversed — vehicle back in inventory");}}>↩️ Unsell</button>}
</div></div>
<div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12,alignItems:"stretch"}}>
{(v.kickedHistory||[]).map((k: any,i: any)=><div key={i} style={{padding:"12px 18px",borderRadius:10,background:"#3B1515",border:"2px solid #7F1D1D",minWidth:260}}>
<div style={{fontSize:13,color:"#FCA5A5",textTransform:"uppercase",letterSpacing:2,fontWeight:600}}>Kicked — #{i+1}</div>
<div style={{fontSize:28,fontWeight:900,color:"#F87171",marginTop:4}}>{k.dealer}</div>
<div style={{fontSize:14,color:"#FCA5A5",marginTop:6,fontWeight:600}}>📅 Sold: {k.soldDate?fmtDate(k.soldDate):"—"}</div>
<div style={{fontSize:14,color:"#FCA5A5",fontWeight:600}}>🔄 Kicked: {k.kickedDate?fmtDate(k.kickedDate):"—"}</div>
{k.sellingBroker&&<div style={{fontSize:13,color:"#9CA3AF",marginTop:2}}>Seller: {k.sellingBroker}</div>}
{k.reason&&<div style={{fontSize:13,color:"#FDBA74",marginTop:6,padding:"6px 10px",background:"rgba(249,115,22,0.1)",borderRadius:4,border:"1px solid #7C2D12"}}>📝 {k.reason}</div>}
</div>)}
{(v.soldTo&&v.soldTo!=="null"&&v.status==="sold")&&(()=>{
const isReSold=(v.kickedHistory||[]).length>0;
return <div style={{padding:"12px 18px",borderRadius:10,background:"#0D3B1E",border:"2px solid #166534",minWidth:260}}>
<div style={{fontSize:13,color:"#6EE7B7",textTransform:"uppercase",letterSpacing:2,fontWeight:600}}>{isReSold?"🔄 Re-Sold To":"Sold To"}</div>
<div style={{fontSize:28,fontWeight:900,color:"#34D399",marginTop:4}}>{v.soldTo}</div>
{v.soldDate&&<div style={{fontSize:16,color:"#6EE7B7",marginTop:6,fontWeight:600}}>📅 Sold: {fmtDate(v.soldDate)}</div>}
</div>;})()}
</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}><div style={{...S.card,borderTop:`4px solid ${inb?.delivered?"#34D399":inb?.set?"#FBBF24":"#EF4444"}`,padding:18}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<span style={{fontWeight:800,color:"#E5E7EB",fontSize:18}}>🚛 Inbound Transport</span>
</div>
{inb?.kickedReturn&&<div style={{padding:"8px 14px",marginBottom:10,borderRadius:6,background:"#7C2D12",border:"1px solid #F97316"}}>
<span style={{fontSize:15,fontWeight:800,color:"#FDBA74"}}>🔄 KICKED RETURN — Pick up from: <span style={{color:"#FFF"}}>{inb.pickupFrom||v.kickedFromDealer||"—"}</span></span>
</div>}
{true?<div style={{display:"grid",gap:12}}>
{inb?.kickedReturn&&<label style={{...S.fl,fontSize:15}}>Pick Up From (Dealer)<input style={{...S.fi,fontSize:18,padding:"10px 14px",color:"#FDBA74"}} value={inbForm.pickupFrom||""} onChange={(e: any)=>setInbForm({...inbForm,pickupFrom:e.target.value})} onBlur={()=>saveInb(inbForm)}/></label>}
<div style={{padding:14,background:"#0D0D1A",borderRadius:8,border:"1px solid #2A2A3E"}}>
<div style={{fontSize:16,fontWeight:700,color:"#E5E7EB",marginBottom:10}}>🚛 Transport</div>
<label style={{...S.fl,fontSize:15,marginBottom:8}}>Destination *
<select style={{...S.fi,fontSize:18,padding:"10px 14px"}} value={inbForm.destination||""} onChange={(e: any)=>{const nf={...inbForm,destination:e.target.value};setInbForm(nf);saveInb(nf);}}>
<option value="">Select location...</option>
<option value="PHX">PHX</option>
<option value="Dallas">Dallas</option>
</select></label>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<label style={{...S.fl,fontSize:15}}>Company *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.company||""} onChange={(e: any)=>setInbForm({...inbForm,company:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Company"/></label>
<label style={{...S.fl,fontSize:15}}>Phone *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.phone||""} onChange={(e: any)=>setInbForm({...inbForm,phone:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Phone #"/></label>
<label style={{...S.fl,fontSize:15}}>Email *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.email||""} onChange={(e: any)=>setInbForm({...inbForm,email:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Email"/></label>
</div>
<label style={{...S.fl,fontSize:15}}>Cost ($)<input style={{...S.fi,fontSize:18,padding:"10px 14px"}} type="number" value={inbForm.cost||""} onChange={(e: any)=>setInbForm({...inbForm,cost:Number(e.target.value)})} onBlur={()=>saveInb(inbForm)}/></label>
<label style={{...S.fl,fontSize:15}}>ETA Date<DateIn style={{fontSize:18,padding:"10px 14px"}} value={inbForm.eta||""} onChange={(v2: any)=>{if(!inbForm.destination||!inbForm.company){notify("⚠️ Fill in destination and company before setting ETA");return;}const nf={...inbForm,eta:v2,set:!!v2};setInbForm(nf);saveInb(nf);if(v2&&typeof fireEmail==="function")fireEmail("transport_inbound_set",{buyer:v.buyingBroker||"",vehicle:vData(v),transport:{company:nf.company||"",phone:nf.phone||"",email:nf.email||"",eta:v2,destination:nf.destination||v.location||"",cost:nf.cost||0}});}}/></label>
{inbForm.eta&&!inbForm.delivered&&<div style={{fontSize:14,color:"#FBBF24",fontWeight:600,marginTop:6}}>📅 ETA: {fmtDate(inbForm.eta)}</div>}
<label style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#E5E7EB",fontWeight:600,marginTop:10}}><input type="checkbox" style={{width:20,height:20}} checked={inbForm.delivered||false} onChange={(e: any)=>{if(e.target.checked){const isDW2=inbForm.drivewayDest||inbForm.driverwayClearDate;if(!isDW2&&(!inbForm.company||!inbForm.destination||!inbForm.eta)){notify("⚠️ Fill in company, destination, and ETA first");return;}if(isDW2&&(!inbForm.drivewayDest||!inbForm.dwCompany)){notify("⚠️ Fill in driveway destination and company first");return;}const nf={...inbForm,delivered:true,dateDelivered:new Date().toISOString().split("T")[0]};setInbForm(nf);saveInb(nf);if(typeof fireEmail==="function")fireEmail("vehicle_grounded",{buyer:v.buyingBroker||"",seller:v.sellingBroker||"",dealer:v.soldTo||"",vehicle:vData(v),location:nf.destination||v.location||"",groundedDate:nf.dateDelivered});}else{const nf={...inbForm,delivered:false,dateDelivered:""};setInbForm(nf);saveInb(nf);}}}/> Grounded</label>
{inbForm.delivered&&<div style={{fontSize:16,color:"#34D399",fontWeight:700,padding:"10px 14px",background:"#0D3B1E",borderRadius:6,border:"1px solid #166534",marginTop:6}}>📅 Grounded: {fmtDate(inbForm.dateDelivered)}</div>}
</div>
{!inb?.kickedReturn&&<div style={{padding:14,background:"#1A1A2E",borderRadius:8,border:"1px solid #4C1D95",marginBottom:4}}>
<div style={{fontSize:16,fontWeight:700,color:"#C4B5FD",marginBottom:8}}>🏠 Driveway Buy</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
<label style={{...S.fl,fontSize:15}}>Company *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.dwCompany||""} onChange={(e: any)=>setInbForm({...inbForm,dwCompany:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Company"/></label>
<label style={{...S.fl,fontSize:15}}>Phone *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.dwPhone||""} onChange={(e: any)=>setInbForm({...inbForm,dwPhone:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Phone #"/></label>
<label style={{...S.fl,fontSize:15}}>Email *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={inbForm.dwEmail||""} onChange={(e: any)=>setInbForm({...inbForm,dwEmail:e.target.value})} onBlur={()=>saveInb(inbForm)} placeholder="Email"/></label>
</div>
<label style={{...S.fl,fontSize:15}}>Destination *
<select style={{...S.fi,fontSize:18,padding:"10px 14px"}} value={inbForm.drivewayDest||""} onChange={(e: any)=>{const nf={...inbForm,drivewayDest:e.target.value};setInbForm(nf);saveInb(nf);}}>
<option value="">Select destination...</option>
<option value="PHX">PHX</option>
<option value="Dallas">Dallas</option>
{v.soldTo&&<option value={v.soldTo}>🏢 {v.soldTo} (Buying Dealer)</option>}
</select></label>
{inbForm.drivewayDest&&<div style={{marginTop:8}}>
<label style={{...S.fl,fontSize:15}}>Clear to Pick Up Date<DateIn style={{fontSize:18,padding:"10px 14px"}} value={inbForm.driverwayClearDate||""} onChange={(v2: any)=>{const nf={...inbForm,driverwayClearDate:v2};setInbForm(nf);saveInb(nf);}}/></label>
{inbForm.driverwayClearDate&&<div style={{fontSize:14,color:"#DDD6FE",fontWeight:600,marginTop:4}}>✅ Clear: {fmtDate(inbForm.driverwayClearDate)}</div>}
{inbForm.driverwayClearDate&&<label style={{...S.fl,fontSize:15,marginTop:8}}>ETA Pick Up<DateIn style={{fontSize:18,padding:"10px 14px"}} value={inbForm.drivewayEta||""} onChange={(v2: any)=>{const nf={...inbForm,drivewayEta:v2};setInbForm(nf);saveInb(nf);}}/></label>}
{inbForm.drivewayEta&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#E5E7EB",fontWeight:600,marginTop:8}}><input type="checkbox" style={{width:20,height:20}} checked={inbForm.drivewayPickedUp||false} onChange={(e: any)=>{const now=new Date().toISOString().split("T")[0];if(e.target.checked){const nf2={...inbForm,drivewayPickedUp:true,drivewayPickedUpDate:now};setInbForm(nf2);saveInb(nf2);const outb=v.transport?.outbound||{};if(outb.isDriveway){onUpdate({transport:{...v.transport,outbound:{...outb,pickedUp:true,datePickedUp:now,readyDate:outb.readyDate||inbForm.driverwayClearDate||"",eta:outb.eta||inbForm.drivewayEta||"",set:true}}});}}else{const nf2={...inbForm,drivewayPickedUp:false,drivewayPickedUpDate:""};setInbForm(nf2);saveInb(nf2);}}}/> Picked Up</label>}
{inbForm.drivewayPickedUp&&<div style={{fontSize:15,color:"#34D399",fontWeight:700,marginTop:6}}>📅 Picked Up: {fmtDate(inbForm.drivewayPickedUpDate)}</div>}
</div>}
</div>}
<button style={{...S.btn,fontSize:16,padding:"12px",background:"#7F1D1D",color:"#FCA5A5"}} onClick={()=>{onUpdate({transport:{...v.transport,inbound:{set:false,destination:"",eta:"",cost:0,delivered:false,dateDelivered:"",company:"",phone:"",email:"",drivewayDest:"",driverwayClearDate:"",drivewayEta:"",drivewayPickedUp:false,drivewayPickedUpDate:"",dwCompany:"",dwPhone:"",dwEmail:""}}});setInbForm({});notify("🗑️ Inbound transport cleared");}}>🗑️ Clear Transport</button>
</div>
:<div style={{display:"grid",gap:8,fontSize:16,color:"#E5E7EB"}}></div>}
</div><div style={{...S.card,borderTop:`4px solid ${outb?.pickedUp?"#34D399":outb?.set?"#FBBF24":"#4B5563"}`,padding:18}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
<span style={{fontWeight:800,color:"#E5E7EB",fontSize:18}}>🚚 Outbound Transport</span>
{!allReconComplete&&!v.noReconNeeded&&rcNeeded.length>0?
<span style={{padding:"8px 16px",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",fontSize:18,fontWeight:800}}>🔒 RECON INCOMPLETE ({rcNeeded.length-rcDone.length} remaining)</span>
:!v.noReconNeeded&&rcNeeded.length===0&&!v.buyerApprovedShip?
<span style={{padding:"8px 16px",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",fontSize:16,fontWeight:800}}>🔒 Set Recon or mark No Recon Needed first</span>
:waitingBuyerApproval?
<div style={{display:"flex",flexDirection:"column",gap:6}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{padding:"8px 16px",borderRadius:8,background:"#78590A",color:"#FDE68A",fontSize:16,fontWeight:800}}>⏳ WAITING ON BUYER APPROVAL</span>
<button style={{padding:"8px 16px",borderRadius:8,background:"#166534",color:"#6EE7B7",fontSize:16,fontWeight:800,border:"none",cursor:"pointer"}}
onClick={()=>{onUpdate({buyerApprovedShip:true,buyerApprovedDate:new Date().toISOString().split("T")[0]});notify("✅ Buyer approved — ready to ship!");
if(typeof fireEmail==="function")fireEmail("buyer_approved_shipping",{buyer:v.buyingBroker||"",vehicle:vData(v),dealer:v.soldTo||"",approvedDate:new Date().toISOString().split("T")[0]});}}>
✅ Approve Shipping</button>
</div>
{v.shippingHoldDate&&<div style={{fontSize:13,color:"#FCA5A5"}}>🛑 Previously held by {v.shippingHoldBy} on {fmtDate(v.shippingHoldDate)}</div>}
</div>
:buyerApproved?
<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
<span style={{padding:"8px 16px",borderRadius:8,background:"#166534",color:"#6EE7B7",fontSize:16,fontWeight:800}}>✅ BUYER APPROVED SHIPPING {v.buyerApprovedDate?fmtDate(v.buyerApprovedDate):""}</span>
<button style={{padding:"8px 16px",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",fontSize:14,fontWeight:800,border:"none",cursor:"pointer"}}
onClick={()=>{onUpdate({buyerApprovedShip:false,buyerApprovedDate:null,shippingHoldDate:new Date().toISOString().split("T")[0],shippingHoldBy:v.buyingBroker});notify("🛑 Shipping on HOLD — buyer unapproved");}}>
🛑 Hold Shipping</button>
</div>
:v.noReconNeeded?
<div style={{display:"flex",alignItems:"center",gap:8}}>
<span style={{padding:"8px 16px",borderRadius:8,background:"#06B6D4",color:"#FFF",fontSize:18,fontWeight:800}}>✅ NO RECON NEEDED</span>
</div>
:null}
</div>
{true?<div style={{display:"grid",gap:12}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
<label style={{...S.fl,fontSize:15}}>Company *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={outForm.company||""} onChange={(e: any)=>setOutForm({...outForm,company:e.target.value})} onBlur={()=>saveOut(outForm)} placeholder="Company"/></label>
<label style={{...S.fl,fontSize:15}}>Phone *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={outForm.phone||""} onChange={(e: any)=>setOutForm({...outForm,phone:e.target.value})} onBlur={()=>saveOut(outForm)} placeholder="Phone #"/></label>
<label style={{...S.fl,fontSize:15}}>Email *<input style={{...S.fi,fontSize:16,padding:"10px 14px"}} value={outForm.email||""} onChange={(e: any)=>setOutForm({...outForm,email:e.target.value})} onBlur={()=>saveOut(outForm)} placeholder="Email"/></label>
</div>
<label style={{...S.fl,fontSize:15}}>Destination{outForm.isRetail&&outForm.deliveryAddress?<div style={{fontSize:14,fontWeight:700,color:"#67E8F9",padding:"10px 14px",background:"#0D2B3E",borderRadius:6,border:"1px solid #164E63"}}>🏪 {outForm.customerName||"Customer"} — {outForm.deliveryAddress}</div>:outForm.isDriveway&&v.soldTo?<div style={{fontSize:14,fontWeight:700,color:"#34D399",padding:"10px 14px",background:"#0D3B1E",borderRadius:6,border:"1px solid #166534"}}>🏢 {v.soldTo} (Buying Dealer)</div>:v.soldTo?<div style={{fontSize:14,fontWeight:700,color:"#34D399",padding:"10px 14px",background:"#0D3B1E",borderRadius:6,border:"1px solid #166534"}}>🏢 {v.soldTo}</div>:<div style={{fontSize:14,color:"#6B7280",padding:"10px 14px",background:"#0D0D1A",borderRadius:6,border:"1px solid #2A2A3E"}}>No buyer — sell vehicle first</div>}</label>
<label style={{...S.fl,fontSize:15}}>Shipping From *<select style={{...S.fi,fontSize:18,padding:"10px 14px"}} value={outForm.shippingFrom||""} onChange={(e: any)=>{const nf={...outForm,shippingFrom:e.target.value};setOutForm(nf);saveOut(nf);}}><option value="">Select...</option><option value="PHX">PHX</option><option value="Dallas">Dallas</option></select></label>
<label style={{...S.fl,fontSize:15}}>Cost ($)<input style={{...S.fi,fontSize:18,padding:"10px 14px"}} type="number" value={outForm.cost===0?"":outForm.cost||""} onChange={(e: any)=>{const val=e.target.value===""?0:parseFloat(e.target.value);setOutForm({...outForm,cost:val});}} onBlur={()=>saveOut(outForm)}/></label>
<div style={{display:"flex",gap:8}}>
<button style={{flex:1,padding:12,borderRadius:8,cursor:"pointer",textAlign:"center",fontSize:16,fontWeight:700,border:!outForm.isDriveway&&!outForm.isRetail?"2px solid #3B82F6":"2px solid #2A2A3E",background:!outForm.isDriveway&&!outForm.isRetail?"#1E3A5F":"#0D0D1A",color:!outForm.isDriveway&&!outForm.isRetail?"#93C5FD":"#6B7280"}}
onClick={()=>{const nf={...outForm,isDriveway:false,isRetail:false,dealerHandling:false};setOutForm(nf);saveOut(nf);}}>🚛 Lot Pick Up</button>
<button style={{flex:1,padding:12,borderRadius:8,cursor:"pointer",textAlign:"center",fontSize:16,fontWeight:700,border:outForm.dealerHandling?"2px solid #34D399":"2px solid #2A2A3E",background:outForm.dealerHandling?"#0D3B1E":"#0D0D1A",color:outForm.dealerHandling?"#34D399":"#6B7280"}} onClick={()=>{const nf={...outForm,dealerHandling:true,isDriveway:false,isRetail:false,company:v.soldTo||""};setOutForm(nf);saveOut(nf);}}>🏢 Dealer P/U</button>
<button style={{flex:1,padding:12,borderRadius:8,cursor:"pointer",textAlign:"center",fontSize:16,fontWeight:700,border:outForm.isDriveway?"2px solid #7C3AED":"2px solid #2A2A3E",background:outForm.isDriveway?"#4C1D95":"#0D0D1A",color:outForm.isDriveway?"#DDD6FE":"#6B7280"}}
onClick={()=>{const inb2=v.transport?.inbound||{};const dest=v.soldTo||outForm.destination||"";setOutForm({...outForm,isDriveway:true,isRetail:false,destination:dest,readyDate:inb2.driverwayClearDate||outForm.readyDate||"",eta:inb2.drivewayEta||outForm.eta||"",set:!!(inb2.driverwayClearDate||outForm.readyDate),pickedUp:inb2.drivewayPickedUp||outForm.pickedUp||false,datePickedUp:inb2.drivewayPickedUpDate||outForm.datePickedUp||""});}}>🏠 Driveway Delivery</button>
<button style={{flex:1,padding:12,borderRadius:8,cursor:"pointer",textAlign:"center",fontSize:16,fontWeight:700,border:outForm.isRetail?"2px solid #06B6D4":"2px solid #2A2A3E",background:outForm.isRetail?"#164E63":"#0D0D1A",color:outForm.isRetail?"#67E8F9":"#6B7280"}}
onClick={()=>{const nf={...outForm,isDriveway:false,isRetail:true};setOutForm(nf);saveOut(nf);}}>🏪 Retail Delivery</button>
</div>
<div style={{padding:14,background:"#1A1A2E",borderRadius:8,border:`1px solid ${outForm.isDriveway?"#4C1D95":"#2A2A3E"}`}}>
<div style={{fontSize:16,fontWeight:700,color:"#E5E7EB",marginBottom:10}}>{outForm.isDriveway?"🏠 Driveway Steps":outForm.isRetail?"🏪 Retail Delivery Steps":"📋 Lot Pick Up Steps"}</div>
<div style={{padding:"10px 12px",marginBottom:8,borderRadius:6,background:outForm.readyDate?"#0D3B1E":"#0D0D1A",border:`1px solid ${outForm.readyDate?"#166534":"#2A2A3E"}`}}>
<label style={{...S.fl,fontSize:15}}>① {outForm.isDriveway?"Clear to P/U":outForm.isRetail?"Ready to Ship":"Ready to Pick Up"}
<div style={{display:"flex",gap:6}}>
<DateIn style={{fontSize:16,padding:"8px 12px"}} value={outForm.readyDate||""} onChange={(v2: any)=>{if(!outForm.isDriveway&&!outForm.company){notify("⚠️ Fill in transport company first");return;}const nf={...outForm,readyDate:v2,set:true};setOutForm(nf);saveOut(nf);}}/>
{outForm.readyDate&&<button style={{...S.sm,fontSize:14,color:"#F87171",padding:"8px 12px"}} onClick={()=>{const nf={...outForm,readyDate:""};setOutForm(nf);saveOut(nf);}}>✕</button>}
</div>
</label>
{outForm.readyDate&&<div style={{fontSize:14,color:"#34D399",fontWeight:600,marginTop:4}}>✓ Ready {fmtDate(outForm.readyDate)}</div>}
</div><div style={{padding:"10px 12px",marginBottom:8,borderRadius:6,background:outForm.eta?"#1A2940":"#0D0D1A",border:`1px solid ${outForm.eta?"#1E3A5F":"#2A2A3E"}`}}>
<label style={{...S.fl,fontSize:15}}>② {outForm.isDriveway?"ETA Driveway Arrival":outForm.isRetail?"ETA Pick Up From "+(outForm.shippingFrom||"Location"):"ETA Pick Up"}
<div style={{display:"flex",gap:6}}>
<DateIn style={{fontSize:16,padding:"8px 12px"}} value={outForm.eta||""} onChange={(v2: any)=>{if(!outForm.isDriveway&&!outForm.company){notify("⚠️ Fill in transport company first");return;}const nf={...outForm,eta:v2,set:true};setOutForm(nf);saveOut(nf);}}/>
{outForm.eta&&<button style={{...S.sm,fontSize:14,color:"#F87171",padding:"8px 12px"}} onClick={()=>{const nf={...outForm,eta:""};setOutForm(nf);saveOut(nf);}}>✕</button>}
</div>
</label>
{outForm.eta&&<div style={{fontSize:14,color:"#60A5FA",fontWeight:600,marginTop:4}}>{outForm.isDriveway?"🏠":"🚛"} {outForm.isDriveway?"Arriving at driveway":"Transport arriving"} {fmtDate(outForm.eta)}</div>}
</div><div style={{padding:"10px 12px",marginBottom:8,borderRadius:6,background:outForm.pickedUp?"#0D3B1E":"#0D0D1A",border:`1px solid ${outForm.pickedUp?"#166534":"#2A2A3E"}`}}>
<label style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#E5E7EB",fontWeight:600}}><input type="checkbox" style={{width:20,height:20}} checked={outForm.pickedUp||false} onChange={(e: any)=>{if(e.target.checked&&!outForm.eta){notify("⚠️ ETA date required before marking picked up");return;}if(e.target.checked){if(!outForm.isDriveway&&(!outForm.company||!outForm.phone||!outForm.email)){notify("⚠️ Fill in transport company first");return;}const nf={...outForm,pickedUp:true,datePickedUp:new Date().toISOString().split("T")[0]};setOutForm(nf);saveOut(nf);const vd=vData(v);if(typeof fireEmail==="function"){if(nf.isDriveway)fireEmail("driveway_outbound_shipped",{buyer:v.buyingBroker||"",vehicle:vd,dealer:v.soldTo||"",destination:nf.destination||v.soldTo||"",pickedUpDate:nf.datePickedUp});else if(nf.isRetail)fireEmail("retail_vehicle_shipped",{buyer:v.buyingBroker||"",vehicle:vd,customerName:nf.customerName||"",deliveryAddress:nf.deliveryAddress||"",transport:{company:nf.company||"",phone:nf.phone||"",eta:nf.eta||""},pickedUpDate:nf.datePickedUp});else fireEmail("dealer_vehicle_shipped",{dealer:v.soldTo||"",vehicle:vd,transport:{company:nf.company||"",phone:nf.phone||"",eta:nf.eta||""},pickedUpDate:nf.datePickedUp});}}else{const nf={...outForm,pickedUp:false,datePickedUp:""};setOutForm(nf);saveOut(nf);}}}/> ③ {outForm.isDriveway?"Shipped":outForm.isRetail?"Shipped":"Picked Up"}</label>
{outForm.pickedUp&&<div style={{fontSize:15,color:"#34D399",fontWeight:700,marginTop:6}}>📅 {outForm.isDriveway?"Shipped":"Picked Up"}: {fmtDate(outForm.datePickedUp)} (auto-locked)</div>}
</div><div style={{padding:"10px 12px",borderRadius:6,background:outForm.delivered?"#0D3B1E":"#0D0D1A",border:`1px solid ${outForm.delivered?"#166534":"#2A2A3E"}`}}>
<label style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#E5E7EB",fontWeight:600}}><input type="checkbox" style={{width:20,height:20}} checked={outForm.delivered||false} onChange={(e: any)=>{if(e.target.checked&&!outForm.pickedUp){notify("⚠️ Must be picked up before marking delivered");return;}if(e.target.checked){const nf={...outForm,delivered:true,dateDelivered:new Date().toISOString().split("T")[0]};setOutForm(nf);saveOut(nf);onUpdate({status:"delivered",deliveredDate:nf.dateDelivered});const vd=vData(v);if(typeof fireEmail==="function"){if(nf.isDriveway)fireEmail("driveway_outbound_delivered",{buyer:v.buyingBroker||"",vehicle:vd,dealer:v.soldTo||"",destination:nf.destination||v.soldTo||"",deliveredDate:nf.dateDelivered});else if(nf.isRetail)fireEmail("retail_vehicle_delivered",{buyer:v.buyingBroker||"",vehicle:vd,customerName:nf.customerName||"",deliveryAddress:nf.deliveryAddress||"",deliveredDate:nf.dateDelivered});else fireEmail("dealer_vehicle_delivered",{dealer:v.soldTo||"",vehicle:vd,deliveredDate:nf.dateDelivered});}}else{const nf={...outForm,delivered:false,dateDelivered:""};setOutForm(nf);saveOut(nf);}}}/> ④ {outForm.isDriveway?"DW Delivered":outForm.isRetail?"Customer Delivered":"Delivered"}</label>
{outForm.delivered&&<div style={{fontSize:15,color:"#34D399",fontWeight:700,marginTop:6}}>📅 Delivered: {fmtDate(outForm.dateDelivered)} (auto-locked)</div>}
</div>
</div>
<button style={{...S.btn,fontSize:16,padding:"12px",background:"#7F1D1D",color:"#FCA5A5"}} onClick={()=>{onUpdate({transport:{...v.transport,outbound:{set:false,destination:"",eta:"",cost:0,pickedUp:false,datePickedUp:"",delivered:false,dateDelivered:"",readyDate:"",isDriveway:false,isRetail:false,company:"",phone:"",email:"",shippingFrom:"",customerName:"",customerPhone:"",customerEmail:"",deliveryAddress:"",customerCharge:0}}});setOutForm({set:false});notify("🗑️ Outbound transport cleared");}}>🗑️ Clear Transport</button>
</div>
:<div style={{display:"grid",gap:8,fontSize:16,color:"#E5E7EB"}}></div>}
</div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
<div style={{...S.card,textAlign:"center"}}><div style={{fontSize:11,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Transport Inbound</div><div style={{fontSize:20,fontWeight:700,color:"#60A5FA"}}>{inbCost?`$${inbCost.toLocaleString()}`:"—"}</div></div>
<div style={{...S.card,textAlign:"center"}}><div style={{fontSize:11,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Transport Outbound</div><div style={{fontSize:20,fontWeight:700,color:"#60A5FA"}}>{outbCost?`$${outbCost.toLocaleString()}`:"—"}</div></div>
<div style={{...S.card,textAlign:"center"}}><div style={{fontSize:11,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Recon Cost</div><div style={{fontSize:20,fontWeight:700,color:"#FBBF24"}}>{reconCost?`$${reconCost.toLocaleString()}`:"$0"}</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>approved+</div></div>
</div><div style={{...S.card,marginBottom:10,padding:16}}>
{(()=>{const arb=v.arb||{};const isInArbLocal=arb.open;
return <div style={{width:"100%"}}>
{!isInArbLocal&&!arb.resolved&&<button style={{padding:"10px 20px",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",border:"2px solid #EF4444",fontSize:15,fontWeight:800,cursor:"pointer",width:"100%"}} onClick={()=>setShowArbForm(true)}>⚖️ Open Arbitration</button>}
{arb.resolved&&!isInArbLocal&&<div style={{padding:14,borderRadius:10,background:"#0D3B1E",border:"2px solid #166534",width:"100%"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:13,color:"#6EE7B7",textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>✅ Arbitration Resolved</div><div style={{fontSize:16,fontWeight:700,color:"#34D399",marginTop:4}}>{arb.source} — {fmtDate(arb.resolvedDate)}</div>{arb.closeReason&&<div style={{fontSize:13,color:"#6EE7B7",marginTop:4}}>📝 {arb.closeReason}</div>}{arb.reason&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>Original reason: {arb.reason}</div>}</div><button style={{padding:"8px 16px",borderRadius:6,background:"#7F1D1D",color:"#FCA5A5",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={()=>setShowArbForm(true)}>⚖️ New Arb</button></div></div>}
{showArbForm&&!isInArbLocal&&<div style={{padding:16,borderRadius:10,background:"#1A1A2E",border:"2px solid #EF4444",width:"100%",marginTop:8}}><div style={{fontSize:16,fontWeight:800,color:"#FCA5A5",marginBottom:12}}>⚖️ Open Arbitration</div><div style={{fontSize:13,color:"#9CA3AF",marginBottom:8}}>Source / Auction</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{ARB_SOURCES.map(s=><button key={s} style={{padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:700,cursor:"pointer",border:arbSource===s?"2px solid #EF4444":"1px solid #2A2A3E",background:arbSource===s?"#7F1D1D":"#0D0D1A",color:arbSource===s?"#FCA5A5":"#6B7280"}} onClick={()=>{setArbSource(s);setArbCustom("");}}>{s}</button>)}<input style={{...S.fi,width:120,fontSize:14}} placeholder="Other..." value={arbCustom} onChange={(e: any)=>{setArbCustom(e.target.value);setArbSource(e.target.value);}}/></div><label style={{...S.fl,fontSize:14,marginBottom:10}}>Reason for Arbitration *<textarea style={{...S.fi,minHeight:60,resize:"vertical",width:"100%",boxSizing:"border-box"}} value={arbReason} onChange={(e: any)=>setArbReason(e.target.value)} placeholder="Describe the issue..."/></label><div style={{display:"flex",gap:8}}><button style={{flex:1,padding:12,borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",border:"2px solid #EF4444",fontSize:16,fontWeight:800,cursor:"pointer",opacity:arbSource&&arbReason?1:0.4}} disabled={!arbSource||!arbReason} onClick={()=>{onUpdate({arb:{open:true,source:arbSource,reason:arbReason,openDate:new Date().toISOString().split("T")[0],resolved:false,resolvedDate:null,kicked:false,kickedDate:null,closeReason:"",closedDate:null}});notify("⚖️ Arbitration opened — "+arbSource);setShowArbForm(false);}}>⚖️ Open Arb</button><button style={{padding:12,borderRadius:8,background:"#1A1A2E",color:"#6B7280",border:"1px solid #2A2A3E",fontSize:14,cursor:"pointer"}} onClick={()=>setShowArbForm(false)}>Cancel</button></div></div>}
{isInArbLocal&&<div style={{width:"100%"}}><div style={{padding:16,borderRadius:10,background:"#3B1515",border:"3px solid #EF4444",width:"100%"}}><div style={{textAlign:"center",padding:"8px 0",marginBottom:12}}><div style={{fontSize:13,color:"#FCA5A5",textTransform:"uppercase",letterSpacing:2,fontWeight:700}}>🔴 VEHICLE IN ARBITRATION</div><div style={{fontSize:28,fontWeight:900,color:"#F87171",marginTop:4}}>{arb.source}</div><div style={{fontSize:14,color:"#FCA5A5",marginTop:4}}>Opened: {fmtDate(arb.openDate)}</div></div><div style={{padding:12,background:"#2A1010",borderRadius:8,marginBottom:12}}><div style={{fontSize:12,color:"#FCA5A5",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Reason</div><div style={{fontSize:15,color:"#FDBA74"}}>{arb.reason}</div></div><div style={{padding:12,background:"rgba(239,68,68,0.1)",borderRadius:8,marginBottom:12,textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:"#FCA5A5"}}>⚠️ All recon is paused while in arbitration</div></div><div style={{fontSize:13,color:"#9CA3AF",marginBottom:6}}>Resolution</div><label style={{...S.fl,fontSize:14,marginBottom:10}}>Close / Resolution Notes<textarea style={{...S.fi,minHeight:50,resize:"vertical",width:"100%",boxSizing:"border-box"}} value={arbCloseReason} onChange={(e: any)=>setArbCloseReason(e.target.value)} placeholder="Resolution details..."/></label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={{flex:1,padding:14,borderRadius:8,background:"#166534",color:"#6EE7B7",border:"2px solid #34D399",fontSize:15,fontWeight:800,cursor:"pointer",opacity:arbCloseReason?1:0.4}} onClick={()=>{if(!arbCloseReason){notify("⚠️ Enter resolution notes before closing");return;}onUpdate({arb:{...arb,open:false,resolved:true,resolvedDate:new Date().toISOString().split("T")[0],closeReason:arbCloseReason}});notify("✅ Arb resolved — recon unlocked");}}>✅ Arb Resolved</button><button style={{flex:1,padding:14,borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",border:"2px solid #EF4444",fontSize:15,fontWeight:800,cursor:"pointer",opacity:arbCloseReason?1:0.4}} onClick={()=>{if(!arbCloseReason){notify("⚠️ Enter resolution notes before closing");return;}const now=new Date().toISOString().split("T")[0];onUpdate({arb:{...arb,open:false,kicked:true,kickedDate:now,closeReason:arbCloseReason,closedDate:now},status:"sold",soldTo:arb.source+" (Arb Return)",soldDate:now,sellingBroker:v.buyingBroker});notify("🔄 Vehicle kicked back to "+arb.source);}}>🔄 Vehicle Kicked</button><button style={{flex:1,padding:14,borderRadius:8,background:"#1E3A5F",color:"#93C5FD",border:"2px solid #3B82F6",fontSize:15,fontWeight:800,cursor:"pointer",opacity:arbCloseReason?1:0.4}} onClick={()=>{if(!arbCloseReason){notify("⚠️ Enter resolution notes before closing");return;}onUpdate({arb:{...arb,open:false,closedDate:new Date().toISOString().split("T")[0],closeReason:arbCloseReason}});notify("⚖️ Arb closed — "+arbCloseReason);}}>📋 Arb Closed</button></div></div></div>}
</div>;})()}
</div><div style={{...S.card,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
{!v.noReconNeeded?
rcNeeded.length>0?<div style={{fontSize:14,color:"#6B7280"}}>☐ No Recon Needed <span style={{fontSize:12,color:"#F87171"}}>(recon already assigned — remove tasks first)</span></div>
:<label style={{display:"flex",alignItems:"center",gap:10,fontSize:18,color:"#E5E7EB",fontWeight:700,cursor:"pointer"}}>
<input type="checkbox" style={{width:22,height:22}} checked={false} onChange={()=>{const today=new Date().toISOString().split("T")[0];const upd: any={noReconNeeded:true,noReconSetBy:"Darren",noReconSetDate:today};if(!v.transport?.outbound?.readyDate){upd.transport={...(v.transport||{}),outbound:{...(v.transport?.outbound||{set:false}),readyDate:today}};}onUpdate(upd);notify("✅ No Recon Needed — Ready to Ship");}}/>
No Recon Needed
</label>
:<div style={{display:"flex",alignItems:"center",gap:10}}>
<input type="checkbox" style={{width:22,height:22,cursor:"pointer"}} checked={true} onChange={()=>{const upd: any={noReconNeeded:false,noReconSetBy:null,noReconSetDate:null};if(v.transport?.outbound?.readyDate&&!v.transport?.outbound?.set){upd.transport={...(v.transport||{}),outbound:{...(v.transport?.outbound||{}),readyDate:null}};}onUpdate(upd);notify("Recon required — No Recon flag removed");}}/>
<div>
<div style={{fontSize:18,fontWeight:800,color:"#06B6D4"}}>No Recon Needed</div>
<div style={{fontSize:12,color:"#6B7280"}}>Set by {v.noReconSetBy||"—"} on {v.noReconSetDate?fmtDate(v.noReconSetDate):"—"}</div>
</div>
</div>}
<div style={{display:"flex",alignItems:"center",gap:8}}>
{v.noReconNeeded&&<span style={{...S.badge,background:"#06B6D4",color:"#FFF",fontSize:13,padding:"4px 12px"}}>🚀 Straight to R2-SHIP when on ground</span>}
{v.noReconNeeded&&<button style={{padding:"6px 14px",borderRadius:6,background:"#7F1D1D",color:"#FCA5A5",fontSize:13,fontWeight:700,border:"none",cursor:"pointer"}}
onClick={()=>{onUpdate({noReconNeeded:false,noReconSetBy:null,noReconSetDate:null});notify("Recon required — buyer removed No Recon flag");}}>
🔄 Needs Recon (Buyer Only)</button>}
</div>
</div>
{!v.noReconNeeded&&isInArb&&<div style={{padding:16,borderRadius:10,background:"#3B1515",border:"2px solid #EF4444",textAlign:"center",marginBottom:10}}><div style={{fontSize:18,fontWeight:800,color:"#FCA5A5"}}>🔴 RECON PAUSED — IN ARBITRATION WITH {v.arb?.source||"?"}</div><div style={{fontSize:13,color:"#F87171",marginTop:4}}>Resolve arbitration before continuing recon</div></div>}
{!v.noReconNeeded&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10,opacity:isInArb?0.4:1,pointerEvents:isInArb?"none":"auto"}}>
{[...VCAT].sort((a,b)=>{const ao=v.reconTasks[a.key]?.order;const bo=v.reconTasks[b.key]?.order;if(ao&&bo)return ao-bo;if(ao&&!bo)return -1;if(!ao&&bo)return 1;return 0;}).map(cat=>{
if(cat.key==="cr"){const crt=v.reconTasks[cat.key];const crNeed=crt?.needed;const crCl={bd:crNeed?"#3B82F6":"#4B5563",bg:"#0D0D1A",text:"#FFF"};
return <div key={cat.key} style={{...S.card,borderLeft:"4px solid "+crCl.bd,background:crCl.bg,opacity:crNeed?1:0.5,minHeight:50}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:20}}>{cat.icon}</span><span style={{fontWeight:700,color:"#E5E7EB",fontSize:16}}>{cat.label}</span>
<span style={{...S.badge,background:crCl.bd,color:crCl.text,fontSize:11}}>{crt?.status==="complete"?"DONE":crt?.status==="started"?"CR REQUESTED":"—"}</span>
</div>
<label style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:4}}>
{crt?.status==="complete"||crt?.status==="started"?<span>🔒</span>
:<input type="checkbox" checked={crNeed||false} onChange={()=>{const t2={...v.reconTasks};t2[cat.key]=t2[cat.key]?.needed?{needed:false,status:"na"}:{needed:true,status:"unassigned"};onUpdate({reconTasks:t2});}}/>} Need</label>
</div>
{crNeed&&!crt?.vendorName&&<div style={{marginTop:8}}>
<select style={{...S.sel,width:"100%",opacity:canAssignVendors?1:0.5}} defaultValue="" disabled={!canAssignVendors} onChange={(e: any)=>{if(e.target.value)assign(cat.key,e.target.value);e.target.value="";}}><option value="" disabled>{canAssignVendors?"+ Assign CR Writer...":"⚠️ Vehicle must be on ground"}</option>{(vendors[cat.key]||[]).map((vn2: any)=><option key={vn2.id} value={vn2.id}>{vn2.name}</option>)}</select>
</div>}
{crNeed&&crt?.vendorName&&<div style={{marginTop:6}}>
<div style={{fontSize:14,fontWeight:700,color:"#FFF"}}>{crt.vendorName}</div>
<div style={{fontSize:13,color:"#FBBF24",marginTop:2}}>CR Requested: {crt.dateStarted?fmtDate(crt.dateStarted):crt.dateAssigned?fmtDate(crt.dateAssigned):"—"}</div>
{crt.status==="started"&&<div style={{marginTop:8}}>
<button style={{...S.btn,width:"100%",background:"#166534",color:"#6EE7B7",padding:10,fontSize:14}} onClick={(e: any)=>{e.target.disabled=true;const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"complete",dateCompleted:new Date().toISOString().split("T")[0]};onUpdate({reconTasks:t2});}}>✅ CR Complete</button>
</div>}
{crt.status==="complete"&&<div style={{marginTop:6}}>
<div style={{fontSize:14,color:"#34D399",fontWeight:700}}>✅ Completed: {crt.dateCompleted?fmtDate(crt.dateCompleted):"—"} • {(crt.photos||[]).length} files</div>
<button style={{...S.btn,width:"100%",background:"#78590A",color:"#FDE68A",padding:10,fontSize:14,marginTop:8}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"started",dateStarted:new Date().toISOString().split("T")[0],dateCompleted:null,crRetakeCount:(crt.crRetakeCount||0)+1,lastCrCompleted:crt.dateCompleted,photos:[]};onUpdate({reconTasks:t2});}}>📋 Request New CR</button>
{crt.crRetakeCount>0&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>Re-writes: {crt.crRetakeCount} • Last completed: {crt.lastCrCompleted?fmtDate(crt.lastCrCompleted):"—"}</div>}
</div>}
</div>}
</div>;}
if(cat.key==="auction"){const axt=v.reconTasks[cat.key];const axNeed=axt?.needed;const axCl={bd:axNeed?"#FBBF24":"#4B5563",bg:"#0D0D1A",text:"#000"};
return <div key={cat.key} style={{...S.card,borderLeft:"4px solid "+axCl.bd,background:axCl.bg,opacity:axNeed?1:0.5,minHeight:50}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:20}}>{cat.icon}</span><span style={{fontWeight:700,color:"#E5E7EB",fontSize:16}}>{cat.label}</span>
<span style={{...S.badge,background:axCl.bd,color:"#000",fontSize:11}}>{axt?.status==="complete"?"SOLD":axt?.auctionRan?"RAN":axt?.auctionInspected?"INSPECTED":axt?.auctionAssigned?"LISTED":"—"}</span>
</div>
<label style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:4}}>
{axt?.status==="complete"?<span>🔒</span>
:<input type="checkbox" checked={axNeed||false} onChange={()=>{const t2={...v.reconTasks};t2[cat.key]=t2[cat.key]?.needed?{needed:false,status:"na"}:{needed:true,status:"unassigned"};onUpdate({reconTasks:t2});}}/>} Need</label>
</div>
{axNeed&&<div style={{marginTop:8}}>
<div style={{fontSize:13,color:"#9CA3AF",marginBottom:6}}>Location: <b style={{color:"#E5E7EB"}}>{v.location}</b></div>
<div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:6}}>Push to Auction:</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
{["Manheim","ACV","Openlane"].map(ax=><label key={ax} style={{display:"flex",alignItems:"center",gap:4,fontSize:14,color:(axt?.auctions||[]).includes(ax)?"#FBBF24":"#6B7280",fontWeight:600,cursor:"pointer"}}>
<input type="checkbox" checked={(axt?.auctions||[]).includes(ax)} onChange={(e: any)=>{const t2={...v.reconTasks};const cur=t2[cat.key]?.auctions||[];t2[cat.key]={...t2[cat.key],auctions:e.target.checked?[...cur,ax]:cur.filter((x: any)=>x!==ax)};onUpdate({reconTasks:t2});}}/>{ax}</label>)}
<button style={{fontSize:12,padding:"4px 10px",borderRadius:4,background:"#78590A",color:"#FDE68A",border:"none",cursor:"pointer",fontWeight:700}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],auctions:["Manheim","ACV","Openlane"]};onUpdate({reconTasks:t2});}}>All</button>
</div>
{(axt?.auctions||[]).length>0&&!axt?.auctionAssigned&&<button style={{...S.btn,width:"100%",background:"#78590A",color:"#FDE68A",padding:10,fontSize:14}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"assigned",auctionAssigned:true,auctionAssignedDate:new Date().toISOString().split("T")[0]};onUpdate({reconTasks:t2});}}>📋 List on {(axt?.auctions||[]).join(" + ")}</button>}
{axt?.auctionAssigned&&<div style={{marginTop:4}}>
<div style={{fontSize:13,color:"#FBBF24"}}>📋 Listed: {fmtDate(axt.auctionAssignedDate)} — {(axt?.auctions||[]).join(", ")}</div>
{!axt?.auctionInspected&&<div style={{marginTop:6}}><button style={{...S.btn,width:"100%",background:"#1E3A5F",color:"#93C5FD",padding:10,fontSize:14}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],auctionInspected:true,auctionInspectedDate:new Date().toISOString().split("T")[0]};onUpdate({reconTasks:t2});}}>🔍 Auction Inspected</button></div>}
{axt?.auctionInspected&&<div style={{fontSize:13,color:"#60A5FA",marginTop:4}}>🔍 Inspected: {fmtDate(axt.auctionInspectedDate)}</div>}
{axt?.auctionInspected&&!axt?.auctionRan&&<div style={{marginTop:6}}><button style={{...S.btn,width:"100%",background:"#4C1D95",color:"#DDD6FE",padding:10,fontSize:14}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],auctionRan:true,auctionRanDate:new Date().toISOString().split("T")[0]};onUpdate({reconTasks:t2});}}>🔨 Ran at Auction</button></div>}
{axt?.auctionRan&&<div style={{fontSize:13,color:"#C4B5FD",marginTop:4}}>🔨 Ran: {fmtDate(axt.auctionRanDate)}</div>}
{axt?.auctionRan&&axt?.status!=="complete"&&<div style={{marginTop:6}}>
<div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:6}}>Sold at which auction?</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
{(axt?.auctions||[]).map((ax: any)=><button key={ax} style={{...S.btn,fontSize:14,padding:"8px 16px",background:axt?.soldAtAuction===ax?"#166534":"#1A1A2E",color:axt?.soldAtAuction===ax?"#6EE7B7":"#9CA3AF",border:axt?.soldAtAuction===ax?"2px solid #34D399":"1px solid #2A2A3E"}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],soldAtAuction:ax};onUpdate({reconTasks:t2});}}>{ax}</button>)}
</div>
{axt?.soldAtAuction&&<button style={{...S.btn,width:"100%",background:"#166534",color:"#6EE7B7",padding:12,fontSize:16}} onClick={()=>{const now=new Date().toISOString().split("T")[0];const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"complete",dateCompleted:now};onUpdate({reconTasks:t2,status:"sold",soldDate:now,soldTo:axt.soldAtAuction+" Auction",sellingBroker:v.buyingBroker});}}>💰 Sold at {axt.soldAtAuction}</button>}
{!axt?.soldAtAuction&&<div style={{fontSize:12,color:"#6B7280",textAlign:"center"}}>Pick auction to mark sold</div>}
</div>}
{axt?.status==="complete"&&<div style={{fontSize:14,color:"#34D399",fontWeight:700,marginTop:4}}>💰 Sold: {fmtDate(axt.dateCompleted)}</div>}
</div>}
</div>}
</div>;}
if(cat.key==="blackwidow"){const bwt=v.reconTasks[cat.key];const bwNeed=bwt?.needed;const bwCl={bd:bwNeed?"#7C3AED":"#4B5563",bg:"#0D0D1A",text:"#FFF"};
return <div key={cat.key} style={{...S.card,borderLeft:"4px solid "+bwCl.bd,background:bwCl.bg,opacity:bwNeed?1:0.5,minHeight:50}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div style={{display:"flex",alignItems:"center",gap:6}}>
<span style={{fontSize:20}}>{cat.icon}</span><span style={{fontWeight:700,color:"#E5E7EB",fontSize:16}}>{cat.label}</span>
<span style={{...S.badge,background:bwCl.bd,color:bwCl.text,fontSize:11}}>{bwt?.status==="complete"?"DONE":bwt?.status==="started"?"PICS REQUESTED":"—"}</span>
</div>
<label style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:4}}>
{bwt?.status==="complete"||bwt?.status==="started"?<span>🔒</span>
:<input type="checkbox" checked={bwNeed||false} onChange={()=>{const t2={...v.reconTasks};t2[cat.key]=t2[cat.key]?.needed?{needed:false,status:"na"}:{needed:true,status:"unassigned"};onUpdate({reconTasks:t2});}}/>} Need</label>
</div>
{bwNeed&&!bwt?.vendorName&&<div style={{marginTop:8}}>
<select style={{...S.sel,width:"100%",opacity:canAssignVendors?1:0.5}} defaultValue="" disabled={!canAssignVendors} onChange={(e: any)=>{if(e.target.value)assign(cat.key,e.target.value);e.target.value="";}}><option value="" disabled>{canAssignVendors?"+ Assign Photo Vendor...":"⚠️ Vehicle must be on ground"}</option>{(vendors[cat.key]||[]).map((vn2: any)=><option key={vn2.id} value={vn2.id}>{vn2.name}</option>)}</select>
</div>}
{bwNeed&&bwt?.vendorName&&<div style={{marginTop:6}}>
<div style={{fontSize:14,fontWeight:700,color:"#FFF"}}>{bwt.vendorName}</div>
<div style={{fontSize:13,color:"#FBBF24",marginTop:2}}>Pics Requested: {bwt.dateStarted?fmtDate(bwt.dateStarted):bwt.dateAssigned?fmtDate(bwt.dateAssigned):"—"}</div>
{bwt.status==="started"&&<button style={{...S.btn,width:"100%",background:"#166534",color:"#6EE7B7",padding:10,fontSize:14,marginTop:8}} onClick={(e: any)=>{e.target.disabled=true;const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"complete",dateCompleted:new Date().toISOString().split("T")[0]};onUpdate({reconTasks:t2});}}>✅ Pics Complete</button>}
{bwt.status==="complete"&&<div style={{marginTop:6}}>
<div style={{fontSize:14,color:"#34D399",fontWeight:700}}>✅ Completed: {bwt.dateCompleted?fmtDate(bwt.dateCompleted):"—"}</div>
<button style={{...S.btn,width:"100%",background:"#78590A",color:"#FDE68A",padding:10,fontSize:14,marginTop:8}} onClick={()=>{const t2={...v.reconTasks};t2[cat.key]={...t2[cat.key],status:"started",dateStarted:new Date().toISOString().split("T")[0],dateCompleted:null,retakeCount:(bwt.retakeCount||0)+1,lastCompleted:bwt.dateCompleted};onUpdate({reconTasks:t2});}}>📸 Request Re-Take Pics</button>
{bwt.retakeCount>0&&<div style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>Re-takes: {bwt.retakeCount} • Last completed: {bwt.lastCompleted?fmtDate(bwt.lastCompleted):"—"}</div>}
</div>}
</div>}
</div>;}
return <ReconCategory key={cat.key} cat={cat} task={v.reconTasks[cat.key]} vOpts={vendors[cat.key]||[]}
onAssign={(vid: any)=>assign(cat.key,vid)} onEst={(a: any)=>est(cat.key,a)} onApr={()=>apr(cat.key)} onStart={(eta: any)=>startRecon(cat.key,eta)} onCmp={()=>cmp(cat.key)} onTog={()=>tog(cat.key)}
onUpdVendor={(vid: any,u: any,sc: any)=>updVendor(cat.key,vid,u,sc)} onSelectVendor={(vid: any)=>selectVendor(cat.key,vid)}
onUpdateTask={(u: any)=>{const t={...v.reconTasks};const cur=t[cat.key];const newStatus=u.status||cur.status;t[cat.key]={...cur,...u,needed:true,status:newStatus==="na"?"unassigned":newStatus};onUpdate({reconTasks:t});}}
onSendReminder={(vid: any)=>sendReminder(cat.key,vid)} onReassign={(vid: any)=>reassignNext(cat.key,vid)} canEditRecon={true}
onOrder={(n: any)=>{const t={...v.reconTasks};t[cat.key]={...t[cat.key],order:n?Number(n):null};onUpdate({reconTasks:t});}}
onNotes={(n: any,clearUnread: any,setUnread: any)=>{const t={...v.reconTasks};if(clearUnread)t[cat.key]={...t[cat.key],noteUnread:false};else t[cat.key]={...t[cat.key],notes:n,noteUnread:setUnread?true:false};onUpdate({reconTasks:t});}}
onPhotos={(p: any)=>{const t={...v.reconTasks};t[cat.key]={...t[cat.key],photos:p};onUpdate({reconTasks:t});}}
/>})}
</div>}
{sm&&<div style={S.ov} onClick={()=>setSm(false)}><div style={{...S.modal,maxWidth:400}} onClick={(e: any)=>e.stopPropagation()}>
<h2 style={{color:"#E5E7EB",fontSize:16,marginBottom:12}}>Mark as Sold</h2>
<div style={{display:"flex",flexDirection:"column",gap:10}}>
<label style={S.fl}>Seller<select style={S.fi} value={sb} onChange={(e: any)=>setSb(e.target.value)}>{(()=>{const names=((allUsers||[]).filter((u: any)=>u.role==="seller"||u.role==="admin"||u.is_seller===1).map((u: any)=>u.firstName+(u.lastName?" "+u.lastName:""))).filter((n: any,i: any,a: any)=>n&&a.indexOf(n)===i);return names.length?names.map((b: any)=><option key={b} value={b}>{b}</option>):<option value="">— No sellers registered —</option>;})()}</select></label>
<label style={S.fl}>Sold To (Buying Dealer) *<input style={S.fi} value={st} onChange={(e: any)=>setSt(e.target.value)} placeholder="e.g. AutoMax Dealers"/></label></div>
<div style={{display:"flex",gap:8,marginTop:12}}><button style={{...S.btn,background:"#7F1D1D"}} onClick={()=>{const dealer=st||"TBD";if(!window.confirm("Mark as SOLD to "+dealer+"?"))return;const soldUpdate: any={status:"sold",soldDate:new Date().toISOString().split("T")[0],sellingBroker:sb,soldTo:dealer,kickedReturn:false,kicked:false,kickedFromCSV:false,kickedFromDealer:null};onUpdate(soldUpdate);setSm(false);notify(`Sold! ${st?`to ${st}`:""}`);if(typeof fireEmail==="function"){fireEmail("seller_vehicle_sold",{seller:sb,buyer:v.buyingBroker||"",vehicle:vData({...v,soldTo:dealer,soldDate:new Date().toISOString().split("T")[0]})});};}}>Confirm</button>
<button style={S.sm} onClick={()=>setSm(false)}>Cancel</button></div>
</div></div>}{showKick&&<div style={S.ov} onClick={()=>setShowKick(false)}><div style={{...S.modal,maxWidth:500}} onClick={(e: any)=>e.stopPropagation()}>
<h2 style={{color:"#FDBA74",fontSize:20,marginBottom:4}}>🔄 Kick Vehicle</h2>
<div style={{fontSize:14,color:"#9CA3AF",marginBottom:12}}>Vehicle will be removed from {v.soldTo} and returned to inventory</div>
<div style={{padding:12,background:"#3B1515",borderRadius:8,border:"1px solid #7F1D1D",marginBottom:12}}>
<div style={{fontSize:13,color:"#FCA5A5"}}>Dealer: <b style={{fontSize:18,color:"#F87171"}}>{v.soldTo}</b></div>
<div style={{fontSize:13,color:"#9CA3AF",marginTop:4}}>Sold: {v.soldDate?fmtDate(v.soldDate):"—"} • Seller: {v.sellingBroker||"—"}</div>
</div>
<label style={{...S.fl,fontSize:15,marginBottom:8}}>Reason for Kick *
<textarea style={{...S.fi,fontSize:16,minHeight:100,resize:"vertical",width:"100%"}} value={kickReason} onChange={(e: any)=>setKickReason(e.target.value)} placeholder="Why was this vehicle kicked?"/>
</label>
<div style={{display:"flex",gap:8,marginTop:12}}>
<button style={{flex:1,padding:"12px",borderRadius:6,border:"2px solid #F97316",background:"#7C2D12",color:"#FDBA74",fontSize:16,cursor:"pointer",fontWeight:800}} onClick={()=>{
if(!kickReason.trim()){notify("⚠️ Please enter a reason for the kick");return;}
const now=new Date().toISOString().split("T")[0];
if(!window.confirm("KICK this vehicle from "+v.soldTo+"?")){{setShowKick(false);return;}}const kickRecord={dealer:v.soldTo,soldDate:v.soldDate,kickedDate:now,sellingBroker:v.sellingBroker,reason:kickReason.trim(),outbound:{...v.transport?.outbound},buyerApprovedShip:v.buyerApprovedShip,buyerApprovedDate:v.buyerApprovedDate};
const history=[...(v.kickedHistory||[]),kickRecord];
onUpdate({
status:"in_recon",soldTo:null,soldDate:null,sellingBroker:"",deliveredDate:null,
buyerApprovedShip:false,buyerApprovedDate:null,shippingHoldDate:null,shippingHoldBy:null,
kickedReturn:true,kickedFromDealer:v.soldTo,
transport:{
inbound:{set:false,destination:v.location||"",eta:"",cost:0,delivered:false,dateDelivered:"",pickupFrom:v.soldTo,kickedReturn:true},
outbound:{set:false,destination:"",eta:"",cost:0,pickedUp:false,datePickedUp:"",delivered:false,dateDelivered:"",readyDate:"",isDriveway:false}
},
kickedHistory:history
});
setShowKick(false);setKickReason("");notify(`🔄 KICKED by ${v.soldTo} — vehicle back in inventory`);
if(typeof fireEmail==="function"){fireEmail("seller_vehicle_kicked",{seller:v.sellingBroker||"",buyer:v.buyingBroker||"",vehicle:vData(v),kickReason:kickReason.trim(),kickedBy:v.soldTo});}
}}>🔄 Confirm Kick</button>
<button style={{...S.sm,fontSize:14,padding:"12px 16px"}} onClick={()=>setShowKick(false)}>Cancel</button>
</div>
</div></div>}
{lbImg2&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.98)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,cursor:"pointer"}} onClick={()=>setLbImg2(null)}>
<div style={{width:"98vw",height:"98vh",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={(e: any)=>e.stopPropagation()}>
{lbImg2.type==="video"?<video key={lbImg2.data} src={lbImg2.data} controls autoPlay playsInline style={{maxWidth:"96vw",maxHeight:"94vh",borderRadius:4,background:"#000"}} onClick={(e: any)=>e.stopPropagation()}/>:<img src={lbImg2.data} style={{maxWidth:"96vw",maxHeight:"94vh",borderRadius:4,objectFit:"contain"}}/>}
<button style={{position:"fixed",top:12,right:12,width:48,height:48,borderRadius:"50%",background:"#EF4444",border:"none",color:"#FFF",fontSize:24,cursor:"pointer"}} onClick={()=>setLbImg2(null)}>✕</button></div></div>}
</div>;
}
