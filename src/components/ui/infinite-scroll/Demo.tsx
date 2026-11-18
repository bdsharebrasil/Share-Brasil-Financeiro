import { DURATION } from '@/engine/tokens';
import { timeline as script } from '@/engine/timeline';
import { FEED, Avatar, Bar, Block, type SceneProps } from '@/wireframe';
const REST={x:470,y:250};
const b=script({cursor:REST,tracks:{scroll:0,load:0,append:0}}).wait(1000).moveTo({x:490,y:318},500,{curve:-.24});
b.tween('scroll',1,400,{advance:true}).tween('load',1,DURATION.fast,{at:1780}).wait(500).tween('load',0,DURATION.exit).tween('append',1,DURATION.enter,{advance:true}).mark('loaded').wait(1000).tween('scroll',0,DURATION.slow,{advance:true}).tween('append',0,DURATION.exit,{advance:true}).moveTo(REST,600,{curve:.2});
export const timeline=b.build();
export const poster=timeline.marks.loaded!;
export default function Scene({frame}:SceneProps) {
 const {scroll=0,load=0,append=0}=frame.v;
 return <><FEED.Page/><Block x={28} y={98} w={504} h={232} r={10} tone="surface">
  <div style={{position:'absolute',inset:0,overflow:'hidden'}}>
   <div style={{transform:`translateY(${-92*scroll}px)`}}>{Array.from({length:7},(_,i)=><div key={i} style={{position:'absolute',top:i*46,width:490,height:46,opacity:i<5?1:append,transform:i<5?undefined:`translateY(${6*(1-append)}px)`}}>
    <Avatar x={10} y={9} size={28} tone={i>=5?'strong':'title'}/><Bar x={50} y={12} w={72+i%3*24} h={8} tone="title"/><Bar x={50} y={27} w={210+i%2*44} h={6}/><Bar x={50} y={45} w={430} h={1}/>
   </div>)}</div>
   <Block x={0} y={202} w={504} h={30} r={0} tone="surface" style={{opacity:load}}><Bar x={204} y={12} w={72} h={6} tone="strong"/></Block>
  </div>
  <Bar x={498} y={6+80*scroll} w={3} h={80} tone="strong"/>
 </Block></>;
}
