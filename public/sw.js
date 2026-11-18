const CACHE_ESTATICOS='share-brasil-static-v3';
const CACHE_PAGINAS='share-brasil-pages-v3';
const VERSOES_ATUAIS=new Set([CACHE_ESTATICOS,CACHE_PAGINAS]);
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const chaves=await caches.keys();
 await Promise.all(chaves.filter(k=>k.startsWith('share-brasil-')&&!VERSOES_ATUAIS.has(k)).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
function tipoValido(request,response){
 if(!response||!response.ok)return false;
 const tipo=response.headers.get('Content-Type')||'';
 const path=new URL(request.url).pathname;
 if(request.destination==='script'||/\.(?:m?js)$/i.test(path))return /(?:java|ecma)script/i.test(tipo);
 if(request.destination==='style'||/\.css$/i.test(path))return /text\/css/i.test(tipo);
 return !/text\/html/i.test(tipo);
}
async function guardar(cache,request,response){
 if(!response.ok||response.headers.get('Cache-Control')?.includes('no-store'))return;
 try{await cache.put(request,response.clone());const chaves=await cache.keys();if(chaves.length>200)await cache.delete(chaves[0]);}catch{/* Cache cheio ou desabilitado: a rede continua funcionando. */}
}
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname==='/api'||url.pathname.startsWith('/api/')||req.headers.has('Authorization'))return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   let cache;try{cache=await caches.open(CACHE_PAGINAS);}catch{}
   try{const response=await fetch(new Request(req,{cache:'no-cache'}));if(cache&&response.ok&&/text\/html/.test(response.headers.get('Content-Type')||''))await guardar(cache,req,response);return response;}
   catch{const salvo=cache&&await cache.match(req);return salvo||new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Share Brasil</title><body><h1>Sem conexão</h1><p>Conecte-se à internet para abrir o sistema.</p><button onclick="location.reload()">Tentar novamente</button></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
  })());return;
 }
 if(!url.pathname.startsWith('/assets/')&&!/\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname))return;
 event.respondWith((async()=>{
  let cache;try{cache=await caches.open(CACHE_ESTATICOS);}catch{}
  const salvo=cache&&await cache.match(req);
  if(salvo&&tipoValido(req,salvo))return salvo;
  if(salvo&&cache)await cache.delete(req);
  try{const response=await fetch(req);if(!tipoValido(req,response))return new Response('Recurso indisponível.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});if(cache)await guardar(cache,req,response);return response;}
  catch{return new Response('Recurso indisponível. Verifique sua conexão.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});}
 })());
});
