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
import {paintBackground,type StudioBackground} from './studio-background';

export type ExportQuality = "4K" | "2K" | "1080";
export type ExportFps = 30 | 60;
export type ExportAspect = "16:9" | "9:16" | "1:1";

export type ExportLyric = { text: string; start: number; width: number };

export type PreviewTypographyMetrics = {
  stageWidth: number;
  stageHeight: number;
  fontSizePx: number;
  lineHeightPx: number;
  letterSpacingPx: number;
  maxWidthPx: number;
  lyricHorizontalPaddingPx: number;
  underlineGapPx: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  title?: { x: number; y: number; fontSize: number; lineHeight: number; fontFamily: string; fontWeight: string; letterSpacing: number; color: string };
  logo?: { x: number; y: number; width: number; height: number; opacity: number };
};

export type ExportVideoOptions = {
  background?: StudioBackground;
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
  previewTypography?: PreviewTypographyMetrics;
  track: { title: string; artist: string };
  showFreeBadge?: boolean;
  watermarkImage?: HTMLImageElement;
  backingUrl: string | null;
  audioClips?: {url:string;start:number;duration:number;offset?:number}[];
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
  width: number;
  height: number;
  fps: ExportFps;
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
  const cleaned = (value || "karaoke")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/[^\w\s.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.]+/, "")
    .slice(0, 80);
  return cleaned || "karaoke";
}

export function exportFilename(track: { title: string; artist: string }, ext: string) {
  const safeExt = (ext || "mp4").replace(/^\.+/, "").toLowerCase() || "mp4";
  const base = sanitizeExportFilename(
    `${track.artist ? `${track.artist} - ` : ""}${track.title || "AK Studio"}`,
  );
  return `${base}.${safeExt}`;
}

/** True if bytes look like an ISO BMFF / MP4 file (ftyp box near the start). */
export function hasMp4Ftyp(bytes: ArrayBuffer | ArrayBufferView, within = 32): boolean {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const limit = Math.min(view.length - 8, Math.max(8, within));
  for (let i = 0; i <= limit; i++) {
    if (
      view[i + 4] === 0x66 && // f
      view[i + 5] === 0x74 && // t
      view[i + 6] === 0x79 && // y
      view[i + 7] === 0x70 // p
    ) {
      return true;
    }
  }
  return false;
}

