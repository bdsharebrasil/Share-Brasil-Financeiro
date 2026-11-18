/** Mescla por identificador, preservando alterações de pessoas em campos distintos. */
export function mesclar(base: any, local: any, remoto: any, preferir: 'local' | 'remoto' = 'local'): { dados: any; conflitos: number } {
  const igual=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
  let conflitos=0;
  function unir(b:any,l:any,r:any):any {
    if(igual(l,b))return r;
    if(igual(r,b)||igual(l,r))return l;
    if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)&&[...b,...l,...r].every(x=>x&&typeof x==='object'&&typeof x.id==='string')){
      const ids=[...new Set([...r,...l].map(x=>x.id))];
      return ids.flatMap(id=>{const bb=b.find(x=>x.id===id),ll=l.find(x=>x.id===id),rr=r.find(x=>x.id===id);const v=unir(bb,ll,rr);return v===undefined?[]:[v];});
    }
    if(b&&l&&r&&[b,l,r].every(x=>typeof x==='object'&&!Array.isArray(x))){const out:any={};for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)]))out[k]=unir(b[k],l[k],r[k]);return out;}
    conflitos++;return preferir==='local'?l:r;
  }
  return {dados:unir(base,local,remoto),conflitos};
}
