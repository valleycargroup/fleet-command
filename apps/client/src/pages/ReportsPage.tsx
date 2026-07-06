import { useState } from 'react';
import { VCAT } from '../lib/constants';
import { fmtDate } from '../lib/utils';
import { useStore } from '../lib/store';

export function ReportsPage() {
const vehicles = useStore((s: any) => s.vehicles);
const [rTab,setRTab]=useState("overview");
const all=vehicles;
const sold=all.filter((v: any)=>v.status==="sold");
const inRecon=all.filter((v: any)=>{const rc=VCAT.filter(c=>v.reconTasks[c.key]?.needed);const done=rc.filter(c=>v.reconTasks[c.key]?.status==="complete");return rc.length>0&&done.length<rc.length;});

const getReconCost=(v: any)=>{let total=0;VCAT.forEach(c=>{const t=v.reconTasks[c.key];if(t?.needed&&t.vendors){(t.vendors||[]).forEach((vn: any)=>{(vn.lineItems||[]).forEach((li: any)=>{if(li.accepted&&!li.declined)total+=Number(li.price)||0;});(vn.vendorFindings||[]).forEach((f: any)=>{if(f.approved)total+=Number(f.price)||0;});});}});return total;};
const totalReconSpend=all.reduce((s: any,v: any)=>s+getReconCost(v),0);
const vehiclesWithRecon=all.filter((v: any)=>getReconCost(v)>0);
const avgReconPerVehicle=vehiclesWithRecon.length>0?Math.round(totalReconSpend/vehiclesWithRecon.length):0;

const vendorSpend: any={};
all.forEach((v: any)=>{VCAT.forEach(c=>{const t=v.reconTasks[c.key];if(t?.needed&&t.vendors){(t.vendors||[]).forEach((vn: any)=>{const name=vn.name||"Unknown";if(!vendorSpend[name])vendorSpend[name]={total:0,jobs:0,complete:0,categories:{}};let cost=0;(vn.lineItems||[]).forEach((li: any)=>{if(li.accepted&&!li.declined)cost+=Number(li.price)||0;});(vn.vendorFindings||[]).forEach((f: any)=>{if(f.approved)cost+=Number(f.price)||0;});if(cost>0||vn.selected){vendorSpend[name].total+=cost;vendorSpend[name].jobs++;if(t.status==="complete")vendorSpend[name].complete++;if(!vendorSpend[name].categories[c.label])vendorSpend[name].categories[c.label]=0;vendorSpend[name].categories[c.label]+=cost;}});};});});
const vendorList=Object.entries(vendorSpend).sort((a: any,b: any)=>b[1].total-a[1].total);

const categorySpend: any={};
VCAT.forEach(c=>{categorySpend[c.label]={icon:c.icon,total:0,jobs:0,complete:0};});
all.forEach((v: any)=>{VCAT.forEach(c=>{const t=v.reconTasks[c.key];if(t?.needed){categorySpend[c.label].jobs++;if(t.status==="complete")categorySpend[c.label].complete++;if(t.vendors){(t.vendors||[]).forEach((vn: any)=>{(vn.lineItems||[]).forEach((li: any)=>{if(li.accepted&&!li.declined)categorySpend[c.label].total+=Number(li.price)||0;});(vn.vendorFindings||[]).forEach((f: any)=>{if(f.approved)categorySpend[c.label].total+=Number(f.price)||0;});});}}});});
const catList=Object.entries(categorySpend).filter(([,d]: any)=>d.jobs>0).sort((a: any,b: any)=>b[1].total-a[1].total);

const groundedVehicles=all.filter((v: any)=>v.transport?.inbound?.delivered&&v.transport?.inbound?.dateDelivered&&v.status!=="delivered");
const avgDaysOnGround=groundedVehicles.length>0?Math.round(groundedVehicles.reduce((s: any,v: any)=>{const d=Math.max(0,Math.floor(((new Date() as any)-(new Date(v.transport.inbound.dateDelivered) as any))/864e5));return s+d;},0)/groundedVehicles.length):0;

const totalInboundCost=all.reduce((s: any,v: any)=>s+(Number(v.transport?.inbound?.cost)||0),0);
const totalOutboundCost=all.reduce((s: any,v: any)=>s+(Number(v.transport?.outbound?.cost)||0),0);

const buyerStats: any={};
all.forEach((v: any)=>{const b=v.buyingBroker||"Unknown";if(!buyerStats[b])buyerStats[b]={bought:0,sold:0,kicked:0,reconSpend:0};buyerStats[b].bought++;if(v.status==="sold"||v.status==="delivered")buyerStats[b].sold++;if((v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV))buyerStats[b].kicked++;buyerStats[b].reconSpend+=getReconCost(v);});
const buyerList=Object.entries(buyerStats).sort((a: any,b: any)=>b[1].bought-a[1].bought);

const sellerStats: any={};
all.forEach((v: any)=>{const s=v.sellingBroker;if(!s)return;if(!sellerStats[s])sellerStats[s]={sold:0,kicked:0};sellerStats[s].sold++;if((v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV))sellerStats[s].kicked++;});
const sellerList=Object.entries(sellerStats).sort((a: any,b: any)=>b[1].sold-a[1].sold);

const locStats: any={PHX:{total:0,sold:0,inbound:0,onGround:0,inRecon:0,r2ship:0,outSet:0,pickedUp:0,delivered:0,kicked:0,daysSum:0,daysCount:0,needsInbound:0,needsOutbound:0,inboundCost:0,outboundCost:0,reconSpend:0,reconVehicles:0},Dallas:{total:0,sold:0,inbound:0,onGround:0,inRecon:0,r2ship:0,outSet:0,pickedUp:0,delivered:0,kicked:0,daysSum:0,daysCount:0,needsInbound:0,needsOutbound:0,inboundCost:0,outboundCost:0,reconSpend:0,reconVehicles:0}};
all.forEach((v: any)=>{const loc=v.location||"PHX";if(!locStats[loc])locStats[loc]={total:0,sold:0,inbound:0,onGround:0,inRecon:0,r2ship:0,outSet:0,pickedUp:0,delivered:0,kicked:0,daysSum:0,daysCount:0,needsInbound:0,needsOutbound:0,inboundCost:0,outboundCost:0,reconSpend:0,reconVehicles:0};const ls=locStats[loc];ls.total++;
if(v.status==="sold"||v.status==="delivered")ls.sold++;
if(v.status==="delivered")ls.delivered++;
if(v.transport?.inbound?.set&&!v.transport?.inbound?.delivered)ls.inbound++;
if(v.transport?.inbound?.delivered&&v.status!=="delivered")ls.onGround++;
const rc=VCAT.filter(c=>v.reconTasks[c.key]?.needed);const done=rc.filter(c=>v.reconTasks[c.key]?.status==="complete");
if(rc.length>0&&done.length<rc.length)ls.inRecon++;
if(v.noReconNeeded||(rc.length>0&&done.length===rc.length))ls.r2ship++;
if(v.transport?.outbound?.set&&!v.transport?.outbound?.pickedUp&&!v.transport?.outbound?.delivered)ls.outSet++;
if(v.transport?.outbound?.pickedUp&&!v.transport?.outbound?.delivered)ls.pickedUp++;
if(((v.kicked||v.kickedFromCSV||v.kickedReturn)&&v.status!=="sold"&&v.status!=="delivered"))ls.kicked++;
if(!v.transport?.inbound?.set&&v.status!=="delivered")ls.needsInbound++;
if((v.status==="sold")&&!v.transport?.outbound?.set)ls.needsOutbound++;
ls.inboundCost+=Number(v.transport?.inbound?.cost)||0;
ls.outboundCost+=Number(v.transport?.outbound?.cost)||0;
ls.reconSpend+=getReconCost(v);
if(getReconCost(v)>0)ls.reconVehicles++;
if(v.transport?.inbound?.delivered&&v.transport?.inbound?.dateDelivered){const days=Math.max(0,Math.floor(((new Date() as any)-(new Date(v.transport.inbound.dateDelivered) as any))/864e5));ls.daysSum+=days;ls.daysCount++;}
});

const RS: any={card:{background:"#12122A",border:"1px solid #1E1E32",borderRadius:12,padding:20},
num:{fontSize:32,fontWeight:800,color:"#F1F5F9",lineHeight:1},
label:{fontSize:12,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginTop:4},
secTitle:{fontSize:16,fontWeight:700,color:"#E5E7EB",marginBottom:12},
row:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:8,marginBottom:4,background:"#0D0D1A",border:"1px solid #1E1E32"},
tabBtn:(active: any)=>({padding:"6px 14px",borderRadius:6,border:active?"1px solid #3B82F6":"1px solid #2A2A3E",background:active?"#1E3A5F":"transparent",color:active?"#93C5FD":"#6B7280",fontSize:13,cursor:"pointer",fontWeight:600}),
bar:(pct: any,color: any)=>({height:8,borderRadius:4,background:color,width:pct+"%",minWidth:pct>0?4:0,transition:"width 0.3s"})};

