import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DURATION, EASING_POINTS } from '@/engine/tokens';

export interface PageResult<T> { items:T[]; nextPage:number|null }
export interface InfiniteListProps<T> {
 initialItems:T[]; initialPage?:number|null; label:string;
 loadPage(page:number,signal:AbortSignal):Promise<PageResult<T>>;
 getKey(item:T):string; renderItem(item:T):ReactNode;
 /** Stop automatic loading after this many pages so the footer remains reachable. */
 maxAutoPages?:number;
}
export function InfiniteList<T>({initialItems,initialPage=1,label,loadPage,getKey,renderItem,maxAutoPages=1}:InfiniteListProps<T>){
 const reduced=useReducedMotion(),batchStart=useRef(initialItems.length),currentItems=useRef(initialItems);
 const [items,setItems]=useState(initialItems),[next,setNext]=useState(initialPage);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),[message,setMessage]=useState(`${initialItems.length} items loaded.`);
 const request=useRef<AbortController|null>(null),sentinel=useRef<HTMLDivElement>(null),region=useRef<HTMLDivElement>(null),automatic=useRef(0);
 useEffect(()=>()=>request.current?.abort(),[]);
 const load=useCallback(async(auto=false)=>{
  if(next===null||request.current||auto&&automatic.current>=maxAutoPages)return;
  const controller=new AbortController();request.current=controller;
  if(auto)automatic.current++;
  setBusy(true);setError(false);setMessage('Loading more items.');
  try{
   const result=await loadPage(next,controller.signal);
   if(controller.signal.aborted)return;
   const previous=currentItems.current;batchStart.current=previous.length;const keys=new Set(previous.map(getKey));
   const added=result.items.filter(item=>{const key=getKey(item);if(keys.has(key))return false;keys.add(key);return true;});
   currentItems.current=[...previous,...added];setItems(currentItems.current);
   setNext(result.nextPage);setMessage(`${added.length} more items loaded.${result.nextPage===null?' End of results.':''}`);
  }catch{if(!controller.signal.aborted){setError(true);setMessage('Could not load more items. Try again.');}}
  finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted)setBusy(false);}}
 },[next,loadPage,getKey,maxAutoPages]);
 useEffect(()=>{
  if(error||busy||next===null||!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void load(true);},{root:region.current,threshold:1});
  if(sentinel.current)observer.observe(sentinel.current);
  return()=>observer.disconnect();
 },[load,error,busy,next]);
 return <section data-testid="infinite-scroll-widget" className="w-full max-w-xl text-ink">
  <h3 className="mb-1 text-lg font-semibold">{label}</h3><p className="mb-4 text-sm text-muted">Scroll for more, or use the button below.</p>
  <div ref={region} tabIndex={0} aria-label={label} className="max-h-64 overflow-y-auto rounded-panel border border-control-line p-3">
   <ul aria-busy={busy} className="m-0 list-none space-y-3 p-0">{items.map((item,index)=><motion.li key={getKey(item)} data-item initial={reduced||index<initialItems.length?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:DURATION.enter/1000,ease:[...EASING_POINTS.out],delay:reduced?0:Math.min(4,Math.max(0,index-batchStart.current))*.02}} className="border-b border-line pb-3">{renderItem(item)}</motion.li>)}</ul>
   <AnimatePresence>{busy?<motion.div aria-hidden="true" data-loader initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:DURATION.exit/1000}} className="py-3 text-sm text-muted">Loading more…</motion.div>:null}</AnimatePresence>
   <div ref={sentinel} aria-hidden="true" className="h-1"/>
  </div>
  <p role="status" className="my-3 min-h-6 text-sm text-muted">{message}</p>
  <Button variant="secondary" aria-disabled={busy||next===null} onClick={()=>{if(!busy&&next!==null)void load()}}>{busy?'Loading…':next===null?'All items loaded':error?'Retry loading':'Load more'}</Button>
 </section>;
}
type Note={id:string;title:string;summary:string};
const notes:Note[]=['Exploring type','Spacing study','Grid sketches','Editorial details','Form anatomy','Image rhythm','Motion notes','Focus states','Navigation study'].map((title,i)=>({id:String(i),title,summary:['Composition journal','Interface field notes','Design practice'][i%3]!}));
const keyOf=(note:Note)=>note.id;
export function Playground(){
 const fail=useRef(false);
 const load=useCallback(async(page:number,signal:AbortSignal):Promise<PageResult<Note>>=>{
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},500);function abort(){clearTimeout(timer);reject(new Error('cancelled'))}signal.addEventListener('abort',abort,{once:true});});
  if(fail.current){fail.current=false;throw new Error('Demo failure');}
  return {items:notes.slice(page*3,(page+1)*3),nextPage:page>=2?null:page+1};
 },[]);
 return <div className="w-full"><InfiniteList initialItems={notes.slice(0,3)} loadPage={load} getKey={keyOf} label="Design journal" renderItem={item=><><h4 className="m-0 text-base font-medium">{item.title}</h4><p className="m-0 text-sm text-muted">{item.summary}</p></>}/><Button variant="ghost" className="mt-3" onClick={()=>{fail.current=true}}>Preview a loading error</Button></div>;
}
