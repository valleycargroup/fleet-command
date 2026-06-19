import { useState, useEffect, Fragment } from 'react';
import { API_URL } from '../lib/constants';
import { useStore } from '../lib/store';

export function LandingPage() {
const onLogin = useStore((s: any) => s.handleLogin);
const [showLogin,setShowLogin]=useState(false);
const [showForgot,setShowForgot]=useState(false);
const [showChangePw,setShowChangePw]=useState(false);
const [showReset,setShowReset]=useState(false);
const [resetToken,setResetToken]=useState("");
const [resetPw,setResetPw]=useState("");const [resetConfirm,setResetConfirm]=useState("");const [resetErr,setResetErr]=useState("");const [resetDone,setResetDone]=useState(false);
const [showLoginPw,setShowLoginPw]=useState(false);
const [showNewPw,setShowNewPw]=useState(false);const [showConfirmPw,setShowConfirmPw]=useState(false);
const [showResetPw,setShowResetPw]=useState(false);const [showResetConfirm,setShowResetConfirm]=useState(false);
const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [loginErr,setLoginErr]=useState("");
const [newPw,setNewPw]=useState("");const [confirmPw,setConfirmPw]=useState("");const [pwErr,setPwErr]=useState("");
const [forgotEmail,setForgotEmail]=useState("");const [forgotSent,setForgotSent]=useState(false);
const [pendingToken,setPendingToken]=useState(null as any);const [pendingUser,setPendingUser]=useState(null as any);
const [loading,setLoading]=useState(false);

useEffect(()=>{
  try{
    const params=new URLSearchParams(window.location.search);
    const tk=params.get("reset");
    if(tk){setResetToken(tk);setShowReset(true);}
  }catch(e){}
},[]);

const doResetPw=async()=>{
  if(resetPw.length<8){setResetErr("Password must be at least 8 characters");return;}
  if(!/[A-Z]/.test(resetPw)){setResetErr("Needs an uppercase letter");return;}
  if(!/[0-9]/.test(resetPw)){setResetErr("Needs a number");return;}
  if(resetPw!==resetConfirm){setResetErr("Passwords don't match");return;}
  setLoading(true);setResetErr("");
  try{
    const r=await fetch(API_URL+"/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:resetToken,new_password:resetPw})});
    const d=await r.json();
    if(!r.ok||d.error){setResetErr(d.error||"Reset failed — link may be expired");setLoading(false);return;}
    window.history.replaceState({},document.title,window.location.pathname);
    setResetDone(true);
  }catch(e){setResetErr("Network error — check connection");}
  setLoading(false);
};

const doLogin=async()=>{
  if(!email||!pw){setLoginErr("Enter email and password");return;}
  setLoading(true);setLoginErr("");
  try{
    const r=await fetch(API_URL+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
    const d=await r.json();
    if(!r.ok){setLoginErr(d.error||"Login failed");setLoading(false);return;}
    setPendingToken(d.token);setPendingUser(d.user);
    if(d.user.must_change_password){setShowChangePw(true);setShowLogin(false);setLoading(false);return;}
    sessionStorage.setItem("fc_token",d.token);sessionStorage.setItem("fc_user",JSON.stringify(d.user));
    onLogin(d.user,d.token);
  }catch(e){setLoginErr("Network error — check connection");setLoading(false);}
  setLoading(false);
};

const doChangePw=async()=>{
  if(newPw.length<8){setPwErr("At least 8 characters");return;}
  if(!/[A-Z]/.test(newPw)){setPwErr("Needs an uppercase letter");return;}
  if(!/[0-9]/.test(newPw)){setPwErr("Needs a number");return;}
  if(newPw!==confirmPw){setPwErr("Passwords don't match");return;}
  setLoading(true);setPwErr("");
  try{
    const r=await fetch(API_URL+"/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+pendingToken},body:JSON.stringify({new_password:newPw})});
    if(!r.ok){const d=await r.json();setPwErr(d.error||"Failed");setLoading(false);return;}
    sessionStorage.setItem("fc_token",pendingToken);sessionStorage.setItem("fc_user",JSON.stringify(pendingUser));
    onLogin(pendingUser,pendingToken);
  }catch(e){setPwErr("Network error");}
  setLoading(false);
};

const doForgot=async()=>{
  if(!forgotEmail){return;}
  try{await fetch(API_URL+"/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:forgotEmail})});}catch(e){}
  setForgotSent(true);
};

const LS: any ={overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20},
card:{maxWidth:360,width:"100%",background:"#12121E",borderRadius:12,border:"1px solid #2A2A3E",padding:24},
title:{fontSize:16,fontWeight:600,color:"#FFF",textAlign:"center",marginBottom:4},
sub:{fontSize:12,color:"#6B7280",textAlign:"center",marginBottom:16},
label:{fontSize:11,color:"#9CA3AF",marginBottom:3,display:"block"},
input:{width:"100%",padding:"9px 12px",background:"#0D0D1A",border:"1px solid #2A2A3E",borderRadius:8,color:"#FFF",fontSize:13,marginBottom:10,outline:"none",boxSizing:"border-box"},
btn:{width:"100%",padding:10,background:"#3B82F6",color:"#FFF",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:8},
link:{display:"block",textAlign:"center",fontSize:12,color:"#6B7280",cursor:"pointer",marginTop:6},
err:{fontSize:11,color:"#F87171",textAlign:"center",marginBottom:10,padding:"6px 10px",background:"#3B1515",borderRadius:4,border:"1px solid #7F1D1D"}};

if(showLogin&&!showChangePw)return <div style={LS.overlay}><div style={LS.card}>
  <div style={LS.title}>Sign in to Fleet Command</div><div style={LS.sub}>Enter your credentials</div>
  {loginErr&&<div style={LS.err}>{loginErr}</div>}
  <label style={LS.label}>Email</label><input style={LS.input} type="email" autoComplete="username" value={email} onChange={(e: any)=>setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={(e: any)=>{if(e.key==="Enter")doLogin();}}/>
  <label style={LS.label}>Password</label>
  <div style={{position:"relative",marginBottom:10}}><input style={{...LS.input,marginBottom:0,paddingRight:36}} type={showLoginPw?"text":"password"} value={pw} onChange={(e: any)=>setPw(e.target.value)} placeholder="Enter password" onKeyDown={(e: any)=>{if(e.key==="Enter")doLogin();}}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"#6B7280",fontSize:14,userSelect:"none"}} onClick={()=>setShowLoginPw(!showLoginPw)}>{showLoginPw?"🙈":"👁"}</span></div>
  <button style={LS.btn} onClick={doLogin} disabled={loading}>{loading?"Signing in...":"Sign in"}</button>
  <span style={LS.link} onClick={()=>{setShowLogin(false);setShowForgot(true);}}>Forgot password?</span>
  <span style={LS.link} onClick={()=>setShowLogin(false)}>Back</span>
</div></div>;

if(showChangePw)return <div style={LS.overlay}><div style={LS.card}>
  <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:20}}>🔒</div>
  <div style={LS.title}>Set new password</div><div style={LS.sub}>Your first login requires a password change</div>
  <div style={{fontSize:11,color:"#6B7280",lineHeight:1.6,marginBottom:12,padding:"8px 10px",background:"#0D0D1A",borderRadius:6}}>
    <div style={{color:newPw.length>=8?"#34D399":"#4B5563"}}>{newPw.length>=8?"●":"○"} At least 8 characters</div>
    <div style={{color:/[A-Z]/.test(newPw)?"#34D399":"#4B5563"}}>{/[A-Z]/.test(newPw)?"●":"○"} One uppercase letter</div>
    <div style={{color:/[0-9]/.test(newPw)?"#34D399":"#4B5563"}}>{/[0-9]/.test(newPw)?"●":"○"} One number</div>
  </div>
  {pwErr&&<div style={LS.err}>{pwErr}</div>}
  <label style={LS.label}>New password</label>
  <div style={{position:"relative",marginBottom:10}}><input style={{...LS.input,marginBottom:0,paddingRight:36}} type={showNewPw?"text":"password"} value={newPw} onChange={(e: any)=>setNewPw(e.target.value)} placeholder="New password"/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"#6B7280",fontSize:14,userSelect:"none"}} onClick={()=>setShowNewPw(!showNewPw)}>{showNewPw?"🙈":"👁"}</span></div>
  <label style={LS.label}>Confirm password</label>
  <div style={{position:"relative",marginBottom:10}}><input style={{...LS.input,marginBottom:0,paddingRight:36}} type={showConfirmPw?"text":"password"} value={confirmPw} onChange={(e: any)=>setConfirmPw(e.target.value)} placeholder="Confirm password" onKeyDown={(e: any)=>{if(e.key==="Enter")doChangePw();}}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"#6B7280",fontSize:14,userSelect:"none"}} onClick={()=>setShowConfirmPw(!showConfirmPw)}>{showConfirmPw?"🙈":"👁"}</span></div>
  <button style={LS.btn} onClick={doChangePw} disabled={loading}>{loading?"Setting...":"Set password & continue"}</button>
