import { useState, useMemo } from 'react';
import { VCAT } from '../lib/constants';
import { fmtDate, vData } from '../lib/utils';
import { S } from '../lib/styles';
import { DateIn } from '../components/DateIn';
import { useStore } from '../lib/store';

export function PaymentsPage(){
const vehicles = useStore((s: any) => s.vehicles);
const vendors = useStore((s: any) => s.vendors);
const notify = useStore((s: any) => s.notify);
const fireEmail = useStore((s: any) => s.fireEmail);
const currentUser = useStore((s: any) => s.currentUser);
const upd = useStore((s: any) => s.upd);
const [locFilter,setLocFilter]=useState("all");
const [expandedVendor,setExpandedVendor]=useState(null as any);
const [paymentForm,setPaymentForm]=useState({} as any);
const queue=useMemo(()=>{
  const groups: any={};
  vehicles.forEach((v: any)=>{
    if(!v.reconTasks)return;
    VCAT.forEach(cat=>{
      const task=v.reconTasks[cat.key];
      if(!task||task.status!=="complete"||!task.approvedForPayment||task.paid)return;
      if(locFilter!=="all"&&v.location!==locFilter)return;
      const vendorName=task.lockedVendorName||"Unknown Vendor";
      const winnerVn=(task.vendors||[]).find((x: any)=>x.selected);
      if(!groups[vendorName]){const vRec=vendors.find((vr: any)=>vr.name===vendorName);groups[vendorName]={name:vendorName,location:v.location,vendorEmail:winnerVn?.email,jobs:[],total:0,totalWS:0,totalRetail:0,deliveryMethod:vRec?.delivery_method||"USPS Mail",paymentTerms:vRec?.payment_terms||"weekly",cutoffDay:vRec?.cutoff_day||"Friday",cutoffTime:vRec?.cutoff_time||"5 PM"};}
      const accLines=(winnerVn?.lineItems||[]).filter((x: any)=>x.accepted&&!x.declined);
      groups[vendorName].jobs.push({vehicleId:v.id,vehicle:v,categoryKey:cat.key,categoryLabel:cat.label,categoryIcon:cat.icon,lineItems:accLines,total:task.lockedTotal||0,ws:task.lockedWS||0,retail:task.lockedRetail||0,approvedBy:task.approvedBy,approvedDate:task.approvedPaymentDate});
      groups[vendorName].total+=task.lockedTotal||0;
      groups[vendorName].totalWS+=task.lockedWS||0;
      groups[vendorName].totalRetail+=task.lockedRetail||0;
    });
  });
  return Object.values(groups);
},[vehicles,locFilter]);

const phxCount=vehicles.filter((v: any)=>{return VCAT.some(c=>{const t=v.reconTasks?.[c.key];return t?.status==="complete"&&t?.approvedForPayment&&!t?.paid&&v.location==="PHX";});}).length;
const dallasCount=vehicles.filter((v: any)=>{return VCAT.some(c=>{const t=v.reconTasks?.[c.key];return t?.status==="complete"&&t?.approvedForPayment&&!t?.paid&&v.location==="Dallas";});}).length;
const grandTotal=queue.reduce((s: any,g: any)=>s+g.total,0);

const markPaid=(group: any)=>{
  const f=paymentForm[group.name]||{};
  if(!f.checkNumber||!f.writtenDate){notify("⚠️ Enter check # and written date");return;}
  const mailedDate=f.mailedDate||f.writtenDate;
  const method=f.method||group.deliveryMethod||"USPS Mail";
  const apName=currentUser?.first_name?currentUser.first_name+" "+(currentUser.last_name||""):"AP";
  const paidJobs: any[]=[];
  group.jobs.forEach((job: any)=>{
    const v=vehicles.find((x: any)=>x.id===job.vehicleId);
    if(!v)return;
    const newTasks={...v.reconTasks};
    newTasks[job.categoryKey]={...newTasks[job.categoryKey],paid:true,paidDate:f.writtenDate,checkNumber:f.checkNumber,mailedDate:mailedDate,deliveryMethod:method,paidBy:apName,paidNotes:f.notes||""};
    upd(v.id,{reconTasks:newTasks});
    paidJobs.push(job);
  });
  if(typeof fireEmail==="function"&&group.vendorEmail){
    fireEmail("vendor_payment_receipt",{
      vendor:{name:group.name,email:group.vendorEmail},
      checkNumber:f.checkNumber,checkWrittenDate:f.writtenDate,checkMailedDate:mailedDate,
      deliveryMethod:method,totalPaid:group.total,totalWS:group.totalWS,totalRetail:group.totalRetail,
      paidBy:apName,
      jobs:paidJobs.map((j: any)=>({vehicleYear:j.vehicle.year,vehicleMake:j.vehicle.make,vehicleModel:j.vehicle.model,vehicleTrim:j.vehicle.trim,vin8:j.vehicle.vin8||j.vehicle.stockNumber,categoryLabel:j.categoryLabel,categoryIcon:j.categoryIcon,lineItems:j.lineItems.map((li: any)=>({desc:li.desc,price:li.price,costType:li.costType||"ws"})),total:j.total,approvedBy:j.approvedBy,approvedDate:j.approvedDate}))
    });
  }
  notify("💸 Marked paid — "+group.name+" notified");
  setExpandedVendor(null);
  setPaymentForm((p: any)=>{const np={...p};delete np[group.name];return np;});
};

const updateForm=(vendorName: any,field: any,value: any)=>{
  setPaymentForm((p: any)=>({...p,[vendorName]:{...(p[vendorName]||{}),[field]:value}}));
};

return <div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<div>
<div style={{fontSize:20,fontWeight:700,color:"#FFF"}}>💸 Payment Queue</div>
<div style={{fontSize:13,color:"#9CA3AF"}}>{queue.length} vendor{queue.length===1?"":"s"} awaiting payment — ${grandTotal.toLocaleString()} total</div>
</div>
<div style={{display:"flex",gap:6}}>
<button style={{padding:"6px 14px",background:locFilter==="all"?"#1E3A5F":"transparent",color:locFilter==="all"?"#93C5FD":"#9CA3AF",border:"1px solid "+(locFilter==="all"?"#3B82F6":"#2A2A3E"),borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setLocFilter("all")}>All ({phxCount+dallasCount})</button>
<button style={{padding:"6px 14px",background:locFilter==="PHX"?"#1E3A5F":"transparent",color:locFilter==="PHX"?"#93C5FD":"#9CA3AF",border:"1px solid "+(locFilter==="PHX"?"#3B82F6":"#2A2A3E"),borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setLocFilter("PHX")}>📍 PHX ({phxCount})</button>
<button style={{padding:"6px 14px",background:locFilter==="Dallas"?"#4C1D95":"transparent",color:locFilter==="Dallas"?"#C4B5FD":"#9CA3AF",border:"1px solid "+(locFilter==="Dallas"?"#7C3AED":"#2A2A3E"),borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setLocFilter("Dallas")}>📍 Dallas ({dallasCount})</button>
</div>
</div>

{queue.length===0&&<div style={{padding:40,textAlign:"center",background:"#0D3B1E",borderRadius:12,border:"1px solid #166534"}}>
<div style={{fontSize:48,marginBottom:10}}>✅</div>
<div style={{fontSize:16,fontWeight:700,color:"#34D399"}}>All caught up</div>
<div style={{fontSize:12,color:"#6EE7B7",marginTop:4}}>No approved jobs awaiting payment{locFilter!=="all"?" in "+locFilter:""}</div>
</div>}

{queue.map((group: any,gi: any)=>{
const isExp=expandedVendor===group.name;
const f=paymentForm[group.name]||{};
return <div key={gi} style={{background:"#12122A",border:"1px solid #2A2A3E",borderRadius:10,padding:16,marginBottom:12}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:isExp?12:0,paddingBottom:isExp?10:0,borderBottom:isExp?"1px solid #2A2A3E":"none",cursor:"pointer"}} onClick={()=>setExpandedVendor(isExp?null:group.name)}>
<div>
<div style={{fontSize:17,fontWeight:700,color:"#FFF"}}>{group.name}</div>
<div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{group.jobs.length} approved job{group.jobs.length>1?"s":""} • <span style={{padding:"2px 8px",background:group.location==="Dallas"?"#4C1D95":"#1E3A5F",color:group.location==="Dallas"?"#C4B5FD":"#93C5FD",borderRadius:4,fontSize:10,fontWeight:700,marginLeft:4}}>📍 {group.location||"PHX"}</span></div>
</div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:10,color:"#6B7280"}}>Check total</div>
<div style={{fontSize:24,fontWeight:700,color:"#34D399"}}>${group.total.toLocaleString()}</div>
<div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{isExp?"▼":"▶"} {isExp?"Hide details":"Click to expand"}</div>
</div>
</div>
{isExp&&<div>
{group.jobs.map((job: any,ji: any)=><div key={ji} style={{padding:12,background:"#0D0D1A",borderRadius:6,marginBottom:6,borderLeft:"3px solid #34D399"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
<div>
<div style={{color:"#FFF",fontWeight:700,fontSize:13}}>{job.vehicle.year} {job.vehicle.make} {job.vehicle.model} {job.vehicle.trim||""}</div>
<div style={{color:"#6B7280",fontSize:11,marginTop:2}}>VIN <span style={{fontFamily:"monospace",color:"#9CA3AF"}}>{job.vehicle.vin8||job.vehicle.stockNumber||"—"}</span></div>
</div>
<div style={{textAlign:"right"}}>
<div style={{background:"#3B2F10",color:"#FDE68A",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,display:"inline-block"}}>{job.categoryIcon} {job.categoryLabel.toUpperCase()}</div>
<div style={{color:"#FBBF24",fontWeight:700,fontSize:16,marginTop:4}}>${job.total.toLocaleString()}</div>
</div>
</div>
<div style={{background:"#1A1A2E",padding:8,borderRadius:4,marginBottom:6}}>
<div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Work completed</div>
{job.lineItems.map((li: any,lii: any)=><div key={lii} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"2px 0",color:"#E5E7EB"}}>
<span>{li.desc}</span>
<span><span style={{color:li.costType==="retail"?"#67E8F9":"#93C5FD",fontSize:10}}>{li.costType==="retail"?"Retail":"W/S"}</span> <span style={{color:"#FBBF24",fontWeight:700,marginLeft:4}}>${Number(li.price)||0}</span></span>
</div>)}
</div>
<div style={{padding:"6px 10px",background:"#0D3B1E",borderLeft:"2px solid #166534",borderRadius:4}}>
<div style={{fontSize:10,color:"#34D399",textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>✅ Approval audit</div>
<div style={{fontSize:11,color:"#6EE7B7",marginTop:2}}>Approved <b>{fmtDate(job.approvedDate)}</b> by <b>{job.approvedBy||"Buyer"}</b></div>
</div>
</div>)}

<div style={{padding:10,background:"#0D3B1E",borderLeft:"3px solid #166534",borderRadius:6,marginBottom:12,fontSize:11}}>
<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#93C5FD"}}>W/S liability</span><span style={{color:"#BFDBFE",fontWeight:700}}>${group.totalWS.toLocaleString()}</span></div>
<div style={{display:"flex",justifyContent:"space-between",marginTop:2}}><span style={{color:"#67E8F9"}}>Retail liability</span><span style={{color:"#A5F3FC",fontWeight:700}}>${group.totalRetail.toLocaleString()}</span></div>
</div>

<div style={{background:"#0D0D1A",borderRadius:8,padding:12,border:"1px dashed #166534"}}>
<div style={{fontSize:11,color:"#34D399",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:8}}>✏️ Enter payment</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Check #</div>
<input type="text" placeholder="1234" value={f.checkNumber||""} onChange={(e: any)=>updateForm(group.name,"checkNumber",e.target.value)} style={{width:"100%",padding:8,background:"#1A1A2E",border:"1px solid #2A2A3E",borderRadius:6,color:"#FFF",fontSize:13,boxSizing:"border-box"}}/>
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<div><div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>📝 Check written</div><DateIn value={f.writtenDate||""} onChange={(v: any)=>updateForm(group.name,"writtenDate",v)}/></div>
<div><div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>📬 Check mailed/delivered</div><DateIn value={f.mailedDate||""} onChange={(v: any)=>updateForm(group.name,"mailedDate",v)}/></div>
</div>
<div style={{marginBottom:8}}>
<div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Delivery method</div>
<select style={{...S.sel,width:"100%",fontSize:13}} value={f.method||group.deliveryMethod||"USPS Mail"} onChange={(e: any)=>updateForm(group.name,"method",e.target.value)}>
<option>USPS Mail</option><option>Handed to vendor</option><option>Picked up at office</option><option>FedEx/UPS</option><option>Other</option>
</select>
</div>
<div style={{marginBottom:10}}>
<div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Notes (optional)</div>
<input type="text" placeholder="Mailed first class" value={f.notes||""} onChange={(e: any)=>updateForm(group.name,"notes",e.target.value)} style={{width:"100%",padding:8,background:"#1A1A2E",border:"1px solid #2A2A3E",borderRadius:6,color:"#FFF",fontSize:13,boxSizing:"border-box"}}/>
</div>
<button style={{...S.btn,width:"100%",background:"#166534",color:"#FFF",padding:12,fontSize:14,fontWeight:700}} onClick={()=>markPaid(group)}>💸 Mark Paid ${group.total.toLocaleString()} → Notify {group.name}</button>
</div>
</div>}
</div>;
})}
</div>;
}
