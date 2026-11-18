import { useId, useRef, useState } from 'react';
import { DialogRoot, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogDescription, DialogClose } from '@/primitives/dialog';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { DURATION, EASING_POINTS } from '@/engine/tokens';
import { Button } from '@/ui/Button';
export interface LightboxImage {id:string;src:string;alt:string;caption:string}
export function ImageLightbox({images,label='Landscape studies'}:{images:LightboxImage[];label?:string}){
 const [selected,setSelected]=useState<number|null>(null),origin=useRef<HTMLButtonElement|null>(null),close=useRef<HTMLButtonElement|null>(null),id=useId();
 const reduced=useReducedMotion(),source=useRef(0);
 const transition={duration:reduced?0:DURATION.enter/1000,ease:[...EASING_POINTS.out] as [number,number,number,number]};
 const current=images[selected??0];
 const change=(delta:number)=>setSelected(previous=>previous===null?null:(previous+delta+images.length)%images.length);
 return <LayoutGroup id={id}><section data-testid="image-lightbox-widget" className="w-full max-w-2xl text-ink"><h3 className="mb-1 text-lg font-semibold">{label}</h3><p className="mb-4 text-sm text-muted">Open an image to inspect it. Use the arrows to explore.</p>
  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3">{images.map((image,i)=><button type="button" key={image.id} aria-label={`Open ${image.caption}`} onClick={event=>{origin.current=event.currentTarget;source.current=i;setSelected(i)}} className="overflow-hidden rounded-panel border border-control-line bg-surface text-left"><motion.div layoutId={reduced?undefined:`image-${i}`} transition={transition}><img src={image.src} alt={image.alt} className="aspect-[3/2] w-full object-cover"/></motion.div><span className="block p-3 text-sm font-medium">{image.caption}</span></button>)}</div>
  {!images.length?<p>No images to view.</p>:null}
  <DialogRoot open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null)}}>
   <AnimatePresence>{selected!==null&&current?<DialogPortal keepMounted><DialogBackdrop render={<motion.div initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:0}} transition={transition} className="fixed inset-0 z-50 bg-[var(--mk-scrim)]"/>}/>
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4"><DialogPopup render={<motion.div layoutRoot initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:reduced?0:DURATION.exit/1000}}} transition={transition}/>} aria-modal="true" initialFocus={close} finalFocus={origin} aria-describedby={id} className="pointer-events-auto max-h-[calc(100dvh-32px)] w-full max-w-3xl overflow-y-auto rounded-overlay bg-surface p-4 text-ink shadow-[var(--mk-shadow-overlay)]" onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();change(event.key==='ArrowLeft'?-1:1)}}}>
     <div className="mb-3 flex items-center justify-between gap-3"><DialogTitle className="text-lg font-semibold">{label}</DialogTitle><DialogClose render={<Button ref={close} variant="secondary">Close viewer</Button>}/></div>
     <motion.div data-lightbox-image layoutId={reduced?undefined:`image-${source.current}`} transition={transition}><AnimatePresence initial={false} mode="wait"><motion.img key={current.id} initial={{opacity:reduced?1:0}} animate={{opacity:1}} exit={{opacity:0}} transition={transition} src={current.src} alt={current.alt} className="max-h-[55dvh] w-full rounded-control object-contain"/></AnimatePresence></motion.div>
     <DialogDescription id={id} className="my-3 text-sm text-muted">{current.caption}</DialogDescription>
     <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="secondary" aria-label="Previous image" onClick={()=>change(-1)}>Previous</Button><p role="status" className="text-sm text-muted">{selected+1} of {images.length}</p><Button variant="secondary" aria-label="Next image" onClick={()=>change(1)}>Next</Button></div>
    </DialogPopup></div></DialogPortal>:null}</AnimatePresence>
  </DialogRoot>
 </section></LayoutGroup>;
}
// Original, code-native grayscale illustrations: no external media, stock or restricted source.
function artwork(i:number){return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#eeeeee"/><circle cx="${[450,140,330][i]}" cy="95" r="48" fill="#cccccc"/><path d="${['M0 400V270L150 130L300 290L440 170L600 310V400Z','M0 400V300L200 110L410 310L520 180L600 250V400Z','M0 400V290L80 210L250 310L410 120L600 300V400Z'][i]}" fill="#aaaaaa"/><path d="M0 400V350L200 280L410 350L600 290V400Z" fill="#777777"/></svg>`)}`}
export function Playground(){return <ImageLightbox images={['Ridge at dawn','Valley light','Distant peaks'].map((caption,i)=>({id:String(i),caption,src:artwork(i),alt:['Layered mountain ridges with a pale sun at the upper right.','A steep valley below a pale sun at the upper left.','Distant angular peaks with a pale sun near the center.'][i]!}))}/>}
