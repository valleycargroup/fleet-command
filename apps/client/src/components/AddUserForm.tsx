import { useState } from 'react';
import { LOCATIONS } from '../lib/constants';
import { S } from '../lib/styles';

export function AddUserForm({onSave, onClose, initial}: any) {
const normRole=(r: any)=>{if(!r)return"Admin";const lc=String(r).toLowerCase();if(lc==="buyer/seller"||lc==="admin")return lc==="admin"?"Admin":"Buyer/Seller";if(lc==="buyer")return"Buyer";if(lc==="seller")return"Seller";return"Admin";};
const [f,setF]=useState(initial?{...initial,role:normRole(initial.role),password:""}:{firstName:"",lastName:"",email:"",cell:"",role:"Admin",location:LOCATIONS[0],password:""});
const isEdit=!!initial;
return <div style={S.ov} onClick={onClose}><div style={{...S.modal,maxWidth:500}} onClick={(e: any)=>e.stopPropagation()}>
<h2 style={{color:"#E5E7EB",fontSize:20,marginBottom:12}}>{isEdit?"✏️ Edit User":"👤 Register User / Admin"}</h2>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<label style={S.fl}>First Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_first" value={f.firstName} onChange={(e: any)=>setF({...f,firstName:e.target.value})}/></label>
<label style={S.fl}>Last Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_last" value={f.lastName} onChange={(e: any)=>setF({...f,lastName:e.target.value})}/></label>
<label style={S.fl}>Email (Username) *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_email_reg" type="text" value={f.email} onChange={(e: any)=>setF({...f,email:e.target.value})} disabled={isEdit}/></label>
<label style={S.fl}>Cell # *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="off" name="fc_phone" type="tel" value={f.cell} onChange={(e: any)=>setF({...f,cell:e.target.value})}/></label>
<label style={S.fl}>Password {isEdit?"(leave blank to keep current)":"*"}<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-password" name="fc_pw_reg" type="password" value={f.password||""} onChange={(e: any)=>setF({...f,password:e.target.value})} placeholder={isEdit?"Leave blank":"Login password"}/></label>
<label style={S.fl}>Role<select style={{...S.fi,fontSize:16,padding:10}} value={f.role} onChange={(e: any)=>setF({...f,role:e.target.value})}><option>Admin</option><option>Buyer</option><option>Seller</option><option>Buyer/Seller</option><option>Accounts Payable</option></select></label>
<label style={S.fl}>Location<select style={{...S.fi,fontSize:16,padding:10}} value={f.location} onChange={(e: any)=>setF({...f,location:e.target.value})}>{LOCATIONS.map((l: any)=><option key={l}>{l}</option>)}</select></label></div>
<div style={{display:"flex",gap:8,marginTop:14}}><button style={{...S.btn,flex:1,fontSize:16,padding:12}} onClick={()=>{
  const missing: any[]=[];
  if(!f.firstName||!f.firstName.trim())missing.push("First Name");
  if(!f.lastName||!f.lastName.trim())missing.push("Last Name");
  if(!f.email||!f.email.trim())missing.push("Email");
  if(!f.cell||!f.cell.trim())missing.push("Cell #");
  if(!isEdit&&(!f.password||!f.password.trim()))missing.push("Password");
  if(missing.length){alert("Please fill in: "+missing.join(", "));return;}
  onSave(f);
}}>{isEdit?"Save Changes":"Register User"}</button><button style={{...S.sm,padding:12}} onClick={onClose}>Cancel</button></div>
</div></div>;
}
