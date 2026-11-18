const CHAVE='share:recuperacao-recursos';
const INTERVALO=120_000;
export function erroDeRecurso(error:unknown):boolean {
 const mensagem=error instanceof Error?error.message:String(error??'');
 return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk|Unable to preload CSS|Expected a JavaScript-or-Wasm module script/i.test(mensagem);
}
export type AmbienteRecuperacao={online:()=>boolean;storage:Pick<Storage,'getItem'|'setItem'>;agora:()=>number;limpar:()=>Promise<unknown>;atualizar:()=>Promise<unknown>;recarregar:()=>void};
export function criarRecuperacao(ambiente:AmbienteRecuperacao){
 let iniciada=false;
 return (forcar=false)=>{
  if(iniciada||!ambiente.online())return false;
  const agora=ambiente.agora();
  try{const anterior=Number(ambiente.storage.getItem(CHAVE));if(!forcar&&anterior>0&&agora-anterior<INTERVALO)return false;ambiente.storage.setItem(CHAVE,String(agora));}catch{if(!forcar)return false;}
  iniciada=true;
  // O recarregamento também ocorre se o cache ou o registro estiver indisponível.
  let timer:ReturnType<typeof setTimeout>;
  const prazo=new Promise<void>(resolve=>{timer=setTimeout(resolve,4000);});
  void Promise.race([Promise.allSettled([Promise.resolve().then(ambiente.limpar),Promise.resolve().then(ambiente.atualizar)]),prazo])
   .finally(()=>{clearTimeout(timer);ambiente.recarregar();});
  return true;
 };
}
let recuperar:ReturnType<typeof criarRecuperacao>|undefined;
export function recuperarRecursos(forcar=false){
 if(typeof window==='undefined')return false;
 recuperar??=criarRecuperacao({
  online:()=>navigator.onLine!==false,
  storage:{getItem:key=>window.sessionStorage.getItem(key),setItem:(key,v)=>window.sessionStorage.setItem(key,v)},agora:()=>Date.now(),
  limpar:async()=>{if(!('caches'in window))return;const chaves=await caches.keys();await Promise.all(chaves.filter(k=>k.startsWith('share-brasil-')).map(k=>caches.delete(k)));},
  atualizar:async()=>{if(!('serviceWorker'in navigator))return;const r=await navigator.serviceWorker.getRegistration('/');if(r)await r.update();},
  recarregar:()=>{const url=new URL(window.location.href);url.searchParams.set('_atualizacao',String(Date.now()));window.location.replace(url.href);},
 });
 return recuperar(forcar);
}
export function instalarRecuperacaoRecursos(){
 const tratar=(evento:Event)=>{const e=evento as Event&{payload?:unknown};if(erroDeRecurso(e.payload)&&recuperarRecursos())e.preventDefault();};
 window.addEventListener('vite:preloadError',tratar);
 return()=>window.removeEventListener('vite:preloadError',tratar);
}
