import { useState } from 'react';
import { API_URL, VCAT } from '../lib/constants';
import { tryParse } from '../lib/utils';
import { S } from '../lib/styles';
import { AddUserForm } from '../components/AddUserForm';
import { AddVendorForm } from '../components/AddVendorForm';
import { AddTransportForm } from '../components/AddTransportForm';
import { useStore, selectRoles } from '../lib/store';

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
const { isAdmin, isTechSupport } = useStore(selectRoles);
const [tab,setTab]=useState("users");
const siteSettings = useStore((s: any) => s.siteSettings);
const setSiteSettings = useStore((s: any) => s.setSiteSettings);
const [showAdd,setShowAdd]=useState(null as any);
const [editUser,setEditUser]=useState(null as any);
const [editVendor,setEditVendor]=useState(null as any);
const [delVendor,setDelVendor]=useState(null as any);
const [delTyped,setDelTyped]=useState('');
const [busy,setBusy]=useState(false);
const ts=(t: any)=>({padding:"8px 16px",borderRadius:6,border:t===tab?"1px solid #3B82F6":"1px solid #2A2A3E",background:t===tab?"#1E3A5F":"transparent",color:t===tab?"#93C5FD":"#6B7280",fontSize:14,cursor:"pointer",fontWeight:600});

const authHdrs=()=>({"Content-Type":"application/json","Authorization":"Bearer "+(localStorage.getItem("fc_token")||"")});

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
    if((isAdmin||isTechSupport)&&f.email&&f.email.trim()!==editUser?.email)payload.email=f.email.trim().toLowerCase();
    if(f.password&&f.password.trim().length>0)payload.password=f.password.trim();
    if(f.role==="Vendor"){
      payload.vendor_id=f.vendorId||null;
      const vn=regVendors.find((v: any)=>String(v.id)===String(f.vendorId));
      payload.vendor_tag=vn?vn.company:null;
    }
    const res=await fetch(API_URL+"/api/users/"+f.id,{method:"PUT",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    // Handle primary contact changes on vendor records
    if(f.role==="Vendor"){
      const oldVid=String(editUser?.vendorId||"");
      const newVid=String(f.vendorId||"");
      const oldVendor=regVendors.find((v: any)=>String(v.id)===oldVid);
      const isPrimaryOnOld=oldVendor&&String(oldVendor.primaryUserId)===String(editUser?.id);
      // Moving off old vendor where user was primary → clear it
      if(oldVid&&oldVid!==newVid&&isPrimaryOnOld){
        await fetch(API_URL+"/api/vendors/"+oldVid,{method:"PUT",headers:authHdrs(),body:JSON.stringify({primary_user_id:null})});
      }
      // Set primary on new/current vendor if checked
      if(newVid&&f.makePrimary){
        await fetch(API_URL+"/api/vendors/"+newVid,{method:"PUT",headers:authHdrs(),body:JSON.stringify({primary_user_id:f.id})});
      }
      // Same vendor, unchecked primary, was primary → clear it
      if(newVid&&oldVid===newVid&&!f.makePrimary&&isPrimaryOnOld){
        await fetch(API_URL+"/api/vendors/"+newVid,{method:"PUT",headers:authHdrs(),body:JSON.stringify({primary_user_id:null})});
      }
    }
    await reloadUsers();await reloadVendors();setEditUser(null);notify("✅ User updated"+(f.password?" — password changed":""));
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
  const mapped=(data.users||[]).map((u: any)=>({id:u.id,firstName:u.first_name,lastName:u.last_name,name:u.first_name+" "+u.last_name,email:u.email,cell:u.phone,role:u.role,location:u.location,isBuyer:!!u.is_buyer,isSeller:!!u.is_seller,vendorTag:u.vendor_tag||null,vendorId:u.vendor_id||null}));
  setUsers(mapped);if(setAllUsers)setAllUsers(mapped);
};

const saveVendor=async(f: any)=>{
  setBusy(true);
  try{
    const contactName=((f.firstName||"")+" "+(f.lastName||"")).trim();
    const payload: any={name:f.company,contact_name:contactName,email:(f.email||"").trim().toLowerCase(),phone:f.cell,office_phone:f.officePhone||"",location:f.address||"",categories:f.categories,password:f.password||"",payment_terms:f.paymentTerms||"weekly",cutoff_day:f.cutoffDay||"Friday",cutoff_time:f.cutoffTime||"5 PM",delivery_method:f.deliveryMethod||"USPS Mail",email_prefs:f.emailPrefs||{}};
    if(f.link_user_id)payload.link_user_id=f.link_user_id;
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
    const payload: any={name:f.company,office_phone:f.officePhone||"",location:f.address||"",categories:cats,payment_terms:f.paymentTerms||"weekly",cutoff_day:f.cutoffDay||"Friday",cutoff_time:f.cutoffTime||"5 PM",delivery_method:f.deliveryMethod||"USPS Mail",payment_info:f.paymentInfo||{},email_prefs:f.emailPrefs||{}};
    if(f.primaryUserId!==undefined)payload.primary_user_id=f.primaryUserId;
    if(f.addUserIds?.length)    payload.add_user_ids    = f.addUserIds;
    if(f.removeUserIds?.length) payload.remove_user_ids = f.removeUserIds;
    const res=await fetch(API_URL+"/api/vendors/"+f.id,{method:"PUT",headers:authHdrs(),body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok||data.error){notify("⚠️ "+(data.error||"Failed"));setBusy(false);return;}
    await Promise.all([reloadVendors(), reloadUsers()]);setEditVendor(null);
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
    regVList.push({id:vn.id,company:vn.name,contact:vn.contact_name||"",email:vn.email||"",cell:vn.phone||"",officePhone:vn.office_phone||"",address:vn.location||"",categories:cats,primaryUserId:vn.primary_user_id||null,paymentTerms:vn.payment_terms||"weekly",cutoffDay:vn.cutoff_day||"Friday",cutoffTime:vn.cutoff_time||"5 PM",deliveryMethod:vn.delivery_method||"USPS Mail",paymentInfo:vn.payment_info||{},emailPrefs:vn.email_prefs||{}});
  });
  setVendors(vnMap);setRegVendors(regVList);
};

return <div style={{padding:10}}>
<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
<button style={ts("users")} onClick={()=>setTab("users")}>👤 Users/Admin ({users.length})</button>
<button style={ts("vendors")} onClick={()=>setTab("vendors")}>🔧 Recon Vendors ({regVendors.length})</button>
<button style={ts("transport")} onClick={()=>setTab("transport")}>🚛 Transport</button>
<button style={ts("techsupport")} onClick={()=>setTab("techsupport")}>⚙️ Settings</button></div>

{tab==="users"&&<div>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:0}}>👤 Users / Admin</h3>
<button style={{...S.btn,fontSize:14}} onClick={()=>setShowAdd("user")} disabled={busy}>+ Add User</button></div>
{users.length===0&&<div style={{color:"#4B5563",textAlign:"center",padding:20}}>No users registered yet</div>}
{users.map((u: any)=><div key={u.id} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
<div style={{flex:"1 1 200px"}}>
<div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{u.firstName} {u.lastName}</div>
<div style={{fontSize:13,color:"#9CA3AF"}}>{u.email} • {u.cell}</div>
<div style={{fontSize:12,color:"#6B7280"}}>{u.role} • {u.location}</div>
{isAdmin&&<div style={{fontSize:10,color:"#4B5563",fontFamily:"monospace",marginTop:1}}>ID: {u.id}</div>}</div>
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
{isAdmin&&<div style={{fontSize:10,color:"#4B5563",fontFamily:"monospace",marginTop:1}}>ID: {v2.id}</div>}
<div style={{display:"flex",gap:6}}>
<button style={{...S.sm,color:"#93C5FD"}} onClick={()=>setEditVendor(v2)} disabled={busy}>Edit</button>
<button style={{...S.sm,color:"#F87171"}} onClick={()=>openDelVendor(v2)} disabled={busy}>Remove</button>
</div></div>
{(()=>{
  const primary=(allUsers||[]).find((u: any)=>v2.primaryUserId&&String(u.id)===String(v2.primaryUserId));
  const assigned=(allUsers||[]).filter((u: any)=>u.vendorId===v2.id);
  const payDeptEmail=v2.emailPrefs?.paymentDeptEmail;
  return <>
    {primary
      ? <div style={{fontSize:13,color:"#9CA3AF",marginBottom:2}}>👤 {primary.name} · {primary.email}{primary.cell?' · '+primary.cell:''}</div>
      : <div style={{fontSize:12,color:"#4B5563",fontStyle:"italic",marginBottom:2}}>No primary contact assigned</div>}
    <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:12,color:"#6B7280",marginBottom:2}}>
      {v2.officePhone&&<span>📞 {v2.officePhone}</span>}
      {payDeptEmail&&<span>💸 {payDeptEmail}</span>}
      {v2.address&&<span>📍 {v2.address}</span>}
      <span>💳 {v2.paymentTerms==="weekly"?`Weekly · ${v2.cutoffDay} ${v2.cutoffTime}`:"Per Completion"}</span>
      {assigned.length>0&&<span>👥 {assigned.length} user{assigned.length!==1?"s":""}</span>}
    </div>
  </>;
})()}
<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>{(v2.categories||[]).map((ck: any)=>{const cat=VCAT.find(c=>c.key===ck);return cat?<span key={ck} style={{...S.badge,background:"#1E3A5F",color:"#93C5FD"}}>{cat.icon} {cat.label}</span>:null;})}</div></div>)}</div>}

