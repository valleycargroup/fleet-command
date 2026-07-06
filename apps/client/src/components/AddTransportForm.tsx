import { useState } from 'react';
import { S } from '../lib/styles';

export function AddTransportForm({onSave, onClose}: any) {
const [f,setF]=useState({company:"",contact:"",email:"",cell:"",address:"",password:""});
return <div style={S.ov}><div style={{...S.modal,maxWidth:500}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{color:"#E5E7EB",fontSize:20,margin:0}}>🚛 Register Transport Company</h2><button style={{background:"transparent",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer",padding:"2px 6px",borderRadius:4,lineHeight:1}} onClick={onClose}>✕</button></div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<label style={S.fl}>Company Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-tcompany" name="fc_tcompany" value={f.company} onChange={(e: any)=>setF({...f,company:e.target.value})}/></label>
<label style={S.fl}>Contact Name *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-tcontact" name="fc_tcontact" value={f.contact} onChange={(e: any)=>setF({...f,contact:e.target.value})}/></label>
<label style={S.fl}>Email (Username) *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-temail" name="fc_temail" type="text" value={f.email} onChange={(e: any)=>setF({...f,email:e.target.value})}/></label>
<label style={S.fl}>Cell # *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-tphone" name="fc_tphone" type="tel" value={f.cell} onChange={(e: any)=>setF({...f,cell:e.target.value})}/></label>
<label style={S.fl}>Password *<input style={{...S.fi,fontSize:16,padding:10}} autoComplete="new-password" name="fc_tpw" type="password" value={f.password||""} onChange={(e: any)=>setF({...f,password:e.target.value})} placeholder="Login password"/></label>
<label style={{...S.fl,gridColumn:"1/3"}}>Address<input style={{...S.fi,fontSize:16,padding:10}} value={f.address} onChange={(e: any)=>setF({...f,address:e.target.value})} placeholder="Street, City, State ZIP"/></label></div>
<div style={{display:"flex",gap:8,marginTop:14}}><button style={{...S.btn,flex:1,fontSize:16,padding:12}} onClick={()=>{if(f.company&&f.contact&&f.email&&f.cell&&f.password)onSave(f);}}>Register Transport</button><button style={{...S.sm,padding:12}} onClick={onClose}>Cancel</button></div>
</div></div>;
}