return <div style={{padding:10,maxHeight:"calc(100vh - 140px)",overflowY:"auto"}}>
<div style={{display:"flex",gap:8,marginBottom:16}}>
{[["overview","📊 Overview"],["vendors","🔧 Vendors"],["categories","📋 Categories"],["buyers","👤 Buyers"],["locations","📍 Locations"]].map(([k,l])=>
<button key={k} style={RS.tabBtn(rTab===k)} onClick={()=>setRTab(k)}>{l}</button>)}
</div>

{rTab==="overview"&&<div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
{Object.entries(locStats).map(([loc,d]: any)=><div key={loc} style={{...RS.card,borderTop:"3px solid #3B82F6"}}>
<div style={{fontSize:22,fontWeight:800,color:"#F1F5F9",marginBottom:14}}>📍 {loc}</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#3B82F6"}}>{d.total}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Total</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#34D399"}}>{d.sold}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Sold</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#60A5FA"}}>{d.inbound}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Inbound</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#34D399"}}>{d.onGround}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>On Ground</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#FBBF24"}}>{d.inRecon}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>In Recon</div></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#06B6D4"}}>{d.r2ship}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>R2-Ship</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#A78BFA"}}>{d.outSet}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Outbound</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#F97316"}}>{d.pickedUp}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Picked Up</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#F87171"}}>{d.kicked}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Kicked</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:22,fontWeight:800,color:"#06B6D4"}}>{d.daysCount>0?Math.round(d.daysSum/d.daysCount):0}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Avg Days</div></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<div style={{textAlign:"center",padding:10,background:d.needsInbound>0?"rgba(239,68,68,0.1)":"#0D0D1A",borderRadius:6,border:d.needsInbound>0?"1px solid #7F1D1D":"1px solid transparent"}}><div style={{fontSize:22,fontWeight:800,color:d.needsInbound>0?"#F87171":"#4B5563"}}>{d.needsInbound}</div><div style={{fontSize:9,color:d.needsInbound>0?"#FCA5A5":"#6B7280",textTransform:"uppercase"}}>Needs Inbound Trans</div></div>
<div style={{textAlign:"center",padding:10,background:d.needsOutbound>0?"rgba(239,68,68,0.1)":"#0D0D1A",borderRadius:6,border:d.needsOutbound>0?"1px solid #7F1D1D":"1px solid transparent"}}><div style={{fontSize:22,fontWeight:800,color:d.needsOutbound>0?"#F87171":"#4B5563"}}>{d.needsOutbound}</div><div style={{fontSize:9,color:d.needsOutbound>0?"#FCA5A5":"#6B7280",textTransform:"uppercase"}}>Needs Outbound Trans</div></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,borderTop:"1px solid #1E1E32",paddingTop:10}}>
<div style={{textAlign:"center",padding:8,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:18,fontWeight:800,color:"#34D399"}}>${d.reconSpend.toLocaleString()}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Recon Spend</div>{d.reconVehicles>0&&<div style={{fontSize:10,color:"#4B5563"}}>${Math.round(d.reconSpend/d.reconVehicles).toLocaleString()} avg</div>}</div>
<div style={{textAlign:"center",padding:8,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:18,fontWeight:800,color:"#60A5FA"}}>${d.inboundCost.toLocaleString()}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Inbound Cost</div></div>
<div style={{textAlign:"center",padding:8,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:18,fontWeight:800,color:"#FBBF24"}}>${d.outboundCost.toLocaleString()}</div><div style={{fontSize:9,color:"#6B7280",textTransform:"uppercase"}}>Outbound Cost</div></div>
</div>
</div>)}
</div>
</div>}