{tab==="transport"&&<div>
<div style={{...S.card,textAlign:"center",padding:30}}>
<div style={{fontSize:40,marginBottom:10}}>🚛</div>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:"0 0 8px"}}>Transport Registration</h3>
<div style={{fontSize:14,color:"#9CA3AF",marginBottom:12}}>Coming soon — Central Dispatch integration</div>
<div style={{fontSize:13,color:"#6B7280",maxWidth:400,margin:"0 auto",lineHeight:1.5}}>We'll pull transport companies directly from Central Dispatch and other third-party carrier networks via API. No manual registration needed.</div>
</div></div>}

{tab==="techsupport"&&<div>
<h3 style={{color:"#E5E7EB",fontSize:18,margin:"0 0 16px"}}>⚙️ Settings</h3>
<div style={{...S.card}}>
  <div style={{fontSize:14,fontWeight:700,color:"#9CA3AF",marginBottom:14,letterSpacing:1}}>EMAIL SETTINGS</div>
  {(()=>{
    const CC_CATS=[
      {key:"all",     label:"All Emails",          desc:"Every outbound email regardless of type"},
      {key:"buyer",   label:"Buyer / Broker Emails",desc:"Bid submissions, work complete, vehicle sold, kicked, shipping approvals"},
      {key:"seller",  label:"Seller Emails",        desc:"Vehicle sold, kicked, and progress update notifications"},
      {key:"vendor",  label:"Vendor Emails",        desc:"Work assignments, bid requests, bid accepted/declined, work canceled, work started"},
      {key:"payment", label:"Payment Emails",       desc:"Approved for payment, vendor payment receipts, weekly digest, disputes"},
      {key:"shipping",label:"Shipping & Logistics", desc:"Grounded, transport set, shipping holds, driveway pickups/deliveries, dealer shipped/delivered"},
      {key:"parts",   label:"Parts & Orders",       desc:"Parts requests, quotes, approvals, received, rejected, backorder"},
    ];
    let cats: Record<string,boolean>={};
    try{cats=JSON.parse(siteSettings.cc_admins_categories||"{}");}catch{}
    const saveCats=async(next: Record<string,boolean>)=>{
      const val=JSON.stringify(next);
      const token=localStorage.getItem("fc_token")||"";
      const r=await fetch(`${API_URL}/api/settings/cc_admins_categories`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({value:val})});
      if(r.ok){setSiteSettings({...siteSettings,cc_admins_categories:val});}
      else notify("⚠️ Failed to save setting");
    };
    const anyOn=Object.values(cats).some(Boolean);
    return <div style={{padding:"14px 0",borderBottom:"1px solid #1E1E32"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>CC Admins on Emails</div>
          <div style={{fontSize:13,color:"#6B7280",marginTop:3}}>Choose which email categories admin users are CC'd on. Changes take effect immediately.</div>
        </div>
        {anyOn&&<span style={{padding:"3px 10px",background:"#166534",color:"#6EE7B7",borderRadius:6,fontSize:11,fontWeight:700,flexShrink:0}}>ACTIVE</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {CC_CATS.map(({key,label,desc})=>{
          const on=!!(key==="all"?cats.all:cats[key]);
          return <label key={key} style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"8px 10px",borderRadius:6,background:on?"#0D1A0D":"transparent",border:on?"1px solid #166534":"1px solid #1E1E32"}}
            onClick={async()=>{
              if(key==="all"){
                const nextOn=!cats.all;
                await saveCats({...cats,all:nextOn});
              } else {
                await saveCats({...cats,all:false,[key]:!cats[key]});
              }
            }}>
            <div style={{width:16,height:16,borderRadius:3,border:on?"2px solid #34D399":"2px solid #374151",background:on?"#166534":"transparent",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {on&&<span style={{color:"#34D399",fontSize:11,fontWeight:900}}>✓</span>}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:on?"#D1FAE5":"#E5E7EB"}}>{label}{key==="all"&&<span style={{fontSize:11,color:"#F59E0B",marginLeft:6,fontWeight:400}}>(overrides all below)</span>}</div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>{desc}</div>
            </div>
          </label>;
        })}
      </div>
    </div>;
  })()}
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"14px 0",borderTop:"1px solid #1E1E32",gap:16}}>
    <div style={{flex:1}}>
      <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>Daily Vendor Digest Times</div>
      <div style={{fontSize:13,color:"#6B7280",marginTop:3}}>Hours the digest fires for <b style={{color:"#E5E7EB"}}>completion-terms</b> vendors (Mon–Fri). Typically 3× per day. Changes take effect immediately.</div>
      <div style={{fontSize:11,color:"#4B5563",marginTop:6,padding:"3px 8px",background:"#0D0D1A",borderRadius:4,display:"inline-block",border:"1px solid #1E1E32"}}>🌐 Server timezone: <span style={{color:"#9CA3AF",fontFamily:"monospace"}}>{siteSettings.server_timezone||"America/Phoenix"}</span> — change via TZ env var</div>
    </div>
    <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:320}}>
      {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((h: number)=>{
        const label=h===12?"12pm":h<12?`${h}am`:`${h-12}pm`;
        const fireHours=(siteSettings.digest_daily_hours||"8,12,17").split(",").map(Number);
        const on=fireHours.includes(h);
        return <button key={h} style={{padding:"5px 10px",borderRadius:6,border:on?"2px solid #166534":"1px solid #2A2A3E",cursor:"pointer",fontSize:12,fontWeight:700,background:on?"#0D3B1E":"transparent",color:on?"#34D399":"#6B7280",minWidth:44}} onClick={async()=>{
          const newHours=on?fireHours.filter((x: number)=>x!==h):[...fireHours,h].sort((a: number,b: number)=>a-b);
          const val=newHours.join(",");
          try{
            const token=localStorage.getItem("fc_token")||"";
            const r=await fetch(`${API_URL}/api/settings/digest_daily_hours`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({value:val})});
            if(r.ok){setSiteSettings({...siteSettings,digest_daily_hours:val});notify(`⏰ Daily digest times: ${newHours.map((x: number)=>x===12?"12pm":x<12?`${x}am`:`${x-12}pm`).join(", ")||"none"}`)}
            else notify("⚠️ Failed to save setting");
          }catch{notify("⚠️ Could not reach server");}
        }}>{label}</button>;
      })}
    </div>
  </div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"14px 0",borderTop:"1px solid #1E1E32",gap:16}}>
    <div style={{flex:1}}>
      <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>Weekly Vendor Digest Schedule</div>
      <div style={{fontSize:13,color:"#6B7280",marginTop:3}}>Day and time the digest fires for <b style={{color:"#E5E7EB"}}>weekly-terms</b> vendors. If that day falls on a weekend or holiday, it rolls to the next business day.</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
        {["Monday","Tuesday","Wednesday","Thursday","Friday"].map((day: string)=>{
          const cur=siteSettings.digest_weekly_day||"Friday";
          const on=cur===day;
          return <button key={day} style={{padding:"5px 10px",borderRadius:6,border:on?"2px solid #1E3A5F":"1px solid #2A2A3E",cursor:"pointer",fontSize:12,fontWeight:700,background:on?"#0F2940":"transparent",color:on?"#93C5FD":"#6B7280"}} onClick={async()=>{
            try{
              const token=localStorage.getItem("fc_token")||"";
              const r=await fetch(`${API_URL}/api/settings/digest_weekly_day`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({value:day})});
              if(r.ok){setSiteSettings({...siteSettings,digest_weekly_day:day});notify(`📅 Weekly digest day set to ${day}`);}
              else notify("⚠️ Failed to save setting");
            }catch{notify("⚠️ Could not reach server");}
          }}>{day.slice(0,3)}</button>;
        })}
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
        {[8,9,10,11,12,13,14,15,16,17,18,19,20].map((h: number)=>{
          const label=h===12?"12pm":h<12?`${h}am`:`${h-12}pm`;
          const cur=parseInt(siteSettings.digest_weekly_hour||"17",10);
          const on=cur===h;
          return <button key={h} style={{padding:"5px 10px",borderRadius:6,border:on?"2px solid #1E3A5F":"1px solid #2A2A3E",cursor:"pointer",fontSize:12,fontWeight:700,background:on?"#0F2940":"transparent",color:on?"#93C5FD":"#6B7280",minWidth:44}} onClick={async()=>{
            try{
              const token=localStorage.getItem("fc_token")||"";
              const r=await fetch(`${API_URL}/api/settings/digest_weekly_hour`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({value:String(h)})});
              if(r.ok){setSiteSettings({...siteSettings,digest_weekly_hour:String(h)});notify(`⏰ Weekly digest time set to ${label}`);}
              else notify("⚠️ Failed to save setting");
            }catch{notify("⚠️ Could not reach server");}
          }}>{label}</button>;
        })}
      </div>
    </div>

  {/* Email preview retention */}
  <div style={{background:"#0D0D1A",border:"1px solid #2A2A3E",borderRadius:10,padding:20,marginTop:16}}>
    <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>🗄 Email Preview Retention</div>
    <div style={{fontSize:13,color:"#6B7280",marginBottom:12}}>Stored email HTML is automatically erased after this many days (2am nightly). Metadata and audit trail are kept forever. Set to 0 to disable expiry.</div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {(()=>{
        const cur=parseInt(siteSettings.email_body_retention_days||"30",10);
        return <>
          <input type="number" min={0} max={365} defaultValue={cur} id="retention-days-input"
            style={{width:80,padding:"6px 10px",borderRadius:6,border:"1px solid #2A2A3E",background:"#1A1A2E",color:"#E5E7EB",fontSize:14}}/>
          <span style={{fontSize:13,color:"#6B7280"}}>days</span>
          <button style={{...S.btn,fontSize:12,padding:"6px 14px"}} onClick={async()=>{
            const val=String((document.getElementById("retention-days-input") as HTMLInputElement)?.value||"30");
            const token=localStorage.getItem("fc_token")||"";
            try{
              const r=await fetch(`${API_URL}/api/settings/email_body_retention_days`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({value:val})});
              if(r.ok){setSiteSettings({...siteSettings,email_body_retention_days:val});notify(`🗄 Email preview retention set to ${val} days`);}
              else notify("⚠️ Failed to save");
            }catch{notify("⚠️ Could not reach server");}
          }}>Save</button>
          {cur===0&&<span style={{fontSize:11,color:"#F59E0B",fontWeight:700}}>⚠️ Expiry disabled — previews stored indefinitely</span>}
          {cur>0&&<span style={{fontSize:11,color:"#4B5563"}}>Previews older than {cur} day{cur===1?"":"s"} are automatically cleared</span>}
        </>;
      })()}
    </div>
  </div>

  </div>
</div>
</div>}

{showAdd==="user"&&<AddUserForm onClose={()=>setShowAdd(null)} onSave={saveUser}/>}
{showAdd==="vendor"&&<AddVendorForm onClose={()=>setShowAdd(null)} onSave={saveVendor}/>}
{editUser&&<AddUserForm initial={editUser} onClose={()=>setEditUser(null)} onSave={updateUser} vendorList={regVendors.map((v: any)=>({id:v.id,company:v.company,primaryUserId:v.primaryUserId}))} canEditEmail={isAdmin||isTechSupport}/>}
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
