"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,Mic2,Volume2,VolumeX,Trash2} from 'lucide-react';
import {availableLane, type AudioClip,type AudioLane} from '../lib/audio-timeline';
import {computeAudioPeaks} from '../lib/audio-peaks';

export function useAudioTimeline(backing:string|null,vocal:string|null,backingMuted:boolean,vocalMuted:boolean){
 const [clips,setClips]=useState<AudioClip[]>([]),[lanes,setLanes]=useState<AudioLane[]>([{id:'backing',name:'Audio 1',muted:false}]);
 const owned=useRef(new Set<string>());
 const [addedClip,setAddedClip]=useState<string|null>(null);
 useEffect(()=>()=>{owned.current.forEach(u=>URL.revokeObjectURL(u))},[]);
 useEffect(()=>{let cancelled=false;setClips(c=>c.filter(x=>x.kind!=='backing'));if(backing)void computeAudioPeaks(backing,500).then(r=>{if(!cancelled){setLanes(ls=>ls.some(l=>l.id==='backing')?ls:[...ls,{id:'backing',name:'Backing',muted:backingMuted}]);setClips(c=>[...c,{id:'backing',source:backing,name:'Backing / full mix',start:0,duration:r.duration,lane:'backing',kind:'backing',peaks:r.peaks}])}});return()=>{cancelled=true}},[backing]);
 useEffect(()=>{let cancelled=false;setClips(c=>c.filter(x=>x.kind!=='vocal'));if(vocal)void computeAudioPeaks(vocal,500).then(r=>{if(!cancelled){setLanes(ls=>ls.some(l=>l.id==='vocal')?ls:[...ls,{id:'vocal',name:'Lead vocal',muted:vocalMuted}]);setClips(c=>[...c,{id:'vocal',source:vocal,name:'Lead vocal',start:0,duration:r.duration,lane:'vocal',kind:'vocal',peaks:r.peaks}])}});return()=>{cancelled=true}},[vocal]);
 async function add(blob:Blob,start:number){const source=URL.createObjectURL(blob);owned.current.add(source);try{const r=await computeAudioPeaks(source,500);const id=crypto.randomUUID();let lane=availableLane(clips,lanes,start,r.duration);if(!lane){lane=crypto.randomUUID();setLanes(ls=>[...ls,{id:lane!,name:`Audio ${ls.length+1}`,muted:false}])}setClips(c=>[...c,{id,source,name:`Recording ${c.filter(x=>x.kind==='recording').length+1}`,start,duration:r.duration,lane:lane!,kind:'recording',peaks:r.peaks}]);setAddedClip(id)}catch(e){URL.revokeObjectURL(source);owned.current.delete(source);throw e}}
 useEffect(()=>{setLanes(ls=>ls.map(l=>l.id==='backing'?{...l,muted:backingMuted}:l))},[backingMuted]);
 useEffect(()=>{setLanes(ls=>ls.map(l=>l.id==='vocal'?{...l,muted:vocalMuted}:l))},[vocalMuted,vocal]);
 const playback=useMemo(()=>clips.map(c=>({...c,muted:Boolean(lanes.find(l=>l.id===c.lane)?.muted)})),[clips,lanes]);
 const audible=playback.filter(c=>!c.muted);
 return {clips,setClips,lanes,setLanes,add,audible,playback,addedClip,end:clips.reduce((m,c)=>Math.max(m,c.start+c.duration),0)};
}

export function AudioPlayback({clips,time,playing,muted,onTime,onEnded,onError}:{clips:(AudioClip&{muted:boolean})[];time:number;playing:boolean;muted:boolean;onTime:(s:number)=>void;onEnded:()=>void;onError:(message:string)=>void}){
 const elements=useRef(new Map<string,HTMLAudioElement>()),clock=useRef(time),playingRef=useRef(false);
 const pendingPlay=useRef(new Set<string>());
 const end=clips.reduce((m,c)=>Math.max(m,c.start+c.duration),0);
 useEffect(()=>{if(Math.abs(time-clock.current)>.15||!playingRef.current)clock.current=time},[time]);
 useEffect(()=>{playingRef.current=playing;let frame=0,last=performance.now();function tick(now:number){if(playing)clock.current+=(now-last)/1000;last=now;const t=clock.current;for(const c of clips){const a=elements.current.get(c.id);if(!a)continue;const active=playing&&t>=c.start&&t<c.start+c.duration;a.muted=muted||c.muted;if(active){const local=t-c.start;if(a.readyState>=1&&!a.seeking&&Math.abs(a.currentTime-local)>.35)a.currentTime=local;if(a.paused&&!pendingPlay.current.has(c.id)){pendingPlay.current.add(c.id);void a.play().catch(e=>{if(e.name!=='AbortError'&&playingRef.current)onError(e.message||'Audio playback failed.')}).finally(()=>pendingPlay.current.delete(c.id))}}else{a.pause();if(a.readyState>=1&&!a.seeking&&t>=c.start&&t<c.start+c.duration&&Math.abs(a.currentTime-(t-c.start))>.35)a.currentTime=t-c.start}}if(playing){onTime(t);if(t>=end){onEnded();return}}frame=requestAnimationFrame(tick)}frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);elements.current.forEach(a=>a.pause())}},[clips,playing,muted,end]);
 return <>{clips.map(c=><audio hidden key={c.id} src={c.source} preload="auto" playsInline ref={el=>{if(el)elements.current.set(c.id,el);else elements.current.delete(c.id)}}/>)}</>;
}

