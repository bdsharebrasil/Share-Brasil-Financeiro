import { DURATION } from '@/engine/tokens';
import { target } from '@/engine/geometry';
import { timeline as script } from '@/engine/timeline';
import { DASHBOARD, Bar, Block, Button, type SceneProps } from '@/wireframe';
export const HEADER={x:392,y:158,w:124,h:28};
export const DETAILS={x:488,y:204,w:28,h:28};
const REST={x:290,y:128};
const b=script({cursor:REST,tracks:{sort:0,detail:0,press:0,expand:0}}).wait(1000).moveTo(target(HEADER),500,{curve:.22}).press({key:'press',anchor:'sortable-table-sort'});
b.tween('sort',1,DURATION.enter,{at:b.lastClick}).wait(220).moveTo(target(DETAILS),380,{curve:-.18}).press({key:'expand',anchor:'sortable-table-details'});
b.tween('detail',1,DURATION.enter,{at:b.lastClick}).wait(700).mark('expanded').press({key:'expand',anchor:'sortable-table-details'});
b.tween('detail',0,DURATION.exit,{at:b.lastClick,ease:'in'}).wait(200).tween('sort',0,DURATION.enter,{advance:true}).moveTo(REST,650,{curve:-.12});
export const timeline=b.build();
export const poster=timeline.marks.expanded!;
export default function Scene({frame}:SceneProps){
 const {sort=0,detail=0,press=0,expand=0}=frame.v;
 const order=[2,0,1];
 return <><DASHBOARD.Page/><Block {...DASHBOARD.targets.chart} tone="surface" r={12}>
  <Bar x={16} y={14} w={96} h={8} tone="strong"/>
  <Button x={240} y={6} w={124} h={28} variant="secondary" press={press} anchor="sortable-table-sort"><Bar x={12} y={11} w={64} h={6} tone="strong"/><div style={{position:'absolute',right:12,top:6,color:'var(--mk-wire-strong)',transform:`rotate(${180*sort}deg)`}}><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12m-4-4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></div></Button>
  {[0,1,2].map((id)=><Block key={id} x={12} y={44+id*36+(order[id]!-id)*36*sort+(id===1?0:28*detail)} w={356} h={34} r={6} tone={id===1?'panel':'surface'}>
   <Bar x={12} y={12} w={[110,72,92][id]} h={8} tone={id===1?'strong':'title'}/><Bar x={220} y={13} w={40+id*12} h={6}/>
   {id===1?<Button x={324} y={8} w={28} h={28} variant="secondary" press={expand} anchor="sortable-table-details"><Bar x={9} y={13} w={10} h={2} tone="strong"/></Button>:null}
   {id===1&&detail>0?<Block x={4} y={34} w={348} h={26} r={4} style={{opacity:detail}}><Bar x={8} y={10} w={192} h={6}/></Block>:null}
  </Block>)}
 </Block></>;
}
