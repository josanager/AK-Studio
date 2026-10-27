"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,ArrowDown,Mic2,Volume2,VolumeX,Trash2} from 'lucide-react';
import {availableLane,trimAudioClip, type AudioClip,type AudioLane} from '../lib/audio-timeline';
import {computeAudioPeaks} from '../lib/audio-peaks';

export function useAudioTimeline(backing:string|null,vocal:string|null,backingMuted:boolean,vocalMuted:boolean){
 const [clips,setClips]=useState<AudioClip[]>([]),[lanes,setLanes]=useState<AudioLane[]>([{id:'backing',name:'Audio 1',muted:false}]);
 const owned=useRef(new Set<string>());
 const clipsRef=useRef(clips),lanesRef=useRef(lanes);clipsRef.current=clips;lanesRef.current=lanes;
 const [addedClip,setAddedClip]=useState<string|null>(null);
 useEffect(()=>()=>{owned.current.forEach(u=>URL.revokeObjectURL(u))},[]);
 useEffect(()=>{let cancelled=false;setClips(c=>c.filter(x=>x.kind!=='backing'));if(backing)void computeAudioPeaks(backing,500).then(r=>{if(!cancelled){setLanes(ls=>ls.some(l=>l.id==='backing')?ls:[...ls,{id:'backing',name:'Backing',muted:backingMuted}]);setClips(c=>[...c,{id:'backing',source:backing,name:'Backing / full mix',start:0,duration:r.duration,lane:'backing',kind:'backing',peaks:r.peaks}])}});return()=>{cancelled=true}},[backing]);
 useEffect(()=>{let cancelled=false;setClips(c=>c.filter(x=>x.kind!=='vocal'));if(vocal)void computeAudioPeaks(vocal,500).then(r=>{if(!cancelled){setLanes(ls=>ls.some(l=>l.id==='vocal')?ls:[...ls,{id:'vocal',name:'Lead vocal',muted:vocalMuted}]);setClips(c=>[...c,{id:'vocal',source:vocal,name:'Lead vocal',start:0,duration:r.duration,lane:'vocal',kind:'vocal',peaks:r.peaks}])}});return()=>{cancelled=true}},[vocal]);
 async function add(blob:Blob,start:number,name?:string){const source=URL.createObjectURL(blob);owned.current.add(source);try{const r=await computeAudioPeaks(source,500);const id=crypto.randomUUID();let lane=availableLane(clipsRef.current,lanesRef.current,start,r.duration);if(!lane){lane=crypto.randomUUID();lanesRef.current=[...lanesRef.current,{id:lane!,name:`Audio ${lanesRef.current.length+1}`,muted:false}];setLanes(lanesRef.current)}clipsRef.current=[...clipsRef.current,{id,source,name:name||`Recording ${clipsRef.current.filter(x=>x.kind==='recording').length+1}`,start,duration:r.duration,lane:lane!,kind:'recording',peaks:r.peaks}];setClips(clipsRef.current);setAddedClip(id)}catch(e){URL.revokeObjectURL(source);owned.current.delete(source);throw e}}
 useEffect(()=>{setLanes(ls=>ls.map(l=>l.id==='backing'?{...l,muted:backingMuted}:l))},[backingMuted]);
 useEffect(()=>{setLanes(ls=>ls.map(l=>l.id==='vocal'?{...l,muted:vocalMuted}:l))},[vocalMuted,vocal]);
 const playback=useMemo(()=>clips.map(c=>({...c,muted:Boolean(lanes.find(l=>l.id===c.lane)?.muted)})),[clips,lanes]);
 const audible=playback.filter(c=>!c.muted);
 return {clips,setClips,lanes,setLanes,add,audible,playback,addedClip,end:clips.reduce((m,c)=>Math.max(m,c.start+c.duration),0)};
}

