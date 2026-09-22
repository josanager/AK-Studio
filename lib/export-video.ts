/** Client-side karaoke video export: WebCodecs (mediabunny) preferred, MediaRecorder fallback. */

import {
  AudioBufferSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
} from "mediabunny";

export type ExportQuality = "4K" | "2K" | "1080";
export type ExportFps = 30 | 60;
export type ExportAspect = "16:9" | "9:16" | "1:1";

export type ExportLyric = { text: string; start: number; width: number };

export type ExportVideoOptions = {
  quality: ExportQuality;
  fps: ExportFps;
  aspect: ExportAspect;
  durationSec: number;
  lyrics: ExportLyric[];
  projectDuration: number;
  font: string;
  fontSize: number;
  lineHeight: number;
  textStyle: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: "left" | "center" | "right";
    color: string;
  };
  textPosition: { x: number; y: number };
  track: { title: string; artist: string };
  showFreeBadge?: boolean;
  backingUrl: string | null;
  vocalUrl: string | null;
  includeBacking: boolean;
  includeVocal: boolean;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export type ExportVideoResult = {
  blob: Blob;
  filename: string;
  mimeType: string;
  method: "webcodecs" | "mediarecorder";
};

export function resolveExportSize(
  quality: ExportQuality,
  aspect: ExportAspect,
): { width: number; height: number } {
  const short =
    quality === "4K" ? 2160 : quality === "2K" ? 1440 : 1080;
  const long =
    quality === "4K" ? 3840 : quality === "2K" ? 2560 : 1920;
  let width: number;
  let height: number;
  if (aspect === "16:9") {
    width = long;
    height = short;
  } else if (aspect === "9:16") {
    width = short;
    height = long;
  } else {
    width = short;
    height = short;
  }
  // H.264 / VP9 prefer even dimensions
  width -= width % 2;
  height -= height % 2;
  return { width, height };
}

export function sanitizeExportFilename(value: string) {
  return (
    (value || "karaoke").replace(/[^\w\s.-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) ||
    "karaoke"
  );
}

export function exportFilename(track: { title: string; artist: string }, ext: string) {
  const base = sanitizeExportFilename(
    `${track.artist ? `${track.artist} - ` : ""}${track.title || "AK Studio"}`,
  );
  return `${base}.${ext}`;
}

function lyricSpanSec(line: ExportLyric, projectDuration: number) {
  return Math.max(0.15, (line.width / 100) * Math.max(projectDuration, 1));
}

function activeLyricAt(
  lyrics: ExportLyric[],
  time: number,
  projectDuration: number,
): ExportLyric | null {
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i]!;
    const end = line.start + lyricSpanSec(line, projectDuration);
    const nextStart = lyrics[i + 1]?.start;
    const hardEnd = nextStart != null ? Math.min(nextStart, end) : end;
    if (time >= line.start && time < hardEnd) return line;
  }
  return null;
}

function paintKaraokeFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  opts: {
    time: number;
    lyrics: ExportLyric[];
    projectDuration: number;
    font: string;
    fontSize: number;
    lineHeight: number;
    textStyle: ExportVideoOptions["textStyle"];
    textPosition: { x: number; y: number };
    track: { title: string; artist: string };
    showFreeBadge?: boolean;
  },
) {
  const scale = Math.min(width, height) / 1080;
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, width, height);

  const metaSize = Math.max(10, Math.round(12 * scale));
  ctx.fillStyle = "#929292";
  ctx.font = `${metaSize}px "Avenir Next Condensed","Avenir Next",sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const pad = Math.round(18 * scale);
  if (opts.track.artist) {
    ctx.fillText(`AK / ${opts.track.artist}`.toUpperCase(), pad, Math.round(14 * scale));
  }
  if (opts.showFreeBadge) {
    ctx.textAlign = "right";
    ctx.fillText("AK STUDIO", width - pad, Math.round(14 * scale));
  }

  const lyric = activeLyricAt(opts.lyrics, opts.time, opts.projectDuration);
  if (!lyric) return;

  const fontPx = Math.max(18, Math.round(opts.fontSize * scale));
  const weight = opts.textStyle.bold ? 700 : 500;
  const style = opts.textStyle.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${fontPx}px ${opts.font},sans-serif`;
  ctx.fillStyle = opts.textStyle.color || "#fff";
  ctx.textAlign = opts.textStyle.align;
  ctx.textBaseline = "middle";

  const cx = (opts.textPosition.x / 100) * width;
  const cy = (opts.textPosition.y / 100) * height;
  const maxW = width * 0.82;
  const lines = wrapText(ctx, lyric.text, maxW);
  const lineGap = fontPx * (opts.lineHeight || 0.94);
  const blockH = lines.length * lineGap;
  let y = cy - blockH / 2 + lineGap / 2;
  for (const line of lines) {
    let x = cx;
    if (opts.textStyle.align === "left") x = cx - maxW / 2;
    if (opts.textStyle.align === "right") x = cx + maxW / 2;
    ctx.fillText(line, x, y);
    if (opts.textStyle.underline) {
      const metrics = ctx.measureText(line);
      const tw = metrics.width;
      let ux = x;
      if (opts.textStyle.align === "center") ux = x - tw / 2;
      if (opts.textStyle.align === "right") ux = x - tw;
      ctx.strokeStyle = opts.textStyle.color || "#fff";
      ctx.lineWidth = Math.max(1, Math.round(2 * scale));
      ctx.beginPath();
      ctx.moveTo(ux, y + fontPx * 0.45);
      ctx.lineTo(ux + tw, y + fontPx * 0.45);
      ctx.stroke();
    }
    y += lineGap;
  }

  // Progress underline under lyric block (matches stage accent bar)
  const barY = cy + blockH / 2 + Math.round(18 * scale);
  const barW = width * 0.56;
  const barX = (width - barW) / 2;
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(barX, barY, barW, Math.max(2, Math.round(2 * scale)));
  const span = lyricSpanSec(lyric, opts.projectDuration);
  const progress = Math.max(0, Math.min(1, (opts.time - lyric.start) / span));
  ctx.fillStyle = "#fff";
  ctx.fillRect(barX, barY, barW * progress, Math.max(2, Math.round(2 * scale)));
}

function wrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i]!;
    }
  }
  lines.push(current);
  return lines.slice(0, 6);
}

async function decodeAudioUrl(url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return await ctx.decodeAudioData(buf.slice(0));
  } catch {
    return null;
  }
}

function mixAudioBuffers(
  ctx: OfflineAudioContext | AudioContext,
  buffers: { buffer: AudioBuffer; gain: number }[],
  durationSec: number,
): AudioBuffer {
  const sampleRate = buffers[0]?.buffer.sampleRate || 48000;
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const channels = Math.max(1, ...buffers.map((b) => b.buffer.numberOfChannels), 2);
  const out = ctx.createBuffer(channels, length, sampleRate);
  for (const { buffer, gain } of buffers) {
    if (gain <= 0) continue;
    for (let c = 0; c < channels; c++) {
      const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const dst = out.getChannelData(c);
      const n = Math.min(src.length, length);
      for (let i = 0; i < n; i++) dst[i]! += src[i]! * gain;
    }
  }
  // Soft clip
  for (let c = 0; c < channels; c++) {
    const dst = out.getChannelData(c);
    for (let i = 0; i < dst.length; i++) {
      const v = dst[i]!;
      dst[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
  }
  return out;
}

async function buildMixedAudio(opts: ExportVideoOptions): Promise<AudioBuffer | null> {
  if (!opts.backingUrl && !opts.vocalUrl) return null;
  const probe = new AudioContext();
  try {
    const parts: { buffer: AudioBuffer; gain: number }[] = [];
    if (opts.backingUrl && opts.includeBacking) {
      const b = await decodeAudioUrl(opts.backingUrl, probe);
      if (b) parts.push({ buffer: b, gain: 1 });
    }
    if (opts.vocalUrl && opts.includeVocal) {
      const v = await decodeAudioUrl(opts.vocalUrl, probe);
      if (v) parts.push({ buffer: v, gain: 1 });
    }
    if (parts.length === 0) {
      // Silent buffer so video still has an audio track length
      return probe.createBuffer(2, Math.max(1, Math.ceil(opts.durationSec * probe.sampleRate)), probe.sampleRate);
    }
    return mixAudioBuffers(probe, parts, opts.durationSec);
  } finally {
    await probe.close().catch(() => undefined);
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

async function exportWithWebCodecs(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  const { width, height } = resolveExportSize(opts.quality, opts.aspect);
  const fps = opts.fps;
  const durationSec = Math.max(0.5, opts.durationSec);
  const frameCount = Math.max(1, Math.ceil(durationSec * fps));
  const frameDur = 1 / fps;

  const canVideo =
    typeof VideoEncoder !== "undefined" &&
    (await canEncodeVideo("avc", { width, height, bitrate: 8_000_000 }));
  if (!canVideo) throw new Error("WebCodecs AVC unavailable");

  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
  } else {
    const el = document.createElement("canvas");
    el.width = width;
    el.height = height;
    canvas = el;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create export canvas");

  const quality =
    opts.quality === "4K"
      ? QUALITY_VERY_HIGH
      : opts.quality === "2K"
        ? QUALITY_HIGH
        : QUALITY_MEDIUM;

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    quality,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const mixed = await buildMixedAudio(opts);
  let audioSource: AudioBufferSource | null = null;
  if (mixed && (await canEncodeAudio("aac"))) {
    audioSource = new AudioBufferSource({ codec: "aac", quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  throwIfAborted(opts.signal);

  if (audioSource && mixed) {
    // Slice mixed audio into ~2s chunks for backpressure-friendly adds
    const chunkSec = 2;
    let t = 0;
    while (t < mixed.duration - 0.001) {
      throwIfAborted(opts.signal);
      const len = Math.min(chunkSec, mixed.duration - t);
      const start = Math.floor(t * mixed.sampleRate);
      const frames = Math.max(1, Math.floor(len * mixed.sampleRate));
      const slice = new AudioBuffer({
        length: frames,
        numberOfChannels: mixed.numberOfChannels,
        sampleRate: mixed.sampleRate,
      });
      for (let c = 0; c < mixed.numberOfChannels; c++) {
        slice.copyToChannel(mixed.getChannelData(c).subarray(start, start + frames), c);
      }
      await audioSource.add(slice);
      t += len;
    }
  }

  const paintOpts = {
    lyrics: opts.lyrics,
    projectDuration: opts.projectDuration,
    font: opts.font,
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    textStyle: opts.textStyle,
    textPosition: opts.textPosition,
    track: opts.track,
    showFreeBadge: opts.showFreeBadge,
  };

  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(opts.signal);
    const time = Math.min(durationSec, i * frameDur);
    paintKaraokeFrame(ctx, width, height, { ...paintOpts, time });
    await videoSource.add(time, frameDur);
    if (i % 8 === 0 || i === frameCount - 1) {
      opts.onProgress?.(Math.round(((i + 1) / frameCount) * 100));
    }
  }

  await output.finalize();
  const buffer = target.buffer;
  if (!buffer) throw new Error("Export produced an empty file");
  const blob = new Blob([buffer], { type: "video/mp4" }); // ArrayBuffer from BufferTarget
  return {
    blob,
    filename: exportFilename(opts.track, "mp4"),
    mimeType: "video/mp4",
    method: "webcodecs",
  };
}

function pickRecorderMime(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mimeType: "video/mp4", ext: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mimeType: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "video/webm", ext: "webm" };
}

async function exportWithMediaRecorder(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("Video export is not supported in this browser.");
  }
  const { width, height } = resolveExportSize(opts.quality, opts.aspect);
  const fps = opts.fps;
  const durationSec = Math.max(0.5, opts.durationSec);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create export canvas");

  const stream = canvas.captureStream(fps);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const mixed = await buildMixedAudio(opts);
  let sourceNode: AudioBufferSourceNode | null = null;
  if (mixed) {
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = mixed;
    sourceNode.connect(dest);
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }

  const { mimeType, ext } = pickRecorderMime();
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond:
      opts.quality === "4K" ? 35_000_000 : opts.quality === "2K" ? 16_000_000 : 8_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
  });

  recorder.start(250);
  if (sourceNode) sourceNode.start(0);

  const paintOpts = {
    lyrics: opts.lyrics,
    projectDuration: opts.projectDuration,
    font: opts.font,
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    textStyle: opts.textStyle,
    textPosition: opts.textPosition,
    track: opts.track,
    showFreeBadge: opts.showFreeBadge,
  };

  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal?.aborted) {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
        reject(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const elapsed = (performance.now() - start) / 1000;
      const time = Math.min(durationSec, elapsed);
      paintKaraokeFrame(ctx, width, height, { ...paintOpts, time });
      opts.onProgress?.(Math.min(99, Math.round((elapsed / durationSec) * 100)));
      if (elapsed >= durationSec) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  sourceNode?.stop();
  await audioCtx.close().catch(() => undefined);
  for (const t of stream.getTracks()) t.stop();

  const blob = await done;
  opts.onProgress?.(100);
  return {
    blob,
    filename: exportFilename(opts.track, ext),
    mimeType: blob.type || mimeType.split(";")[0]!,
    method: "mediarecorder",
  };
}

export async function exportKaraokeVideo(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  opts.onProgress?.(1);
  try {
    if (typeof VideoEncoder !== "undefined") {
      try {
        return await exportWithWebCodecs(opts);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        // Fall through to MediaRecorder
      }
    }
    return await exportWithMediaRecorder(opts);
  } finally {
    opts.onProgress?.(100);
  }
}

export function canExportVideoRoughly() {
  return (
    (typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined") ||
    (typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined")
  );
}
