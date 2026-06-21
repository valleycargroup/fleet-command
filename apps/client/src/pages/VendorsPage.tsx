import { VCAT } from '../lib/constants';
import { S } from '../lib/styles';
import { useStore } from '../lib/store';

export function VendorsPage() {
const vendors = useStore((s: any) => s.vendors);
const search  = useStore((s: any) => s.search);
const q = (search || '').toUpperCase().trim();

return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
  {VCAT.map(cat => {
    const all = vendors[cat.key] || [];
    const filtered = q ? all.filter((vn: any) => (vn.name||'').toUpperCase().includes(q) || (vn.email||'').toUpperCase().includes(q)) : all;
    if (q && filtered.length === 0) return null;
    return <div key={cat.key} style={S.card}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{fontSize:18}}>{cat.icon}</span>
        <span style={{fontWeight:700,color:'#E5E7EB',fontSize:14}}>{cat.label}</span>
        <span style={{color:'#6B7280',fontSize:12}}>({filtered.length})</span>
      </div>
      {filtered.map((vn: any) => <div key={vn.id} style={{padding:'4px 0',borderBottom:'1px solid #2A2A3E',fontSize:12}}>
        <div style={{color:'#E5E7EB',fontWeight:600}}>{vn.name}</div>
        <div style={{color:'#6B7280'}}>{vn.email}{vn.phone?' • '+vn.phone:''}</div>
      </div>)}
    </div>;
  })}
</div>;
}
