import {useEffect,useId,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {DURATION,EASING_POINTS} from '@/engine/tokens';
import {Button} from '@/ui/Button';
export type UploadFile=(file:File,context:{signal:AbortSignal;onProgress:(percent:number)=>void})=>Promise<void>;
type Entry={id:string;file:File;progress:number;status:'uploading'|'complete'|'error'};
export interface FileDropzoneProps {upload:UploadFile;maxFiles?:number;maxBytes?:number;accept?:readonly string[];}
const DEFAULT_TYPES=['image/png','image/jpeg','application/pdf'];
/** Transport is injected. Client checks improve feedback; the server must validate files again. */
export function FileDropzone({upload,maxFiles=3,maxBytes=5*1024*1024,accept=DEFAULT_TYPES}:FileDropzoneProps){
 const id=useId();const reduced=useReducedMotion();const input=useRef<HTMLInputElement>(null);const browse=useRef<HTMLButtonElement>(null);
 const controllers=useRef(new Map<string,AbortController>());const counter=useRef(0);const depth=useRef(0);
 const entriesRef=useRef<Entry[]>([]);const [entries,setEntries]=useState<Entry[]>([]);const [dragging,setDragging]=useState(false);const [message,setMessage]=useState('No files attached.');const [validation,setValidation]=useState('');
 const update=(f:(entries:Entry[])=>Entry[])=>{entriesRef.current=f(entriesRef.current);setEntries(entriesRef.current);};
 useEffect(()=>()=>{for(const controller of controllers.current.values())controller.abort();},[]);
 const start=(entry:Entry)=>{
  const controller=new AbortController();controllers.current.set(entry.id,controller);
  update(es=>es.map(e=>e.id===entry.id?{...e,status:'uploading',progress:0}:e));
  Promise.resolve().then(()=>upload(entry.file,{signal:controller.signal,onProgress:percent=>{
   if(!controller.signal.aborted)update(es=>es.map(e=>e.id===entry.id?{...e,progress:Math.max(0,Math.min(100,percent))}:e));
  }})).then(()=>{if(!controller.signal.aborted){update(es=>es.map(e=>e.id===entry.id?{...e,status:'complete',progress:100}:e));setMessage(`${entry.file.name} is ready.`);}})
   .catch(()=>{if(!controller.signal.aborted){update(es=>es.map(e=>e.id===entry.id?{...e,status:'error'}:e));setMessage(`Could not process ${entry.file.name}. Retry or remove it.`);}})
   .finally(()=>{if(controllers.current.get(entry.id)===controller)controllers.current.delete(entry.id);});
 };
 const add=(files:File[])=>{
  const errors:string[]=[];const added:Entry[]=[];
  for(const file of files){
   if(!accept.includes(file.type)){errors.push(`${file.name}: file type is not allowed.`);continue;}
   if(file.size>maxBytes){errors.push(`${file.name}: exceeds ${Math.round(maxBytes/1024/1024)} MB.`);continue;}
   if(entriesRef.current.length+added.length>=maxFiles){errors.push(`Only ${maxFiles} files can be attached.`);continue;}
   if([...entriesRef.current,...added].some(e=>e.file.name===file.name&&e.file.size===file.size&&e.file.lastModified===file.lastModified)){errors.push(`${file.name} is already attached.`);continue;}
   added.push({id:`${id}-${++counter.current}`,file,progress:0,status:'uploading'});
  }
  update(es=>[...es,...added]);for(const entry of added)start(entry);
  setValidation(errors.join(' '));setMessage(`${added.length} file${added.length===1?'':'s'} added.`);
 };
 const remove=(entry:Entry)=>{
  controllers.current.get(entry.id)?.abort();controllers.current.delete(entry.id);
  update(es=>es.filter(e=>e.id!==entry.id));setMessage(`Removed ${entry.file.name}.`);browse.current?.focus();
 };
 return <div className="w-full max-w-lg" data-testid="dropzone-upload-widget">
  <motion.div role="region" aria-label="File upload" aria-describedby={`${id}-limits`} data-testid="dropzone-upload-zone"
   onDragEnter={event=>{event.preventDefault();if(event.dataTransfer.types.includes('Files')){depth.current++;setDragging(true);}}}
   onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';}}
   onDragLeave={event=>{event.preventDefault();depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);}}
   onDrop={event=>{event.preventDefault();depth.current=0;setDragging(false);add(Array.from(event.dataTransfer.files));}}
   animate={{scale:reduced?1:dragging?1.01:1}} transition={{duration:reduced?0:DURATION.enter/1000,ease:[...EASING_POINTS.out]}}
   className={`rounded-overlay border-2 border-dashed border-control-line p-5 text-center text-ink ${dragging?'bg-secondary':'bg-surface'}`}>
    <p className="m-0 text-base font-medium">{dragging?'Drop files here':'Drag files here or browse'}</p>
    <p id={`${id}-limits`} className="mt-2 text-sm text-muted">{accept.map(t=>t.split('/')[1]?.toUpperCase()).join(', ')} · Up to {Math.round(maxBytes/1024/1024)} MB each · {maxFiles} files</p>
    <input ref={input} type="file" multiple accept={accept.join(',')} className="hidden" aria-label="Choose files" onChange={event=>{add(Array.from(event.target.files??[]));event.target.value='';}}/>
    <Button ref={browse} data-testid="dropzone-upload-trigger" variant="secondary" onClick={()=>input.current?.click()}>Browse files</Button>
  </motion.div>
  <ul className="m-0 mt-3 grid list-none gap-2 p-0" aria-label="Attached files">
   <AnimatePresence initial={false}>{entries.map(entry=><motion.li key={entry.id} data-testid="dropzone-upload-row" className="min-w-0 rounded-control border border-control-line bg-surface p-3 text-ink" initial={{opacity:reduced?1:0,y:reduced?0:6}} animate={{opacity:1,y:0}} exit={{opacity:reduced?1:0,y:reduced?0:-6,transition:{duration:reduced?0:DURATION.exit/1000,ease:[...EASING_POINTS.in]}}} transition={{duration:reduced?0:DURATION.enter/1000}}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 flex-1 break-all text-sm font-medium">{entry.file.name}</span>
     <Button variant="ghost" aria-label={`Remove ${entry.file.name}`} onClick={()=>remove(entry)}>Remove</Button></div>
    {entry.status==='uploading'?<progress max={100} value={entry.progress} aria-label={`Progress for ${entry.file.name}`} className="h-2 w-full accent-[var(--mk-accent)]"/>:<p className="m-0 text-sm text-muted">{entry.status==='complete'?'✓ Ready':'Could not process this file.'}</p>}
    {entry.status==='error'&&<Button variant="secondary" onClick={()=>start(entry)} aria-label={`Retry ${entry.file.name}`}>Retry</Button>}
   </motion.li>)}</AnimatePresence>
  </ul>
  {validation&&<p role="alert" className="mt-3 break-words text-sm text-ink">{validation}</p>}
  <p role="status" data-testid="dropzone-upload-result" className="mt-3 min-h-6 break-words text-sm text-muted">{message}</p>
 </div>;
}
/** Playground reads the actual file stream locally; it never pretends a network upload succeeded. */
const readLocalFile:UploadFile=async(file,{signal,onProgress})=>{
 const reader=file.stream().getReader();let read=0;
 const abort=()=>{void reader.cancel();};signal.addEventListener('abort',abort,{once:true});
 try{while(true){if(signal.aborted)throw new DOMException('Aborted','AbortError');const chunk=await reader.read();if(chunk.done)break;read+=chunk.value.byteLength;onProgress(file.size?read/file.size*100:100);}}
 finally{signal.removeEventListener('abort',abort);reader.releaseLock();}
};
export function Playground(){return <div className="w-full max-w-lg"><FileDropzone upload={readLocalFile}/><p className="text-sm text-muted">Files stay in this demo. Nothing is sent to a server.</p></div>;}
