"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp,Captions,FolderOpen,Music2,Type,Volume2,VolumeX,WandSparkles} from "lucide-react";
import type {AudioLane} from "../lib/audio-timeline";

export type MobilePanel = "lyrics"|"audio"|"style"|"saved"|null;
export function useMobileEditor(){
 const[compact,setCompact]=useState(false),[panel,setPanel]=useState<MobilePanel>(null);
 const[sourceOpen,setSourceOpen]=useState(false);
 const panelRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{const media=window.matchMedia("(max-width:720px), (max-width:1000px) and (max-height:500px)");const sync=()=>{setCompact(media.matches);if(!media.matches)setPanel(null)};sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync)},[]);
 useEffect(()=>{
  if(!compact||!panel||!panelRef.current)return;
  const root=panelRef.current,previous=document.activeElement as HTMLElement|null;
  const shell=root.closest("main")!;
  const background=Array.from(shell.querySelectorAll<HTMLElement>(".ak-topbar,.source-bar,.preview-column,.timeline-shell,.mobile-editor-tools"));
  background.forEach(el=>el.inert=true);
  root.querySelector<HTMLElement>("[data-mobile-close]")?.focus();
  const onKey=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();setPanel(null);return}
   if(e.key!=="Tab")return;
   const items=Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[contenteditable=true],[tabindex='0']")).filter(el=>el.getClientRects().length);
   const first=items[0],last=items.at(-1);if(!first)return;
   if(e.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){e.preventDefault();last?.focus()}
   else if(!e.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){e.preventDefault();first.focus()}
  };
  document.addEventListener("keydown",onKey,true);
  return()=>{background.forEach(el=>el.inert=false);document.removeEventListener("keydown",onKey,true);if(previous?.isConnected)previous.focus()};
 },[compact,panel]);
 return{compact,panel,setPanel,panelRef,sourceOpen,setSourceOpen};
}

export function MobileEditorTools({panel,onOpen}:{panel:MobilePanel;onOpen:(panel:Exclude<MobilePanel,null>)=>void}){
 return <nav className="mobile-editor-tools" aria-label="Editor tools">
  {([{id:"lyrics",label:"Lyrics",Icon:Captions},{id:"audio",label:"Audio",Icon:Music2},{id:"style",label:"Style",Icon:Type},{id:"saved",label:"Saved",Icon:FolderOpen}] as const).map(({id,label,Icon})=><button type="button" key={id} aria-label={`Open ${label.toLowerCase()}`} aria-expanded={panel===id} onClick={()=>onOpen(id)}><Icon aria-hidden="true"/><span>{label}</span></button>)}
 </nav>;
}

export function StudioAudioTools({busy,separating,hasLeadVocal,canSeparate,onSeparate,onImport,lanes,setLanes}:{busy:boolean;separating:boolean;hasLeadVocal:boolean;canSeparate:boolean;onSeparate:()=>void;onImport:()=>void;lanes:AudioLane[];setLanes:React.Dispatch<React.SetStateAction<AudioLane[]>>}){
 function move(index:number,delta:number){setLanes(current=>{const next=[...current];if(!next[index+delta])return current;[next[index],next[index+delta]]=[next[index+delta]!,next[index]!];return next})}
 return <><div className="studio-audio-actions">
  <button type="button" className="audio-separate-action" disabled={busy||!canSeparate||hasLeadVocal} onClick={onSeparate}><WandSparkles/>{separating?"Separating…":hasLeadVocal?"Lead vocal ready":"Separate lead vocal"}</button>
  <button type="button" disabled={busy} onClick={onImport}><FolderOpen/>Add audio file</button>
 </div><section className="mobile-audio-lanes" aria-label="Audio tracks"><h3>Tracks</h3>{lanes.map((lane,index)=><div key={lane.id}><span>{lane.name}</span><button type="button" disabled={busy||index===0} aria-label={`Move ${lane.name} up`} onClick={()=>move(index,-1)}><ArrowUp/></button><button type="button" disabled={busy||index===lanes.length-1} aria-label={`Move ${lane.name} down`} onClick={()=>move(index,1)}><ArrowDown/></button><button type="button" aria-label={`${lane.muted?"Unmute":"Mute"} ${lane.name}`} onClick={()=>setLanes(current=>current.map(item=>item.id===lane.id?{...item,muted:!item.muted}:item))}>{lane.muted?<VolumeX/>:<Volume2/>}</button></div>)}</section></>;
}
