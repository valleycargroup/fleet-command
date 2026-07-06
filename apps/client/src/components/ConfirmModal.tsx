import { useStore } from '../lib/store';

export function ConfirmModal() {
  const confirmModal = useStore((s: any) => s.confirmModal);
  const closeConfirm = useStore((s: any) => s.closeConfirm);
  if (!confirmModal) return null;
  const { title, message, onConfirm, danger = true, confirmLabel } = confirmModal;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
      <div style={{background:'#12122A',border:'1px solid #2A2A3E',borderRadius:12,padding:28,width:'100%',maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}
        onClick={(e:any)=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:17,fontWeight:700,color:'#E5E7EB'}}>{title||''}</div>
          <button style={{background:'transparent',border:'none',color:'#6B7280',fontSize:20,cursor:'pointer',padding:'2px 6px',borderRadius:4,lineHeight:1}} onClick={closeConfirm}>✕</button>
        </div>
        <div style={{fontSize:14,color:'#9CA3AF',lineHeight:1.6,marginBottom:24}}>{message}</div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          <button style={{padding:'8px 20px',borderRadius:6,border:'1px solid #2A2A3E',background:'transparent',color:'#9CA3AF',fontSize:14,cursor:'pointer',fontWeight:600}}
            onClick={closeConfirm}>Cancel</button>
          <button style={{padding:'8px 20px',borderRadius:6,border:'none',background:danger?'#7F1D1D':'#166534',color:danger?'#FCA5A5':'#6EE7B7',fontSize:14,cursor:'pointer',fontWeight:700}}
            onClick={()=>{closeConfirm();onConfirm();}}>
            {confirmLabel||(danger?'Delete':'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
