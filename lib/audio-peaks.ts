/** Decode an audio URL and return normalized peak magnitudes (0–1) across the full buffer. */

export type AudioPeaksResult = {
  peaks: number[];
  /** Decoded AudioBuffer duration in seconds. */
  duration: number;
};

// Keep only small peak arrays, never decoded PCM buffers. Share in-flight work
// between the preview and timeline and serialize decodes to cap peak mobile RAM.
const peakCache=new Map<string,Promise<AudioPeaksResult>>();
let decodeQueue:Promise<unknown>=Promise.resolve();
export async function computeAudioPeaks(url:string,barCount=1000):Promise<AudioPeaksResult>{
 if(!url||typeof window==="undefined")return{peaks:[],duration:0};
 let task=peakCache.get(url);
 if(!task){
  task=decodeQueue.catch(()=>undefined).then(async()=>{
   const response=await fetch(url);if(!response.ok)throw new Error(`Audio fetch failed (${response.status})`);
   const bytes=await response.arrayBuffer();
   const AC=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
   const ctx=new AC();
   try{const buffer=await ctx.decodeAudioData(bytes);return{peaks:peaksFromAudioBuffer(buffer,1000),duration:Number.isFinite(buffer.duration)?buffer.duration:0}}
   finally{await ctx.close().catch(()=>undefined)}
  });
  peakCache.set(url,task);decodeQueue=task.catch(()=>undefined);
  void task.catch(()=>{if(peakCache.get(url)===task)peakCache.delete(url)});
  if(peakCache.size>8)peakCache.delete(peakCache.keys().next().value!);
 }
 const result=await task;return{duration:result.duration,peaks:resamplePeaks(result.peaks,barCount)};
}

/** Max-abs peaks from an AudioBuffer via getChannelData, normalized to 0–1. */
export function peaksFromAudioBuffer(buffer: AudioBuffer, barCount: number): number[] {
  const count = Math.max(1, Math.floor(barCount));
  const channels = Math.max(1, Math.min(buffer.numberOfChannels, 2));
  const length = buffer.length;
  if (!length) return new Array(count).fill(0);

  const peaks = new Array<number>(count).fill(0);
  const blockSize = Math.max(1, Math.floor(length / count));

  for (let i = 0; i < count; i++) {
    const start = i * blockSize;
    const end = i === count - 1 ? length : Math.min(length, start + blockSize);
    let peak = 0;
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > peak) peak = v;
      }
    }
    peaks[i] = peak;
  }

  let max = 0;
  for (const p of peaks) if (p > max) max = p;
  if (max > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] /= max;
  }
  return peaks;
}

/** Down/up-sample peaks so display bars fill the current clip width. */
export function resamplePeaks(peaks: number[], targetCount: number): number[] {
  const n = Math.max(0, Math.floor(targetCount));
  if (!n) return [];
  if (!peaks.length) return new Array(n).fill(0);
  if (peaks.length === n) return peaks.slice();

  const out = new Array<number>(n);
  const ratio = peaks.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let peak = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      if (peaks[j] > peak) peak = peaks[j];
    }
    out[i] = peak;
  }
  return out;
}
