import { useMemo, useRef, useEffect, useState } from 'react';
import { useStore, selectRoles } from './lib/store';
import { API_URL, VCAT, LOCATIONS } from './lib/constants';
import { S } from './lib/styles';
import { useIsMobile } from './lib/useIsMobile';
import { LandingPage } from './components/LandingPage';
import { VehicleTable } from './components/VehicleTable';
import { AddVehicleModal } from './components/AddVehicleModal';
import { ImportCrmModal } from './components/ImportCrmModal';
import { VehicleDetail } from './components/VehicleDetail';
import { VendorsPage } from './pages/VendorsPage';
import { DealersPage } from './pages/DealersPage';
import { AdminPage } from './pages/AdminPage';
import { ReportsPage } from './pages/ReportsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { EmailLogPage } from './pages/EmailLogPage';
import { ConfirmModal } from './components/ConfirmModal';
import { DevUserSwitcher } from './components/DevUserSwitcher';

const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === 'true';

function App() {
  const isMobile = useIsMobile();
  const currentUser = useStore(s => s.currentUser);
  const { isAdmin, isVendor, isAP, isTechSupport } = useStore(selectRoles);
  const tab = useStore(s => s.tab);
  const setTab = useStore(s => s.setTab);
  const selV = useStore(s => s.selV);
  const setSelV = useStore(s => s.setSelV);
  const fLoc = useStore(s => s.fLoc);
  const setFLoc = useStore(s => s.setFLoc);
  const search = useStore(s => s.search);
  const setSearch = useStore(s => s.setSearch);
  const [localSearch, setLocalSearch] = useState(search);
  const note = useStore(s => s.note);
  const showAdd = useStore(s => s.showAdd);
  const setShowAdd = useStore(s => s.setShowAdd);
  const deepLinkCat = useStore(s => s.deepLinkCat);
  const setDeepLinkCat = useStore(s => s.setDeepLinkCat);
  const pendingDeepLink = useStore(s => s.pendingDeepLink);
  const setPendingDeepLink = useStore(s => s.setPendingDeepLink);
  const vehicles = useStore(s => s.vehicles);
  const apiReady = useStore(s => s.apiReady);
  const loading = useStore(s => s.loading);
  const csvUploading = useStore(s => s.csvUploading);
  const { loadData, handleLogout, handleCSVUpload, showConfirm } = useStore(s => s);
  const csvRef = useRef(null as any);
  const [showImportCrm, setShowImportCrm] = useState(false);

  // Debounce search — update store 250ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => setSearch(localSearch), 250);
    return () => clearTimeout(t);
  }, [localSearch]);

  // Load data on login
  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  // Idle timeout — auto-logout after 12 hours of inactivity
  useEffect(() => {
    if (!currentUser) return;
    const IDLE_MS = 12*60*60*1000;
    let idleTimer: any;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        alert("You've been logged out due to 12 hours of inactivity.");
        handleLogout();
      }, IDLE_MS);
    };
    const events = ["mousedown","keydown","touchstart","scroll"];
    events.forEach(e => window.addEventListener(e, resetIdle, {passive:true}));
    resetIdle();
    return () => { clearTimeout(idleTimer); events.forEach(e => window.removeEventListener(e, resetIdle)); };
  }, [currentUser]);

  // Detect ?login=true URL param — force fresh login
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "true") {
        handleLogout();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch(e) {}
  }, []);

  // localStorage backup
  useEffect(() => { try { localStorage.setItem("fc_vehicles", JSON.stringify(vehicles)); } catch(e) {} }, [vehicles]);

  // Background auto-sync every 30 seconds
  useEffect(() => {
    if (!apiReady || !currentUser) return;
    const interval = setInterval(async () => {
      try {
        const { mapVehicle, api } = useStore.getState();
        const data = await api('/api/vehicles');
        const deletedIds = (window as any)._deletedDbIds || [];
        const fresh = (data.vehicles||[]).map((v: any)=>mapVehicle(v)).filter((v: any)=>!deletedIds.includes(v._dbId));
        useStore.setState((prev: any) => {
          if (prev.vehicles.length !== fresh.length) return { vehicles: fresh };
          let changed = false;
          for (let i = 0; i < fresh.length; i++) {
            const prev_ = prev.vehicles.find((p: any)=>p._dbId===fresh[i]._dbId);
            if (!prev_ || JSON.stringify(prev_._raw) !== JSON.stringify(fresh[i]._raw)) { changed = true; break; }
          }
          return changed ? { vehicles: fresh } : prev;
        });
      } catch(e) {}
    }, 30000);
    return () => clearInterval(interval);
  }, [apiReady, currentUser]);

  // Deep link — open vehicle + recon tab from URL params
  useEffect(() => {
    if (!pendingDeepLink || !apiReady || vehicles.length === 0) return;
    const found = vehicles.find((v: any) => v.id === pendingDeepLink.vid);
    if (found) {
      setTab("active");
      setSelV(found);
      if (pendingDeepLink.vcat) setDeepLinkCat(pendingDeepLink.vcat);
      try { const url = new URL(window.location.href); url.searchParams.delete("vehicle"); url.searchParams.delete("cat"); window.history.replaceState({}, document.title, url.pathname); } catch(e) {}
      setPendingDeepLink(null);
    }
  }, [apiReady, vehicles.length, pendingDeepLink]);

  // Keep ?v=<id> in sync with selected vehicle so refresh restores it
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selV) url.searchParams.set('v', String(selV.id));
      else url.searchParams.delete('v');
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch(e) {}
  }, [selV?.id]);

  // Header stats
  const stats = useMemo(() => ({
    active: vehicles.filter((v: any) => v.status !== "delivered").length,
    delivered: vehicles.filter((v: any) => v.status === "delivered").length,
  }), [vehicles]);

  if (!currentUser) return <LandingPage/>;

  if (loading) return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>🚗</div>
        <div style={{fontSize:20,fontWeight:700,color:"#E5E7EB",marginBottom:8}}>Fleet Command</div>
        <div style={{fontSize:14,color:"#6B7280"}}>Loading from server...</div>
        <div style={{marginTop:16,width:200,height:4,background:"#1E1E32",borderRadius:2,overflow:"hidden",margin:"16px auto 0"}}>
          <div style={{width:"60%",height:"100%",background:"#3B82F6",borderRadius:2}}/>
        </div>
      </div>
    </div>
  );

  return <div style={S.app}>
    {note&&<div style={S.toast}>✉️ {note}</div>}
    <ConfirmModal/>
    {DEV_TOOLS&&<DevUserSwitcher/>}
    <header style={S.hdr}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={S.logo}>🚗</div>
        <div>
          <h1 style={{...S.h1,fontSize:isMobile?16:20}}>FLEET COMMAND</h1>
          {!isMobile&&<p style={S.sub}>Recon & Transport</p>}
        </div>
        {!isMobile&&<span style={{fontSize:13,color:"#9CA3AF"}}>{apiReady?"🟢":"🟡"} {stats.active} active • {stats.delivered} delivered</span>}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {isMobile&&<span style={{fontSize:12,color:"#9CA3AF"}}>{apiReady?"🟢":"🟡"} {stats.active}</span>}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:"#1A1A2E",border:"1px solid #2A2A3E"}}>
          <span style={{fontSize:12,color:isTechSupport?"#A78BFA":isAdmin?"#FBBF24":isVendor?"#60A5FA":isAP?"#34D399":"#34D399",fontWeight:700}}>{isTechSupport?"🛠️":isAdmin?"🛡️":isVendor?"🔧":isAP?"💸":"👤"} {isMobile?"":isTechSupport?"Tech Support":isAdmin?"Admin":isVendor?"Vendor":isAP?"AP":currentUser?.role||""}</span>
          <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600}}>{currentUser?.first_name||currentUser?.firstName||currentUser?.name}</span>
          <button style={{padding:"4px 8px",borderRadius:4,border:"1px solid #7F1D1D",background:"transparent",color:"#F87171",fontSize:11,cursor:"pointer",fontWeight:600}} onClick={handleLogout}>Logout</button>
          {isAdmin&&!isMobile&&<><input ref={csvRef} type="file" accept=".csv,.tsv" style={{display:"none"}} onChange={(e: any)=>{handleCSVUpload(e.target.files[0]);if(csvRef.current)csvRef.current.value="";}}/>
          <button style={{padding:"4px 8px",borderRadius:4,border:"1px solid #166534",background:"transparent",color:"#34D399",fontSize:11,cursor:"pointer",fontWeight:600,opacity:csvUploading?0.5:1}} disabled={csvUploading} onClick={()=>csvRef.current?.click()}>{csvUploading?"…":"📄 CSV"}</button></>}
          {isAdmin&&!isMobile&&<button style={{padding:"4px 8px",borderRadius:4,border:"1px solid #78590A",background:"transparent",color:"#FBBF24",fontSize:11,cursor:"pointer",fontWeight:600}} onClick={()=>{showConfirm("Reload all data from server?",async()=>{await loadData();},"Refresh Data",false);}}>🔄</button>}
        </div>
      </div>
    </header>
    <div style={{...S.bar,flexWrap:isMobile?"wrap":"nowrap"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",paddingBottom:2,flex:isMobile?"1 1 100%":"none"}}>
        <button style={tab==="active"?S.tOn:S.tOff} onClick={()=>setTab("active")}>Inventory</button>
        {!isVendor&&<button style={tab==="delivered"?S.tOn:S.tOff} onClick={()=>setTab("delivered")}>Delivered {stats.delivered>0&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:"#166534",color:"#34D399",marginLeft:4}}>{stats.delivered}</span>}</button>}
        {!isVendor&&<button style={tab==="vendors"?S.tOn:S.tOff} onClick={()=>setTab("vendors")}>Vendors</button>}
        {isAdmin&&<button style={tab==="register"?S.tOn:S.tOff} onClick={()=>setTab("register")}>⚙️ {!isMobile&&"Register"}</button>}
        {isAdmin&&<button style={tab==="reports"?S.tOn:S.tOff} onClick={()=>setTab("reports")}>📊 {!isMobile&&"Reports"}</button>}
        {(isAdmin||isAP)&&<button style={tab==="payments"?S.tOn:S.tOff} onClick={()=>setTab("payments")}>💸 {!isMobile&&"Payment Queue"}</button>}
        {isAdmin&&<button style={tab==="dealers"?S.tOn:S.tOff} onClick={()=>setTab("dealers")}>🏢 {!isMobile&&"Dealers"}</button>}
        {(isAdmin||isTechSupport)&&<button style={tab==="emaillog"?S.tOn:S.tOff} onClick={()=>setTab("emaillog")}>📧 {!isMobile&&"Email Log"}</button>}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",flex:isMobile?"1 1 100%":"none"}}>
        <div style={{position:"relative",flex:isMobile?"1 1 100%":"none"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>🔍</span>
          <input style={{...S.inp,paddingLeft:32,width:isMobile?"100%":"auto",minWidth:isMobile?"auto":280,fontFamily:"monospace",boxSizing:"border-box"}} placeholder="Search..." value={localSearch} onChange={(e: any)=>setLocalSearch(e.target.value.toUpperCase())}/>
        </div>
        <select style={S.sel} value={fLoc} onChange={(e: any)=>setFLoc(e.target.value)}>
          <option value="All">All Locations</option>
          {LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        {tab!=="vendors"&&tab!=="register"&&!isVendor&&<button style={S.btn} onClick={()=>setShowAdd(true)}>+ Add</button>}
        {tab!=="vendors"&&tab!=="register"&&isAdmin&&!isMobile&&<button style={{...S.btn,background:"#1E3A5F",color:"#93C5FD"}} onClick={()=>setShowImportCrm(true)}>⬇️ Import from CRM</button>}
        {tab!=="vendors"&&tab!=="register"&&isAdmin&&isMobile&&<button style={{...S.btn,background:"#1E3A5F",color:"#93C5FD"}} onClick={()=>setShowImportCrm(true)}>⬇️ CRM</button>}
      </div>
    </div>
    <div style={{padding:"12px 16px"}}>
      {tab==="register"?<AdminPage/>
      :tab==="reports"?<ReportsPage/>
      :tab==="payments"?<PaymentsPage/>
      :tab==="dealers"?<DealersPage/>
      :tab==="emaillog"?<EmailLogPage/>
      :tab==="vendors"?<VendorsPage/>
      :(tab==="active"||tab==="delivered")?<div style={{height:"calc(100vh - 120px)",overflow:"auto"}}>
        {selV
          ? <VehicleDetail key={selV.id}/>
          : <>
              {tab==="delivered"&&<div style={{padding:"8px 12px",background:"#0D3B1E",borderBottom:"1px solid #166534",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,color:"#34D399",fontWeight:700}}>✅ Delivered Vehicles</span></div>}
              <VehicleTable/>
            </>
        }
      </div>:null}
    </div>
    {showAdd&&<AddVehicleModal/>}
    {showImportCrm&&<ImportCrmModal onClose={()=>setShowImportCrm(false)}/>}
  </div>;
}

export default App;
