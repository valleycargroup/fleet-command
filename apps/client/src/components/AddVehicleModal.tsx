import { useState } from 'react';
import { VCAT, SOURCES, COLORS, LOCATIONS } from '../lib/constants';
import { S } from '../lib/styles';
import { useStore } from '../lib/store';

export function AddVehicleModal() {
const vendors = useStore((s: any) => s.vendors);
const allUsers = useStore((s: any) => s.allUsers);
const addVehicle = useStore((s: any) => s.addVehicle);
const setShowAdd = useStore((s: any) => s.setShowAdd);
const onClose = () => setShowAdd(false);
const onAdd = addVehicle;
const buyerList=((allUsers||[]).filter((u: any)=>u.role==="buyer"||u.role==="admin"||u.is_buyer===1).map((u: any)=>u.firstName+(u.lastName?" "+u.lastName:""))).filter((n: any,i: any,a: any)=>n&&a.indexOf(n)===i);
const [f,setF]=useState({vin:"",purchaseDate:new Date().toISOString().split("T")[0],buyingBroker:buyerList[0]||"",source:SOURCES[0],year:"",make:"",model:"",trim:"",miles:"",color:COLORS[0],location:LOCATIONS[0]});
const [recon,setRecon]=useState(()=>{const o: any={};VCAT.forEach(c=>{o[c.key]={on:false,vendorId:"",notes:""};});return o;});
const [err,setErr]=useState("");
const submit=()=>{
if(!f.vin.trim()){setErr("VIN is required");return;}
setErr("");
const vi=f.vin.toUpperCase().trim(),fv=vi.length>8?vi:"",v8=vi.length>8?vi.slice(-8):vi;
const rt: any={};VCAT.forEach(c=>{if(recon[c.key].on){const vl=vendors[c.key]||[],vn=recon[c.key].vendorId?vl.find((x: any)=>x.id===recon[c.key].vendorId):null;
rt[c.key]={needed:true,status:vn?"assigned":"unassigned",vendorId:vn?.id||null,vendorName:vn?.name||null,estimate:null,notes:recon[c.key].notes,photos:[],dateAssigned:vn?new Date().toISOString().split("T")[0]:null,dateCompleted:null};
}else rt[c.key]={needed:false,status:"na"};});const{vin,...rest}=f;
onAdd({id:`v${Date.now()}`,...rest,fullVin:fv,vin8:v8,sellingBroker:"",miles:Number(f.miles)||0,year:Number(f.year)||0,status:"in_recon",
transport:{inbound:{set:false,destination:f.location,eta:"",cost:0,delivered:false},outbound:{set:false,destination:"",eta:"",cost:0,pickedUp:false}},reconTasks:rt,soldDate:null,deliveredDate:null,soldTo:""});
};
const F=(l: any,k: any,t="text",opts?: any)=><label style={S.fl}>{l}{opts?<select style={S.fi} value={(f as any)[k]} onChange={(e: any)=>setF({...f,[k]:e.target.value})}>{opts.map((o: any)=><option key={o} value={o}>{o}</option>)}</select>:<input style={S.fi} type={t} value={(f as any)[k]} onChange={(e: any)=>setF({...f,[k]:e.target.value})}/>}</label>;
return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:1000,paddingTop:30,overflowY:"auto"}} onClick={onClose}>
<div style={{...S.modal,maxWidth:620,marginBottom:30}} onClick={(e: any)=>e.stopPropagation()}>
<h2 style={{color:"#E5E7EB",fontSize:18,marginBottom:12}}>Add New Vehicle</h2>
<label style={S.fl}>VIN (Full or Last 8) *<input style={{...S.fi,fontSize:16,fontFamily:"monospace",letterSpacing:2,border:err?"1px solid #EF4444":"1px solid #2A2A3E"}} value={f.vin} onChange={(e: any)=>{setF({...f,vin:e.target.value.toUpperCase()});setErr("");}} placeholder="e.g. 1GNSKFKD8PR134404" maxLength={17}/></label>
{err&&<div style={{fontSize:12,color:"#EF4444",marginTop:4}}>{err}</div>}
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>{F("Purchase Date","purchaseDate","date")}{F("Year","year","number")}{F("Make","make")}{F("Model","model")}{F("Trim","trim")}{F("Color","color","text",COLORS)}{F("Miles","miles","number")}{F("Location","location","text",LOCATIONS)}<label style={S.fl}>Buyer<select style={S.fi} value={f.buyingBroker} onChange={(e: any)=>setF({...f,buyingBroker:e.target.value})}>{buyerList.length?buyerList.map((o: any)=><option key={o} value={o}>{o}</option>):<option value="">— No buyers registered —</option>}</select></label>{F("Source","source","text",SOURCES)}</div>
<div style={{marginTop:12,padding:10,background:"#0D0D1A",borderRadius:8,border:"1px solid #2A2A3E"}}><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",marginBottom:8}}>Recon Services</div>
{VCAT.map(c=>{const r=recon[c.key];return <div key={c.key} style={{borderRadius:6,border:`1px solid ${r.on?"#3B82F6":"#2A2A3E"}`,marginBottom:4,background:r.on?"#0F2940":"transparent"}}>
<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",cursor:"pointer"}} onClick={()=>setRecon((p: any)=>({...p,[c.key]:{...p[c.key],on:!p[c.key].on}}))}><input type="checkbox" checked={r.on} onChange={()=>{}} style={{accentColor:"#3B82F6"}}/><span>{c.icon}</span><span style={{fontSize:12,color:r.on?"#93C5FD":"#6B7280",fontWeight:600}}>{c.label}</span></div>
{r.on&&<div style={{padding:"0 8px 8px",display:"flex",gap:6}}><select style={{...S.fi,flex:1,fontSize:12}} value={r.vendorId} onChange={(e: any)=>setRecon((p: any)=>({...p,[c.key]:{...p[c.key],vendorId:e.target.value}}))}><option value="">Assign later...</option>{(vendors[c.key]||[]).map((vn: any)=><option key={vn.id} value={vn.id}>{vn.name}</option>)}</select>
<input style={{...S.fi,flex:1,fontSize:12}} placeholder="Notes..." value={r.notes} onChange={(e: any)=>setRecon((p: any)=>({...p,[c.key]:{...p[c.key],notes:e.target.value}}))}/></div>}</div>;})}
</div>
<div style={{display:"flex",gap:8,marginTop:12,position:"sticky",bottom:0,background:"#12122A",padding:"10px 0"}}><button style={{...S.btn,flex:1,fontSize:16,padding:"12px"}} onClick={submit}>✓ Add Vehicle</button><button style={{...S.sm,padding:"12px 20px"}} onClick={onClose}>Cancel</button></div>
</div></div>;
}
