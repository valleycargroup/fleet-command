import { useState } from 'react';
import { fmtDate } from '../lib/utils';
import { S } from '../lib/styles';

export function DateIn({value, onChange, style: st2}: any) {
  const [typing, setTyping] = useState(false);
  const [raw, setRaw] = useState("");
  const display = value ? fmtDate(value) : "";
  const parse = (s: any) => {
    const digits = s.replace(/[^0-9]/g,"");
    let m=0, d=0;
    if(digits.length===3){m=parseInt(digits[0]);d=parseInt(digits.slice(1));}
    else if(digits.length===4){m=parseInt(digits.slice(0,2));d=parseInt(digits.slice(2));}
    else if(digits.length>=2&&s.includes("/")){const p=s.split("/");m=parseInt(p[0]);d=parseInt(p[1]);}
    if(m>=1&&m<=12&&d>=1&&d<=31){
      const now=new Date(); let y=now.getFullYear();
      if(new Date(y,m-1,d)<new Date(now.getFullYear(),now.getMonth(),now.getDate()))y++;
      onChange(y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")); return true;
    }
    return false;
  };
  const handleBlur = () => { if(raw) parse(raw); setTyping(false); setRaw(""); };
  return <input style={{...S.fi,...(st2||{}),fontFamily:"monospace"}} placeholder="321 = 3/21"
    value={typing ? raw : display}
    onFocus={()=>{setTyping(true);setRaw("");}}
    onChange={e=>setRaw(e.target.value)}
    onBlur={handleBlur}
    onKeyDown={(e: any)=>{if(e.key==="Enter"){handleBlur();e.target.blur();}}}
  />;
}
