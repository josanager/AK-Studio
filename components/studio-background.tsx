"use client";
import {useEffect,useRef} from 'react';
import {paintBackground,type StudioBackground} from '../lib/studio-background';
export function StudioBackgroundPreview({background,time}:{background:StudioBackground;time:number}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;const draw=()=>{const box=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(box.width*devicePixelRatio));canvas.height=Math.max(1,Math.round(box.height*devicePixelRatio));const ctx=canvas.getContext('2d');if(ctx)paintBackground(ctx,canvas.width,canvas.height,time,background)};const observer=new ResizeObserver(draw);observer.observe(canvas);draw();return()=>observer.disconnect()},[background,time]);
 return <canvas ref={ref} className="studio-background" aria-hidden="true"/>;
}
