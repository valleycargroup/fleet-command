import { VCAT } from '../lib/constants';
import { S } from '../lib/styles';
import { useStore } from '../lib/store';

export function VendorsPage() {
const vendors = useStore((s: any) => s.vendors);
  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
    {VCAT.map(cat=><div key={cat.key} style={S.card}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:18}}>{cat.icon}</span>
        <span style={{fontWeight:700,color:"#E5E7EB",fontSize:14}}>{cat.label}</span>
        <span style={{color:"#6B7280",fontSize:12}}>({(vendors[cat.key]||[]).length})</span>
      </div>
      {(vendors[cat.key]||[]).map((vn: any)=><div key={vn.id} style={{padding:"4px 0",borderBottom:"1px solid #2A2A3E",fontSize:12}}>
        <div style={{color:"#E5E7EB",fontWeight:600}}>{vn.name}</div>
        <div style={{color:"#6B7280"}}>{vn.email} • {vn.phone}</div>
      </div>)}
    </div>)}
  </div>;
}
