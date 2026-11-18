import { DURATION } from '@/engine/tokens';
import { target } from '@/engine/geometry';
import { timeline as script } from '@/engine/timeline';
import { LANDING, Bar, Block, Button, type SceneProps } from '@/wireframe';
export const THUMB={x:300,y:62,w:232,h:150};
export const NEXT={x:474,y:158,w:32,h:32};
export const CLOSE={x:474,y:36,w:32,h:28};
const REST={x:226,y:300};
const b=script({cursor:REST,tracks:{open:0,peer:0,press:0,next:0,close:0}}).wait(1000).moveTo(target(THUMB),500,{curve:-.3}).press({key:'press',anchor:'image-lightbox-open'});
b.tween('open',1,DURATION.enter,{at:b.lastClick}).wait(200).moveTo(target(NEXT),380,{curve:.18}).press({key:'next',anchor:'image-lightbox-next'});
b.tween('peer',1,DURATION.enter,{at:b.lastClick}).wait(600).mark('viewing').moveTo(target(CLOSE),300,{curve:-.2}).press({key:'close',anchor:'image-lightbox-close'});
b.tween('open',0,DURATION.exit,{at:b.lastClick,ease:'in'}).wait(200).set('peer',0).moveTo(REST,650,{curve:.24});
export const timeline=b.build();
export const poster=timeline.marks.viewing!;
function Picture({peer=0}:{peer?:number}){return <svg width="100%" height="100%" viewBox="0 0 232 150" preserveAspectRatio="xMidYMid slice"><rect width="232" height="150" fill="var(--mk-panel)"/><circle cx={170-90*peer} cy="38" r="18" fill="var(--mk-wire-title)"/><path d={peer>.5?'M0 150V90L90 46L160 112L205 74L232 96V150Z':'M0 150V110L64 58L114 108L164 76L232 120V150Z'} fill="var(--mk-wire)"/><path d="M0 150L96 104L160 132L232 116V150Z" fill="var(--mk-wire-strong)"/></svg>}
export default function Scene({frame}:SceneProps){const {open=0,peer=0,press=0,next=0,close=0}=frame.v;return <><LANDING.Page/><Block {...THUMB} tone="panel" r={12} style={{overflow:'hidden'}}><div data-anchor="image-lightbox-open" style={{width:'100%',height:'100%',transform:`scale(${1-.02*press})`}}><Picture/></div></Block>{open>0?<><Block x={0} y={0} w={560} h={344} r={0} tone="panel" style={{opacity:.96*open}}/><Block x={300-240*open} y={62-10*open} w={232+208*open} h={150+114*open} r={12} style={{overflow:'hidden'}}><Picture peer={peer}/></Block><Button {...CLOSE} variant="secondary" press={close} anchor="image-lightbox-close" style={{opacity:open}}><Bar x={10} y={13} w={12} h={2} tone="strong"/></Button><Button {...NEXT} variant="secondary" press={next} anchor="image-lightbox-next" style={{opacity:open}}><Bar x={12} y={15} w={8} h={2} tone="strong"/></Button></>:null}</>}
