"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlignCenter, AlignLeft, AlignRight, Captions, Check, ChevronDown, CircleUserRound, Download,
  Gauge, HelpCircle, Link2, LoaderCircle, Lock, Menu, Mic2, Minus, Music,
  MoreHorizontal, Pause, Play, Plus, Redo2, Scissors, Settings, SlidersHorizontal,
  Type, Undo2, Volume2, WandSparkles, ZoomIn, ZoomOut,
} from "lucide-react";

type TrackInfo = { title: string; artist: string; lyrics?: string[] };

const seedLyrics = [
  { text: "We were running through the city lights", start: 6.2, width: 18 },
  { text: "Trying to make the moment last", start: 10.1, width: 15 },
  { text: "Every shadow turned to silver", start: 14.0, width: 16 },
  { text: "When you said my name", start: 18.0, width: 12 },
];

const waveform = Array.from({ length: 124 }, (_, i) => 8 + ((i * 23 + i * i * 3) % 38));

export default function Studio() {
  const [url, setUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<{kind:"success"|"error",text:string}|null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [track, setTrack] = useState<TrackInfo>({ title: "Midnight City", artist: "M83" });
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(27);
  const [selectedLyric, setSelectedLyric] = useState(1);
  const [lyrics, setLyrics] = useState(seedLyrics);
  const [font, setFont] = useState("Avenir Next");
  const [fontSize, setFontSize] = useState(72);
  const [lineHeight, setLineHeight] = useState(.94);
  const [textStyle, setTextStyle] = useState({bold:true,italic:false,underline:false,align:"center" as "left"|"center"|"right",color:"#fff"});
  const [textPosition, setTextPosition] = useState({x:50,y:50});
  const [snap, setSnap] = useState({x:false,y:false});
  const [zoom, setZoom] = useState(62);
  const [muted, setMuted] = useState(false);
  const [stemMuted, setStemMuted] = useState({backing:false,vocal:false});
  const [aspect, setAspect] = useState<"16:9"|"9:16">("16:9");
  const [activeTool, setActiveTool] = useState<"lyrics"|"type"|"audio"|"vocals"|"settings">("lyrics");
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setPosition((value) => value >= 95 ? 0 : value + .18), 50);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (!playing || muted) return;
    const click = () => {
      const context = audioRef.current || new AudioContext(); audioRef.current = context;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.value = 880; gain.gain.setValueAtTime(.055, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .045);
      oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .05);
    };
    click(); const id = window.setInterval(click, 60000 / 118); return () => window.clearInterval(id);
  }, [playing, muted]);

  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: "read_karaoke_project", title: "Leer proyecto de karaoke", description: "Devuelve la canción, el estado del análisis y la línea seleccionada.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ title: track.title, artist: track.artist, bpm: analyzed ? null : 118, demo: !analyzed, progressPercent: Math.round(position), selectedLyric: lyrics[selectedLyric]?.text }) }, { signal: lifecycle.signal }));
    return () => lifecycle.abort();
  }, [track, position, lyrics, selectedLyric, analyzed]);

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setNotice(null); setProcessing(true);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await response.json() as { error?: string; title?: string; artist?: string; lyrics?: string[] };
      if (!response.ok) throw new Error(data.error || "No se pudo analizar el enlace.");
      setTrack({ title: data.title || "Nueva canción", artist: data.artist || "YouTube", lyrics: data.lyrics });
      setAnalyzed(true);
      if (data.lyrics?.length) setLyrics(data.lyrics.slice(0, 4).map((text, i) => ({ text, start: 6.2 + i * 4, width: Math.min(20, 10 + text.length / 4) })));
      setPosition(0); setNotice({kind:"success",text:"Metadatos y letra listos · audio pendiente"});
    } catch (error) { setNotice({kind:"error",text:error instanceof Error ? error.message : "No se pudo analizar el enlace."}); }
    finally { setProcessing(false); }
  }

  const playTime = useMemo(() => {
    const seconds = Math.round(position * 2.42); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, [position]);

  function startTextDrag(event: React.PointerEvent<HTMLDivElement>) {
    const stage = stageRef.current; if (!stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (clientX:number, clientY:number) => {
      const rect = stage.getBoundingClientRect(); let x = Math.max(10, Math.min(90, (clientX-rect.left)/rect.width*100)); let y = Math.max(15, Math.min(85, (clientY-rect.top)/rect.height*100));
      const sx = Math.abs(x-50)<3; const sy = Math.abs(y-50)<3; if(sx)x=50;if(sy)y=50;setSnap({x:sx,y:sy});setTextPosition({x,y});
    };
    move(event.clientX,event.clientY);
    const target=event.currentTarget; const onMove=(e:PointerEvent)=>move(e.clientX,e.clientY); const stop=()=>{target.removeEventListener("pointermove",onMove);setSnap({x:false,y:false})};
    target.addEventListener("pointermove",onMove); target.addEventListener("pointerup",stop,{once:true});
  }

  function nudgeText(event: React.KeyboardEvent<HTMLDivElement>) { const step=event.shiftKey?5:1; const delta:{[key:string]:[number,number]}={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}; if(!delta[event.key])return;event.preventDefault();const [dx,dy]=delta[event.key];setTextPosition(p=>({x:Math.max(10,Math.min(90,p.x+dx)),y:Math.max(15,Math.min(85,p.y+dy))})); }

  return <main className="ak-shell">
    <header className="ak-topbar">
      <Link className="ak-wordmark" href="/" aria-label="AK Studio, inicio"><span>AK</span><b>Studio</b></Link>
      <div className="project-ident"><strong>{track.title}</strong><span>{track.artist}</span><ChevronDown size={14}/></div>
      <div className="edit-history"><button disabled aria-label="Deshacer"><Undo2/></button><button disabled aria-label="Rehacer"><Redo2/></button><i>Vista demo</i></div>
      <div className="header-actions"><button className="icon-button" aria-label="Ayuda" onClick={()=>setNotice({kind:"success",text:"Arrastra la letra; usa flechas para precisión y Mayús para saltos grandes."})}><HelpCircle/></button><Link className="account-button" href="/account" aria-label="Cuenta"><CircleUserRound/></Link><button className="render-button" onClick={()=>setNotice({kind:"error",text:"Conecta el procesador de audio para habilitar la exportación."})}><Download/> Exportar</button></div>
    </header>

    <form className="source-bar" onSubmit={analyze}>
      <Link2 aria-hidden="true"/>
      <input aria-label="Enlace de YouTube Music" value={url} onChange={e => setUrl(e.target.value)} placeholder="Pega un enlace de YouTube Music"/>
      {notice && <span className={`source-status ${notice.kind}`}>{notice.kind === "success" ? <Check/> : <HelpCircle/>} {notice.text}</span>}
      <label className="rights-check"><input type="checkbox" required/> Tengo permiso para usar este contenido</label>
      <button disabled={processing || !url.trim()}>{processing ? <LoaderCircle className="spin"/> : <WandSparkles/>}{processing ? "Analizando" : "Analizar"}</button>
    </form>

    <section className={`editor-grid tool-${activeTool}`}>
      <nav className="tool-dock" aria-label="Herramientas">
        <button className={activeTool === "lyrics" ? "active" : ""} onClick={() => setActiveTool("lyrics")} aria-label="Letra"><Captions/></button>
        <button className={activeTool === "type" ? "active" : ""} onClick={() => setActiveTool("type")} aria-label="Tipografía"><Type/></button>
        <button className={activeTool === "audio" ? "active" : ""} onClick={() => setActiveTool("audio")} aria-label="Audio"><Music/></button>
        <button className={activeTool === "vocals" ? "active" : ""} onClick={() => setActiveTool("vocals")} aria-label="Voces"><Mic2/></button>
        <button className={activeTool === "settings" ? "active" : ""} onClick={() => setActiveTool("settings")} aria-label="Ajustes"><SlidersHorizontal/></button>
        <span/>
        <button aria-label="Configuración" onClick={()=>setActiveTool("settings")}><Settings/></button>
      </nav>

      <aside className="lyrics-panel">
        <div className="panel-title"><h2>Letra</h2><button onClick={() => setLyrics(current => [...current,{text:"Nueva línea",start:(current.at(-1)?.start||0)+4,width:12}])} aria-label="Añadir línea"><Plus/></button></div>
        <div className="lyrics-list">
          {lyrics.map((line, index) => <div role="button" tabIndex={0} key={`${line.text}-${index}`} className={selectedLyric === index ? "selected" : ""} onClick={() => setSelectedLyric(index)} onKeyDown={e => {if(e.key === "Enter") setSelectedLyric(index)}}><time>00:{String(Math.round(line.start)).padStart(2,"0")}</time><span contentEditable suppressContentEditableWarning onClick={e => e.stopPropagation()} onBlur={e => setLyrics(current => current.map((item,i) => i === index ? {...item,text:e.currentTarget.textContent || item.text} : item))}>{line.text}</span></div>)}
        </div>
        <button className="add-line" onClick={() => setLyrics(current => [...current,{text:"Nueva línea",start:(current.at(-1)?.start||0)+4,width:12}])}><Plus/> Añadir línea</button>
      </aside>

      <section className="preview-column">
        <div className="preview-tools"><button onClick={()=>setAspect(v=>v==="16:9"?"9:16":"16:9")}><Menu/> {aspect}</button><div><button aria-label="Centrar texto" onClick={()=>setTextPosition({x:50,y:50})}><AlignCenter/></button><button aria-label="Opciones" onClick={()=>setActiveTool("settings")}><Settings/></button></div></div>
        <div className="stage-wrap">
          <div ref={stageRef} className={`karaoke-stage aspect-${aspect.replace(":","-")}`}>
            <div className="stage-meta"><span>AK / {track.artist}</span><span>01:42</span></div>
            {snap.x&&<i className="snap-guide vertical"/>}{snap.y&&<i className="snap-guide horizontal"/>}
            <div className="lyric-canvas" tabIndex={0} aria-label="Posición de la letra; arrastra o usa las flechas" onPointerDown={startTextDrag} onKeyDown={nudgeText} style={{fontFamily: font,left:`${textPosition.x}%`,top:`${textPosition.y}%`,fontSize:`${fontSize}px`,lineHeight,fontWeight:textStyle.bold?700:500,fontStyle:textStyle.italic?"italic":"normal",textDecoration:textStyle.underline?"underline":"none",textAlign:textStyle.align,color:textStyle.color}}><p>{lyrics[selectedLyric]?.text}</p><i aria-hidden="true"/></div>
            <span className="watermark">AK STUDIO</span>
          </div>
        </div>
        <div className="transport">
          <button className="transport-main" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? <Pause/> : <Play fill="currentColor"/>}</button>
          <time>{playTime}</time><div className="scrub"><i style={{width:`${position}%`}}/><button style={{left:`${position}%`}} aria-label="Posición de reproducción"/></div><time>4:02</time>
          <button className="icon-button" aria-label={muted?"Activar sonido":"Silenciar"} onClick={()=>setMuted(v=>!v)}><Volume2 className={muted?"muted-icon":""}/></button>
        </div>
      </section>

      <aside className="inspector">
        <div className="panel-title"><h2>{activeTool==="audio"?"Audio":activeTool==="vocals"?"Voces":activeTool==="settings"?"Proyecto":"Texto"}</h2><button aria-label="Restablecer" onClick={()=>{setTextPosition({x:50,y:50});setFontSize(72);setLineHeight(.94)}}><Undo2/></button></div>
        {(activeTool==="audio"||activeTool==="vocals"||activeTool==="settings") && <div className="status-card"><strong>{activeTool==="audio"?"Audio de demostración":activeTool==="vocals"?"Separación pendiente":"Ajustes del proyecto"}</strong><p>{activeTool==="audio"?"El reproductor emite un clic a 118 BPM. La canción real se habilita al conectar el procesador.":activeTool==="vocals"?"Conecta Music.ai o Moises para separar voz principal e instrumental + coros.":"Arrastra la letra en el lienzo. El imán aparece al cruzar los ejes centrales."}</p></div>}
        {(activeTool==="lyrics"||activeTool==="type") && <>
        <label className="field-label">Tipografía<select value={font} onChange={e => setFont(e.target.value)}><option>Avenir Next</option><option>Avenir Next Condensed</option><option>Georgia</option><option>Courier New</option></select></label>
        <div className="field-row"><label>Tamaño<input value={fontSize} onChange={e=>setFontSize(Number(e.target.value)||72)} inputMode="numeric"/></label><label>Interlineado<input value={lineHeight} onChange={e=>setLineHeight(Number(e.target.value)||.94)} inputMode="decimal"/></label></div>
        <div className="segmented"><button onClick={()=>setTextStyle(s=>({...s,bold:false,italic:false,underline:false}))}>Aa</button><button className={textStyle.bold?"active":""} onClick={()=>setTextStyle(s=>({...s,bold:!s.bold}))}><b>Aa</b></button><button className={textStyle.italic?"active":""} onClick={()=>setTextStyle(s=>({...s,italic:!s.italic}))}><i>Aa</i></button><button className={textStyle.underline?"active":""} onClick={()=>setTextStyle(s=>({...s,underline:!s.underline}))}><u>Aa</u></button></div>
        <div className="inspector-section"><span>Alineación</span><div className="alignment">{(["left","center","right"] as const).map((align,i)=>{const Icon=[AlignLeft,AlignCenter,AlignRight][i];return <button key={align} className={textStyle.align===align?"active":""} aria-label={`Alinear ${align}`} onClick={()=>setTextStyle(s=>({...s,align}))}><Icon/></button>})}</div></div>
        <div className="inspector-section"><span>Color</span><div className="swatches">{[["white","#fff"],["black","#111"],["gray","#aaa"]].map(([name,color])=><button key={name} className={name} aria-label={name} onClick={()=>setTextStyle(s=>({...s,color}))}/>)}</div></div>
        <div className="inspector-section"><span>Animación</span><select><option>Seguimiento por palabra</option><option>Seguimiento por línea</option><option>Sin animación</option></select></div>
        </>}
      </aside>
    </section>

    <section className="timeline-shell">
      <div className="timeline-toolbar">
        <div><button disabled><Scissors/> Dividir</button><button onClick={() => setLyrics(current => current.filter((_,i) => i !== selectedLyric))}><Minus/> Eliminar</button></div>
        <div className="tempo"><Gauge/><b>{analyzed ? "—" : "118"}</b><span>BPM</span><button disabled><ChevronDown/></button></div>
        <div><button aria-label="Alejar" onClick={()=>setZoom(v=>Math.max(20,v-10))}><ZoomOut/></button><input type="range" value={zoom} onChange={e=>setZoom(Number(e.target.value))} aria-label="Zoom de la línea de tiempo"/><button aria-label="Acercar" onClick={()=>setZoom(v=>Math.min(100,v+10))}><ZoomIn/></button></div>
      </div>
      <div className="timeline-body">
        <div className="track-heads"><div><Captions/><span>Letra</span><button aria-label="Añadir letra" onClick={()=>setLyrics(c=>[...c,{text:"Nueva línea",start:(c.at(-1)?.start||0)+4,width:12}])}><Plus/></button></div><div><Music/><span>Instrumental + coros</span><button aria-label="Silenciar instrumental" onClick={()=>setStemMuted(s=>({...s,backing:!s.backing}))}>{stemMuted.backing?<Volume2 className="muted-icon"/>:<MoreHorizontal/>}</button></div><div><Mic2/><span>Voz principal</span><button aria-label="Silenciar voz" onClick={()=>setStemMuted(s=>({...s,vocal:!s.vocal}))}>{stemMuted.vocal?<Volume2 className="muted-icon"/>:<MoreHorizontal/>}</button></div></div>
        <div className="track-canvas">
          <div className="time-ruler">{[0,15,30,45,60,75,90,105,120].map(v => <span key={v}>{Math.floor(v/60)}:{String(v%60).padStart(2,"0")}</span>)}</div>
          <div className="beat-grid">{Array.from({length:48}).map((_,i)=><i key={i} className={i%4===0?"bar":"beat"}/>)}</div>
          <div className="playhead" style={{left:`${position}%`}}><b/></div>
          <div className="lyric-track" style={{minWidth:`${100+zoom*5}px`}}>{lyrics.map((line,index)=><button key={`${line.text}-${index}`} className={selectedLyric===index?"selected":""} style={{left:`${line.start/1.2}%`,width:`${line.width}%`}} onClick={()=>setSelectedLyric(index)} onPointerDown={e=>{const el=e.currentTarget.parentElement!;const start=e.clientX;const initial=line.start;e.currentTarget.setPointerCapture(e.pointerId);const move=(ev:PointerEvent)=>{const raw=initial+(ev.clientX-start)/el.clientWidth*120;const beat=60/118;const snapped=Math.round(raw/beat)*beat;setLyrics(c=>c.map((item,i)=>i===index?{...item,start:Math.max(0,Math.min(118,snapped))}:item))};const stop=()=>e.currentTarget.removeEventListener("pointermove",move);e.currentTarget.addEventListener("pointermove",move);e.currentTarget.addEventListener("pointerup",stop,{once:true})}}><span>{line.text}</span></button>)}</div>
          <div className={`wave-track backing ${stemMuted.backing?"muted-track":""}`}>{waveform.map((height,i)=><i key={i} style={{height}}/>)}</div>
          <div className={`wave-track vocal ${stemMuted.vocal?"muted-track":""}`}>{waveform.map((height,i)=><i key={i} style={{height:Math.max(5,height-8)}}/>)}</div>
        </div>
      </div>
    </section>

    {processing && <div className="processing-layer" role="status"><div><LoaderCircle className="spin"/><strong>Analizando el enlace</strong><ol><li className="done"><Check/> Metadatos</li><li className="active"><LoaderCircle/> Buscando letra</li><li><Lock/> Audio, tempo y voces requieren procesador</li></ol></div></div>}
  </main>;
}