</div></div>;

if(showReset)return <div style={LS.overlay}><div style={LS.card}>
  {!resetDone?<><div style={{width:56,height:56,borderRadius:"50%",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:24}}>🔒</div>
  <div style={LS.title}>Set new password</div>
  <div style={LS.sub}>Choose a strong password for your account</div>
  <div style={{fontSize:11,color:"#6B7280",lineHeight:1.6,marginBottom:12,padding:"8px 10px",background:"#0D0D1A",borderRadius:6}}>
    <div style={{color:resetPw.length>=8?"#34D399":"#4B5563"}}>{resetPw.length>=8?"●":"○"} At least 8 characters</div>
    <div style={{color:/[A-Z]/.test(resetPw)?"#34D399":"#4B5563"}}>{/[A-Z]/.test(resetPw)?"●":"○"} One uppercase letter</div>
    <div style={{color:/[0-9]/.test(resetPw)?"#34D399":"#4B5563"}}>{/[0-9]/.test(resetPw)?"●":"○"} One number</div>
  </div>
  {resetErr&&<div style={LS.err}>{resetErr}</div>}
  <label style={LS.label}>New password</label>
  <div style={{position:"relative",marginBottom:10}}><input style={{...LS.input,marginBottom:0,paddingRight:36}} type={showResetPw?"text":"password"} value={resetPw} onChange={(e: any)=>setResetPw(e.target.value)} placeholder="Enter new password"/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"#6B7280",fontSize:14,userSelect:"none"}} onClick={()=>setShowResetPw(!showResetPw)}>{showResetPw?"🙈":"👁"}</span></div>
  <label style={LS.label}>Confirm password</label>
  <div style={{position:"relative",marginBottom:10}}><input style={{...LS.input,marginBottom:0,paddingRight:36}} type={showResetConfirm?"text":"password"} value={resetConfirm} onChange={(e: any)=>setResetConfirm(e.target.value)} placeholder="Re-enter password" onKeyDown={(e: any)=>{if(e.key==="Enter")doResetPw();}}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",cursor:"pointer",color:"#6B7280",fontSize:14,userSelect:"none"}} onClick={()=>setShowResetConfirm(!showResetConfirm)}>{showResetConfirm?"🙈":"👁"}</span></div>
  <button style={{...LS.btn,background:"#166534"}} onClick={doResetPw} disabled={loading}>{loading?"Updating...":"Update password"}</button>
  <span style={LS.link} onClick={()=>{setShowReset(false);window.history.replaceState({},document.title,window.location.pathname);}}>Cancel and return to sign in</span>
  </>:<><div style={{width:56,height:56,borderRadius:"50%",background:"rgba(52,211,153,0.15)",border:"1px solid rgba(52,211,153,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28}}>✅</div>
  <div style={{...LS.title,color:"#34D399"}}>Password updated</div>
  <div style={LS.sub}>You can now sign in with your new password</div>
  <button style={LS.btn} onClick={()=>{setShowReset(false);setResetDone(false);setResetPw("");setResetConfirm("");setShowLogin(true);}}>Continue to sign in</button>
  </>}
</div></div>;

if(showForgot)return <div style={LS.overlay}><div style={LS.card}>
  <div style={LS.title}>{forgotSent?"Check your email":"Reset password"}</div>
  <div style={LS.sub}>{forgotSent?"If that email exists, a reset link was sent.":"Enter your email and we'll send a reset link"}</div>
  {!forgotSent&&<><label style={LS.label}>Email</label><input style={LS.input} type="email" value={forgotEmail} onChange={(e: any)=>setForgotEmail(e.target.value)} placeholder="your@email.com"/>
  <button style={LS.btn} onClick={doForgot}>Send reset link</button></>}
  {forgotSent&&<button style={LS.btn} onClick={()=>{setShowForgot(false);setShowLogin(true);setForgotSent(false);}}>Back to sign in</button>}
  {!forgotSent&&<span style={LS.link} onClick={()=>{setShowForgot(false);setShowLogin(true);}}>Back to sign in</span>}
</div></div>;

const HS: any ={page:{background:"#0D0D1A",minHeight:"100vh",color:"#E5E7EB",fontFamily:"'Segoe UI',system-ui,sans-serif"},
nav:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 28px",borderBottom:"1px solid rgba(255,255,255,0.06)"},
logo:{fontSize:20,fontWeight:700,color:"#FFF"},logoSpan:{color:"#3B82F6"},
navBtn:{fontSize:12,padding:"6px 16px",borderRadius:6,cursor:"pointer",fontWeight:600,border:"none"},
section:{padding:"48px 28px",textAlign:"center"},
heroTag:{display:"inline-block",fontSize:11,padding:"5px 14px",borderRadius:20,background:"rgba(59,130,246,0.1)",color:"#93C5FD",border:"1px solid rgba(59,130,246,0.2)",letterSpacing:0.5,marginBottom:16},
h1:{fontSize:32,fontWeight:700,color:"#FFF",lineHeight:1.15,marginBottom:12,maxWidth:480,margin:"0 auto 12px"},
heroP:{fontSize:14,color:"#9CA3AF",maxWidth:420,margin:"0 auto 28px",lineHeight:1.6},
featGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,maxWidth:520,margin:"0 auto",textAlign:"left"},
feat:{padding:16,background:"#12121E",borderRadius:10,border:"1px solid #2A2A3E"},
featTitle:{fontSize:13,fontWeight:600,color:"#FFF",marginBottom:4},
featDesc:{fontSize:11,color:"#6B7280",lineHeight:1.5},
spRow:{display:"flex",gap:24,justifyContent:"center",flexWrap:"wrap",marginBottom:20},
spVal:{fontWeight:700,color:"#FFF",fontSize:16},
divider:{border:"none",borderTop:"1px solid rgba(255,255,255,0.06)",margin:0},
sTag:{fontSize:10,color:"#3B82F6",textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:8},
sH2:{fontSize:22,fontWeight:700,color:"#FFF",marginBottom:8},
sP:{fontSize:13,color:"#6B7280",maxWidth:400,margin:"0 auto 28px",lineHeight:1.5},
wfSteps:{display:"flex",gap:12,maxWidth:520,margin:"0 auto"},
wfStep:{flex:1,padding:"14px 10px",background:"#12121E",borderRadius:10,border:"1px solid #2A2A3E",textAlign:"center"},
wfNum:{fontSize:18,fontWeight:700,marginBottom:4},
wfLabel:{fontSize:10,color:"#9CA3AF",lineHeight:1.4},
ctaBox:{maxWidth:420,margin:"0 auto",padding:28,background:"#12121E",borderRadius:12,border:"1px solid #2A2A3E",textAlign:"center"},
ctaH:{fontSize:20,fontWeight:700,color:"#FFF",marginBottom:6},
ctaP:{fontSize:12,color:"#6B7280",marginBottom:16,lineHeight:1.5},
footer:{padding:"20px 28px",borderTop:"1px solid rgba(255,255,255,0.06)",textAlign:"center",fontSize:11,color:"#4B5563"}};