export function AudioPlayback({clips,time,seekRevision=0,playing,muted,onTime,onEnded,onError}:{clips:(AudioClip&{muted:boolean})[];time:number;seekRevision?:number;playing:boolean;muted:boolean;onTime:(s:number)=>void;onEnded:()=>void;onError:(message:string)=>void}){
 const elements=useRef(new Map<string,HTMLAudioElement>()),clock=useRef(time),playingRef=useRef(false);
 const pendingPlay=useRef(new Set<string>());
 const callbacks=useRef({onTime,onEnded,onError});callbacks.current={onTime,onEnded,onError};
 const end=clips.reduce((m,c)=>Math.max(m,c.start+c.duration),0);
 // Seek only for an explicit user seek. Playback follows the media clock, not render time.
 useEffect(()=>{clock.current=time;for(const c of clips){const a=elements.current.get(c.id);if(a&&a.readyState>=1)a.currentTime=Math.max(0,Math.min(c.duration,time-c.start))+(c.offset||0)}},[seekRevision]);
 useEffect(()=>{
  playingRef.current=playing;
  let frame=0,last=performance.now(),lastPaint=0,lastSync=0;
  const started=new Set<string>();
  function tick(now:number){
   const elapsed=(now-last)/1000;last=now;
   let t=clock.current;
   const master=clips.find(c=>!c.muted&&t>=c.start&&t<c.start+c.duration);
   const media=master&&elements.current.get(master.id);
   if(playing){
    // Waiting/buffering freezes the timeline with the actual audio. Never seek the
    // master forward to catch a wall clock: that restarts mobile decoders repeatedly.
    if(master&&media){if(started.has(master.id)&&media.readyState>=1)t=master.start+Math.min(master.duration,Math.max(0,media.currentTime-(master.offset||0)));}
    else t+=elapsed;
   }
   clock.current=t;
   const syncFollowers=now-lastSync>=1000;
   for(const c of clips){
    const a=elements.current.get(c.id);if(!a)continue;
    a.muted=muted||c.muted;
    const active=playing&&!c.muted&&t>=c.start&&t<c.start+c.duration;
    if(active){
     const local=t-c.start+(c.offset||0);
     if(!started.has(c.id)){
      if(a.readyState<1)continue;
      if(Math.abs(a.currentTime-local)>.05)a.currentTime=local;
      started.add(c.id);
     }else if(c!==master&&syncFollowers&&a.readyState>=3&&!a.seeking&&Math.abs(a.currentTime-local)>.5)a.currentTime=local;
     if(a.paused&&!pendingPlay.current.has(c.id)){
      pendingPlay.current.add(c.id);
      void a.play().catch(e=>{if(e.name!=='AbortError'&&playingRef.current)callbacks.current.onError(e.message||'Audio playback failed.')}).finally(()=>pendingPlay.current.delete(c.id));
     }
    }else{if(!a.paused)a.pause();started.delete(c.id)}
   }
   if(syncFollowers)lastSync=now;
   if(playing){
    // Avoid rebuilding the entire editor and waveform DOM at 60–120 fps.
    if(now-lastPaint>=50){callbacks.current.onTime(t);lastPaint=now}
    if(t>=end){callbacks.current.onTime(end);callbacks.current.onEnded();return}
    frame=requestAnimationFrame(tick);
   }
  }
  tick(performance.now());
  return()=>{cancelAnimationFrame(frame);elements.current.forEach(a=>a.pause())};
 },[clips,playing,muted,end,seekRevision]);
 return <>{clips.map(c=><audio hidden key={c.id} src={c.source} preload={c.muted?"metadata":"auto"} playsInline ref={el=>{if(el)elements.current.set(c.id,el);else elements.current.delete(c.id)}}/>)}</>;
}

