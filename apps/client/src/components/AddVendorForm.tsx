import { useState } from 'react';
import { VCAT } from '../lib/constants';
import { S } from '../lib/styles';

export function AddVendorForm({onSave, onClose, initial}: any) {
const [f,setF]=useState(initial||{company:"",contact:"",email:"",cell:"",address:"",categories:[],password:""});
const isEdit=!!initial;
return <div style={S.ov} onClick={onClose}><div style={{...S.modal,maxWidth:550}} onClick={(e: any)=>e.stopPropagation()}>
<h2 style={{color:"#E5E7EB",fontSize:20,marginBottom:12}}>{isEdit?"✏️ Edit Recon Vendor":"🔧 Register Recon Vendor"}</h2>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<label style={S.fl}>Company Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_vcompany" value={f.company} onChange={(e: any)=>setF({...f,company:e.target.value})}/></label>
<label style={S.fl}>Contact Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_vcontact" value={f.contact} onChange={(e: any)=>setF({...f,contact:e.target.value})}/></label>
<label style={S.fl}>Email (Username) *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_vemail" type="text" value={f.email} onChange={(e: any)=>setF({...f,email:e.target.value})}/></label>
<label style={S.fl}>Cell # *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_vphone" type="tel" value={f.cell} onChange={(e: any)=>setF({...f,cell:e.target.value})}/></label>
<label style={S.fl}>Office Phone<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_voffice" type="tel" value={f.officePhone||""} onChange={(e: any)=>setF({...f,officePhone:e.target.value})}/></label>
<label style={S.fl}>Password {isEdit?"(optional)":"*"}<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-password" name="fc_vpw" type="password" value={f.password||""} onChange={(e: any)=>setF({...f,password:e.target.value})} placeholder={isEdit?"Leave blank":"Login password"}/></label>
<label style={{...S.fl,gridColumn:"1/3"}}>Address<input style={{...S.fi,fontSize:16,padding:10}} value={f.address} onChange={(e: any)=>setF({...f,address:e.target.value})} placeholder="Street, City, State ZIP"/></label></div>
<div style={{marginTop:10,fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:8}}>Assign to Recon Categories * <span style={{fontSize:11,color:"#6B7280",fontWeight:400}}>({(f.categories||[]).length} selected)</span></div>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{VCAT.map(c=>{
  const cats=Array.isArray(f.categories)?f.categories:[];
  const isSelected=cats.includes(c.key);
  return <button key={c.key} type="button" style={{padding:"8px 14px",borderRadius:6,fontSize:14,fontWeight:600,cursor:"pointer",border:isSelected?"2px solid #3B82F6":"2px solid #2A2A3E",background:isSelected?"#1E3A5F":"#0D0D1A",color:isSelected?"#93C5FD":"#6B7280"}} onClick={(e: any)=>{
    e.preventDefault();e.stopPropagation();
    setF((prev: any)=>{
      const prevCats=Array.isArray(prev.categories)?[...prev.categories]:[];
      const newCats=prevCats.includes(c.key)?prevCats.filter((k: any)=>k!==c.key):[...prevCats,c.key];
      return {...prev,categories:newCats};
    });
  }}>{c.icon} {c.label}</button>;
})}</div>
<div style={{marginTop:14,padding:12,background:"#0D3B1E",border:"1px solid #166534",borderRadius:8}}>
<div style={{fontSize:13,fontWeight:700,color:"#34D399",marginBottom:10}}>💸 Payment Terms *</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<button type="button" style={{padding:12,borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",border:(f.paymentTerms||"weekly")==="weekly"?"2px solid #34D399":"1px solid #2A2A3E",background:(f.paymentTerms||"weekly")==="weekly"?"#166534":"transparent",color:(f.paymentTerms||"weekly")==="weekly"?"#FFF":"#9CA3AF",textAlign:"center"}} onClick={(e: any)=>{e.preventDefault();setF({...f,paymentTerms:"weekly"});}}>📅 Weekly Batch<div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:0.8}}>One check per week</div></button>
<button type="button" style={{padding:12,borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",border:f.paymentTerms==="completion"?"2px solid #34D399":"1px solid #2A2A3E",background:f.paymentTerms==="completion"?"#166534":"transparent",color:f.paymentTerms==="completion"?"#FFF":"#9CA3AF",textAlign:"center"}} onClick={(e: any)=>{e.preventDefault();setF({...f,paymentTerms:"completion"});}}>⚡ On Completion<div style={{fontSize:10,fontWeight:400,marginTop:2,opacity:0.8}}>Pay per job</div></button>
</div>
{(f.paymentTerms||"weekly")==="weekly"&&<div style={{background:"#0D0D1A",borderRadius:6,padding:10}}>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
<div><div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Cutoff day</div><select style={{...S.sel,width:"100%",fontSize:12,padding:6}} value={f.cutoffDay||"Friday"} onChange={(e: any)=>setF({...f,cutoffDay:e.target.value})}><option>Thursday</option><option>Friday</option><option>Monday</option></select></div>
<div><div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Cutoff time (AZ)</div><select style={{...S.sel,width:"100%",fontSize:12,padding:6}} value={f.cutoffTime||"5 PM"} onChange={(e: any)=>setF({...f,cutoffTime:e.target.value})}><option>9 AM</option><option>12 PM</option><option>5 PM</option><option>6 PM</option></select></div>
</div>
<div><div style={{fontSize:10,color:"#6B7280",marginBottom:3}}>Default delivery method</div><select style={{...S.sel,width:"100%",fontSize:12,padding:6}} value={f.deliveryMethod||"USPS Mail"} onChange={(e: any)=>setF({...f,deliveryMethod:e.target.value})}><option>USPS Mail</option><option>Handed at PHX</option><option>Handed at Dallas</option><option>FedEx/UPS</option><option>Other</option></select></div>
</div>}
{f.paymentTerms==="completion"&&<div style={{padding:8,background:"#0D0D1A",borderRadius:6}}><div style={{fontSize:11,color:"#6EE7B7"}}>⚡ Vendor will be paid per approved job — no batching. AP gets immediate alert when buyer approves.</div></div>}
<div style={{marginTop:8,fontSize:10,color:"#6B7280",fontStyle:"italic"}}>🔒 Vendor only paid for jobs the buyer has approved.</div>
</div>
<div style={{display:"flex",gap:8,marginTop:14}}><button style={{...S.btn,flex:1,fontSize:16,padding:12}} onClick={()=>{
  const missing: any[]=[];
  if(!f.company||!f.company.trim())missing.push("Company Name");
  if(!f.contact||!f.contact.trim())missing.push("Contact Name");
  if(!f.email||!f.email.trim())missing.push("Email");
  if(!f.cell||!f.cell.trim())missing.push("Cell #");
  if(!isEdit&&(!f.password||!f.password.trim()))missing.push("Password");
  if(!f.categories||!f.categories.length)missing.push("at least one Recon Category");
  if(missing.length){alert("Please fill in: "+missing.join(", "));return;}
  onSave(f);
}}>{isEdit?"Save Changes":"Register Vendor"}</button><button style={{...S.sm,padding:12}} onClick={onClose}>Cancel</button></div>
</div></div>;
}
