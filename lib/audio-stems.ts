import { env } from "cloudflare:workers";
import { sanitizeDownloadError } from "./youtube-download";

export type NdjsonEvent = Record<string, unknown>;

const STEM_EXTS = ["m4a", "mp4", "webm", "mp3", "ogg", "flac"] as const;

export function ndjsonResponse(run: (send: (event: NdjsonEvent) => Promise<void>) => Promise<void>) {
  const encoder = new TextEncoder();
  let disconnected = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() { disconnected = true; },
    async start(controller) {
      const send = async (event: NdjsonEvent) => {
        if (!disconnected) {
          try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
          catch { disconnected = true; }
        }
      };
      // Keep the connection alive during yt-dlp preparation, without fake progress.
      const heartbeat = setInterval(() => {
        if (!disconnected) {
          try { controller.enqueue(encoder.encode("\n")); }
          catch { disconnected = true; }
        }
      }, 15_000);
      try {
        await run(send);
      } catch (error) {
        const raw = error instanceof Error ? error.message : "The song could not be processed.";
        await send({
          status: "error",
          progress: 0,
          error: sanitizeDownloadError(raw),
        });
      } finally {
        clearInterval(heartbeat);
        if (!disconnected) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function storeStem(
  usageId: string,
  stem: string,
  body: ArrayBuffer | Uint8Array | ReadableStream,
  contentType: string,
  extension: string,
  userId: string,
  extra: Record<string, string> = {},
) {
  await env.TEMP_BUCKET.put(`audio/${usageId}-${stem}.${extension}`, body, {
    httpMetadata: { contentType, cacheControl: "private, max-age=86400" },
    customMetadata: {
      createdAt: new Date().toISOString(),
      source: "youtube",
      stem,
      userId,
      extension,
      ...extra,
    },
  });
  return `/api/audio/${usageId}?stem=${stem}`;
}

export async function findOwnedStem(audioId: string, stem: string, userId: string) {
  for (const ext of STEM_EXTS) {
    const object = await env.TEMP_BUCKET.head(`audio/${audioId}-${stem}.${ext}`);
    if (!object) continue;
    if (object.customMetadata?.userId !== userId) return null;
    return { ext, meta: object.customMetadata || {} };
  }
  return null;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createStemAccessToken(audioId: string, stem: string, secret: string, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${audioId}:${stem}:${exp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${exp}.${sig}`;
}

export async function verifyStemAccessToken(
  audioId: string,
  stem: string,
  token: string | null,
  secret: string | undefined,
) {
  if (!token || !secret) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const payload = `${audioId}:${stem}:${exp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (expected.length !== sig.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i += 1) ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return ok === 0;
}

export const GPU_UNAVAILABLE_MESSAGE =
  "Stem separation needs the GPU processor. Full mix still plays.";

export function canRunGpuSeparator() {
  return Boolean(env.SEPARATOR_PROCESSOR_URL && env.SEPARATOR_WEBHOOK_SECRET);
}

type ProcessGpuOpts = {
  youtubeUrl?: string;
  audioUrl?: string;
  usageId: string;
  jobId?: string;
  userId: string;
  send: (event: NdjsonEvent) => Promise<void>;
  /** When true, skip storing original from the processor (keep R2 full-mix). */
  skipOriginal?: boolean;
};

export async function processWithGpu({
  youtubeUrl,
  audioUrl,
  usageId,
  jobId,
  userId,
  send,
  skipOriginal = false,
}: ProcessGpuOpts) {
  if (!env.SEPARATOR_PROCESSOR_URL || !env.SEPARATOR_WEBHOOK_SECRET) {
    throw new Error(GPU_UNAVAILABLE_MESSAGE);
  }
  if (!youtubeUrl && !audioUrl) {
    throw new Error("A YouTube link or stored audio file is required for stem separation.");
  }

  const processorBase = env.SEPARATOR_PROCESSOR_URL.replace(/\/$/, "");
  const processorJobId = jobId || crypto.randomUUID();
  await send({ status: "downloading", progress: 5, phase: "processor", message: "Separating lead vocal…" });

  const body: Record<string, string> = { jobId: processorJobId };
  if (audioUrl) body.audioUrl = audioUrl;
  if (youtubeUrl) body.url = youtubeUrl;

  const response = await fetch(`${processorBase}/process`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SEPARATOR_WEBHOOK_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    const lower = message.toLowerCase();
    if (
      response.status === 404
      || lower.includes("not found")
      || lower.includes("no such")
      || lower.includes("audio-separator")
      || lower.includes("separator")
    ) {
      throw new Error(GPU_UNAVAILABLE_MESSAGE);
    }
    throw new Error(sanitizeDownloadError(message.slice(0, 300) || GPU_UNAVAILABLE_MESSAGE));
  }

  await send({ status: "downloading", progress: 55, phase: "storing", message: "Saving stems…" });
  const manifest = await response.json() as {
    files?: Record<string, string>;
    title?: string;
    artist?: string;
    duration?: number;
    bpm?: number;
    model?: string;
  };
  if (!manifest.files?.backing || !manifest.files?.lead) {
    throw new Error("The separator returned an incomplete result.");
  }
  if (!skipOriginal && !manifest.files.original) {
    throw new Error("The separator returned an incomplete result.");
  }

  const stored: Record<string, string> = {};
  const stems = Object.entries(manifest.files).filter(([stem]) => !(skipOriginal && stem === "original"));
  let done = 0;
  await Promise.all(stems.map(async ([stem, path]) => {
    const fileResponse = await fetch(`${processorBase}${path}`, {
      headers: { authorization: `Bearer ${env.SEPARATOR_WEBHOOK_SECRET}` },
    });
    if (!fileResponse.ok || !fileResponse.body) throw new Error(`The ${stem} stem could not be stored.`);
    stored[stem] = await storeStem(
      usageId,
      stem,
      fileResponse.body,
      "audio/flac",
      "flac",
      userId,
      { mode: "stems", model: manifest.model || "BS-RoFormer" },
    );
    done += 1;
    await send({ status: "downloading", progress: 55 + Math.round((done / stems.length) * 40), phase: "storing" });
  }));

  await send({
    status: "ready",
    progress: 100,
    id: usageId,
    mode: "stems",
    audioUrl: stored.original || `/api/audio/${usageId}?stem=original`,
    backingUrl: stored.backing,
    vocalUrl: stored.lead,
    format: "flac",
    expiresIn: 86400,
    bpm: manifest.bpm,
    model: manifest.model || "BS-RoFormer",
    title: manifest.title,
    artist: manifest.artist,
    duration: manifest.duration,
  });
}
