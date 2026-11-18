import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DURATION, EASING_POINTS } from '@/engine/tokens';
export interface FilterItem { id:string; category:string; title:string; content?:ReactNode }
export function FilterGrid({items,categories,label='Resource library'}:{items:FilterItem[];categories:string[];label?:string}){
 const reduced=useReducedMotion();
 const [active,setActive]=useState<string[]>([]),id=useId();
 const visible=items.filter(item=>!active.length||active.includes(item.category));
 const region=useRef<HTMLElement>(null),focusedItem=useRef<string|null>(null);
 const visibleKeys=visible.map(item=>item.id).join('\0');
 useLayoutEffect(()=>{if(focusedItem.current&&!visible.some(item=>item.id===focusedItem.current)&&document.activeElement===document.body){region.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();focusedItem.current=null;}},[visibleKeys]);
 return <section ref={region} onFocusCapture={event=>{focusedItem.current=(event.target as HTMLElement).closest<HTMLElement>('[data-item]')?.dataset.item??null;}} data-testid="filter-shuffle-widget" className="w-full max-w-2xl text-ink">
  <h3 className="mb-1 text-lg font-semibold">{label}</h3><p id={id} className="mb-4 text-sm text-muted">Select one or more categories. Matching either category includes a resource.</p>
  <div role="group" aria-label="Filter resources" aria-describedby={id} className="flex flex-wrap gap-2">
   <Button variant={active.length?'secondary':'primary'} aria-pressed={!active.length} onClick={()=>setActive([])}>All</Button>
   {categories.map(category=><Button key={category} variant={active.includes(category)?'primary':'secondary'} aria-pressed={active.includes(category)} onClick={()=>setActive(previous=>previous.includes(category)?previous.filter(c=>c!==category):[...previous,category])}>{category}</Button>)}
  </div>
  <p role="status" className="my-4 text-sm text-muted">{visible.length?`${visible.length} resources`:'No resources match. Clear the filters with All.'}</p>
  <ul className="relative m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 p-0">
   <AnimatePresence initial={false} mode="popLayout">{visible.map(item=><motion.li layout={!reduced} key={item.id} data-item={item.id} initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:reduced?0:DURATION.exit/1000,ease:[...EASING_POINTS.in]}}} transition={{duration:reduced?0:DURATION.enter/1000,ease:[...EASING_POINTS.out]}} className="rounded-panel border border-line bg-surface p-4"><p className="mb-2 text-sm text-muted">{item.category}</p><h4 className="m-0 text-base font-medium">{item.title}</h4>{item.content}</motion.li>)}</AnimatePresence>
  </ul>
 </section>;
}
export function Playground(){return <FilterGrid categories={['Type','Layout','Motion','Audio']} items={[
 {id:'type',category:'Type',title:'Editorial scale'},{id:'grid',category:'Layout',title:'Responsive grid'},{id:'ease',category:'Motion',title:'Easing notebook'},
 {id:'pair',category:'Type',title:'Typeface pairings'},{id:'space',category:'Layout',title:'Spacing rhythm'},{id:'enter',category:'Motion',title:'Entrance studies'},
]}/>}
