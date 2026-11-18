import { useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { DURATION, EASING_POINTS } from '@/engine/tokens';
import { Table, TableHeader, Column, TableBody, Row, Cell, type SortDescriptor } from '@/primitives/react-aria';
import { Button } from '@/ui/Button';
import './table.css';
export interface TableRecord {id:string;name:string;size:number;details:string}
export function SortableTable({records,label='Project files'}:{records:TableRecord[];label?:string}){
 const [sort,setSort]=useState<SortDescriptor>({column:'name',direction:'ascending'}),[expanded,setExpanded]=useState<string[]>([]),id=useId();
 const rows=[...records].sort((a,b)=>{const comparison=sort.column==='size'?a.size-b.size:a.name.localeCompare(b.name);return sort.direction==='ascending'?comparison:-comparison});
 const reduced=useReducedMotion(),nodes=useRef(new Map<string,HTMLElement>()),positions=useRef(new Map<string,number>()),region=useRef<HTMLDivElement>(null);
 // FLIP the actual semantic rows; wrapping collection children would break React Aria's collection.
 useLayoutEffect(()=>{
  const controls=new Set<ReturnType<typeof animate>>();
  const measure=()=>{
   for(const [key,node] of nodes.current){const before=positions.current.get(key),after=node.offsetTop;
    if(reduced)node.style.transform='';
    else if(before!==undefined&&before!==after){const control=animate(node,{y:[before-after,0]},{duration:DURATION.enter/1000,ease:[...EASING_POINTS.out]});controls.add(control);void control.then(()=>controls.delete(control));}
    positions.current.set(key,after);
   }
  };
  // React Aria commits its cached collection after the parent's layout effect.
  // Observe that commit, not the outer sort-state render, to measure actual row positions.
  const observer=new MutationObserver(measure);
  if(region.current)observer.observe(region.current,{childList:true,subtree:true});
  measure();
  return()=>{observer.disconnect();controls.forEach(control=>control.stop());};
 },[reduced]);
 return <section data-testid="sortable-table-widget" className="w-full max-w-2xl text-ink"><h3 className="mb-1 text-lg font-semibold">{label}</h3><p className="mb-4 text-sm text-muted">Sort by name or size. Open a row for its details.</p>
  <div ref={region} className="st-scroll"><Table aria-label={label} sortDescriptor={sort} onSortChange={setSort} className="st-table">
   <TableHeader><Column id="name" isRowHeader allowsSorting>Name {sort.column==='name'?<motion.span aria-hidden="true" style={{display:'inline-block'}} animate={{rotate:sort.direction==='ascending'?0:180}} transition={{duration:reduced?0:DURATION.exit/1000,ease:[...EASING_POINTS.in]}}>↑</motion.span>:null}</Column><Column id="size" allowsSorting>Size {sort.column==='size'?<motion.span aria-hidden="true" style={{display:'inline-block'}} animate={{rotate:sort.direction==='ascending'?0:180}} transition={{duration:reduced?0:DURATION.exit/1000,ease:[...EASING_POINTS.in]}}>↑</motion.span>:null}</Column><Column id="details">Details</Column></TableHeader>
   <TableBody dependencies={[expanded,reduced]} items={rows} renderEmptyState={()=>'No files yet.'}>{item=><Row id={item.id} textValue={item.name} ref={node=>{if(node)nodes.current.set(item.id,node);else nodes.current.delete(item.id)}}><Cell>{item.name}</Cell><Cell>{item.size} KB</Cell><Cell>
    <Button variant="ghost" aria-label={`Details for ${item.name}`} aria-expanded={expanded.includes(item.id)} aria-controls={`${id}-${item.id}`} onClick={()=>setExpanded(prev=>prev.includes(item.id)?prev.filter(x=>x!==item.id):[...prev,item.id])}>{expanded.includes(item.id)?'Hide':'Show'}</Button>
    <div id={`${id}-${item.id}`}><AnimatePresence initial={false}>{expanded.includes(item.id)?<motion.div initial={reduced?false:{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,transition:{duration:reduced?0:DURATION.exit/1000}}} transition={{duration:reduced?0:DURATION.enter/1000,ease:[...EASING_POINTS.out]}} className="st-detail">{item.details}</motion.div>:null}</AnimatePresence></div>
   </Cell></Row>}</TableBody>
  </Table></div><p role="status" className="mt-3 text-sm text-muted">Sorted by {sort.column==='name'?'name':'size'}, {sort.direction}.</p>
 </section>;
}
export function Playground(){return <SortableTable records={[
 {id:'atlas',name:'Atlas',size:84,details:'Responsive layout exploration.'},{id:'folio',name:'Folio',size:32,details:'Editorial typography studies.'},{id:'index',name:'Index',size:156,details:'Navigation and wayfinding notes.'},
]}/>}
