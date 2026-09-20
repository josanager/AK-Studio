"use client";

import { useEffect, useRef, useState } from "react";
import {
  Captions, ChevronDown, CircleUserRound, Download, Film, Image as ImageIcon,
  Layers3, Menu, Mic2, Music2, Pause, Play, Plus, Redo2, Scissors,
  Settings2, Sparkles, Type, Undo2, Upload, Volume2, WandSparkles, X,
} from "lucide-react";

const tools = [["Medios", Film], ["Texto", Type], ["Audio", Music2], ["Subtítulos", Captions], ["Recursos", ImageIcon], ["IA", Sparkles]] as const;

export default function Studio() {
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Campaña verano.mp4");
  const [progress, setProgress] = useState(34);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    const context = (document as unknown as {modelContext?: {registerTool:(tool:unknown,options?:{signal?:AbortSignal})=>void|Promise<void>}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({name:"read_editor_state",title:"Leer estado del editor",description:"Devuelve el proyecto activo y el progreso visible del editor de vídeo.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({project:fileName,hasLocalVideo:Boolean(videoUrl),progressPercent:Math.round(progress)})},{signal:lifecycle.signal}));
    void Promise.resolve(context.registerTool({name:"open_account_settings",title:"Abrir cuenta y facturación",description:"Abre la página de cuenta, claves API y suscripción del usuario.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{location.href="/account";return {navigating:true}}},{signal:lifecycle.signal}));
    return () => lifecycle.abort();
  }, [fileName, progress, videoUrl]);
  function pickVideo(file?: File) { if (!file) return; if (videoUrl) URL.revokeObjectURL(videoUrl); setVideoUrl(URL.createObjectURL(file)); setFileName(file.name); setProgress(0); }
  function togglePlayback() { const video = videoRef.current; if (!video) return setPlaying(v => !v); if (video.paused) void video.play(); else video.pause(); }

  return <main className="studio-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Film size={18}/></span><span>Frameflow</span></div>
      <button className="project-title"><span>{fileName.replace(/\.[^.]+$/, "")}</span><ChevronDown size={15}/></button>
      <div className="history"><button aria-label="Deshacer"><Undo2 size={17}/></button><button aria-label="Rehacer"><Redo2 size={17}/></button><span className="save-state">Guardado</span></div>
      <div className="top-actions"><a className="plan-pill" href="/account"><WandSparkles size={15}/> Pro</a><button className="export-button"><Download size={16}/> Exportar</button><a className="avatar" href="/account" aria-label="Cuenta"><CircleUserRound size={21}/></a></div>
    </header>
    <section className="workspace">
      <nav className="rail" aria-label="Herramientas">{tools.map(([label, Icon], i) => <button className={i === 0 ? "active" : ""} key={label}><Icon size={20}/><span>{label}</span></button>)}</nav>
      <aside className="asset-panel">
        <div className="panel-heading"><div><p className="eyebrow">Biblioteca</p><h2>Medios</h2></div><button aria-label="Cerrar panel"><X size={18}/></button></div>
        <label className="upload-card"><input type="file" accept="video/*" onChange={e => pickVideo(e.target.files?.[0])}/><span className="upload-icon"><Upload size={20}/></span><strong>Sube un vídeo</strong><small>MP4, MOV o WebM · hasta 2 GB</small></label>
        <div className="asset-tabs"><button className="selected">Tus archivos</button><button>Stock</button></div>
        <article className="media-card"><div className="media-thumb"><div className="thumb-sky"/><span>00:24</span></div><div><strong>{fileName}</strong><small>1920 × 1080</small></div><button aria-label="Añadir al lienzo"><Plus size={17}/></button></article>
        <article className="tip-card"><Sparkles size={18}/><div><strong>Edita más rápido</strong><p>Quita silencios y genera subtítulos con IA.</p></div></article>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><button><Menu size={16}/> 16:9</button><div><button aria-label="Volumen"><Volume2 size={16}/></button><button aria-label="Ajustes"><Settings2 size={16}/></button></div></div>
        <div className="canvas-stage">{videoUrl ? <video ref={videoRef} src={videoUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={e => { const v=e.currentTarget; if(v.duration) setProgress(v.currentTime/v.duration*100); }}/> : <div className="placeholder-frame"><div className="sun"/><div className="horizon one"/><div className="horizon two"/><div className="caption-chip">Tu historia empieza aquí</div></div>}</div>
        <div className="transport"><button onClick={togglePlayback} aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? <Pause size={18}/> : <Play size={18} fill="currentColor"/>}</button><span>00:08.4</span><div className="transport-line"><i style={{width:`${progress}%`}}/></div><span>00:24.0</span><button aria-label="Volumen"><Volume2 size={18}/></button></div>
      </section>
      <aside className="properties-panel">
        <div className="panel-heading"><div><p className="eyebrow">Inspector</p><h2>Vídeo</h2></div><button><Settings2 size={18}/></button></div>
        <div className="property-group"><label>Posición y tamaño</label><div className="field-grid"><span>X <b>0</b></span><span>Y <b>0</b></span><span>W <b>1920</b></span><span>H <b>1080</b></span></div></div>
        <div className="property-group"><label>Opacidad <b>100%</b></label><input aria-label="Opacidad" type="range" defaultValue="100"/></div>
        <div className="property-group"><label>Volumen <b>100%</b></label><input aria-label="Volumen" type="range" defaultValue="100"/></div>
        <div className="property-group"><label>Velocidad</label><div className="speed-row"><button>0.5×</button><button className="active">1×</button><button>1.5×</button><button>2×</button></div></div>
        <button className="remove-bg"><WandSparkles size={17}/> Eliminar fondo <span>IA</span></button>
      </aside>
    </section>
    <section className="timeline">
      <div className="timeline-actions"><div><button><Scissors size={16}/> Dividir</button><button><Mic2 size={16}/> Voz</button></div><div><button>−</button><input aria-label="Zoom" type="range" defaultValue="48"/><button>+</button></div></div>
      <div className="tracks"><div className="track-labels"><span><Layers3 size={15}/> Vídeo</span><span><Music2 size={15}/> Audio</span></div><div className="track-content"><div className="ruler">{[0,3,6,9,12,15,18,21,24].map(n=><span key={n}>{n}s</span>)}</div><div className="playhead" style={{left:`calc(${progress}% - 1px)`}}/><div className="video-clip"><div className="clip-stripes"/><strong>{fileName}</strong><span>00:24</span></div><div className="audio-clip">{Array.from({length:42}).map((_,i)=><i key={i} style={{height:`${8+(i*13)%24}px`}}/>)}</div></div></div>
    </section>
  </main>;
}
