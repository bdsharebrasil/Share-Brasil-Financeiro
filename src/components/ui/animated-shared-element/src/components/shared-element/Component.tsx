import { useEffect, useId, useRef, useSyncExternalStore, type MouseEvent } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { EASING_POINTS } from "@/engine/tokens";
import { Button } from "@/ui/Button";
const subscribe=(cb:()=>void)=>{window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb);};
const snapshot=()=>new URLSearchParams(window.location.search).get('note')==='field-notes';
/** Query routes retain the surrounding kit route and support reload, links and browser Back. */
export function SharedElementNotes(){
 const detail=useSyncExternalStore(subscribe,snapshot,()=>false);const reduced=useReducedMotion();const id=useId();const source=useRef<HTMLAnchorElement>(null);const heading=useRef<HTMLHeadingElement>(null);const previous=useRef(detail);const scroll=useRef(0);
 const route=(show:boolean,replace=false)=>{const url=new URL(window.location.href);if(show)url.searchParams.set('note','field-notes');else url.searchParams.delete('note');window.history[replace?'replaceState':'pushState']({...window.history.state,uimkNote:show},'',url);window.dispatchEvent(new PopStateEvent('popstate'));};
 const open=(e:MouseEvent<HTMLAnchorElement>)=>{if(e.button||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.preventDefault();scroll.current=window.scrollY;route(true);};
 useEffect(()=>{if(previous.current===detail)return;previous.current=detail;if(detail)heading.current?.focus({preventScroll:true});else{source.current?.focus({preventScroll:true});window.scrollTo(0,scroll.current);}},[detail]);
 const href=new URL(typeof window==='undefined'?'https://example.invalid/':window.location.href);href.searchParams.set('note','field-notes');
 return <LayoutGroup id={id}><div data-testid="shared-element-panel" className="min-h-64">
 {detail?<article><motion.div data-testid="shared-visual" layoutId={reduced?undefined:'note'} className="mb-4 h-32 w-full rounded-control bg-secondary" transition={{duration:reduced?0:.26,ease:[...EASING_POINTS.out]}} aria-hidden="true"><div className="h-full w-1/3 rounded-control bg-ink/20"/></motion.div><h3 ref={heading} tabIndex={-1} className="text-xl font-semibold">Field notes: coastal light</h3><p className="text-base">Soft light changes how we see familiar places. These notes collect observations from the morning walk.</p><Button data-testid="shared-element-back" variant="secondary" onClick={()=>{if(window.history.state?.uimkNote)window.history.back();else route(false,true);}}>Back to notes</Button></article>:
 <div><h3 className="text-lg font-semibold">Studio notebook</h3><a ref={source} data-testid="shared-element-trigger" href={href.pathname+href.search} onClick={open} className="flex min-h-20 items-center gap-4 rounded-control p-3 text-ink hover:bg-secondary"><motion.div data-testid="shared-visual" layoutId={reduced?undefined:'note'} className="h-16 w-16 shrink-0 rounded-control bg-secondary" transition={{duration:reduced?0:.18,ease:[...EASING_POINTS.in]}} aria-hidden="true"><div className="h-full w-1/3 rounded-control bg-ink/20"/></motion.div><span className="text-base font-medium">Field notes: coastal light</span></a><p className="text-sm text-muted">Open a note, then use Back to return to the list.</p></div>}
 </div></LayoutGroup>;
}
export function Playground(){return <div data-testid="shared-element-playground" className="w-full max-w-md space-y-4 text-ink"><p className="text-sm text-muted">A thumbnail stays connected to its detail page.</p><SharedElementNotes/></div>;}
