import { useState } from 'react';
import { API_URL, VCAT } from '../lib/constants';
import { tryParse } from '../lib/utils';
import { S } from '../lib/styles';
import { AddUserForm } from '../components/AddUserForm';
import { AddVendorForm } from '../components/AddVendorForm';
import { AddTransportForm } from '../components/AddTransportForm';
import { useStore } from '../lib/store';

export function AdminPage() {
const users = useStore((s: any) => s.users);
const setUsers = useStore((s: any) => s.setUsers);
const allUsers = useStore((s: any) => s.allUsers);
const setAllUsers = useStore((s: any) => s.setAllUsers);
const regVendors = useStore((s: any) => s.regVendors);
const setRegVendors = useStore((s: any) => s.setRegVendors);
const vendors = useStore((s: any) => s.vendors);
const setVendors = useStore((s: any) => s.setVendors);
const notify = useStore((s: any) => s.notify);
const showConfirm = useStore((s: any) => s.showConfirm);
const [tab,setTab]=useState("users");
const [showAdd,setShowAdd]=useState(null as any);
const [editUser,setEditUser]=useState(null as any);
const [editVendor,setEditVendor]=useState(null as any);
const [delVendor,setDelVendor]=useState(null as any);
const [delTyped,setDelTyped]=useState('');
const [busy,setBusy]=useState(false);
const ts=(t: any)=>({padding:"8px 16px",borderRadius:6,border:t===tab?"1px solid #3B82F6":"1px solid #2A2A3E",background:t===tab?"#1E3A5F":"transparent",color:t===tab?"#93C5FD":"#6B7280",fontSize:14,cursor:"pointer",fontWeight:600});

const authHdrs=()=>({"Content-Type":"application/json","Authorization":"Bearer "+(sessionStorage.getItem("fc_token")||"")});

const saveUser=async(f: any)=>{
  setBusy(true);
  try{
    const payload={email:f.email.trim().toLowerCase(),phone:f.cell,first_name:f.firstName,last_name:f.lastName,role:f.role==="Buyer/Seller"?"admin":f.role==="Accounts Payable"?"ap":f.role.toLowerCase(),is_buyer:f.role==="Buyer"||f.role==="Buyer/Seller"||f.role==="Admin"?1:0,is_seller:f.role==="Seller"||f.role==="Buyer/Seller"||f.role==="Admin"?1:0,is_ap:f.role==="Accounts Payable"?1:0,location:f.location,password:f.password||""};
    const res=await fetch(API_URL+"/api/users",{method:"POST",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await reloadUsers();setShowAdd(null);notify("✅ User registered");
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);
};

const updateUser=async(f: any)=>{
  setBusy(true);
  try{
    const payload: any={first_name:f.firstName,last_name:f.lastName,phone:f.cell,role:f.role==="Buyer/Seller"?"admin":f.role==="Accounts Payable"?"ap":f.role.toLowerCase(),is_buyer:f.role==="Buyer"||f.role==="Buyer/Seller"||f.role==="Admin"?1:0,is_seller:f.role==="Seller"||f.role==="Buyer/Seller"||f.role==="Admin"?1:0,is_ap:f.role==="Accounts Payable"?1:0,location:f.location};
    if(f.password&&f.password.trim().length>0)payload.password=f.password.trim();
    const res=await fetch(API_URL+"/api/users/"+f.id,{method:"PUT",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await reloadUsers();setEditUser(null);notify("✅ User updated"+(f.password?" — password changed":""));
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);
};

const deleteUser=(u: any)=>{
  showConfirm(`Remove ${u.firstName} ${u.lastName}? They will no longer be able to log in. You can re-register them with the same email later.`,async()=>{
  setBusy(true);
  try{
    const res=await fetch(API_URL+"/api/users/"+u.id,{method:"DELETE",headers:authHdrs()});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await reloadUsers();notify("✅ User removed");
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);},"Remove User");
};

const reloadUsers=async()=>{
  const res=await fetch(API_URL+"/api/users",{headers:authHdrs()});
  const data=await res.json();
  const mapped=(data.users||[]).map((u: any)=>({id:u.id,firstName:u.first_name,lastName:u.last_name,name:u.first_name+" "+u.last_name,email:u.email,cell:u.phone,role:u.role,location:u.location}));
  setUsers(mapped);if(setAllUsers)setAllUsers(mapped);
};

const saveVendor=async(f: any)=>{
  setBusy(true);
  try{
    const payload={name:f.company,contact_name:f.contact,email:f.email.trim().toLowerCase(),phone:f.cell,office_phone:f.officePhone||"",location:f.address||"",categories:f.categories,password:f.password||"",payment_terms:f.paymentTerms||"weekly",cutoff_day:f.cutoffDay||"Friday",cutoff_time:f.cutoffTime||"5 PM",delivery_method:f.deliveryMethod||"USPS Mail"};
    const res=await fetch(API_URL+"/api/vendors",{method:"POST",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed to register vendor"));setBusy(false);return;}
    await reloadVendors();setShowAdd(null);
    if(data.warning){notify("⚠️ "+data.warning);}else if(data.updated){notify("✅ Vendor updated (was already in system)");}else{notify("✅ Vendor registered");}
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);
};

const updateVendor=async(f: any)=>{
  setBusy(true);
  try{
    const cats=Array.isArray(f.categories)?f.categories:(f.categories?[f.categories]:[]);
    const payload: any={name:f.company,contact_name:f.contact,email:f.email.trim().toLowerCase(),phone:f.cell,office_phone:f.officePhone||"",location:f.address||"",categories:cats,payment_terms:f.paymentTerms||"weekly",cutoff_day:f.cutoffDay||"Friday",cutoff_time:f.cutoffTime||"5 PM",delivery_method:f.deliveryMethod||"USPS Mail"};
    if(f.password&&f.password.trim())payload.password=f.password.trim();
    const res=await fetch(API_URL+"/api/vendors/"+f.id,{method:"PUT",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await reloadVendors();setEditVendor(null);
    if(data.warning){notify("⚠️ "+data.warning);}else{notify("✅ Vendor updated — saved "+cats.length+" categories");}
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);
};

const openDelVendor=(v: any)=>{setDelVendor(v);setDelTyped('');};
const closeDelVendor=()=>{setDelVendor(null);setDelTyped('');};
const confirmDelVendor=async()=>{
  if(!delVendor||delTyped!=='DELETE')return;
  setBusy(true);
  try{
    const res=await fetch(API_URL+"/api/vendors/"+delVendor.id,{method:"DELETE",headers:authHdrs()});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await reloadVendors();notify("✅ "+delVendor.company+" removed");
  }catch(e: any){notify("⚠️ "+e.message);}
  setBusy(false);closeDelVendor();
};
const vendorLinkedUsers=(v: any)=>allUsers.filter((u: any)=>u.vendorId===v.id||(u.vendorTag&&u.vendorTag.toLowerCase()===v.company.toLowerCase()));

const reloadVendors=async()=>{
  const res=await fetch(API_URL+"/api/vendors",{headers:authHdrs()});
  const data=await res.json();
  const vnMap: any={};VCAT.forEach(c=>{vnMap[c.key]=[];});
  const regVList: any[]=[];
  (data.vendors||[]).forEach((vn: any)=>{
    const cats=vn.categories?tryParse(vn.categories,[]):[];
    cats.forEach((ck: any)=>{if(vnMap[ck])vnMap[ck].push({id:"vn_"+vn.id,name:vn.name,email:vn.email||"",phone:vn.phone||""});});
    regVList.push({id:vn.id,company:vn.name,contact:vn.contact_name||"",email:vn.email||"",cell:vn.phone||"",officePhone:vn.office_phone||"",address:vn.location||"",categories:cats,primaryUserId:vn.primary_user_id||null,paymentTerms:vn.payment_terms||"weekly",cutoffDay:vn.cutoff_day||"Friday",cutoffTime:vn.cutoff_time||"5 PM",deliveryMethod:vn.delivery_method||"USPS Mail"});
  });
  setVendors(vnMap);setRegVendors(regVList);
};

return <div style={{padding:10}}>
<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
<button style={ts("users")} onClick={()=>setTab("users")}>👤 Users/Admin ({users.length})</button>
<button style={ts("vendors")} onClick={()=>setTab("vendors")}>🔧 Recon Vendors ({regVendors.length})</button>
<button style={ts("transport")} onClick={()=>setTab("transport")}>🚛 Transport</button></div>

{tab==="users"&&<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:0}}>👤 Users / Admin</h3>
<button style={{...S.btn,fontSize:14}} onClick={()=>setShowAdd("user")} disabled={busy}>+ Add User</button></div>
{users.length===0&&<div style={{color:"#4B5563",textAlign:"center",padding:20}}>No users registered yet</div>}
{users.map((u: any)=><div key={u.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
<div style={{flex:"1 1 200px"}}>
<div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{u.firstName} {u.lastName}</div>
<div style={{fontSize:13,color:"#9CA3AF"}}>{u.email} • {u.cell}</div>
<div style={{fontSize:12,color:"#6B7280"}}>{u.role} • {u.location}</div></div>
<div style={{display:"flex",gap:6}}>
<button style={{...S.sm,color:"#93C5FD"}} onClick={()=>setEditUser(u)} disabled={busy}>Edit</button>
<button style={{...S.sm,color:"#F87171"}} onClick={()=>deleteUser(u)} disabled={busy}>Remove</button>
</div></div>)}</div>}

{tab==="vendors"&&<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:0}}>🔧 Recon Vendors</h3>
<button style={{...S.btn,fontSize:14}} onClick={()=>setShowAdd("vendor")} disabled={busy}>+ Add Vendor</button></div>
{regVendors.length===0&&<div style={{color:"#4B5563",textAlign:"center",padding:20}}>No vendors registered yet</div>}
{regVendors.map((v2: any)=><div key={v2.id} style={{...S.card}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8,flexWrap:"wrap"}}>
<div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{v2.company}</div>
<div style={{display:"flex",gap:6}}>
<button style={{...S.sm,color:"#93C5FD"}} onClick={()=>setEditVendor(v2)} disabled={busy}>Edit</button>
<button style={{...S.sm,color:"#F87171"}} onClick={()=>openDelVendor(v2)} disabled={busy}>Remove</button>
</div></div>
<div style={{fontSize:13,color:"#9CA3AF"}}>{v2.contact} • {v2.email} • {v2.cell}</div>
{v2.address&&<div style={{fontSize:12,color:"#6B7280"}}>{v2.address}</div>}
<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>{(v2.categories||[]).map((ck: any)=>{const cat=VCAT.find(c=>c.key===ck);return cat?<span key={ck} style={{...S.badge,background:"#1E3A5F",color:"#93C5FD"}}>{cat.icon} {cat.label}</span>:null;})}</div></div>)}</div>}

{tab==="transport"&&<div>
<div style={{...S.card,textAlign:"center",padding:30}}>
<div style={{fontSize:40,marginBottom:10}}>🚛</div>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:"0 0 8px"}}>Transport Registration</h3>
<div style={{fontSize:14,color:"#9CA3AF",marginBottom:12}}>Coming soon — Central Dispatch integration</div>
<div style={{fontSize:13,color:"#6B7280",maxWidth:400,margin:"0 auto",lineHeight:1.5}}>We'll pull transport companies directly from Central Dispatch and other third-party carrier networks via API. No manual registration needed.</div>
</div></div>}

{showAdd==="user"&&<AddUserForm onClose={()=>setShowAdd(null)} onSave={saveUser}/>}
{showAdd==="vendor"&&<AddVendorForm onClose={()=>setShowAdd(null)} onSave={saveVendor}/>}
{editUser&&<AddUserForm initial={editUser} onClose={()=>setEditUser(null)} onSave={updateUser}/>}
{editVendor&&<AddVendorForm initial={editVendor} onClose={()=>setEditVendor(null)} onSave={updateVendor}/>}

{delVendor&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}} onClick={closeDelVendor}>
  <div style={{background:"#12122A",border:"2px solid #7F1D1D",borderRadius:12,padding:28,width:"100%",maxWidth:460}} onClick={(e:any)=>e.stopPropagation()}>
    <div style={{fontSize:17,fontWeight:800,color:"#F87171",marginBottom:4}}>🗑 Remove Vendor</div>
    <div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{delVendor.company}</div>
    <div style={{fontSize:13,color:"#6B7280",marginBottom:16}}>{delVendor.email}</div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
      <div style={{padding:10,borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#9CA3AF",marginBottom:6}}>ASSIGNED CATEGORIES</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {(delVendor.categories||[]).map((ck: any)=>{const cat=VCAT.find((c: any)=>c.key===ck);return cat?<span key={ck} style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:"#1E3A5F",color:"#93C5FD"}}>{cat.icon} {cat.label}</span>:null;})}
        </div>
      </div>
      {vendorLinkedUsers(delVendor).length>0
        ?<div style={{padding:10,borderRadius:8,background:"#3B1515",border:"1px solid #7F1D1D"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#FCA5A5",marginBottom:6}}>LINKED ACCOUNTS — WILL BE DEACTIVATED</div>
          {vendorLinkedUsers(delVendor).map((u: any)=><div key={u.id} style={{fontSize:13,color:"#E5E7EB",padding:"3px 0"}}>{u.firstName} {u.lastName} <span style={{color:"#6B7280"}}>• {u.email}</span></div>)}
        </div>
        :<div style={{padding:10,borderRadius:8,background:"#0D0D1A",border:"1px solid #2A2A3E",fontSize:12,color:"#6B7280"}}>No linked user accounts</div>}
    </div>
    <div style={{fontSize:13,color:"#9CA3AF",marginBottom:6}}>Type <span style={{color:"#F87171",fontWeight:700,fontFamily:"monospace"}}>DELETE</span> to confirm:</div>
    <input autoFocus style={{width:"100%",boxSizing:"border-box",padding:"10px 14px",borderRadius:6,border:`2px solid ${delTyped==="DELETE"?"#DC2626":"#4B5563"}`,background:"#0D0D1A",color:"#F87171",fontSize:16,fontWeight:700,fontFamily:"monospace",outline:"none",marginBottom:16}}
      placeholder="DELETE" value={delTyped} onChange={(e:any)=>setDelTyped(e.target.value)} onKeyDown={(e:any)=>{if(e.key==="Enter"&&delTyped==="DELETE")confirmDelVendor();}}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
      <button style={{padding:"8px 20px",borderRadius:6,border:"1px solid #2A2A3E",background:"transparent",color:"#9CA3AF",fontSize:14,cursor:"pointer",fontWeight:600}} onClick={closeDelVendor}>Cancel</button>
      <button style={{padding:"8px 20px",borderRadius:6,border:"none",background:delTyped==="DELETE"?"#7F1D1D":"#1F1F2E",color:delTyped==="DELETE"?"#FCA5A5":"#4B5563",fontSize:14,cursor:delTyped==="DELETE"?"pointer":"not-allowed",fontWeight:700}}
        disabled={delTyped!=="DELETE"||busy} onClick={confirmDelVendor}>{busy?"Removing...":"Delete Vendor"}</button>
    </div>
  </div>
</div>}
</div>;
}