const dashPreview: any ={maxWidth:520,margin:"0 auto",background:"#12121E",borderRadius:10,border:"1px solid #2A2A3E",overflow:"hidden"};

return <div style={HS.page}>
<div style={HS.nav}>
  <div style={HS.logo}>Fleet<span style={HS.logoSpan}>Command</span></div>
  <div style={{display:"flex",gap:12,alignItems:"center"}}>
    <button style={{...HS.navBtn,background:"transparent",border:"1px solid #2A2A3E",color:"#FFF"}} onClick={()=>setShowLogin(true)}>Sign in</button>
    <button style={{...HS.navBtn,background:"#3B82F6",color:"#FFF"}} onClick={()=>{const el=document.getElementById("fc-cta");if(el)el.scrollIntoView({behavior:"smooth"});}}>Request demo</button>
  </div>
</div>
<div style={HS.section}>
  <div style={HS.heroTag}>Built for high-volume dealer groups</div>
  <div style={HS.h1}>Stop losing money on <span style={{color:"#3B82F6"}}>recon.</span> Start commanding it.</div>
  <div style={HS.heroP}>Fleet Command gives your team real-time visibility into every vehicle, every vendor, and every dollar from purchase to delivery.</div>
  <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:36}}>
    <button style={{padding:"12px 28px",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",background:"#3B82F6",color:"#FFF",border:"none"}} onClick={()=>{const el=document.getElementById("fc-cta");if(el)el.scrollIntoView({behavior:"smooth"});}}>Request a demo</button>
    <button style={{padding:"12px 28px",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",background:"transparent",color:"#FFF",border:"1px solid #2A2A3E"}} onClick={()=>setShowLogin(true)}>Sign in</button>
  </div>
  <div style={HS.spRow}>
    <div style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:6}}><span style={HS.spVal}>700+</span> vehicles/month</div>
    <div style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:6}}><span style={HS.spVal}>30-40hrs</span> saved weekly</div>
    <div style={{fontSize:12,color:"#6B7280",display:"flex",alignItems:"center",gap:6}}><span style={HS.spVal}>2</span> markets live</div>
  </div>
  <div style={dashPreview}>
    <div style={{display:"flex",gap:4,padding:"8px 12px",background:"#0A0A14",borderBottom:"1px solid #2A2A3E"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#EF4444"}}/><div style={{width:8,height:8,borderRadius:"50%",background:"#F59E0B"}}/><div style={{width:8,height:8,borderRadius:"50%",background:"#22C55E"}}/></div>
    <div style={{padding:12}}>
      <div style={{display:"flex",gap:8,marginBottom:6}}>
        {[{v:"47",l:"In recon",c:"#3B82F6"},{v:"12",l:"Ready to ship",c:"#34D399"},{v:"8",l:"Bids waiting",c:"#FBBF24"},{v:"5",l:"Past due",c:"#F87171"}].map((s,i)=><div key={i} style={{flex:1,padding:8,background:"#0D0D1A",borderRadius:6,border:"1px solid #2A2A3E",textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:8,color:"#6B7280",textTransform:"uppercase"}}>{s.l}</div></div>)}
      </div>
    </div>
  </div>
</div>
<hr style={HS.divider}/>
<div style={HS.section}>
  <div style={HS.sTag}>Features</div>
  <div style={HS.sH2}>Everything your recon operation needs</div>
  <div style={HS.sP}>From the moment you buy a car to the moment it's delivered, Fleet Command tracks every step, every cost, every person.</div>
  <div style={HS.featGrid}>
    {[{t:"15 recon categories",d:"Body, paint, PDR, tires, mechanical, detail, and more."},{t:"Vendor bidding",d:"Assign multiple vendors. Compare bids. Accept the best price."},{t:"Transport tracking",d:"Inbound and outbound. ETA, carrier, cost."},{t:"24 email triggers",d:"Automated notifications. Only when action is needed."},{t:"Reports + export",d:"Recon costs, vendor performance, transport spend."},{t:"Role-based access",d:"Admin, buyer, seller, vendor, parts manager."}].map((f,i)=><div key={i} style={HS.feat}><div style={HS.featTitle}>{f.t}</div><div style={HS.featDesc}>{f.d}</div></div>)}
  </div>
</div>
<hr style={HS.divider}/>
<div style={HS.section}>
  <div style={HS.sTag}>How it works</div>
  <div style={HS.sH2}>Purchase to delivery in one platform</div>
  <div style={HS.sP}>Every vehicle follows the same path. Fleet Command makes sure nothing falls through the cracks.</div>
  <div style={HS.wfSteps}>
    {[{n:"1",l:"Vehicle purchased & grounded",c:"#3B82F6"},{n:"2",l:"Vendors assigned, bids submitted",c:"#FBBF24"},{n:"3",l:"Recon complete, ready to ship",c:"#34D399"},{n:"4",l:"Transported & delivered",c:"#A78BFA"}].map((s,i)=><Fragment key={i}>{i>0&&<div style={{display:"flex",alignItems:"center",color:"#2A2A3E",fontSize:16}}>→</div>}<div style={HS.wfStep}><div style={{...HS.wfNum,color:s.c}}>{s.n}</div><div style={HS.wfLabel}>{s.l}</div></div></Fragment>)}
  </div>
</div>
<hr style={HS.divider}/>
<div style={HS.section} id="fc-cta">
  <div style={HS.ctaBox}>
    <div style={HS.ctaH}>Ready to take command?</div>
    <div style={HS.ctaP}>See how Fleet Command can streamline your recon operation.</div>
    <div style={{display:"flex",gap:8}}>
      <input style={{flex:1,padding:"10px 12px",background:"#0D0D1A",border:"1px solid #2A2A3E",borderRadius:8,color:"#FFF",fontSize:13,outline:"none"}} type="email" placeholder="you@dealership.com"/>
      <button style={{padding:"10px 20px",background:"#3B82F6",border:"none",borderRadius:8,color:"#FFF",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}} onClick={(e: any)=>{e.target.textContent="We'll be in touch!";e.target.style.background="#1D9E75";}}>Request demo</button>
    </div>
  </div>
</div>
<div style={HS.footer}>
  <div style={{...HS.logo,marginBottom:8}}>Fleet<span style={HS.logoSpan}>Command</span></div>
  Valley Car Group • Phoenix • Dallas • fleetcommandrecon.com<br/>
  <span style={{color:"#3B82F6",cursor:"pointer"}} onClick={()=>setShowLogin(true)}>Team sign in</span>
</div>
</div>;
}
