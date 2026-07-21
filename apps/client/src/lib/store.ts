import { create } from 'zustand';
import { API_URL, VCAT } from './constants';
import { tryParse } from './utils';

// ============ SYNC DEBOUNCE ============
const _syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

// ============ WEBSOCKET ============
let _ws: WebSocket | null = null;
let _wsBackoff = 1000;
let _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function _mapVendors(vendors: any[]) {
  const vnMap: any = {};
  VCAT.forEach(c => { vnMap[c.key] = []; });
  const regVList: any[] = [];
  vendors.forEach((vn: any) => {
    const cats = vn.categories ? tryParse(vn.categories, []) : [];
    cats.forEach((ck: any) => { if (vnMap[ck]) vnMap[ck].push({ id: 'vn_' + vn.id, name: vn.name, email: vn.email || '', phone: vn.phone || '' }); });
    regVList.push({ id: vn.id, company: vn.name, contact: vn.contact_name || '', email: vn.email || '', cell: vn.phone || '', officePhone: vn.office_phone || '', address: vn.location || '', categories: cats, primaryUserId: vn.primary_user_id || null, paymentTerms: vn.payment_terms || 'weekly', cutoffDay: vn.cutoff_day || 'Friday', cutoffTime: vn.cutoff_time || '5 PM', deliveryMethod: vn.delivery_method || 'USPS Mail', paymentInfo: vn.payment_info || {}, emailPrefs: vn.email_prefs || {} });
  });
  return { vnMap, regVList };
}

function _mapUsers(users: any[]) {
  return users.map((u: any) => ({
    id: u.id, firstName: u.first_name, lastName: u.last_name,
    name: u.first_name + ' ' + u.last_name,
    email: u.email, cell: u.phone, role: u.role, location: u.location,
    isBuyer: !!u.is_buyer, isSeller: !!u.is_seller,
    vendorTag: u.vendor_tag || null, vendorId: u.vendor_id || null,
  }));
}

export function disconnectWebSocket() {
  if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
  _wsBackoff = 1000;
}

export function connectWebSocket() {
  if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) return;
  const wsUrl = API_URL.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws') + '/ws';
  try {
    _ws = new WebSocket(wsUrl);
  } catch { return; }

  _ws.onopen = () => {
    _wsBackoff = 1000;
    const s = useStore.getState();
    s.refreshVehicles();
    s.refreshVendors();
    s.refreshUsers();
  };

  _ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string);
      const s = useStore.getState();
      if (msg.type === 'VEHICLES_UPDATED') s.refreshVehicles();
      else if (msg.type === 'VENDORS_UPDATED') s.refreshVendors();
      else if (msg.type === 'USERS_UPDATED') s.refreshUsers();
    } catch {}
  };

  _ws.onclose = () => {
    _ws = null;
    if (!useStore.getState().currentUser) return;
    _wsReconnectTimer = setTimeout(() => {
      _wsBackoff = Math.min(_wsBackoff * 2, 30000);
      connectWebSocket();
    }, _wsBackoff);
  };

  _ws.onerror = () => { try { _ws?.close(); } catch {} };
}

