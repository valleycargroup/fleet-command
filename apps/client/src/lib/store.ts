import { create } from 'zustand';
import { API_URL, VCAT } from './constants';
import { tryParse, vData } from './utils';

export const useStore = create<any>((set, get) => ({

  // ============ AUTH ============
  currentUser: (()=>{try{const s=sessionStorage.getItem("fc_user");if(s)return JSON.parse(s);}catch(e){}return null;})(),
  authToken: sessionStorage.getItem("fc_token")||null,

  handleLogin: (user: any, token: string) => {
    sessionStorage.setItem("fc_token", token);
    sessionStorage.setItem("fc_user", JSON.stringify(user));
    set({ currentUser: user, authToken: token });
  },

  handleLogout: () => {
    sessionStorage.removeItem("fc_token");
    sessionStorage.removeItem("fc_user");
    set({ currentUser: null, authToken: null });
  },

  // ============ DATA ============
  vehicles: [] as any[],
  vendors: {} as any,
  users: [] as any[],
  allUsers: [] as any[],
  regVendors: [] as any[],
  apiReady: false,
  loading: false,
  csvUploading: false,

  setVendors: (vendors: any) => set({ vendors }),
  setUsers: (users: any[]) => set({ users }),
  setAllUsers: (allUsers: any[]) => set({ allUsers }),
  setRegVendors: (regVendors: any[]) => set({ regVendors }),

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

  setTab: (tab: string) => set({ tab, selV: null }),
  setSelV: (selV: any) => set({ selV }),
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
  showConfirm: (message: string, onConfirm: () => void, title?: string, danger = true) => {
    set({ confirmModal: { title, message, onConfirm, danger } });
  },
  closeConfirm: () => set({ confirmModal: null }),

  // ============ API HELPER ============
  api: async (path: string, method="GET", body: any=null) => {
    const token = sessionStorage.getItem("fc_token");
    const opts: any = { method, headers: { "Content-Type": "application/json" } };
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(API_URL + path, opts);
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
      id:"db_"+(v._rowid||v.id),_dbId:v._rowid||v.id,
      vin8:v.vin?(v.vin.length>8?v.vin.slice(-8):v.vin):(v.stock_number||""),
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
    const { mapVehicle } = get();
    const token = sessionStorage.getItem("fc_token");
    if (!token) return;
    set({ loading: true });
    try {
      const hdrs={"Content-Type":"application/json","Authorization":"Bearer "+token};
      const [vRes,vnRes,uRes]=await Promise.all([
        fetch(API_URL+"/api/vehicles",{headers:hdrs}).then(r=>r.json()),
        fetch(API_URL+"/api/vendors",{headers:hdrs}).then(r=>r.json()),
        fetch(API_URL+"/api/users",{headers:hdrs}).then(r=>r.json()),
      ]);
      const mapped=(vRes.vehicles||[]).map((v: any)=>mapVehicle(v));
      const vnMap: any={};
      VCAT.forEach(c=>{vnMap[c.key]=[];});
      const regVList: any[]=[];
      (vnRes.vendors||[]).forEach((vn: any)=>{
        const cats=vn.categories?tryParse(vn.categories,[]):[];
        cats.forEach((ck: any)=>{if(vnMap[ck])vnMap[ck].push({id:"vn_"+vn.id,name:vn.name,email:vn.email||"",phone:vn.phone||""});});
        regVList.push({id:vn.id,company:vn.name,contact:vn.contact_name||"",email:vn.email||"",cell:vn.phone||"",officePhone:vn.office_phone||"",address:vn.location||"",categories:cats,primaryUserId:vn.primary_user_id||null,paymentTerms:vn.payment_terms||"weekly",cutoffDay:vn.cutoff_day||"Friday",cutoffTime:vn.cutoff_time||"5 PM",deliveryMethod:vn.delivery_method||"USPS Mail"});
      });
      const mappedUsers=(uRes.users||[]).map((u: any)=>({id:u.id,firstName:u.first_name,lastName:u.last_name,name:u.first_name+" "+u.last_name,email:u.email,cell:u.phone,role:u.role,location:u.location,isBuyer:!!u.is_buyer,isSeller:!!u.is_seller}));
      const currentSelV=get().selV;
      const freshSelV=currentSelV?mapped.find((v: any)=>v._dbId===currentSelV._dbId)||currentSelV:null;
      set({ vehicles:mapped, vendors:vnMap, regVendors:regVList, users:mappedUsers, allUsers:mappedUsers, apiReady:true, selV:freshSelV });
    } catch(e) {
      console.error("API load failed, falling back to localStorage:", e);
      try{const sv=localStorage.getItem("fc_vehicles");if(sv){const p=JSON.parse(sv);if(p&&p.length>0)set({vehicles:p});}}catch(e2){}
      try{const sv=localStorage.getItem("fc_vendors");if(sv)set({vendors:JSON.parse(sv)});}catch(e2){}
    }
    set({ loading: false });
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

  // ============ UPDATE VEHICLE (local + sync) ============
  upd: (id: any, updates: any) => {
    set((state: any) => {
      const vehicles = state.vehicles.map((v: any) => v.id===id ? {...v,...updates} : v);
      const selV = state.selV?.id===id ? {...state.selV,...updates} : state.selV;
      return { vehicles, selV };
    });
    const updated = get().vehicles.find((v: any) => v.id===id);
    if (updated) get().syncVehicle(updated);
  },

  // ============ ADD VEHICLE ============
  addVehicle: async (v: any) => {
    const { api, apiReady, notify } = get();
    if (apiReady) {
      const res = await api("/api/vehicles", "POST", {
        vin:v.fullVin||v.vin8||"", stock_number:v.vin8||"",
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
      const res = await api(`/api/vehicles/${v._dbId}/send-to-auction`, 'POST', { replace_existing_images: !!opts.replaceExistingImages, photos: v.photos || [] });
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
  const isAdmin = u?.role==="Admin"||u?.role==="admin"||!!(u?.is_buyer&&u?.is_seller);
  const isVendor = u?.role==="Vendor"||u?.role==="vendor";
  const isAP = u?.role==="ap"||u?.role==="AP"||u?.is_ap;
  return { isAdmin, isVendor, isAP };
};
