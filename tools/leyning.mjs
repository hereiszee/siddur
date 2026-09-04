import {HDate} from '@hebcal/core';
import {getLeyningOnDate} from '@hebcal/leyning';
const out={}; const shapes=new Set();
for (const il of [false,true]) {
  let d=new Date(2026,0,1);
  const end=new Date(2050,0,1);
  while(d<end){
    const dow=d.getDay();
    if(dow!==6){ // skip Shabbat
      const hd=new HDate(d);
      let r=null; try{ r=getLeyningOnDate(hd,il,true);}catch(e){}
      if(r) for(const item of r){
        const parts = item.weekday || item.fullkriyah;
        if(!parts) continue;
        const key=(item.name&&item.name.en)||'?';
        for(const [al,a] of Object.entries(parts)){
          const ref=`${a.k} ${a.b}-${a.e}`;
          shapes.add(ref);
          out[key]=out[key]||{};
          out[key][al]={k:a.k,b:a.b,e:a.e,v:a.v,reason:a.reason||null};
        }
      }
    }
    d=new Date(d.getTime()+864e5);
  }
}
console.error('distinct readings:',Object.keys(out).length,'distinct ranges:',shapes.size);
process.stdout.write(JSON.stringify({readings:out,ranges:[...shapes].sort()},null,1));
