export type StudioBackground={color:string;pattern:"none"|"dots"|"lines"|"grid";motion:boolean};
export const defaultBackground:StudioBackground={color:"#090909",pattern:"none",motion:true};
/** Same deterministic renderer for preview and exported frames. */
export function paintBackground(ctx:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,width:number,height:number,time:number,background:StudioBackground=defaultBackground){
  ctx.save();ctx.fillStyle=background.color;ctx.fillRect(0,0,width,height);
  if(background.pattern!=="none"){
    const unit=width/24,offset=background.motion?(time*unit*.3)%unit:0;
    const rgb=Number.parseInt(background.color.slice(1),16),light=((rgb>>16)*.2126+((rgb>>8)&255)*.7152+(rgb&255)*.0722)>140;
    const ink=light?'0,0,0':'255,255,255';
    ctx.strokeStyle=`rgba(${ink},.13)`;ctx.fillStyle=`rgba(${ink},.18)`;ctx.lineWidth=Math.max(.5,width/1200);
    for(let x=-unit+offset;x<width+unit;x+=unit){
      if(background.pattern==="dots")for(let y=-unit+offset;y<height+unit;y+=unit){ctx.beginPath();ctx.arc(x,y,width/650,0,Math.PI*2);ctx.fill()}
      else {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
    }
    if(background.pattern==="grid")for(let y=-unit+offset;y<height+unit;y+=unit){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
  }
  ctx.restore();
}