{rTab==="vendors"&&<div>
<div style={RS.secTitle}>🔧 Vendor Spend Breakdown</div>
{vendorList.length===0&&<div style={{color:"#4B5563",textAlign:"center",padding:40}}>No vendor spend data yet — assign vendors and approve bids to see data here</div>}
{vendorList.map(([name,d]: any)=><div key={name} style={{...RS.row,flexDirection:"column",alignItems:"stretch"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{name}</div>
<div style={{fontSize:12,color:"#6B7280"}}>{d.jobs} job{d.jobs!==1?"s":""} • {d.complete} complete</div></div>
<div style={{fontSize:20,fontWeight:800,color:"#34D399"}}>${d.total.toLocaleString()}</div>
</div>
{Object.entries(d.categories).filter(([,v]: any)=>v>0).length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
{Object.entries(d.categories).filter(([,v]: any)=>v>0).map(([cat,amt]: any)=><span key={cat} style={{fontSize:11,padding:"3px 8px",borderRadius:4,background:"#1E3A5F",color:"#93C5FD"}}>{cat}: ${amt.toLocaleString()}</span>)}
</div>}
</div>)}
</div>}

{rTab==="categories"&&<div>
<div style={RS.secTitle}>📋 Recon Category Breakdown</div>
{catList.length===0&&<div style={{color:"#4B5563",textAlign:"center",padding:40}}>No recon data yet</div>}
{catList.map(([name,d]: any)=><div key={name} style={RS.row}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:22}}>{d.icon}</span>
<div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{name}</div>
<div style={{fontSize:12,color:"#6B7280"}}>{d.jobs} job{d.jobs!==1?"s":""} • {d.complete} complete</div>
<div style={{width:120,height:6,background:"#1E1E32",borderRadius:3,marginTop:4}}>
<div style={RS.bar(d.jobs>0?Math.round(d.complete/d.jobs*100):0,"#34D399")}/>
</div></div>
</div>
<div style={{fontSize:20,fontWeight:800,color:"#FBBF24"}}>${d.total.toLocaleString()}</div>
</div>)}
</div>}

