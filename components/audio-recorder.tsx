"use client";
import {useEffect,useRef,useState} from 'react';
import {Mic,Square,Trash2,Plus} from 'lucide-react';
export function AudioRecorder({disabled,onUse}:{disabled:boolean;onUse:(blob:Blob)=>void}){
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[device,setDevice]=useState('default'),[recording,setRecording]=useState(false),[pending,setPending]=useState(false),[blob,setBlob]=useState<Blob|null>(null),[url,setUrl]=useState<string|null>(null),[error,setError]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;const refresh=()=>{void navigator.mediaDevices?.enumerateDevices().then(d=>{if(mounted.current)setDevices(d.filter(x=>x.kind==='audioinput'))}).catch(()=>undefined)};refresh();navigator.mediaDevices?.addEventListener('devicechange',refresh);return()=>{mounted.current=false;navigator.mediaDevices?.removeEventListener('devicechange',refresh);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 useEffect(()=>{if(!blob){setUrl(null);return}const next=URL.createObjectURL(blob);setUrl(next);return()=>URL.revokeObjectURL(next)},[blob]);
 async function start(){if(disabled||pending||recording)return;setError('');setPending(true);try{
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Audio recording is not supported in this browser.');
  const media=await navigator.mediaDevices.getUserMedia({audio:device==='default'?true:{deviceId:{exact:device}},video:false});
  if(!mounted.current){media.getTracks().forEach(t=>t.stop());return}stream.current=media;
  const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const next=new MediaRecorder(media,mime?{mimeType:mime}:undefined),chunks:Blob[]=[];recorder.current=next;
  next.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  next.onstop=()=>{media.getTracks().forEach(t=>t.stop());stream.current=null;if(mounted.current){setRecording(false);if(chunks.length)setBlob(new Blob(chunks,{type:next.mimeType}))}};
  next.onerror=()=>{media.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);setError('Recording failed. Please try again.')}};
  next.start(250);setRecording(true);setBlob(null);setDevices((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'));
 }catch(e){stream.current?.getTracks().forEach(t=>t.stop());setError(e instanceof DOMException&&e.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser settings.':e instanceof Error?e.message:'Could not access the microphone.')}finally{if(mounted.current)setPending(false)}}
 return <section className="inspector-section recording-controls"><span>Record audio</span><label>Microphone<select aria-label="Microphone" value={device} disabled={recording||pending||disabled} onChange={e=>setDevice(e.target.value)}><option value="default">System default</option>{devices.filter(d=>d.deviceId&&d.deviceId!=='default').map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Microphone ${i+1}`}</option>)}</select></label><button type="button" disabled={disabled||pending} onClick={()=>recording?recorder.current?.stop():void start()} aria-label={recording?'Stop recording':'Record audio'}>{recording?<Square/>:<Mic/>}{recording?'Stop recording':pending?'Connecting…':'Record audio'}</button>{recording&&<p role="status">Recording…</p>}{url&&<><audio controls src={url} aria-label="Recording preview"/><p>Adding replaces the voice track. Recording stays on this device.</p><div><button type="button" disabled={disabled} onClick={()=>{if(blob)onUse(blob);setBlob(null)}}><Plus/>Use recording</button><button type="button" aria-label="Discard recording" onClick={()=>setBlob(null)}><Trash2/></button></div></>}{error&&<p role="alert">{error}</p>}</section>;
}