export const useStore = create<any>((set, get) => ({

  // ============ AUTH ============
  currentUser: (()=>{try{const s=localStorage.getItem("fc_user");if(s){const u=JSON.parse(s);setTimeout(connectWebSocket,500);return u;}}catch(e){}return null;})(),
  authToken: localStorage.getItem("fc_token")||null,

  handleLogin: (user: any, token: string) => {
    localStorage.setItem("fc_token", token);
    localStorage.setItem("fc_user", JSON.stringify(user));
    set({ currentUser: user, authToken: token });
    setTimeout(connectWebSocket, 500);
  },

  handleLogout: () => {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_user");
    disconnectWebSocket();
    set({ currentUser: null, authToken: null });
  },

  // ============ DATA ============
  vehicles: [] as any[],
  vendors: {} as any,
  users: [] as any[],
  allUsers: [] as any[],
  regVendors: [] as any[],
  dealers: [] as any[],
  siteSettings: {} as Record<string, string>,
  apiReady: false,
  loading: false,
  csvUploading: false,

  setVendors: (vendors: any) => set({ vendors }),
  setUsers: (users: any[]) => set({ users }),
  setAllUsers: (allUsers: any[]) => set({ allUsers }),
  setRegVendors: (regVendors: any[]) => set({ regVendors }),
  setDealers: (dealers: any[]) => set({ dealers }),
  setSiteSettings: (siteSettings: Record<string, string>) => set({ siteSettings }),

  fetchDealers: async () => {
    const { api } = get();
    try {
      const res = await api('/api/dealers');
      set({ dealers: res.dealers || [] });
    } catch (e) { console.error('fetchDealers failed:', e); }
  },

  // ============ UI ============
  tab: "active",
  selV: null as any,
  fLoc: "All",
  search: "",
  note: null as string|null,
  showAdd: false,
  deepLinkCat: null as string|null,
  deepLinkCr: false as boolean,
  pendingDeepLink: (()=>{try{const p=new URLSearchParams(window.location.search);const vid=p.get("vehicle");const vcat=p.get("cat");return vid?{vid,vcat}:null;}catch(e){return null;}})(),
  deliveredCount: 0,
  deliveredLoaded: false,
  returnTab: null as string|null,

  setTab: (tab: string) => set({ tab, selV: null, returnTab: null }),
  setSelV: (selV: any) => set({ selV }),
  setReturnTab: (returnTab: string|null) => set({ returnTab }),
  setFLoc: (fLoc: string) => set({ fLoc }),
  setSearch: (search: string) => set({ search }),
  setShowAdd: (showAdd: boolean) => set({ showAdd }),
  setDeepLinkCat: (deepLinkCat: any) => set({ deepLinkCat }),
  setDeepLinkCr: (deepLinkCr: boolean) => set({ deepLinkCr }),
  setPendingDeepLink: (pendingDeepLink: any) => set({ pendingDeepLink }),

  notify: (msg: string) => {
    set({ note: msg });
    setTimeout(() => set({ note: null }), 3500);
  },

  // ============ CONFIRM MODAL ============
  confirmModal: null as { title?: string; message: string; onConfirm: () => void; danger?: boolean } | null,
  showConfirm: (message: string, onConfirm: () => void, title?: string, danger = true, confirmLabel?: string) => {
    set({ confirmModal: { title, message, onConfirm, danger, confirmLabel } });
  },
  closeConfirm: () => set({ confirmModal: null }),

  // ============ API HELPER ============
  api: async (path: string, method="GET", body: any=null) => {
    const token = localStorage.getItem("fc_token");
    const opts: any = { method, cache: 'no-store', headers: { "Content-Type": "application/json" } };
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    if (body) opts.body = JSON.stringify(body);
    const sep = path.includes('?') ? '&' : '?';
    const r = await fetch(`${API_URL}${path}${sep}_v=${__BUILD_TS__}`, opts);
    if (!r.ok) {
      const errData = await r.json().catch(()=>({ error:"Request failed" }));
      if (r.status === 401) get().handleLogout();
      throw new Error(errData.error || "API error " + r.status);
    }
    return r.json();
  },

  // ============ MAP VEHICLE ============
  mapVehicle: (v: any) => {
    const freshRecon=()=>{const rt: any={};VCAT.forEach(c=>{rt[c.key]={needed:false,status:"na"};});return rt;};
    let reconTasks=freshRecon();
    if(v.recon_data){
      const parsed=tryParse(v.recon_data,null);
      if(parsed&&(parsed.detail!==undefined||parsed.bodyshop!==undefined||parsed.touchup!==undefined||parsed.mechanical!==undefined)){
        reconTasks=JSON.parse(JSON.stringify(parsed));
        VCAT.forEach(c=>{if(!reconTasks[c.key])reconTasks[c.key]={needed:false,status:"na"};});
      }
    }
    let transport={inbound:{set:false},outbound:{set:false}};
    if(v.transport_data){
      const parsed=tryParse(v.transport_data,null);
      if(parsed&&(parsed.inbound||parsed.outbound))transport=JSON.parse(JSON.stringify(parsed));
    }
    return {
      id:"db_"+v.id,_dbId:v.id,
      vin8:v.vin?(v.vin.length>8?v.vin.slice(-8):v.vin):"",
      fullVin:v.vin||"",stockNumber:v.stock_number||"",
      year:v.year||0,make:v.make||"",model:v.model||"",trim:v.trim||"",
      miles:v.miles||0,color:v.color||"",
      zipCode:v.zip_code||"",fuelType:v.fuel_type||"",transmission:v.transmission||"",
      driveline:v.driveline||"",drive:v.drive||"",motorTrailer:v.motor_trailer||"",
      location:(()=>{const l=(v.location||"PHX").toUpperCase().trim();if(l==="PHOENIX"||l==="PHX"||l==="AZ")return "PHX";if(l==="DALLAS"||l==="DFW"||l==="TX")return "Dallas";return v.location||"PHX";})(),
      source:v.source||"",
      purchaseDate:v.purchase_date||v.enter_date||"",
      enterDate:v.enter_date||v.purchase_date||"",
      buyingBroker:v.buyer||"",sellingBroker:v.seller||"",
      status:v.status==="sold"?"sold":v.status==="delivered"?"delivered":"in_recon",
      soldDate:v.sale_date||null,soldTo:v.sold_to||"",
      deliveredDate:v.grounded_date||null,
      noReconNeeded:(()=>{const rd=tryParse(v.recon_data,{});return !!rd._noReconNeeded;})(),
      noReconSetBy:(()=>{const rd=tryParse(v.recon_data,{});return rd._noReconSetBy||null;})(),
      noReconSetDate:(()=>{const rd=tryParse(v.recon_data,{});return rd._noReconSetDate||null;})(),
      buyerApprovedShip:(()=>{const rd=tryParse(v.recon_data,{});return !!rd._buyerApprovedShip;})(),
      buyerApprovedDate:(()=>{const rd=tryParse(v.recon_data,{});return rd._buyerApprovedDate||null;})(),
      shippingHoldBy:(()=>{const rd=tryParse(v.recon_data,{});return rd._shippingHoldBy||null;})(),
      shippingHoldDate:(()=>{const rd=tryParse(v.recon_data,{});return rd._shippingHoldDate||null;})(),
      arb:(()=>{const rd=tryParse(v.recon_data,{});return rd._arb||null;})(),
      transport,reconTasks,
      kicked:(()=>{const rd=tryParse(v.recon_data,{});return rd._kicked||v.kicked===1||v.kicked===true;})(),
      kickedFromCSV:(()=>{const rd=tryParse(v.recon_data,{});return rd._kickedFromCSV||v.kicked===1||v.kicked===true;})(),
      kickedReturn:(()=>{const rd=tryParse(v.recon_data,{});return rd._kickedReturn||false;})(),
      kickedFromDealer:(()=>{const rd=tryParse(v.recon_data,{});return rd._kickedFromDealer||null;})(),
      kickedHistory:(()=>{const rd=tryParse(v.recon_data,{});return rd._kickedHistory||[];})(),
      notes:v.notes||"",
      conditionReport:(()=>{const r=v.condition_report;if(!r)return null;return typeof r==='string'?tryParse(r,null):r;})(),
      crStatus:v.cr_status||null,
      crAssignedTo:v.cr_assigned_to||null,
      photos:tryParse(v.photos,[]),
      _raw:v,
    };
  },

  // ============ LOAD ALL DATA ============
  loadData: async () => {
    const { mapVehicle, api } = get();
    if (!localStorage.getItem("fc_token")) return;
    set({ loading: true });
    try {
      const [vRes,vnRes,uRes,dlRes,stRes]=await Promise.all([
        api('/api/vehicles?excludeDelivered=true'),
        api('/api/vendors'),
        api('/api/users').catch(()=>({users:[]})),
        api('/api/dealers').catch(()=>({dealers:[]})),
        api('/api/settings').catch(()=>({data:{}})),
      ]);
      const mapped=(vRes.vehicles||[]).map((v: any)=>mapVehicle(v));
      const { vnMap, regVList } = _mapVendors(vnRes.vendors||[]);
      const mappedUsers = _mapUsers(uRes.users||[]);
      const currentSelV=get().selV;
      const freshSelV=currentSelV?mapped.find((v: any)=>v._dbId===currentSelV._dbId)||currentSelV:null;
      set({ vehicles:mapped, vendors:vnMap, regVendors:regVList, users:mappedUsers, allUsers:mappedUsers, dealers:dlRes.dealers||[], siteSettings:stRes.data||{}, apiReady:true, selV:freshSelV, deliveredCount:vRes.deliveredCount||0, deliveredLoaded:false });
    } catch(e) {
      const msg = (e as any)?.message || String(e);
      const serverDown = msg.includes('<!doctype') || msg.includes('not valid JSON') || msg.includes('Failed to fetch');
      console.error('[loadData]', serverDown ? 'Server unreachable or returned HTML error page' : msg, e);
      if (serverDown) get().notify('Could not reach the server — please refresh or clear your browser cache.');
      try{const sv=localStorage.getItem("fc_vehicles");if(sv){const p=JSON.parse(sv);if(p&&p.length>0)set({vehicles:p});}}catch(e2){}
      try{const sv=localStorage.getItem("fc_vendors");if(sv)set({vendors:JSON.parse(sv)});}catch(e2){}
    }
    set({ loading: false });
  },

  // ============ DELIVERED LAZY LOAD ============
  loadDelivered: async () => {
    if (get().deliveredLoaded) return;
    const { api, mapVehicle } = get();
    try {
      const data = await api('/api/vehicles?deliveredOnly=true');
      const delivered = (data.vehicles||[]).map((v: any) => mapVehicle(v));
      const active = get().vehicles.filter((v: any) => v.status !== 'delivered');
      set({ vehicles: [...active, ...delivered], deliveredLoaded: true, deliveredCount: delivered.length });
    } catch(e) { console.error('[loadDelivered]', e); }
  },

  // ============ TARGETED REFRESH (used by WebSocket events) ============
  refreshVehicles: async () => {
    const { api, mapVehicle } = get();
    try {
      const data = await api('/api/vehicles');
      const deletedIds = (window as any)._deletedDbIds || [];
      const mapped = (data.vehicles || []).map((v: any) => mapVehicle(v)).filter((v: any) => !deletedIds.includes(v._dbId));
      const currentSelV = get().selV;
      const freshSelV = currentSelV ? mapped.find((v: any) => v._dbId === currentSelV._dbId) || currentSelV : null;
      set((prev: any) => {
        if (prev.vehicles.length !== mapped.length) return { vehicles: mapped, selV: freshSelV };
        for (let i = 0; i < mapped.length; i++) {
          const p = prev.vehicles.find((x: any) => x._dbId === mapped[i]._dbId);
          if (!p || JSON.stringify(p._raw) !== JSON.stringify(mapped[i]._raw)) return { vehicles: mapped, selV: freshSelV };
        }
        return prev;
      });
    } catch {}
  },

  refreshVendors: async () => {
    const { api } = get();
    try {
      const data = await api('/api/vendors');
      const { vnMap, regVList } = _mapVendors(data.vendors || []);
      set({ vendors: vnMap, regVendors: regVList });
    } catch {}
  },

  refreshUsers: async () => {
    const { api } = get();
    try {
      const data = await api('/api/users');
      const mapped = _mapUsers(data.users || []);
      set({ users: mapped, allUsers: mapped });
    } catch {}
  },

  // ============ SYNC VEHICLE TO API ============
  syncVehicle: async (v: any) => {
    const { api, apiReady } = get();
    if (!apiReady || !v._dbId) return;
    try {
      await api("/api/vehicles/"+v._dbId, "PUT", {
        vin:v.fullVin||v.vin8||"", stock_number:v.stockNumber||v.vin8||"",
        year:v.year, make:v.make, model:v.model, trim:v.trim||"",
        color:v.color, miles:v.miles, location:v.location,
        zip_code:v.zipCode||null, fuel_type:v.fuelType||null, transmission:v.transmission||null,
        driveline:v.driveline||null, drive:v.drive||null, motor_trailer:v.motorTrailer||null,
        source:v.source||"", buyer:v.buyingBroker||"", seller:v.sellingBroker||"",
        sold_to:v.soldTo||null, sale_date:v.soldDate||null,
        purchase_date:v.purchaseDate||null, grounded_date:v.deliveredDate||null,
        status:v.status==="delivered"?"delivered":v.status==="sold"?"sold":"active",
        kicked:(v.kickedHistory||[]).length>0||(v.kicked||v.kickedFromCSV||v.kickedReturn)?1:0,
        notes:v.notes||"",
        condition_report:v.conditionReport||null,
        cr_status:v.crStatus||null,
        cr_assigned_to:v.crAssignedTo||null,
        recon_data:JSON.stringify({...(v.reconTasks||{}),_kickedHistory:v.kickedHistory||[],_kickedFromDealer:v.kickedFromDealer||null,_kickedReturn:v.kickedReturn||false,_kicked:v.kicked||false,_kickedFromCSV:v.kickedFromCSV||false,_noReconNeeded:!!v.noReconNeeded,_noReconSetBy:v.noReconSetBy||null,_noReconSetDate:v.noReconSetDate||null,_buyerApprovedShip:!!v.buyerApprovedShip,_buyerApprovedDate:v.buyerApprovedDate||null,_shippingHoldBy:v.shippingHoldBy||null,_shippingHoldDate:v.shippingHoldDate||null,_arb:v.arb||null}),
        transport_data:JSON.stringify(v.transport||{}),
        photos:JSON.stringify(v.photos||[]),
      });
    } catch(e) { console.error("Sync failed:", e); }
  },

  // ============ UPDATE VEHICLE (local + debounced sync) ============
  upd: (id: any, updates: any, syncDelay = 1500) => {
    set((state: any) => {
      const vehicles = state.vehicles.map((v: any) => v.id===id ? {...v,...updates} : v);
      const selV = state.selV?.id===id ? {...state.selV,...updates} : state.selV;
      return { vehicles, selV };
    });
    if (_syncTimers[id]) clearTimeout(_syncTimers[id]);
    _syncTimers[id] = setTimeout(() => {
      delete _syncTimers[id];
      const fresh = get().vehicles.find((v: any) => v.id===id);
      if (fresh) get().syncVehicle(fresh);
    }, syncDelay);
  },

  // ============ ADD VEHICLE ============
  addVehicle: async (v: any) => {
    const { api, apiReady, notify } = get();
    if (apiReady) {
      const res = await api("/api/vehicles", "POST", {
        vin:v.fullVin||v.vin8||"", stock_number:v.stockNumber||v.vin8||"",
        year:v.year, make:v.make, model:v.model, trim:v.trim||"",
        color:v.color, miles:v.miles, location:v.location,
        zip_code:v.zipCode||null, fuel_type:v.fuelType||null, transmission:v.transmission||null,
        driveline:v.driveline||null, drive:v.drive||null, motor_trailer:v.motorTrailer||null,
        source:v.source||"", buyer:v.buyingBroker||"", seller:v.sellingBroker||"",
        purchase_date:v.purchaseDate||null, status:"active",
        recon_data:JSON.stringify(v.reconTasks||{}),
        transport_data:JSON.stringify(v.transport||{}),
      });
      if (res.ok && res.id) { v.id="db_"+res.id; v._dbId=res.id; v.stockNumber=v.vin8||""; }
    }
    set((state: any) => ({ vehicles:[v,...state.vehicles], showAdd:false }));
    notify("Vehicle added");
  },

  // ============ DELETE VEHICLE ============
  deleteVehicle: async (v: any) => {
    const { api, apiReady, notify } = get();
    set((state: any) => ({ selV:null, vehicles:state.vehicles.filter((x: any)=>x.id!==v.id) }));
    if (v._dbId && apiReady) {
      try {
        const res = await api("/api/vehicles/"+v._dbId, "DELETE");
        if (res.ok) {
          notify("🗑️ Vehicle deleted from database");
          (window as any)._deletedDbIds=((window as any)._deletedDbIds||[]);
          (window as any)._deletedDbIds.push(v._dbId);
        }
      } catch(e: any) { notify("⚠️ Delete failed: "+e.message); }
    }
  },

  // ============ CSV UPLOAD ============
  handleCSVUpload: async (file: File) => {
    const { api, mapVehicle, notify } = get();
    set({ csvUploading: true });
    try {
      const text = await file.text();
      const res = await api("/api/vehicles/upload-csv", "POST", { csv_data: text });
      if (res.ok) {
        notify("✅ CSV Import: "+res.imported+" new, "+res.updated+" updated"+(res.errors?.length?" ("+res.errors.length+" errors)":""));
        const vRes = await api("/api/vehicles");
        set({ vehicles:(vRes.vehicles||[]).map(mapVehicle) });
      } else {
        notify("⚠️ CSV Error: "+(res.error||"Unknown error"));
      }
    } catch(e: any) { notify("⚠️ CSV upload failed: "+e.message); }
    set({ csvUploading: false });
  },

  // ============ SEND TO AUCTION ============
  sendToAuction: async (v: any, opts: { replaceExistingImages?: boolean } = {}) => {
    const { api, notify } = get();
    if (!v._dbId) { notify('⚠️ Save the vehicle before sending to auction'); return; }
    try {
      const res = await api(`/api/vehicles/${v._dbId}/send-to-auction`, 'POST', { replace_existing_images: !!opts.replaceExistingImages, photos: v.photos || [], buyer_transport: !!v.buyerTransport });
      notify(`🔨 Sent to Auction — ${res.skippedNonUrlMedia ? res.skippedNonUrlMedia + ' local photo(s) skipped (no hosted URL)' : 'media included'}`);
      return res;
    } catch (e: any) {
      notify(`⚠️ Send to Auction failed — ${e.message}`);
      throw e;
    }
  },

  // ============ IMPORT FROM CRM ============
  lookupCrmVehicle: async (vin: string) => {
    const { api, notify } = get();
    try {
      return await api(`/api/vehicles/import-from-crm/lookup?vin=${encodeURIComponent(vin)}`, 'GET');
    } catch (e: any) {
      notify(`⚠️ CRM lookup failed — ${e.message}`);
      throw e;
    }
  },
  importFromCrm: async (fields: any) => {
    const { api, notify, loadData } = get();
    try {
      const res = await api('/api/vehicles/import-from-crm', 'POST', fields);
      notify(res.updated ? '✅ Vehicle updated from CRM' : '✅ Vehicle imported from CRM');
      await loadData();
      return res;
    } catch (e: any) {
      notify(`⚠️ Import from CRM failed — ${e.message}`);
      throw e;
    }
  },

  // ============ FIRE EMAIL ============
  fireEmail: async (type: string, data: any) => {
    const { notify } = get();
    try {
      const resp = await fetch(API_URL+"/api/email/send", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({type,to:"",data}) });
      if (resp.ok) {
        const result = await resp.json().catch(()=>({}));
        const n = (result.recipients||[]).length;
        notify(n>0?`📧 Email sent (${n} recipient${n===1?"":"s"})`:"📧 Email fired — no recipients matched");
        return;
      }
      const errText = await resp.text().catch(()=>"Unknown error");
      notify(`⚠️ Email failed (${resp.status}): ${type.replace(/_/g," ")} — ${errText.substring(0,100)}`);
    } catch(e: any) {
      notify(`⚠️ Email worker unreachable — ${type.replace(/_/g," ")} (${e.message})`);
    }
  },

}));

// Selector: derive role flags from currentUser
export const selectRoles = (s: any) => {
  const u = s.currentUser;
  const isTechSupport = ["Tech Support","tech_support","TechSupport","techsupport"].includes(u?.role||"");
  const isAdmin = u?.role==="Admin"||u?.role==="admin"||!!(u?.is_buyer&&u?.is_seller)||isTechSupport;
  const isVendor = u?.role==="Vendor"||u?.role==="vendor";
  const isAP = u?.role==="ap"||u?.role==="AP"||u?.is_ap;
  return { isAdmin, isVendor, isAP, isTechSupport };
};
