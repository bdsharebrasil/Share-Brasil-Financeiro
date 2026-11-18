import { DURATION } from '@/engine/tokens';
import { target } from '@/engine/geometry';
import { timeline as script } from '@/engine/timeline';
import { SETTINGS, Bar, Block, Button, type SceneProps } from '@/wireframe';
export const CHIP={x:168,y:108,w:92,h:28};
export const ALL={x:28,y:108,w:60,h:28};
const REST={x:458,y:298};
const b=script({cursor:REST,tracks:{filter:0,press:0,reset:0}}).wait(1000).moveTo(target(CHIP),620,{curve:-.2}).press({key:'press',anchor:'filter-shuffle-chip'});
b.tween('filter',1,DURATION.enter,{at:b.lastClick}).wait(1500).mark('filtered').moveTo(target(ALL),300,{curve:.28}).press({key:'reset',anchor:'filter-shuffle-all'});
b.tween('filter',0,DURATION.enter,{at:b.lastClick}).wait(100).moveTo(REST,650,{curve:-.16});
export const timeline=b.build();
export const poster=timeline.marks.filtered!;
export default function Scene({frame}:SceneProps){const {filter=0,press=0,reset=0}=frame.v;return <><SETTINGS.Page/><Block x={28} y={100} w={504} h={232} r={0} tone="surface"/>{[28,96,168].map((x,i)=><Button key={x} x={x} y={108} w={i===2?92:60} h={28} variant="secondary" press={i===2?press:reset} anchor={i===2?'filter-shuffle-chip':i===0?'filter-shuffle-all':undefined}><Bar x={12} y={11} w={i===2?60:36} h={6} tone={(filter>.5?i===2:i===0)?'strong':'base'}/></Button>)}{[0,1,2,3,4,5].map((id)=>{const kept=id%2===0;const dest=Math.floor(id/2);return <Block key={id} x={28+(id%3)*172+(kept?(dest-id%3)*172*filter:0)} y={152+Math.floor(id/3)*88*(1-(kept?filter:0))} w={160} h={76} r={10} style={{opacity:kept?1:1-filter}}><Block x={12} y={12} w={32+id*3} h={24} tone={kept?'title':'base'} r={6}/><Bar x={12} y={48} w={70+id*8} h={8} tone="title"/><Bar x={12} y={62} w={56} h={5}/></Block>})}</>}