function looksLikeHtml(bytes: ArrayBuffer | ArrayBufferView): boolean {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let start = 0;
  // Skip UTF-8 BOM / leading whitespace
  if (view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) start = 3;
  while (start < view.length && (view[start] === 0x20 || view[start] === 0x09 || view[start] === 0x0a || view[start] === 0x0d)) {
    start++;
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(view.subarray(start, Math.min(view.length, start + 64)))
    .toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head") || head.startsWith("<?xml");
}

function hasWebmMagic(bytes: ArrayBuffer | ArrayBufferView): boolean {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.length >= 4 && view[0] === 0x1a && view[1] === 0x45 && view[2] === 0xdf && view[3] === 0xa3;
}

/**
 * After finalize: reject empty/corrupt buffers and HTML error documents.
 * Never allow a download of something that is not a real media container.
 */
export async function assertValidExportBlob(
  blob: Blob,
  expected: "mp4" | "webm",
): Promise<Blob> {
  if (!blob || blob.size < 32) {
    throw new Error("Export produced an empty or corrupt file. Nothing was downloaded.");
  }
  const probe = await blob.slice(0, 64).arrayBuffer();
  if (looksLikeHtml(probe)) {
    throw new Error(
      "Export produced an HTML document instead of a video file. Nothing was downloaded — try again or use 1080p.",
    );
  }
  if (expected === "mp4") {
    if (!hasMp4Ftyp(probe, 32)) {
      throw new Error(
        "Export did not produce a valid MP4 (missing ftyp). Nothing was downloaded — try 1080p / 30fps.",
      );
    }
    // Force correct MIME even if recorder/encoder left it blank or wrong
    if (blob.type !== "video/mp4") {
      return new Blob([blob], { type: "video/mp4" });
    }
    return blob;
  }
  // webm
  if (!hasWebmMagic(probe)) {
    throw new Error(
      "Export did not produce a valid WebM file. Nothing was downloaded — try another browser or 1080p.",
    );
  }
  if (blob.type !== "video/webm") {
    return new Blob([blob], { type: "video/webm" });
  }
  return blob;
}

/**
 * Robust client download: always use a File + object URL + <a download>.
 * Never navigate window.location to the blob (that often saves/opens HTML).
 */
export function downloadBlob(blob: Blob, filename: string) {
  const rawName = (filename || "karaoke.mp4").trim() || "karaoke.mp4";
  const lower = rawName.toLowerCase();
  const base = sanitizeExportFilename(rawName.replace(/\.[^.]+$/, "")) || "karaoke";
  const blobType = (blob.type || "").split(";")[0]!.trim().toLowerCase();

  // Filename extension wins; never mislabel webm as mp4. Default to .mp4.
  let safeName: string;
  let mime: string;
  if (lower.endsWith(".webm")) {
    safeName = `${base}.webm`;
    mime = "video/webm";
  } else if (lower.endsWith(".mp4")) {
    safeName = `${base}.mp4`;
    mime = "video/mp4";
  } else if (blobType === "video/webm") {
    safeName = `${base}.webm`;
    mime = "video/webm";
  } else {
    safeName = `${base}.mp4`;
    mime = "video/mp4";
  }

  const file = new File([blob], safeName, { type: mime });
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  return safeName;
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
    previewTypography?: PreviewTypographyMetrics;
    track: { title: string; artist: string };
    showFreeBadge?: boolean;
    watermarkImage?: HTMLImageElement;
    background?: StudioBackground;
  },
) {
  const scale = Math.min(width, height) / 1080;
  paintBackground(ctx,width,height,opts.time,opts.background);

  const preview = opts.previewTypography;
  const previewScale = preview ? width / Math.max(1, preview.stageWidth) : scale;
  const title = preview?.title;
  const metaSize = title ? title.fontSize * previewScale : Math.max(10, Math.round(12 * scale));
  ctx.fillStyle = title?.color || "#929292";
  ctx.font = `${title?.fontWeight || "400"} ${metaSize}px ${title?.fontFamily || '"Avenir Next Condensed","Avenir Next",sans-serif'}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(title?.letterSpacing || 0) * previewScale}px`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const pad = Math.round(18 * scale);
  if (opts.track.title) {
    ctx.fillText(opts.track.title.toUpperCase(), title ? title.x * previewScale : pad, title ? title.y * previewScale : Math.round(14 * scale));
  }
  if (opts.showFreeBadge && opts.watermarkImage) {
    const logo = preview?.logo;
    const logoWidth = logo ? logo.width * previewScale : width * .05;
    const logoHeight = logo ? logo.height * previewScale : logoWidth * opts.watermarkImage.naturalHeight / opts.watermarkImage.naturalWidth;
    ctx.save();
    ctx.globalAlpha = logo?.opacity ?? .65;
    ctx.drawImage(opts.watermarkImage, logo ? logo.x * previewScale : width * .975 - logoWidth, logo ? logo.y * previewScale : height * .025, logoWidth, logoHeight);
    ctx.restore();
  }

  const lyric = activeLyricAt(opts.lyrics, opts.time, opts.projectDuration);
  if (!lyric) return;

  const fontPx = preview ? preview.fontSizePx * previewScale : Math.max(18, opts.fontSize * scale);
  const weight = preview?.fontWeight || (opts.textStyle.bold ? "700" : "500");
  const style = preview?.fontStyle || (opts.textStyle.italic ? "italic" : "normal");
  const family = preview?.fontFamily || `${opts.font},sans-serif`;
  ctx.font = `${style} ${weight} ${fontPx}px ${family}`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(preview?.letterSpacingPx || 0) * previewScale}px`;
  }
  ctx.fillStyle = opts.textStyle.color || "#fff";
  ctx.textAlign = opts.textStyle.align;
  ctx.textBaseline = "middle";

  const cx = (opts.textPosition.x / 100) * width;
  const cy = (opts.textPosition.y / 100) * height;
  const maxW = preview ? preview.maxWidthPx * previewScale : width * 0.82;
  const lines = wrapText(ctx, lyric.text, maxW);
  const lineGap = preview ? preview.lineHeightPx * previewScale : fontPx * (opts.lineHeight || 0.94);
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

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

function reportProgress(opts: ExportVideoOptions, percent: number) {
  opts.onProgress?.(Math.max(0, Math.min(100, Math.round(percent))));
}

async function yieldToUi() {
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  const onAbort = () => {
    if (timer) clearTimeout(timer);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
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
  buffers: { buffer: AudioBuffer; gain: number; start?:number; duration?:number; offset?:number }[],
  durationSec: number,
): AudioBuffer {
  const sampleRate = buffers[0]?.buffer.sampleRate || 48000;
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const channels = Math.max(1, ...buffers.map((b) => b.buffer.numberOfChannels), 2);
  const out = ctx.createBuffer(channels, length, sampleRate);
  for (const { buffer, gain, start=0, duration=buffer.duration, offset:sourceOffset=0 } of buffers) {
    if (gain <= 0) continue;
    for (let c = 0; c < channels; c++) {
      const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const dst = out.getChannelData(c);
      const offset=Math.round(start*sampleRate);
      const sourceStart=Math.round(sourceOffset*sampleRate);
      const n = Math.min(src.length-sourceStart, Math.ceil(duration*sampleRate), length-offset);
      for (let i = 0; i < n; i++) dst[i+offset]! += src[i+sourceStart]! * gain;
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

async function buildMixedAudio(
  opts: ExportVideoOptions,
  onPhaseProgress?: (fraction: number) => void,
): Promise<AudioBuffer | null> {
  if (!opts.backingUrl && !opts.vocalUrl && !opts.audioClips?.length) return null;
  const probe = new AudioContext();
  try {
    if (probe.state === "suspended") {
      await probe.resume().catch(() => undefined);
    }
    const parts: { buffer: AudioBuffer; gain: number; start?:number; duration?:number; offset?:number }[] = [];
    const jobs: { url: string; gain: number; label: string; start?:number; duration?:number; offset?:number }[] = (opts.audioClips??[]).map((c,i)=>({...c,gain:1,label:`clip ${i+1}`}));
    if (opts.backingUrl && opts.includeBacking) {
      jobs.push({ url: opts.backingUrl, gain: 1, label: "backing" });
    }
    if (opts.vocalUrl && opts.includeVocal) {
      jobs.push({ url: opts.vocalUrl, gain: 1, label: "vocal" });
    }
    if (jobs.length === 0) {
      onPhaseProgress?.(1);
      return probe.createBuffer(
        2,
        Math.max(1, Math.ceil(opts.durationSec * probe.sampleRate)),
        probe.sampleRate,
      );
    }
    for (let i = 0; i < jobs.length; i++) {
      throwIfAborted(opts.signal);
      onPhaseProgress?.(i / Math.max(jobs.length, 1));
      const job = jobs[i]!;
      const decoded = await withTimeout(
        decodeAudioUrl(job.url, probe),
        90_000,
        `Timed out decoding ${job.label} audio for export.`,
        opts.signal,
      );
      if (decoded) parts.push({ buffer: decoded, gain: job.gain,start:job.start,duration:job.duration,offset:job.offset });
      else throw new Error(`Could not decode ${job.label} for export.`);
      onPhaseProgress?.((i + 1) / Math.max(jobs.length, 1));
      await yieldToUi();
    }
    if (parts.length === 0) {
      return probe.createBuffer(
        2,
        Math.max(1, Math.ceil(opts.durationSec * probe.sampleRate)),
        probe.sampleRate,
      );
    }
    return mixAudioBuffers(probe, parts, opts.durationSec);
  } finally {
    await probe.close().catch(() => undefined);
  }
}

function sliceAudioBuffer(source: AudioBuffer, startSec: number, lengthSec: number): AudioBuffer {
  const start = Math.max(0, Math.floor(startSec * source.sampleRate));
  const frames = Math.max(1, Math.floor(lengthSec * source.sampleRate));
  const slice = new AudioBuffer({
    length: frames,
    numberOfChannels: source.numberOfChannels,
    sampleRate: source.sampleRate,
  });
  for (let c = 0; c < source.numberOfChannels; c++) {
    const channel = source.getChannelData(c);
    const end = Math.min(channel.length, start + frames);
    if (end > start) {
      slice.copyToChannel(channel.subarray(start, end), c);
    }
  }
  return slice;
}

async function exportWithWebCodecs(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  const { width, height } = resolveExportSize(opts.quality, opts.aspect);
  const fps = opts.fps;
  const durationSec = Math.max(0.5, Number.isFinite(opts.durationSec) ? opts.durationSec : 0.5);
  const frameCount = Math.max(1, Math.ceil(durationSec * fps));
  const frameDur = 1 / fps;

  reportProgress(opts, 2);

  const canVideo = await withTimeout(
    canEncodeVideo("avc", { width, height, bitrate: 8_000_000 }),
    15_000,
    "Timed out checking WebCodecs video support.",
    opts.signal,
  );
  if (
    typeof VideoEncoder === "undefined" ||
    !canVideo
  ) {
    throw new Error("WebCodecs AVC unavailable");
  }

  // Prefer a DOM canvas — VideoFrame + MediaRecorder paths are more reliable than OffscreenCanvas alone.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) throw new Error("Could not create export canvas");

  const quality =
    opts.quality === "4K"
      ? QUALITY_VERY_HIGH
      : opts.quality === "2K"
        ? QUALITY_HIGH
        : QUALITY_MEDIUM;

  reportProgress(opts, 4);
  const mixed = await buildMixedAudio(opts, (fraction) => {
    reportProgress(opts, 4 + fraction * 12);
  });
  throwIfAborted(opts.signal);
  reportProgress(opts, 16);

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

  let audioSource: AudioBufferSource | null = null;
  if (mixed && (await canEncodeAudio("aac"))) {
    audioSource = new AudioBufferSource({ codec: "aac", quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  const cancelOutput = () => { void output.cancel().catch(() => undefined) };
  opts.signal?.addEventListener("abort", cancelOutput, {once:true});
  try {
  throwIfAborted(opts.signal);
  await withTimeout(
    output.start(),
    20_000,
    "Timed out starting the video encoder. Try 1080p or another browser.",
    opts.signal,
  );
  throwIfAborted(opts.signal);
  reportProgress(opts, 18);

  const paintOpts = {
    lyrics: opts.lyrics,
    projectDuration: Math.max(opts.projectDuration, durationSec, 1),
    font: opts.font,
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    textStyle: opts.textStyle,
    textPosition: opts.textPosition,
    previewTypography: opts.previewTypography,
    background: opts.background,
    track: opts.track,
    showFreeBadge: opts.showFreeBadge,
    watermarkImage: opts.watermarkImage,
  };

  // Interleave audio + video in ~1s chunks so:
  // 1) progress moves immediately (no silent "encode all audio first" stall)
  // 2) MP4 packet buffering stays bounded
  const chunkSec = 1;
  let audioCursor = 0;
  const audioDuration = mixed && audioSource ? Math.min(mixed.duration, durationSec) : 0;

  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(opts.signal);
    const time = Math.min(durationSec, i * frameDur);

    // Catch audio up to the current video timestamp (+1 chunk ahead)
    if (audioSource && mixed && audioCursor < audioDuration - 0.0005) {
      const targetAudio = Math.min(audioDuration, Math.floor(time / chunkSec + 1) * chunkSec);
      while (audioCursor < targetAudio - 0.0005) {
        throwIfAborted(opts.signal);
        const len = Math.min(chunkSec, audioDuration - audioCursor);
        const slice = sliceAudioBuffer(mixed, audioCursor, len);
        await audioSource.add(slice);
        audioCursor += len;
      }
    }

    paintKaraokeFrame(ctx, width, height, { ...paintOpts, time });
    await videoSource.add(time, frameDur);

    if (i === 0 || i % 4 === 0 || i === frameCount - 1) {
      // Video frames own 18→96%
      reportProgress(opts, 18 + ((i + 1) / frameCount) * 78);
      if (i % 12 === 0) await yieldToUi();
    }
  }

  // Flush any remaining audio tail
  if (audioSource && mixed && audioCursor < audioDuration - 0.0005) {
    while (audioCursor < audioDuration - 0.0005) {
      throwIfAborted(opts.signal);
      const len = Math.min(chunkSec, audioDuration - audioCursor);
      const slice = sliceAudioBuffer(mixed, audioCursor, len);
      await audioSource.add(slice);
      audioCursor += len;
    }
  }

  try {
    audioSource?.close();
  } catch {
    /* optional */
  }
  try {
    videoSource.close();
  } catch {
    /* optional */
  }

  reportProgress(opts, 97);
  await withTimeout(
    output.finalize(),
    120_000,
    "Timed out finalizing the MP4 file.",
    opts.signal,
  );
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 32) {
    throw new Error("Export produced an empty or corrupt file");
  }
  if (looksLikeHtml(buffer) || !hasMp4Ftyp(buffer, 32)) {
    throw new Error(
      "Export did not produce a valid MP4 (missing ftyp or HTML payload). Try 1080p / 30fps.",
    );
  }
  let blob = new Blob([buffer], { type: "video/mp4" });
  blob = await assertValidExportBlob(blob, "mp4");
  reportProgress(opts, 100);
  return {
    blob,
    filename: exportFilename(opts.track, "mp4"),
    mimeType: "video/mp4",
    method: "webcodecs",
    width,
    height,
    fps,
  };
  } finally {
    opts.signal?.removeEventListener("abort", cancelOutput);
    if (opts.signal?.aborted) {
      await output.cancel().catch(() => undefined);
      try {videoSource.close()} catch {/* already closed */}
      try {audioSource?.close()} catch {/* already closed */}
    }
  }
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
  const durationSec = Math.max(0.5, Number.isFinite(opts.durationSec) ? opts.durationSec : 0.5);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Could not create export canvas");

  reportProgress(opts, 3);
  const stream = canvas.captureStream(fps);
  const audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume().catch(() => undefined);
  }
  const dest = audioCtx.createMediaStreamDestination();
  const mixed = await buildMixedAudio(opts, (fraction) => {
    reportProgress(opts, 3 + fraction * 10);
  });
  throwIfAborted(opts.signal);
  reportProgress(opts, 14);

  let sourceNode: AudioBufferSourceNode | null = null;
  if (mixed) {
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = mixed;
    sourceNode.connect(dest);
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }

  const { mimeType, ext } = pickRecorderMime();
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond:
        opts.quality === "4K" ? 35_000_000 : opts.quality === "2K" ? 16_000_000 : 8_000_000,
    });
  } catch {
    recorder = new MediaRecorder(stream);
  }
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
    projectDuration: Math.max(opts.projectDuration, durationSec, 1),
    font: opts.font,
    fontSize: opts.fontSize,
    lineHeight: opts.lineHeight,
    textStyle: opts.textStyle,
    textPosition: opts.textPosition,
    previewTypography: opts.previewTypography,
    background: opts.background,
    track: opts.track,
    showFreeBadge: opts.showFreeBadge,
    watermarkImage: opts.watermarkImage,
  };

  const start = performance.now();
  try {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    const tick = () => {
      if (opts.signal?.aborted) {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
        finish(new DOMException("Export cancelled", "AbortError"));
        return;
      }
      const elapsed = (performance.now() - start) / 1000;
      const time = Math.min(durationSec, elapsed);
      paintKaraokeFrame(ctx, width, height, { ...paintOpts, time });
      reportProgress(opts, 14 + Math.min(85, (elapsed / durationSec) * 85));
      if (elapsed >= durationSec) {
        finish();
        return;
      }
      // Prefer rAF for smooth capture; fall back to setTimeout so a background tab still advances.
      if (typeof requestAnimationFrame === "function" && !document.hidden) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(tick, Math.max(8, 1000 / fps));
      }
    };
    tick();
  });
  } finally {
    if(opts.signal?.aborted){
      try {if(recorder.state!=="inactive")recorder.stop()} catch {/* stopped */}
      try {sourceNode?.stop()} catch {/* stopped */}
      for(const track of stream.getTracks())track.stop();
      await audioCtx.close().catch(()=>undefined);
    }
  }

  await new Promise((r) => setTimeout(r, 160));
  try {
    if (recorder.state !== "inactive") recorder.stop();
  } catch {
    /* ignore */
  }
  try {
    sourceNode?.stop();
  } catch {
    /* ignore */
  }
  await audioCtx.close().catch(() => undefined);
  for (const t of stream.getTracks()) t.stop();

  const blob = await withTimeout(
    done,
    30_000,
    "Timed out finishing MediaRecorder export.",
    opts.signal,
  );
  if (!blob.size) throw new Error("Export produced an empty or corrupt file");
  // Prefer the container we actually got (sniff), not only the requested mime.
  const head = await blob.slice(0, 64).arrayBuffer();
  let outExt = ext;
  let outMime = (blob.type || mimeType.split(";")[0] || "").split(";")[0] || "video/webm";
  if (hasMp4Ftyp(head, 32)) {
    outExt = "mp4";
    outMime = "video/mp4";
  } else if (hasWebmMagic(head)) {
    outExt = "webm";
    outMime = "video/webm";
  } else if (looksLikeHtml(head)) {
    throw new Error(
      "MediaRecorder returned an HTML document instead of video. Nothing was downloaded.",
    );
  } else if (outExt === "mp4" || outMime.includes("mp4")) {
    // Claimed mp4 but no ftyp — do not mislabel / download as mp4
    throw new Error(
      "MediaRecorder did not produce a valid MP4. Nothing was downloaded — try Chrome at 1080p.",
    );
  } else {
    throw new Error(
      "MediaRecorder did not produce a valid video file. Nothing was downloaded — try Chrome at 1080p.",
    );
  }
  let outBlob = new Blob([blob], { type: outMime });
  outBlob = await assertValidExportBlob(outBlob, outExt === "mp4" ? "mp4" : "webm");
  reportProgress(opts, 100);
  return {
    blob: outBlob,
    filename: exportFilename(opts.track, outExt),
    mimeType: outMime,
    method: "mediarecorder",
    width,
    height,
    fps,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Could not export video.";
}

export async function exportKaraokeVideo(opts: ExportVideoOptions): Promise<ExportVideoResult> {
  if (opts.showFreeBadge && !opts.watermarkImage) {
    const logo = new Image();
    logo.src = "/logoak.svg";
    await logo.decode();
    opts = { ...opts, watermarkImage: logo };
  }
  // Never let a fallback move the visible progress bar backwards. If WebCodecs
  // fails after doing meaningful work, map the recorder fallback into the
  // remaining percentage instead of restarting the UI at 0–3%.
  let visibleProgress = 0;
  const emitProgress = (percent: number) => {
    const next = Math.max(visibleProgress, Math.max(0, Math.min(100, Math.round(percent))));
    if (next !== visibleProgress) {
      visibleProgress = next;
      opts.onProgress?.(next);
    }
  };
  const primaryOpts: ExportVideoOptions = { ...opts, onProgress: emitProgress };
  emitProgress(1);
  throwIfAborted(opts.signal);

  let webCodecsError: unknown = null;
  if (typeof VideoEncoder !== "undefined") {
    try {
      return await exportWithWebCodecs(primaryOpts);
    } catch (err) {
      throwIfAborted(opts.signal);
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      webCodecsError = err;
    }
  }

  try {
    const fallbackStart = Math.min(95, visibleProgress + 1);
    emitProgress(fallbackStart);
    const result = await exportWithMediaRecorder({
      ...opts,
      // Preserve the dimensions and frame rate the user selected. A failed
      // high-resolution export must be reported, never silently downgraded.
      onProgress: (percent) => emitProgress(
        fallbackStart + ((100 - fallbackStart) * percent) / 100,
      ),
    });
    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    const fallback = errorMessage(err);
    if (webCodecsError) {
      throw new Error(`${errorMessage(webCodecsError)} (fallback also failed: ${fallback})`);
    }
    throw err instanceof Error ? err : new Error(fallback);
  }
}

export function canExportVideoRoughly() {
  return (
    (typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined") ||
    (typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined")
  );
}
