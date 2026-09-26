"use client";
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {AlignCenter,AlignLeft,AlignRight,Captions,Check,ChevronDown,CircleUserRound,Download,FolderOpen,Gauge,HelpCircle,Link2,LoaderCircle,Maximize2,Mic2,Minus,Music,Pause,Play,Plus,Scissors,Trash2,Undo2,Volume2,VolumeX,WandSparkles,ZoomIn,ZoomOut} from "lucide-react";
import type {PlanSnapshot} from "../lib/plans";
import {cachedAudioUrl,revokeAudioUrl} from "../lib/audio-cache";
import {computeAudioPeaks} from "../lib/audio-peaks";
import {WaveformTrack} from "../components/waveform-track";
import type {SavedProjectSummary,StudioProjectState} from "../lib/studio-project";
import {canExportVideoRoughly,downloadBlob,exportKaraokeVideo,type ExportFps,type ExportQuality,type PreviewTypographyMetrics} from "../lib/export-video";
type Lyric={text:string;start:number;width:number}; type Track={title:string;artist:string}; type ApiLyric={text:string;start:number;end:number};
const formatTime=(seconds:number)=>{const whole=Math.round(seconds);return`${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`};
const youtubeHosts=new Set(["youtube.com","www.youtube.com","music.youtube.com","youtu.be","m.youtube.com"]);
function isYouTubeLink(value:string){const match=value.match(/https?:\/\/[^\s<>"']+/i);if(!match)return false;try{const url=new URL(match[0].replace(/[),.;!?\]}]+$/,""));return youtubeHosts.has(url.hostname.toLowerCase())}catch{return false}}
async function readAudioNdjson(response:Response,onProgress:(n:number)=>void){if(!response.body){const data=await response.json() as Record<string,unknown>;return data}const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";let last:Record<string,unknown>={};while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line) as Record<string,unknown>;last=event;if(typeof event.progress==="number")onProgress(Math.max(0,Math.min(100,Math.round(event.progress))));if(event.status==="error")throw new Error(sanitizeClientError(typeof event.error==="string"?event.error:"The song could not be downloaded."))}}if(buffer.trim()){const event=JSON.parse(buffer) as Record<string,unknown>;last=event;if(typeof event.progress==="number")onProgress(Math.max(0,Math.min(100,Math.round(event.progress))));if(event.status==="error")throw new Error(sanitizeClientError(typeof event.error==="string"?event.error:"The song could not be downloaded."))}return last}

function sanitizeClientError(message:string){
  const lower=message.toLowerCase();
  if(lower.includes("not a robot")||lower.includes("sign in to confirm")||(lower.includes("sign in")&&lower.includes("robot"))){
    return "Could not download audio from YouTube. Please try again in a moment.";
  }
  return message;
}

export default function Studio({user,plan}:{user:{name:string,email:string};plan:PlanSnapshot}){
 const[url,setUrl]=useState("");const[processing,setProcessing]=useState(false);const[analyzed,setAnalyzed]=useState(false);const[notice,setNotice]=useState<{kind:"success"|"error",text:string}|null>(null);const[track,setTrack]=useState<Track>({title:"",artist:""});const[duration,setDuration]=useState(240);const[audioSrc,setAudioSrc]=useState<string|null>(null);const[backingSrc,setBackingSrc]=useState<string|null>(null);const[vocalSrc,setVocalSrc]=useState<string|null>(null);const[bpm,setBpm]=useState<number|null>(null);const[model,setModel]=useState<string|null>(null);const[lyrics,setLyrics]=useState<Lyric[]>([]);const[selected,setSelected]=useState(-1);const[playing,setPlaying]=useState(false);const[position,setPosition]=useState(0);const[muted,setMuted]=useState(false);const[stemMuted,setStemMuted]=useState({backing:false,vocal:true});const[font,setFont]=useState("Avenir Next");const[fontSize,setFontSize]=useState(72);const[lineHeight,setLineHeight]=useState(.94);const[zoom,setZoom]=useState(62);const[aspect,setAspect]=useState<"16:9"|"9:16"|"1:1">("16:9");const[exportQuality,setExportQuality]=useState<ExportQuality>("1080");const[exportFps,setExportFps]=useState<ExportFps>(30);const[qualityOpen,setQualityOpen]=useState(false);const[exporting,setExporting]=useState(false);const[textStyle,setTextStyle]=useState({bold:true,italic:false,underline:false,align:"center" as "left"|"center"|"right",color:"#fff"});const[textPosition,setTextPosition]=useState({x:50,y:50});const[snap,setSnap]=useState({x:false,y:false});const stageRef=useRef<HTMLDivElement>(null);const timelineRef=useRef<HTMLDivElement>(null);const metronomeRef=useRef<AudioContext|null>(null);const mediaRef=useRef<HTMLAudioElement>(null);const vocalRef=useRef<HTMLAudioElement>(null);const scrubbingRef=useRef<{pointerId:number;surface:HTMLElement;target:HTMLElement}|null>(null);const endScrubRef=useRef<(()=>void)|null>(null);const positionRef=useRef(0);const togglePlaybackRef=useRef<()=>void>(()=>{});
 const[backingPeaks,setBackingPeaks]=useState<number[]|null>(null);const[vocalPeaks,setVocalPeaks]=useState<number[]|null>(null);const[audioDuration,setAudioDuration]=useState(0);const[downloadProgress,setDownloadProgress]=useState<number|null>(null);
 const[progressLabel,setProgressLabel]=useState<string|null>(null);
 const[separating,setSeparating]=useState(false);
 const[exportOpen,setExportOpen]=useState(false);
 const[stemMenu,setStemMenu]=useState<{x:number;y:number}|null>(null);
 const exportMenuRef=useRef<HTMLDivElement>(null);
 const stemMenuRef=useRef<HTMLDivElement>(null);
 const qualityMenuRef=useRef<HTMLDivElement>(null);

 const[projectId,setProjectId]=useState<string|null>(null);const[audioId,setAudioId]=useState<string|null>(null);const[audioApiUrl,setAudioApiUrl]=useState<string|null>(null);const[backingApiUrl,setBackingApiUrl]=useState<string|null>(null);const[vocalApiUrl,setVocalApiUrl]=useState<string|null>(null);const[savedProjects,setSavedProjects]=useState<SavedProjectSummary[]>([]);const[leftTab,setLeftTab]=useState<"lyrics"|"saved">("lyrics");const[saveNote,setSaveNote]=useState<string|null>(null);const[hydrating,setHydrating]=useState(true);const skipSaveRef=useRef(true);const saveTimerRef=useRef<number|null>(null);
 useEffect(()=>()=>{revokeAudioUrl(audioSrc);revokeAudioUrl(backingSrc);revokeAudioUrl(vocalSrc)},[audioSrc,backingSrc,vocalSrc]);
 useEffect(()=>{positionRef.current=position},[position]);
 useEffect(()=>{if(!exportOpen&&!stemMenu&&!qualityOpen)return;const onDown=(e:PointerEvent)=>{const t=e.target as Node;if(exportOpen&&exportMenuRef.current&&!exportMenuRef.current.contains(t))setExportOpen(false);if(stemMenu&&stemMenuRef.current&&!stemMenuRef.current.contains(t))setStemMenu(null);if(qualityOpen&&qualityMenuRef.current&&!qualityMenuRef.current.contains(t))setQualityOpen(false)};const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setExportOpen(false);setStemMenu(null);setQualityOpen(false)}};window.addEventListener("pointerdown",onDown,true);window.addEventListener("keydown",onKey);return()=>{window.removeEventListener("pointerdown",onDown,true);window.removeEventListener("keydown",onKey)}},[exportOpen,stemMenu,qualityOpen]);

 useEffect(()=>{if(!backingSrc){setBackingPeaks(null);setAudioDuration(0);return}let cancelled=false;void computeAudioPeaks(backingSrc,1000).then(r=>{if(cancelled)return;setBackingPeaks(r.peaks);if(r.duration>0){setAudioDuration(r.duration);setDuration(d=>Math.max(d,r.duration))}}).catch(()=>{if(!cancelled)setBackingPeaks(null)});return()=>{cancelled=true}},[backingSrc]);
 useEffect(()=>{if(!vocalSrc){setVocalPeaks(null);return}let cancelled=false;void computeAudioPeaks(vocalSrc,1000).then(r=>{if(!cancelled)setVocalPeaks(r.peaks)}).catch(()=>{if(!cancelled)setVocalPeaks(null)});return()=>{cancelled=true}},[vocalSrc]);
 useEffect(()=>{const end=lyrics.reduce((m,line)=>Math.max(m,line.start+Math.max(0.15,(line.width/100)*Math.max(duration,1))),0);const next=Math.max(duration,audioDuration,end);if(next>duration+0.05)setDuration(next)},[lyrics,audioDuration,duration]);

 function isTypingTarget(el:EventTarget|null){if(!(el instanceof HTMLElement))return false;const tag=el.tagName;if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return true;if(el.isContentEditable)return true;return Boolean(el.closest("input,textarea,select,[contenteditable=true],[contenteditable='']"));}
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.code!=="Space"&&e.key!==" ")return;if(e.metaKey||e.ctrlKey||e.altKey)return;if(isTypingTarget(e.target))return;if(!backingSrc)return;e.preventDefault();togglePlaybackRef.current()};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[backingSrc]);

 
 useEffect(()=>{if(!playing||audioSrc)return;const id=window.setInterval(()=>setPosition(v=>v>=100?0:v+.18),50);return()=>window.clearInterval(id)},[playing,audioSrc]);
 useEffect(()=>{if(!playing||muted||audioSrc)return;const click=()=>{const c=metronomeRef.current||new AudioContext();metronomeRef.current=c;const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.setValueAtTime(.14,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.055);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.06)};click();const id=window.setInterval(click,60000/(bpm||118));return()=>window.clearInterval(id)},[playing,muted,audioSrc,bpm]);
 const lyricsEndSec=useMemo(()=>lyrics.reduce((m,line)=>Math.max(m,line.start+Math.max(0.15,(line.width/100)*Math.max(duration,1))),0),[lyrics,duration]);
 const timelineDuration=Math.max(30,duration,audioDuration,lyricsEndSec);
 const timelineMinWidth="0px";
 const timelineScale=2**(zoom/33);
 const timelineScrollRef=useRef<HTMLDivElement>(null);
 const zoomRef=useRef(zoom);
 const zoomAnchor=useRef<{ratio:number;x:number}|null>(null);
 const [showWatermark,setShowWatermark]=useState(true);
 function changeZoom(value:number,clientX?:number){const viewport=timelineScrollRef.current;const canvas=timelineRef.current;if(viewport&&canvas){const x=clientX==null?viewport.clientWidth/2:Math.max(0,Math.min(viewport.clientWidth,clientX-viewport.getBoundingClientRect().left));zoomAnchor.current={ratio:(viewport.scrollLeft+x)/canvas.offsetWidth,x}}const next=Math.max(0,Math.min(100,value));zoomRef.current=next;setZoom(next)}
 useLayoutEffect(()=>{zoomRef.current=zoom;const viewport=timelineScrollRef.current;const canvas=timelineRef.current;const anchor=zoomAnchor.current;if(viewport&&canvas&&anchor)viewport.scrollLeft=anchor.ratio*canvas.offsetWidth-anchor.x;zoomAnchor.current=null},[zoom]);
 useEffect(()=>{const viewport=timelineScrollRef.current;if(!viewport)return;const wheel=(e:WheelEvent)=>{if(!e.metaKey&&!e.ctrlKey)return;e.preventDefault();changeZoom(zoomRef.current-e.deltaY*(e.deltaMode===1?2:.18),e.clientX)};let initial=0;const start=(e:Event)=>{e.preventDefault();initial=zoomRef.current};const gesture=(e:Event)=>{e.preventDefault();const g=e as Event&{scale:number;clientX:number};changeZoom(initial+Math.log2(Math.max(.1,g.scale))*33,g.clientX)};viewport.addEventListener("wheel",wheel,{passive:false});viewport.addEventListener("gesturestart",start,{passive:false});viewport.addEventListener("gesturechange",gesture,{passive:false});return()=>{viewport.removeEventListener("wheel",wheel);viewport.removeEventListener("gesturestart",start);viewport.removeEventListener("gesturechange",gesture)}},[]);
 const waveWidthPercent=timelineDuration>0&&audioDuration>0?Math.min(100,Math.max(0.5,(audioDuration/timelineDuration)*100)):100;
 const playTime=useMemo(()=>formatTime(position/100*timelineDuration),[position,timelineDuration]);
 const lyricSpanSec=(line:Lyric)=>Math.max(0.15,(line.width/100)*Math.max(duration,1));
 const currentSeconds=position/100*timelineDuration;
 const activeIndex=lyrics.findIndex((line,index)=>{const end=line.start+lyricSpanSec(line);const nextStart=lyrics[index+1]?.start;return currentSeconds>=line.start&&currentSeconds<(nextStart!=null?Math.min(nextStart,end):end)});
 const activeLyric=activeIndex>=0?lyrics[activeIndex]:null;
 useEffect(()=>{if(activeIndex>=0)setSelected(activeIndex)},[activeIndex]);
 useEffect(()=>{const c=(document as unknown as{modelContext?:{registerTool:(tool:unknown,options?:{signal?:AbortSignal})=>void|Promise<void>}}).modelContext;if(!c?.registerTool)return;const x=new AbortController();void Promise.resolve(c.registerTool({name:"read_karaoke_project",title:"Read karaoke project",description:"Returns the current song and selected lyric.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({title:track.title,artist:track.artist,bpm:analyzed?null:118,demo:!analyzed,progressPercent:Math.round(position),selectedLyric:lyrics[selected]?.text})},{signal:x.signal}));return()=>x.abort()},[track,position,lyrics,selected,analyzed]);
 useEffect(()=>()=>{const cleanup=endScrubRef.current;const active=scrubbingRef.current;scrubbingRef.current=null;endScrubRef.current=null;cleanup?.();if(active){try{if(active.target.hasPointerCapture?.(active.pointerId))active.target.releasePointerCapture(active.pointerId)}catch{/* unmount */}}},[]);

 async function refreshSavedProjects(){
  try{
   const r=await fetch("/api/projects");
   if(!r.ok)return;
   const d=await r.json() as{projects?:SavedProjectSummary[]};
   setSavedProjects(d.projects||[]);
  }catch{/* ignore */}
 }
 async function applyProjectState(state:StudioProjectState,id:string|null){
  skipSaveRef.current=true;
  setProjectId(id);
  setUrl(state.url||"");
  setTrack(state.track||{title:"",artist:""});
  setLyrics(state.lyrics||[]);
  setDuration(state.duration||240);setAudioDuration(0);
  setAnalyzed(Boolean(state.analyzed));
  setSelected(typeof state.selected==="number"?state.selected:-1);
  setPosition(state.position||0);
  setAspect(state.aspect||"16:9");
  setExportQuality(state.exportQuality==="4K"||state.exportQuality==="2K"||state.exportQuality==="1080"?state.exportQuality:"1080");
  setExportFps(state.exportFps===60?60:30);
  setFont(state.font||"Avenir Next");
  setFontSize(state.fontSize||72);
  setLineHeight(state.lineHeight??.94);
  setTextStyle(state.textStyle||{bold:true,italic:false,underline:false,align:"center",color:"#fff"});
  setTextPosition(state.textPosition||{x:50,y:50});
  setStemMuted(state.stemMuted||{backing:false,vocal:true});
  setZoom(state.zoom??62);
  setBpm(state.bpm??null);
  setModel(state.model||null);
  setAudioId(state.audioId||null);
  setAudioApiUrl(state.audioUrl||null);
  setBackingApiUrl(state.backingUrl||null);
  setVocalApiUrl(state.vocalUrl||null);
  revokeAudioUrl(audioSrc);
  revokeAudioUrl(backingSrc);
  revokeAudioUrl(vocalSrc);
  const[a,b,v]=await Promise.all([
   state.audioUrl?cachedAudioUrl(state.audioUrl):Promise.resolve(null),
   state.backingUrl?cachedAudioUrl(state.backingUrl):(state.audioUrl?cachedAudioUrl(state.audioUrl):Promise.resolve(null)),
   state.vocalUrl?cachedAudioUrl(state.vocalUrl):Promise.resolve(null),
  ]);
  setAudioSrc(a);
  setBackingSrc(b);
  setVocalSrc(v);
  if(state.analyzed)setNotice({kind:"success",text:state.backingUrl||state.audioUrl?"Restored saved project · audio ready for 24h":"Restored saved project"});
  window.setTimeout(()=>{skipSaveRef.current=false},800);
 }
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   setHydrating(true);
   try{
    const listRes=await fetch("/api/projects");
    if(listRes.ok){
     const list=await listRes.json() as{projects?:SavedProjectSummary[]};
     if(!cancelled)setSavedProjects(list.projects||[]);
     const first=list.projects?.[0];
     if(first){
      const one=await fetch(`/api/projects/${first.id}`);
      if(one.ok){
       const payload=await one.json() as{id:string;state:StudioProjectState};
       if(!cancelled)await applyProjectState(payload.state,payload.id);
      }
     }
    }
   }catch{/* ignore */}
   finally{
    if(!cancelled){
     setHydrating(false);
     window.setTimeout(()=>{skipSaveRef.current=false},500);
    }
   }
  })();
  return()=>{cancelled=true};
 },[]);
 useEffect(()=>{
  if(hydrating||skipSaveRef.current)return;
  if(!analyzed&&lyrics.length===0&&!url)return;
  if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current);
  saveTimerRef.current=window.setTimeout(()=>{
   void(async()=>{
    const state:StudioProjectState={url,track,lyrics,duration,analyzed,audioId,audioUrl:audioApiUrl,backingUrl:backingApiUrl,vocalUrl:vocalApiUrl,model,bpm,aspect,exportQuality,exportFps,font,fontSize,lineHeight,textStyle,textPosition,stemMuted,position:positionRef.current,zoom,selected};
    try{
     const r=await fetch("/api/projects",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({id:projectId,name:track.title||"Untitled project",state})});
     const d=await r.json() as{id?:string;message?:string;error?:string;expiresAt?:number};
     if(!r.ok){setSaveNote(d.error||"Could not save project.");return}
     if(typeof d.id==="string")setProjectId(d.id);
     setSaveNote(d.message||"Saved");
     await refreshSavedProjects();
     window.setTimeout(()=>setSaveNote(null),3500);
    }catch{setSaveNote("Could not save project.")}
   })();
  },900);
  return()=>{if(saveTimerRef.current)window.clearTimeout(saveTimerRef.current)};
 },[hydrating,analyzed,url,track,lyrics,duration,audioId,audioApiUrl,backingApiUrl,vocalApiUrl,model,bpm,aspect,exportQuality,exportFps,font,fontSize,lineHeight,textStyle,textPosition,stemMuted,zoom,selected,projectId,plan.plan]);
 async function analyze(e:React.FormEvent){e.preventDefault();if(!isYouTubeLink(url))return;setNotice(null);setProcessing(true);setDownloadProgress(0);setProgressLabel("Fetching lyrics…");setAudioSrc(null);setBackingSrc(null);setVocalSrc(null);setBackingPeaks(null);setVocalPeaks(null);setAudioDuration(0);setModel(null);setAudioId(null);setAudioApiUrl(null);setBackingApiUrl(null);setVocalApiUrl(null);try{const r=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url})});const d=await r.json() as{error?:string;title?:string;artist?:string;duration?:number;lyrics?:ApiLyric[];lyricsSource?:string|null};if(!r.ok)throw new Error(d.error||"The link could not be analyzed.");setTrack({title:d.title||"New song",artist:d.artist||"YouTube"});const nextDuration=Math.max(30,d.duration||d.lyrics?.at(-1)?.end||242);setDuration(nextDuration);if(d.lyrics?.length)setLyrics(d.lyrics.slice(0,80).map(line=>({text:line.text,start:line.start,width:Math.max(0.05,((line.end-line.start)/nextDuration)*100)})));setSelected(0);setAnalyzed(true);setPosition(0);setNotice({kind:"success",text:"Lyrics ready · Downloading song…"});setDownloadProgress(1);setProgressLabel("Downloading song… 1%");const audioResponse=await fetch("/api/audio",{method:"POST",headers:{"content-type":"application/json",accept:"application/x-ndjson"},body:JSON.stringify({url})});if(audioResponse.status===401||audioResponse.status===429||audioResponse.status===400){const err=await audioResponse.json() as{error?:string};throw new Error(err.error||"The song could not be downloaded.")}const ctype=audioResponse.headers.get("content-type")||"";let audio:Record<string,unknown>;if(ctype.includes("ndjson")){audio=await readAudioNdjson(audioResponse,(n)=>{setDownloadProgress(n);setProgressLabel(`Downloading song… ${Math.max(0,Math.min(100,n))}%`)})}else{audio=await audioResponse.json() as Record<string,unknown>;if(!audioResponse.ok)throw new Error(typeof audio.error==="string"?audio.error:"The song could not be downloaded.");setDownloadProgress(100)}if(audio.status==="error")throw new Error(sanitizeClientError(typeof audio.error==="string"?audio.error:"The song could not be downloaded."));const audioUrl=typeof audio.audioUrl==="string"?audio.audioUrl:null;const backingUrl=typeof audio.backingUrl==="string"?audio.backingUrl:null;const vocalUrl=typeof audio.vocalUrl==="string"?audio.vocalUrl:null;if(!backingUrl&&!audioUrl)throw new Error(sanitizeClientError(typeof audio.error==="string"?audio.error:"The song could not be downloaded."));const nextAudioId=typeof audio.id==="string"?audio.id:null;setAudioId(nextAudioId);setAudioApiUrl(audioUrl);setBackingApiUrl(backingUrl||audioUrl);setVocalApiUrl(vocalUrl);revokeAudioUrl(audioSrc);revokeAudioUrl(backingSrc);revokeAudioUrl(vocalSrc);const[cachedOriginal,cachedBacking,cachedVocal]=await Promise.all([cachedAudioUrl(audioUrl||backingUrl!),cachedAudioUrl(backingUrl||audioUrl!),vocalUrl?cachedAudioUrl(vocalUrl):Promise.resolve(null)]);setAudioSrc(cachedOriginal);setBackingSrc(cachedBacking);setVocalSrc(cachedVocal);setStemMuted(s=>({...s,vocal:audio.mode==="full"?true:s.vocal}));setBpm(typeof audio.bpm==="number"?audio.bpm:null);setModel(typeof audio.model==="string"?audio.model:(audio.mode==="full"?"full-mix":"BS-RoFormer"));if(typeof audio.duration==="number"&&audio.duration>0){setAudioDuration(audio.duration);setDuration(d=>Math.max(d,audio.duration as number))}setDownloadProgress(100);setProgressLabel(null);window.setTimeout(()=>setDownloadProgress(null),700);setNotice({kind:"success",text:`Ready · ${typeof audio.model==="string"?audio.model:(audio.mode==="full"?"full mix":"audio")}${d.lyricsSource?` · ${d.lyricsSource}`:""}`})}catch(error){setNotice({kind:"error",text:sanitizeClientError(error instanceof Error?error.message:"The link could not be analyzed.")});window.setTimeout(()=>setDownloadProgress(null),2500);setProgressLabel(null)}finally{setProcessing(false)}}
 const addLine=()=>setLyrics(c=>{const next=[...c,{text:"New line",start:c.length?(c.at(-1)?.start||0)+4:0,width:12}];setSelected(next.length-1);return next});
 function dragText(e:React.PointerEvent<HTMLDivElement>){const stage=stageRef.current;if(!stage)return;const target=e.currentTarget;target.setPointerCapture(e.pointerId);const move=(x:number,y:number)=>{const r=stage.getBoundingClientRect();let px=Math.max(10,Math.min(90,(x-r.left)/r.width*100)),py=Math.max(15,Math.min(85,(y-r.top)/r.height*100));const sx=Math.abs(px-50)<3,sy=Math.abs(py-50)<3;if(sx)px=50;if(sy)py=50;setSnap({x:sx,y:sy});setTextPosition({x:px,y:py})};move(e.clientX,e.clientY);const onMove=(x:PointerEvent)=>move(x.clientX,x.clientY);const stop=()=>{target.removeEventListener("pointermove",onMove);setSnap({x:false,y:false})};target.addEventListener("pointermove",onMove);target.addEventListener("pointerup",stop,{once:true});target.addEventListener("pointercancel",stop,{once:true})}
 function nudge(e:React.KeyboardEvent<HTMLDivElement>){const s=e.shiftKey?5:1,d:{[key:string]:[number,number]}={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]};if(!d[e.key])return;e.preventDefault();const[dx,dy]=d[e.key];setTextPosition(p=>({x:Math.max(10,Math.min(90,p.x+dx)),y:Math.max(15,Math.min(85,p.y+dy))}))}
 function scrubToClientX(clientX:number,surface?:HTMLElement|null){const el=surface||timelineRef.current;if(!el)return;const r=el.getBoundingClientRect();if(r.width<=0)return;const next=Math.max(0,Math.min(100,(clientX-r.left)/r.width*100)),seconds=next/100*timelineDuration;setPosition(next);if(mediaRef.current)mediaRef.current.currentTime=seconds;if(vocalRef.current)vocalRef.current.currentTime=seconds}
 function endScrub(){const active=scrubbingRef.current;const cleanup=endScrubRef.current;scrubbingRef.current=null;endScrubRef.current=null;if(cleanup)cleanup();if(!active)return;try{if(active.target.hasPointerCapture?.(active.pointerId))active.target.releasePointerCapture(active.pointerId)}catch{/* already released */}}
 function scrubFromPointer(e:React.PointerEvent<HTMLElement>){if(stemMenu||separating)return;if(e.button!==0&&e.pointerType==="mouse")return;e.preventDefault();e.stopPropagation();if(scrubbingRef.current)endScrub();const target=e.currentTarget;const surface=timelineRef.current&&timelineRef.current.contains(target)?timelineRef.current:target;const pointerId=e.pointerId;try{target.setPointerCapture(pointerId)}catch{/* capture optional; window listeners still end drag */}scrubbingRef.current={pointerId,surface,target};scrubToClientX(e.clientX,surface);const onMove=(ev:PointerEvent)=>{if(ev.pointerId!==pointerId)return;if(scrubbingRef.current?.pointerId!==pointerId)return;scrubToClientX(ev.clientX,surface)};const onUp=(ev:PointerEvent)=>{if(ev.pointerId!==pointerId)return;endScrub()};const onLost=(ev:PointerEvent)=>{if(ev.pointerId!==pointerId)return;endScrub()};const onBlur=()=>endScrub();const onMouseUp=()=>endScrub();endScrubRef.current=()=>{window.removeEventListener("pointermove",onMove,true);window.removeEventListener("pointerup",onUp,true);window.removeEventListener("pointercancel",onUp,true);window.removeEventListener("mouseup",onMouseUp,true);window.removeEventListener("blur",onBlur);target.removeEventListener("lostpointercapture",onLost)};window.addEventListener("pointermove",onMove,true);window.addEventListener("pointerup",onUp,true);window.addEventListener("pointercancel",onUp,true);window.addEventListener("mouseup",onMouseUp,true);window.addEventListener("blur",onBlur);target.addEventListener("lostpointercapture",onLost)}
 function dragHead(e:React.PointerEvent<HTMLDivElement>){scrubFromPointer(e)}
 function dragLyric(e:React.PointerEvent<HTMLButtonElement>,index:number){e.stopPropagation();if(stemMenu||separating)return;const parent=e.currentTarget.parentElement;if(!parent)return;const target=e.currentTarget,originX=e.clientX,initial=lyrics[index].start;target.setPointerCapture(e.pointerId);const move=(ev:PointerEvent)=>{if(ev.pointerId!==e.pointerId)return;const raw=initial+(ev.clientX-originX)/parent.clientWidth*timelineDuration,beat=60/(bpm||118),snapped=Math.round(raw/beat)*beat;setLyrics(c=>c.map((v,i)=>i===index?{...v,start:Math.max(0,Math.min(timelineDuration-2,snapped))}:v))};const stop=(ev:PointerEvent)=>{if(ev.pointerId!==e.pointerId)return;target.releasePointerCapture(e.pointerId);target.removeEventListener("pointermove",move);target.removeEventListener("pointerup",stop);target.removeEventListener("pointercancel",stop)};target.addEventListener("pointermove",move);target.addEventListener("pointerup",stop);target.addEventListener("pointercancel",stop)}
 

 const stemMenuOpen=Boolean(stemMenu);
 const timelineLocked=stemMenuOpen||separating;
 const hasLeadVocal=Boolean(vocalSrc);
 async function separateLeadVocal(){
  setStemMenu(null);
  if(!audioId){setNotice({kind:"error",text:"Download the song first, then separate the lead vocal."});return}
  if(separating||processing||exporting)return;
  setSeparating(true);setNotice(null);setDownloadProgress(2);setProgressLabel("Separating lead vocal… 2%");
  try{
    const audioResponse=await fetch("/api/audio/separate",{method:"POST",headers:{"content-type":"application/json",accept:"application/x-ndjson"},body:JSON.stringify({audioId,url:url||undefined})});
    if(audioResponse.status===401)throw new Error("Sign in to separate stems.");
    if(audioResponse.status===503||audioResponse.status===404||audioResponse.status===400){
      const err=await audioResponse.json().catch(()=>({})) as{error?:string};
      throw new Error(err.error||"Stem separation needs the GPU processor. Full mix still plays.");
    }
    const ctype=audioResponse.headers.get("content-type")||"";
    let audio:Record<string,unknown>;
    if(ctype.includes("ndjson")){audio=await readAudioNdjson(audioResponse,(n)=>{setDownloadProgress(n);setProgressLabel(`Separating lead vocal… ${Math.max(0,Math.min(100,n))}%`)})}
    else{audio=await audioResponse.json() as Record<string,unknown>;if(!audioResponse.ok)throw new Error(typeof audio.error==="string"?audio.error:"Stem separation needs the GPU processor. Full mix still plays.");setDownloadProgress(100);setProgressLabel("Separating lead vocal… 100%")}
    if(audio.status==="error")throw new Error(sanitizeClientError(typeof audio.error==="string"?audio.error:"Stem separation needs the GPU processor. Full mix still plays."));
    const backingUrl=typeof audio.backingUrl==="string"?audio.backingUrl:null;
    const vocalUrl=typeof audio.vocalUrl==="string"?audio.vocalUrl:null;
    const audioUrl=typeof audio.audioUrl==="string"?audio.audioUrl:audioApiUrl;
    if(!backingUrl||!vocalUrl)throw new Error("Stem separation needs the GPU processor. Full mix still plays.");
    setAudioApiUrl(audioUrl);setBackingApiUrl(backingUrl);setVocalApiUrl(vocalUrl);
    revokeAudioUrl(backingSrc);revokeAudioUrl(vocalSrc);
    const[cachedBacking,cachedVocal]=await Promise.all([cachedAudioUrl(backingUrl),cachedAudioUrl(vocalUrl)]);
    setBackingSrc(cachedBacking);setVocalSrc(cachedVocal);
    setStemMuted(s=>({...s,vocal:true,backing:false}));
    setModel(typeof audio.model==="string"?audio.model:"BS-RoFormer");
    if(typeof audio.bpm==="number")setBpm(audio.bpm);
    if(typeof audio.duration==="number"&&audio.duration>0){setAudioDuration(audio.duration);setDuration(d=>Math.max(d,audio.duration as number))}
    setDownloadProgress(100);setProgressLabel("Separating lead vocal… 100%");
    window.setTimeout(()=>{setDownloadProgress(null);setProgressLabel(null)},700);
    setNotice({kind:"success",text:"Lead vocal separated · mute controls unlocked"});
  }catch(error){
    setNotice({kind:"error",text:sanitizeClientError(error instanceof Error?error.message:"Stem separation needs the GPU processor. Full mix still plays.")});
    setProgressLabel(null);
    window.setTimeout(()=>setDownloadProgress(null),2500);
  }finally{setSeparating(false)}
 }
 function sanitizeFilename(value:string){return(value||"karaoke").replace(/[^\w\s.-]+/g," ").replace(/\s+/g," ").trim().slice(0,80)||"karaoke"}
 async function downloadProjectAudio(){
  setExportOpen(false);
  const src=backingSrc||audioSrc;
  const api=backingApiUrl||audioApiUrl;
  if(!src&&!api){setNotice({kind:"error",text:"No audio to export yet. Create karaoke first."});return}
  try{
    const fetchUrl=api||src!;
    const res=await fetch(fetchUrl);
    if(!res.ok)throw new Error("Could not download the audio file.");
    const blob=await res.blob();
    const ext=(api||src||"").match(/[.](m4a|mp3|webm|ogg|flac|mp4)(?:\?|$)/i)?.[1]
      ||(blob.type.includes("mpeg")?"mp3":blob.type.includes("webm")?"webm":blob.type.includes("flac")?"flac":blob.type.includes("ogg")?"ogg":"m4a");
    const name=sanitizeFilename(`${track.artist?track.artist+" - ":""}${track.title||"AK Studio"}`) + `.${ext}`;
    const objectUrl=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=objectUrl;a.download=name;document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
    setNotice({kind:"success",text:`Downloaded ${name}`});
  }catch(error){setNotice({kind:"error",text:error instanceof Error?error.message:"Could not download the audio file."})}
 }
  
 async function exportProjectVideo(){
  setExportOpen(false);
  if(exporting||separating||processing)return;
  if(!backingSrc&&!audioSrc){setNotice({kind:"error",text:"No audio to export yet. Create karaoke first."});return}
  if(!canExportVideoRoughly()){setNotice({kind:"error",text:"Video export needs a modern browser with WebCodecs or MediaRecorder."});return}
  if(playing){mediaRef.current?.pause();vocalRef.current?.pause();setPlaying(false)}
  setExporting(true);setNotice(null);setDownloadProgress(1);setProgressLabel("Exporting video… 1%");
  try{
    await document.fonts?.ready;
    const stage=stageRef.current;
    const lyricText=stage?.querySelector<HTMLElement>(".lyric-canvas p");
    const lyricContainer=stage?.querySelector<HTMLElement>(".lyric-canvas");
    let previewTypography:PreviewTypographyMetrics|undefined;
    if(stage&&lyricText&&lyricContainer){
      const stageBox=stage.getBoundingClientRect();
      const computed=window.getComputedStyle(lyricText);
      const containerComputed=window.getComputedStyle(lyricContainer);
      const fontSizePx=Number.parseFloat(computed.fontSize)||fontSize;
      const lineHeightPx=Number.parseFloat(computed.lineHeight)||fontSizePx*lineHeight;
      const letterSpacingPx=Number.parseFloat(computed.letterSpacing)||0;
      let maxWidthPx=computed.maxWidth.endsWith("px")?Number.parseFloat(computed.maxWidth):0;
      if(!maxWidthPx){
        const probe=document.createElement("canvas").getContext("2d");
        if(probe){probe.font=`${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;maxWidthPx=probe.measureText("0").width*15}
      }
      previewTypography={stageWidth:stageBox.width,stageHeight:stageBox.height,fontSizePx,lineHeightPx,letterSpacingPx,maxWidthPx:maxWidthPx||stageBox.width*.82,lyricHorizontalPaddingPx:(Number.parseFloat(containerComputed.paddingLeft)||0)+(Number.parseFloat(containerComputed.paddingRight)||0),underlineGapPx:12,fontFamily:computed.fontFamily,fontWeight:computed.fontWeight,fontStyle:computed.fontStyle};
    }
    const includeBacking=!(muted||stemMuted.backing);
    const includeVocal=Boolean(vocalSrc)&&!(muted||stemMuted.vocal);
    // If both stems muted, still export backing (or full mix) so the file isn’t silent-by-accident
    const forceBacking=!includeBacking&&!includeVocal;
    const result=await exportKaraokeVideo({
      quality:exportQuality,
      fps:exportFps,
      aspect,
      durationSec:timelineDuration,
      lyrics,
      projectDuration:duration,
      font,
      fontSize,
      lineHeight,
      textStyle,
      textPosition,
      previewTypography,
      track,
      showFreeBadge:plan.plan==="free"||showWatermark,
      backingUrl:backingSrc||audioSrc,
      vocalUrl:vocalSrc,
      includeBacking:includeBacking||forceBacking,
      includeVocal:includeVocal&&!forceBacking,
      onProgress:(n)=>{setDownloadProgress(n);setProgressLabel(`Exporting video… ${n}%`)},
    });
    const savedName=downloadBlob(result.blob, result.filename);
    setDownloadProgress(100);setProgressLabel("Exporting video… 100%");
    window.setTimeout(()=>{setDownloadProgress(null);setProgressLabel(null)},700);
    const kind=savedName.toLowerCase().endsWith(".mp4")||result.mimeType==="video/mp4"?".mp4":savedName.toLowerCase().endsWith(".webm")?".webm":"";
    const specs=`${result.width}×${result.height} · ${result.fps}fps`;
    setNotice({kind:"success",text:kind===".mp4"?`Exported ${savedName} · ${specs}`:kind===".webm"?`Exported ${savedName} · ${specs} (WebM fallback)`:`Exported ${savedName} · ${specs}`});
  }catch(error){
    setNotice({kind:"error",text:error instanceof Error?error.message:"Could not export video."});
    setProgressLabel(null);
    window.setTimeout(()=>setDownloadProgress(null),2500);
  }finally{setExporting(false)}
 }
async function deleteSavedProject(id:string,title:string){const prev=savedProjects;setSavedProjects(list=>list.filter(p=>p.id!==id));try{const r=await fetch(`/api/projects/${id}`,{method:"DELETE"});if(r.status===401){setSavedProjects(prev);setNotice({kind:"error",text:"Sign in to delete a project."});return}if(!r.ok){const err=await r.json().catch(()=>({})) as{error?:string};setSavedProjects(prev);setNotice({kind:"error",text:err.error||"Could not delete project."});return}if(projectId===id){skipSaveRef.current=true;if(saveTimerRef.current){window.clearTimeout(saveTimerRef.current);saveTimerRef.current=null}setProjectId(null);setUrl("");setTrack({title:"",artist:""});setLyrics([]);setDuration(240);setAudioDuration(0);setAnalyzed(false);setSelected(-1);setPosition(0);setBpm(null);setModel(null);setAudioId(null);setAudioApiUrl(null);setBackingApiUrl(null);setVocalApiUrl(null);revokeAudioUrl(audioSrc);revokeAudioUrl(backingSrc);revokeAudioUrl(vocalSrc);setAudioSrc(null);setBackingSrc(null);setVocalSrc(null);setBackingPeaks(null);setVocalPeaks(null);setPlaying(false);setSaveNote(null);setNotice({kind:"success",text:`Deleted “${title}”. Create karaoke to autosave again.`});window.setTimeout(()=>{skipSaveRef.current=false},600)}await refreshSavedProjects()}catch{setSavedProjects(prev);setNotice({kind:"error",text:"Could not delete project."})}
 }
 async function togglePlayback(){const backing=mediaRef.current,vocal=vocalRef.current;if(backingSrc&&backing){try{if(playing){backing.pause();vocal?.pause();setPlaying(false);return}const t=backing.currentTime;if(vocal){vocal.currentTime=t;await Promise.all([backing.play(),vocal.play()])}else await backing.play();setPlaying(true)}catch(error){setPlaying(false);setNotice({kind:"error",text:error instanceof Error?error.message:"Audio could not start. Try again after the stems finish loading."})}return}setPlaying(v=>!v)}
 togglePlaybackRef.current=()=>{void togglePlayback()};
 return <main className="ak-shell"><header className="ak-topbar"><Link className="ak-wordmark" href="/studio" aria-label="AK Studio home"><span><Image src="/logoak.svg" alt="" width={1080} height={1080} /></span><b>Studio</b></Link><div className="project-ident"><strong>{track.title||"Untitled project"}</strong>{track.artist&&<span>{track.artist}</span>}</div><div className="edit-history"><i>{plan.plan==="pro"?"Pro · unlimited":"Free · 1 karaoke per week"}{saveNote?` · ${saveNote}`:projectId?" · autosaved":""}</i></div><div className="header-actions"><button className="icon-button" aria-label="Help" onClick={()=>setNotice({kind:"success",text:"Paste a link to begin. Lyrics follow the playhead automatically."})}><HelpCircle/></button><a className="account-button profile-button" href="/account" aria-label={`Profile: ${user.name}`}><CircleUserRound/><span>{user.name.split(" ")[0]}</span></a><div className="export-menu" ref={exportMenuRef}><button type="button" className="render-button" aria-label="Export" aria-expanded={exportOpen} aria-haspopup="menu" title="Export" onClick={()=>setExportOpen(v=>!v)}><Download/><span className="btn-label">Export</span><ChevronDown/></button>{exportOpen&&<div className="export-menu-panel" role="menu"><button type="button" role="menuitem" className="export-primary" disabled={exporting||separating||processing||(!backingSrc&&!audioSrc)} onClick={()=>void exportProjectVideo()} title="Export karaoke video"><Download/><span>Export video</span><i>{exportQuality} · {exportFps}fps</i></button><button type="button" role="menuitem" disabled={exporting||separating||(!backingSrc&&!audioSrc)} onClick={()=>void downloadProjectAudio()}><span>Download audio</span></button></div>}</div></div></header>
 <form className={`source-bar${processing || separating || exporting || downloadProgress!==null ? " is-progress" : ""}${notice?.kind==="error" && downloadProgress!==null ? " is-error" : ""}`} onSubmit={analyze} aria-busy={processing || separating || exporting || undefined}>
  <div className="source-bar-fill" style={{width: processing || separating || exporting || downloadProgress!==null ? `${Math.max(2, Math.min(100, downloadProgress ?? 2))}%` : "0%"}} aria-hidden="true"/>
  <div className="source-bar-content">
    <Link2/>
    <input aria-label="YouTube Music link" value={url} onChange={e=>setUrl(e.target.value)} onPaste={e=>{const pasted=e.clipboardData.getData("text").trim();if(!pasted)return;e.preventDefault();setUrl(pasted)}} placeholder="Paste a YouTube Music link" disabled={processing || separating || exporting}/>
    <span className={`source-status ${notice ? notice.kind : processing || separating || exporting ? "progress" : ""}`}>
      {processing || separating || exporting || downloadProgress!==null
        ? <><LoaderCircle className="spin"/>{
            progressLabel
              ? progressLabel
              : exporting
                ? `Exporting video… ${Math.max(0, Math.min(100, downloadProgress ?? 0))}%`
                : separating
                  ? `Separating lead vocal… ${Math.max(0, Math.min(100, downloadProgress ?? 0))}%`
                  : processing && (downloadProgress===null || downloadProgress<2)
                    ? "Fetching lyrics…"
                    : `Downloading song… ${Math.max(0, Math.min(100, downloadProgress ?? 0))}%`
          }</>
        : notice ? <>{notice.kind==="success"?<Check/>:<HelpCircle/>}{notice.text}</>
        : null}
    </span>
    {plan.canCreate
      ? <button type="submit" aria-label={processing?"Preparing karaoke":"Create karaoke"} title={processing?"Preparing":"Create karaoke"} disabled={processing||separating||exporting||!isYouTubeLink(url)}>{processing?<LoaderCircle className="spin"/>:<WandSparkles/>}<span className="btn-label">{processing?"Preparing":"Create karaoke"}</span></button>
      : <Link className="limit-link" href="/account">Weekly limit reached · Upgrade</Link>}
  </div>
</form>
 <section className="editor-grid"><aside className="lyrics-panel"><div className="panel-title"><div className="panel-tabs" role="tablist" aria-label="Sidebar"><button type="button" role="tab" aria-selected={leftTab==="lyrics"} className={leftTab==="lyrics"?"active":""} onClick={()=>setLeftTab("lyrics")}>Lyrics</button><button type="button" role="tab" aria-selected={leftTab==="saved"} className={leftTab==="saved"?"active":""} onClick={()=>{setLeftTab("saved");void refreshSavedProjects()}}>Saved</button></div>{leftTab==="lyrics"?<button onClick={addLine} aria-label="Add line"><Plus/></button>:<button onClick={()=>void refreshSavedProjects()} aria-label="Refresh saved projects" title="Refresh"><FolderOpen/></button>}</div>{leftTab==="lyrics"?<><div className="lyrics-list">{lyrics.map((line,i)=><div role="button" tabIndex={0} key={`${line.text}-${i}`} className={selected===i?"selected":""} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==="Enter")setSelected(i)}}><time>{formatTime(line.start)}</time><span contentEditable suppressContentEditableWarning onClick={e=>e.stopPropagation()} onBlur={e=>setLyrics(c=>c.map((v,n)=>n===i?{...v,text:e.currentTarget.textContent||v.text}:v))}>{line.text}</span></div>)}</div><button className="add-line" onClick={addLine} aria-label="Add line" title="Add line"><Plus/><span className="btn-label">Add line</span></button></>:<div className="saved-projects"><p className="saved-hint">{plan.plan==="free"?"Free keeps 1 project for 24 hours. Creating a new karaoke updates that draft.":"Projects autosave for 24 hours while temporary audio is available."}{saveNote?` · ${saveNote}`:""}</p>{hydrating&&<p className="saved-empty">Restoring…</p>}{!hydrating&&savedProjects.length===0&&<p className="saved-empty">No saved projects yet. Create karaoke to autosave.</p>}{savedProjects.map(p=><div key={p.id} className={`saved-card${projectId===p.id?" active":""}`}><button type="button" className="saved-open" onClick={()=>void(async()=>{const r=await fetch(`/api/projects/${p.id}`);if(!r.ok){const err=await r.json().catch(()=>({})) as{error?:string};setNotice({kind:"error",text:err.error||"Could not open project."});await refreshSavedProjects();return}const payload=await r.json() as{id:string;state:StudioProjectState};await applyProjectState(payload.state,payload.id);setLeftTab("lyrics")})}><strong>{p.title||p.name}</strong><span>{p.artist||"AK Studio"}{p.hasAudio?" · audio":""}</span><i>Expires in 24h from last save</i></button><button type="button" className="saved-delete" aria-label={`Delete ${p.title||p.name}`} title="Delete" onClick={e=>{e.preventDefault();e.stopPropagation();void deleteSavedProject(p.id,p.title||p.name)}}><Trash2/></button></div>)}</div>}</aside>
 <section className="preview-column"><div className="preview-tools"><button onClick={()=>setAspect(v=>v==="16:9"?"9:16":v==="9:16"?"1:1":"16:9")} aria-label={`Preview aspect ratio ${aspect}`} title={`Aspect ${aspect}`}><Maximize2/><span className="btn-label">{aspect}</span></button><div className="preview-tools-right"><button type="button" aria-label="Preview watermark" aria-pressed={showWatermark} title="Preview watermark" onClick={()=>setShowWatermark(v=>!v)}><img src="/logoak.svg" alt="" className="watermark-toggle-icon"/></button><button aria-label="Center text" onClick={()=>setTextPosition({x:50,y:50})}><AlignCenter/></button><div className="quality-fps" ref={qualityMenuRef}><button type="button" className="quality-fps-chip" aria-label={`Export quality ${exportQuality}, ${exportFps} frames per second`} aria-expanded={qualityOpen} aria-haspopup="dialog" title="Export quality & FPS" onClick={()=>setQualityOpen(v=>!v)}><b>{exportQuality}</b><span>{exportFps}</span></button>{qualityOpen&&<div className="quality-fps-panel" role="dialog" aria-label="Export quality and FPS"><div className="quality-fps-group"><span>Quality</span><div>{(["4K","2K","1080"] as ExportQuality[]).map(q=><button type="button" key={q} className={exportQuality===q?"active":""} onClick={()=>{setExportQuality(q);setQualityOpen(false)}}>{q}</button>)}</div></div><div className="quality-fps-group"><span>FPS</span><div>{([30,60] as ExportFps[]).map(f=><button type="button" key={f} className={exportFps===f?"active":""} onClick={()=>{setExportFps(f);setQualityOpen(false)}}>{f}</button>)}</div></div></div>}</div></div></div><div className="stage-wrap"><div ref={stageRef} className={`karaoke-stage aspect-${aspect.replace(":","-")}`}>{analyzed&&track.artist&&<div className="stage-meta"><span>AK / {track.artist}</span></div>}{showWatermark&&<img className="stage-watermark-logo" src="/logoak.svg" alt="AK Studio watermark" draggable={false}/>} {activeLyric&&<>{snap.x&&<i className="snap-guide vertical"/>}{snap.y&&<i className="snap-guide horizontal"/>}<div className="lyric-canvas" tabIndex={0} aria-label="Lyric position; drag or use arrow keys" onPointerDown={dragText} onKeyDown={nudge} style={{fontFamily:font,left:`${textPosition.x}%`,top:`${textPosition.y}%`,fontSize:`${fontSize}px`,lineHeight,fontWeight:textStyle.bold?700:500,fontStyle:textStyle.italic?"italic":"normal",textDecoration:textStyle.underline?"underline":"none",textAlign:textStyle.align,color:textStyle.color}}><p>{activeLyric.text}</p></div></>}</div></div>{backingSrc&&<audio hidden ref={mediaRef} src={backingSrc} muted={muted||stemMuted.backing} preload="auto" playsInline onLoadedMetadata={e=>{const d=e.currentTarget.duration;if(d>0&&Number.isFinite(d)){setAudioDuration(prev=>Math.max(prev,d));setDuration(prev=>Math.max(prev,d))}}} onTimeUpdate={e=>{const media=e.currentTarget;const total=Math.max(timelineDuration,media.duration||0,audioDuration,1);setPosition(total?media.currentTime/total*100:0);if(vocalRef.current&&Math.abs(vocalRef.current.currentTime-media.currentTime)>0.35)vocalRef.current.currentTime=media.currentTime}} onPlay={()=>{if(vocalRef.current&&vocalSrc&&!stemMuted.vocal&&!muted){vocalRef.current.currentTime=mediaRef.current?.currentTime||0;void vocalRef.current.play().catch(()=>undefined)}}} onPause={()=>vocalRef.current?.pause()} onEnded={()=>{setPlaying(false);setPosition(0);vocalRef.current?.pause()}}/>}{vocalSrc&&<audio hidden ref={vocalRef} src={vocalSrc} muted={muted||stemMuted.vocal} preload="auto" playsInline/>}<div className="transport"><button className="transport-main" disabled={!backingSrc} onClick={togglePlayback} aria-label={playing?"Pause song":"Play song"}>{playing?<Pause/>:<Play fill="currentColor"/>}</button><time>{playTime}</time><div className="scrub" role="slider" aria-label="Playback position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)} tabIndex={0} onPointerDown={scrubFromPointer} onKeyDown={e=>{if(e.key==="ArrowLeft"){e.preventDefault();const next=Math.max(0,position-1);setPosition(next);const seconds=next/100*timelineDuration;if(mediaRef.current)mediaRef.current.currentTime=seconds;if(vocalRef.current)vocalRef.current.currentTime=seconds}if(e.key==="ArrowRight"){e.preventDefault();const next=Math.min(100,position+1);setPosition(next);const seconds=next/100*timelineDuration;if(mediaRef.current)mediaRef.current.currentTime=seconds;if(vocalRef.current)vocalRef.current.currentTime=seconds}}}><i style={{width:`${position}%`}}/><button type="button" style={{left:`${position}%`}} tabIndex={-1} aria-hidden="true"/></div><time>{analyzed?formatTime(timelineDuration):"0:00"}</time><button className="icon-button" aria-label={muted?"Enable sound":"Mute sound"} onClick={()=>setMuted(v=>!v)}>{muted?<VolumeX/>:<Volume2/>}</button></div></section>
 <aside className="inspector"><div className="panel-title"><h2>Text & audio</h2><button aria-label="Reset text" onClick={()=>{setTextPosition({x:50,y:50});setFontSize(72);setLineHeight(.94)}}><Undo2/></button></div><label className="field-label">Typeface<select value={font} onChange={e=>setFont(e.target.value)}><option>Avenir Next</option><option>Avenir Next Condensed</option><option>Georgia</option><option>Courier New</option></select></label><div className="field-row"><label>Size<input value={fontSize} onChange={e=>setFontSize(Number(e.target.value)||72)}/></label><label>Line height<input value={lineHeight} onChange={e=>setLineHeight(Number(e.target.value)||.94)}/></label></div><div className="segmented"><button onClick={()=>setTextStyle(s=>({...s,bold:false,italic:false,underline:false}))}>Aa</button><button className={textStyle.bold?"active":""} onClick={()=>setTextStyle(s=>({...s,bold:!s.bold}))}><b>Aa</b></button><button className={textStyle.italic?"active":""} onClick={()=>setTextStyle(s=>({...s,italic:!s.italic}))}><i>Aa</i></button><button className={textStyle.underline?"active":""} onClick={()=>setTextStyle(s=>({...s,underline:!s.underline}))}><u>Aa</u></button></div><div className="inspector-section"><span>Alignment</span><div className="alignment">{(["left","center","right"] as const).map((a,i)=>{const Icon=[AlignLeft,AlignCenter,AlignRight][i];return<button key={a} className={textStyle.align===a?"active":""} aria-label={`Align ${a}`} onClick={()=>setTextStyle(s=>({...s,align:a}))}><Icon/></button>})}</div></div><div className="inspector-section"><span>Color</span><div className="swatches">{[["white","#fff"],["black","#111"],["gray","#aaa"]].map(([name,color])=><button key={name} className={name} aria-label={name} onClick={()=>setTextStyle(s=>({...s,color}))}/>)}</div></div><div className="status-card"><strong>{hasLeadVocal?(model||"Stems ready"):model==="full-mix"?"Full mix on timeline":model||"Song audio"}</strong><p>{hasLeadVocal?"Lead vocal and backing + instrumental are ready on separate tracks.":model==="full-mix"?"Full song audio is on the backing track. Right-click the waveform to separate the lead vocal.":backingSrc?"Right-click the full-mix waveform to separate the lead vocal when the GPU processor is available.":"Create a karaoke to download the song onto the timeline."}</p></div></aside></section>
 <section className="timeline-shell"><div className="timeline-toolbar"><div><button disabled aria-label="Split" title="Split"><Scissors/><span className="btn-label">Split</span></button><button disabled={selected<0} aria-label="Delete" title="Delete" onClick={()=>setLyrics(c=>c.filter((_,i)=>i!==selected))}><Minus/><span className="btn-label">Delete</span></button></div><div className="tempo" title="BPM" aria-label={bpm?`Tempo ${Math.round(bpm)} BPM`:"Tempo unavailable"}><Gauge/><b>{bpm?Math.round(bpm):"—"}</b><span className="btn-label">BPM</span></div><div><button aria-label="Zoom out" onClick={()=>changeZoom(zoomRef.current-10)}><ZoomOut/></button><input type="range" min={0} max={100} step={1} value={zoom} onChange={e=>changeZoom(Number(e.target.value))} aria-label="Timeline zoom"/><button aria-label="Zoom in" onClick={()=>changeZoom(zoomRef.current+10)}><ZoomIn/></button></div></div><div className="timeline-body"><div className={`track-heads${hasLeadVocal?"":" no-vocal"}`}><div role="group" title="Lyrics" aria-label="Lyrics"><Captions aria-hidden="true"/><button type="button" aria-label="Add lyric line" title="Add lyric line" onClick={addLine}><Plus/></button></div><div role="group" title={hasLeadVocal?"Backing + instrumental":"Full mix / backing"} aria-label={hasLeadVocal?"Backing + instrumental":"Full mix / backing"}><Music aria-hidden="true"/><button type="button" title={stemMuted.backing?"Unmute backing":"Mute backing"} aria-label={stemMuted.backing?"Unmute backing":"Mute backing"} onClick={()=>setStemMuted(s=>({...s,backing:!s.backing}))}>{stemMuted.backing?<VolumeX/>:<Volume2/>}</button></div>{hasLeadVocal&&<div role="group" title="Lead vocal" aria-label="Lead vocal"><Mic2 aria-hidden="true"/><button type="button" title={stemMuted.vocal?"Unmute lead vocal":"Mute lead vocal"} aria-label={stemMuted.vocal?"Unmute lead vocal":"Mute lead vocal"} onClick={()=>setStemMuted(s=>({...s,vocal:!s.vocal}))}>{stemMuted.vocal?<VolumeX/>:<Volume2/>}</button></div>}</div><div className="timeline-scroll" ref={timelineScrollRef}><div style={{width:`${timelineScale*100}%`}} className={`track-canvas${timelineLocked?" is-locked":""}`} ref={timelineRef} onPointerDown={e=>{if(timelineLocked){e.preventDefault();e.stopPropagation();return}scrubFromPointer(e)}}><div className="time-ruler">{Array.from({length:9},(_,i)=>analyzed?Math.round(timelineDuration/8*i):0).map((v,i)=><span key={i}>{formatTime(v)}</span>)}</div>{analyzed&&<div className="beat-grid">{Array.from({length:48}).map((_,i)=><i key={i} className={i%4===0?"bar":"beat"}/>)}</div>}<div className="playhead" role="slider" aria-label="Playhead" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)} tabIndex={0} style={{left:`${position}%`}} onPointerDown={e=>{e.stopPropagation();if(timelineLocked){e.preventDefault();return}dragHead(e)}} onKeyDown={e=>{if(e.key==="ArrowLeft")setPosition(v=>Math.max(0,v-1));if(e.key==="ArrowRight")setPosition(v=>Math.min(100,v+1))}}><b/></div><div className="lyric-track" style={{width:"100%",minWidth:timelineMinWidth}}>{lyrics.map((line,i)=>{const span=lyricSpanSec(line);const leftPct=(line.start/timelineDuration)*100;const widthPct=(span/timelineDuration)*100;return <button key={`${line.text}-${i}`} className={selected===i||activeIndex===i?"selected":""} style={{left:`${leftPct}%`,width:`${Math.max(0.15,widthPct)}%`}} onClick={()=>setSelected(i)} onPointerDown={e=>{e.stopPropagation();dragLyric(e,i)}}><span>{line.text}</span></button>})}</div>{analyzed&&<><WaveformTrack className={`backing ${stemMuted.backing?"muted-track":""}${separating?" is-separating":""}`} peaks={backingPeaks} minWidth={timelineMinWidth} widthPercent={waveWidthPercent} maxBarHeight={40} interactive={Boolean(backingSrc)&&!hasLeadVocal&&!separating&&!exporting&&!stemMenuOpen} title={backingSrc&&!hasLeadVocal?"Right-click to separate lead vocal":undefined} aria-label={backingSrc&&!hasLeadVocal?"Full mix track. Right-click to separate lead vocal.":"Backing track"} onContextMenu={e=>{if(!backingSrc||hasLeadVocal||separating||exporting)return;e.preventDefault();e.stopPropagation();setStemMenu({x:Math.min(e.clientX,window.innerWidth-200),y:Math.min(e.clientY,window.innerHeight-56)});setExportOpen(false)}}>{separating&&<div className="wave-fill" style={{width:`${Math.max(2,Math.min(100,downloadProgress??2))}%`}} aria-hidden="true"/>}</WaveformTrack>{hasLeadVocal&&<WaveformTrack className={`vocal ${stemMuted.vocal?"muted-track":""}`} peaks={vocalPeaks} minWidth={timelineMinWidth} widthPercent={waveWidthPercent} maxBarHeight={32}/>}</>}</div></div></div>{stemMenuOpen&&<><div className="stem-menu-backdrop" aria-hidden="true" onPointerDown={e=>{e.preventDefault();e.stopPropagation();setStemMenu(null)}} onClick={e=>{e.preventDefault();e.stopPropagation()}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setStemMenu(null)}}/><div ref={stemMenuRef} className="stem-context-menu" role="menu" style={{left:stemMenu!.x,top:stemMenu!.y}} onPointerDown={e=>{e.stopPropagation()}} onClick={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation()}}><button type="button" role="menuitem" disabled={separating||exporting||!audioId} onPointerDown={e=>{e.stopPropagation()}} onClick={e=>{e.stopPropagation();void separateLeadVocal()}}>Separate lead vocal</button></div></>}</section>
 </main>
}