{rTab==="buyers"&&<div>
<div style={RS.secTitle}>👤 Buyer Performance</div>
{buyerList.map(([name,d]: any)=><div key={name} style={RS.row}>
<div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{name}</div>
<div style={{fontSize:12,color:"#6B7280"}}>Recon: ${d.reconSpend.toLocaleString()}</div></div>
<div style={{display:"flex",gap:16,alignItems:"center"}}>
<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#3B82F6"}}>{d.bought}</div><div style={{fontSize:10,color:"#6B7280"}}>Bought</div></div>
<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#34D399"}}>{d.sold}</div><div style={{fontSize:10,color:"#6B7280"}}>Sold</div></div>
<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#F87171"}}>{d.kicked}</div><div style={{fontSize:10,color:"#6B7280"}}>Kicked</div></div>
</div></div>)}
<div style={{...RS.secTitle,marginTop:20}}>👤 Seller Performance</div>
{sellerList.map(([name,d]: any)=><div key={name} style={RS.row}>
<div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{name}</div>
<div style={{display:"flex",gap:16,alignItems:"center"}}>
<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#34D399"}}>{d.sold}</div><div style={{fontSize:10,color:"#6B7280"}}>Sold</div></div>
<div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#F87171"}}>{d.kicked}</div><div style={{fontSize:10,color:"#6B7280"}}>Kicked</div></div>
</div></div>)}
</div>}

{rTab==="locations"&&<div>
<div style={RS.secTitle}>📍 Location Breakdown</div>
{Object.entries(locStats).map(([loc,d]: any)=><div key={loc} style={{...RS.card,marginBottom:12}}>
<div style={{fontSize:20,fontWeight:700,color:"#E5E7EB",marginBottom:12}}>📍 {loc}</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:8}}>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#3B82F6"}}>{d.total}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Total</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#34D399"}}>{d.sold}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Sold</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#60A5FA"}}>{d.inbound}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Inbound</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#34D399"}}>{d.onGround}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>On Ground</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#FBBF24"}}>{d.inRecon}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>In Recon</div></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#06B6D4"}}>{d.r2ship}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>R2-Ship</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#A78BFA"}}>{d.outSet}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Outbound</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#F97316"}}>{d.pickedUp}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Picked Up</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#F87171"}}>{d.kicked}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Kicked</div></div>
<div style={{textAlign:"center",padding:10,background:"#0D0D1A",borderRadius:8}}><div style={{fontSize:24,fontWeight:800,color:"#06B6D4"}}>{d.daysCount>0?Math.round(d.daysSum/d.daysCount):0}</div><div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase"}}>Avg Days</div></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:8}}>
<div style={{textAlign:"center",padding:10,background:d.needsInbound>0?"rgba(239,68,68,0.1)":"#0D0D1A",borderRadius:8,border:d.needsInbound>0?"1px solid #7F1D1D":"1px solid transparent"}}><div style={{fontSize:24,fontWeight:800,color:d.needsInbound>0?"#F87171":"#4B5563"}}>{d.needsInbound}</div><div style={{fontSize:10,color:d.needsInbound>0?"#FCA5A5":"#6B7280",textTransform:"uppercase"}}>Needs Inbound Trans</div></div>
<div style={{textAlign:"center",padding:10,background:d.needsOutbound>0?"rgba(239,68,68,0.1)":"#0D0D1A",borderRadius:8,border:d.needsOutbound>0?"1px solid #7F1D1D":"1px solid transparent"}}><div style={{fontSize:24,fontWeight:800,color:d.needsOutbound>0?"#F87171":"#4B5563"}}>{d.needsOutbound}</div><div style={{fontSize:10,color:d.needsOutbound>0?"#FCA5A5":"#6B7280",textTransform:"uppercase"}}>Needs Outbound Trans</div></div>
</div>
</div>)}
</div>}
</div>;
}