export function AudioLaneHeads({lanes,setLanes,locked}:{lanes:AudioLane[];setLanes:React.Dispatch<React.SetStateAction<AudioLane[]>>;locked:boolean}){
 function reorder(i:number,d:number){setLanes(ls=>{const next=[...ls];[next[i],next[i+d]]=[next[i+d]!,next[i]!];return next})}
 return <>{lanes.map((l,i)=><div key={l.id} className="audio-lane-head" draggable={!locked} onDragStart={e=>e.dataTransfer.setData('application/ak-lane',l.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/ak-lane');setLanes(ls=>{const source=ls.find(x=>x.id===id);if(!source)return ls;const next=ls.filter(x=>x.id!==id);next.splice(i,0,source);return next})}}><Mic2/><span>{l.name}</span><button disabled={locked||i===0} aria-label={`Move ${l.name} up`} onClick={()=>reorder(i,-1)}><ArrowUp/></button><button disabled={locked||i===lanes.length-1} aria-label={`Move ${l.name} down`} onClick={()=>reorder(i,1)}><ArrowDown/></button><button aria-label={`${l.muted?'Unmute':'Mute'} ${l.name}`} onClick={()=>setLanes(ls=>ls.map(x=>x.id===l.id?{...x,muted:!x.muted}:x))}>{l.muted?<VolumeX/>:<Volume2/>}</button></div>)}</>;
}

export function AudioLaneClips({clips,setClips,lanes,duration,snap,locked,onContextMenu,onLongPress,selected,onSelect}:{clips:AudioClip[];setClips:React.Dispatch<React.SetStateAction<AudioClip[]>>;lanes:AudioLane[];duration:number;snap:number|null;locked:boolean;onContextMenu:(e:React.MouseEvent)=>void;onLongPress?:(x:number,y:number)=>void;selected:string|null;onSelect:(id:string)=>void}){
 const cleanup=useRef<(()=>void)|null>(null),holdCleanup=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>{cleanup.current?.();holdCleanup.current?.()},[]);
 function hold(e:React.PointerEvent,c:AudioClip){
  if(locked||c.kind!=='backing'||e.pointerType!=='touch'||!onLongPress||!window.matchMedia('(max-width:720px) and (orientation:portrait)').matches)return;
  holdCleanup.current?.();const x=e.clientX,y=e.clientY,id=e.pointerId;
  const stop=()=>{window.clearTimeout(timer);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',stop,true);window.removeEventListener('pointercancel',stop,true);window.removeEventListener('blur',stop);window.removeEventListener('resize',stop);holdCleanup.current=null};
  const move=(p:PointerEvent)=>{if(p.pointerId!==id||Math.hypot(p.clientX-x,p.clientY-y)>8)stop()};
  const timer=window.setTimeout(()=>{stop();cleanup.current?.();onLongPress(x,y)},550);
  holdCleanup.current=stop;window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',stop,true);window.addEventListener('pointercancel',stop,true);window.addEventListener('blur',stop);window.addEventListener('resize',stop);
 }
 function drag(e:React.PointerEvent,c:AudioClip,edge?:'start'|'end'){e.stopPropagation();if(locked||e.button!==0)return;e.preventDefault();onSelect(c.id);cleanup.current?.();const surface=e.currentTarget.closest('.track-canvas')!,r=surface.getBoundingClientRect(),origin=e.clientX;const id=e.pointerId;
 const move=(p:PointerEvent)=>{if(p.pointerId!==id)return;if(edge){let delta=(p.clientX-origin)/r.width*duration;if(snap)delta=Math.round((c.start+(edge==='end'?c.duration:0)+delta)/snap)*snap-(c.start+(edge==='end'?c.duration:0));setClips(cs=>cs.map(x=>x.id===c.id?trimAudioClip(c,delta,edge):x));return}let start=Math.max(0,c.start+(p.clientX-origin)/r.width*duration);if(snap)start=Math.round(start/snap)*snap;const lane=lanes[Math.max(0,Math.min(lanes.length-1,Math.floor((p.clientY-r.top-92)/66)))]!;setClips(cs=>cs.map(x=>x.id===c.id?{...x,start,lane:lane.id}:x))};
 const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);cleanup.current=null};cleanup.current=stop;window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop)}
 return <>{lanes.map((l,i)=><div key={l.id} className="audio-lane" style={{top:92+i*66}}>{clips.filter(c=>c.lane===l.id).map(c=><div key={c.id} data-audio-clip={c.id} className={`audio-clip${selected===c.id?' selected':''}${l.muted?' muted-track':''}`} role="group" tabIndex={0} aria-label={`${c.name}, ${c.start.toFixed(2)} seconds. Arrow keys move clip.`} style={{left:`${c.start/duration*100}%`,width:`${c.duration/duration*100}%`}} onFocus={()=>onSelect(c.id)} onClick={()=>onSelect(c.id)} onPointerDown={e=>{hold(e,c);if(e.pointerType==="touch"&&selected!==c.id){e.stopPropagation();onSelect(c.id);return}drag(e,c)}} onContextMenu={c.kind==='backing'?onContextMenu:undefined} onKeyDown={e=>{if(locked)return;onSelect(c.id);const step=snap|| (e.shiftKey?1:.1);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();setClips(cs=>cs.map(x=>x.id!==c.id?x:{...x,start:Math.max(0,x.start+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)),lane:lanes[Math.max(0,Math.min(lanes.length-1,i+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)))]!.id}))}}}><span>{c.name}</span><div className="audio-clip-peaks">{c.peaks?.slice(Math.floor((c.offset||0)/(c.sourceDuration??c.duration)*c.peaks.length),Math.ceil(((c.offset||0)+c.duration)/(c.sourceDuration??c.duration)*c.peaks.length)).map((p,j)=><i key={j} style={{height:Math.max(2,p*30)}}/>)}</div>{(['start','end'] as const).map(edge=><span key={edge} role="slider" tabIndex={0} aria-label={`Trim audio ${edge}: ${c.name}`} aria-valuenow={edge==='start'?c.start:c.start+c.duration} className={`audio-trim-handle ${edge}`} onPointerDown={e=>drag(e,c,edge)} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(locked||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();onSelect(c.id);setClips(cs=>cs.map(x=>x.id===c.id?trimAudioClip(x,(e.key==='ArrowLeft'?-1:1)*(snap||.1),edge):x))}}/>)}<button disabled={locked} aria-label={`Remove ${c.name}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>setClips(cs=>cs.filter(x=>x.id!==c.id))}><Trash2/></button></div>)}</div>)}</>;
}