export function AudioLaneHeads({lanes,setLanes,locked}:{lanes:AudioLane[];setLanes:React.Dispatch<React.SetStateAction<AudioLane[]>>;locked:boolean}){
 function reorder(i:number,d:number){setLanes(ls=>{const next=[...ls];[next[i],next[i+d]]=[next[i+d]!,next[i]!];return next})}
 return <>{lanes.map((l,i)=><div key={l.id} className="audio-lane-head" draggable={!locked} onDragStart={e=>e.dataTransfer.setData('application/ak-lane',l.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/ak-lane');setLanes(ls=>{const source=ls.find(x=>x.id===id);if(!source)return ls;const next=ls.filter(x=>x.id!==id);next.splice(i,0,source);return next})}}><Mic2/><span>{l.name}</span><button disabled={locked||i===0} aria-label={`Move ${l.name} up`} onClick={()=>reorder(i,-1)}><ArrowUp/></button><button disabled={locked||i===lanes.length-1} aria-label={`Move ${l.name} down`} onClick={()=>reorder(i,1)}><ArrowDown/></button><button aria-label={`${l.muted?'Unmute':'Mute'} ${l.name}`} onClick={()=>setLanes(ls=>ls.map(x=>x.id===l.id?{...x,muted:!x.muted}:x))}>{l.muted?<VolumeX/>:<Volume2/>}</button></div>)}</>;
}

export function AudioLaneClips({clips,setClips,lanes,duration,snap,locked,onContextMenu}:{clips:AudioClip[];setClips:React.Dispatch<React.SetStateAction<AudioClip[]>>;lanes:AudioLane[];duration:number;snap:number|null;locked:boolean;onContextMenu:(e:React.MouseEvent)=>void}){
 const cleanup=useRef<(()=>void)|null>(null);useEffect(()=>()=>cleanup.current?.(),[]);
 function drag(e:React.PointerEvent,c:AudioClip){e.stopPropagation();if(locked||e.button!==0)return;e.preventDefault();cleanup.current?.();const surface=e.currentTarget.parentElement!.parentElement!,r=surface.getBoundingClientRect(),origin=e.clientX;const id=e.pointerId;
 const move=(p:PointerEvent)=>{if(p.pointerId!==id)return;let start=Math.max(0,c.start+(p.clientX-origin)/r.width*duration);if(snap)start=Math.round(start/snap)*snap;const lane=lanes[Math.max(0,Math.min(lanes.length-1,Math.floor((p.clientY-r.top-92)/66)))]!;setClips(cs=>cs.map(x=>x.id===c.id?{...x,start,lane:lane.id}:x))};
 const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);cleanup.current=null};cleanup.current=stop;window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop)}
 return <>{lanes.map((l,i)=><div key={l.id} className="audio-lane" style={{top:92+i*66}}>{clips.filter(c=>c.lane===l.id).map(c=><div key={c.id} data-audio-clip={c.id} className={`audio-clip${l.muted?' muted-track':''}`} role="group" tabIndex={0} aria-label={`${c.name}, ${c.start.toFixed(2)} seconds. Arrow keys move clip.`} style={{left:`${c.start/duration*100}%`,width:`${c.duration/duration*100}%`}} onPointerDown={e=>drag(e,c)} onContextMenu={c.kind==='backing'?onContextMenu:undefined} onKeyDown={e=>{if(locked)return;const step=snap|| (e.shiftKey?1:.1);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();setClips(cs=>cs.map(x=>x.id!==c.id?x:{...x,start:Math.max(0,x.start+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)),lane:lanes[Math.max(0,Math.min(lanes.length-1,i+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)))]!.id}))}}}><span>{c.name}</span><div className="audio-clip-peaks">{c.peaks?.map((p,j)=><i key={j} style={{height:Math.max(2,p*30)}}/>)}</div><button disabled={locked} aria-label={`Remove ${c.name}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>setClips(cs=>cs.filter(x=>x.id!==c.id))}><Trash2/></button></div>)}</div>)}</>;
}
