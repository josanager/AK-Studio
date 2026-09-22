/** Lightweight YouTube audio fetch for Cloudflare Workers (no yt-dlp binary). */

const VISITOR_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

export type AudioDownloadResult = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  title?: string;
  artist?: string;
  duration?: number;
  source: "youtube" | "cobalt" | "processor";
};

export type ProgressFn = (progress: number) => void | Promise<void>;

/** Map YouTube bot-check copy to AK Studio–safe English (never mention robots / sign-in). */
export function friendlyYouTubeError(reason?: string): string {
  const text = (reason || "").toLowerCase();
  if (
    text.includes("sign in") ||
    text.includes("not a robot") ||
    text.includes("confirm you") ||
    text.includes("bot") ||
    text.includes("login") ||
    text.includes("captcha")
  ) {
    return "Could not download audio from YouTube from this server. Retrying with another method…";
  }
  if (reason && reason.trim()) {
    return `Could not download audio from YouTube (${reason.trim()}).`;
  }
  return "Could not download audio from YouTube. Please try again.";
}

export function sanitizeDownloadError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("not a robot") ||
    lower.includes("sign in to confirm") ||
    lower.includes("sign in") && lower.includes("robot")
  ) {
    return "Could not download audio from YouTube. Please try again in a moment.";
  }
  return message;
}

type PlayerFormat = {
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  contentLength?: string;
  url?: string;
  audioQuality?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  const v = url.searchParams.get("v");
  if (v && /^[\w-]{11}$/.test(v)) return v;
  const shorts = url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);
  return shorts?.[1] || null;
}

function extensionFor(contentType: string, mimeTypeHint?: string): string {
  const mime = (contentType || mimeTypeHint || "").toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("flac")) return "flac";
  if (mime.includes("ogg") || mime.includes("opus")) return "ogg";
  return "m4a";
}

async function getVisitorData(): Promise<string> {
  const response = await fetch("https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": VISITOR_UA },
    body: JSON.stringify({
      context: { client: { clientName: "WEB", clientVersion: "2.20250331.01.00", hl: "en" } },
    }),
  });
  if (!response.ok) throw new Error("Could not start a YouTube session for audio download.");
  const data = asRecord(await response.json());
  const visitor = asRecord(data?.responseContext)?.visitorData;
  if (typeof visitor !== "string" || !visitor) throw new Error("Could not start a YouTube session for audio download.");
  return visitor;
}

async function fetchVisionOSPlayer(videoId: string, visitorData: string) {
  const response = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": VISITOR_UA,
      origin: "https://www.youtube.com",
      "x-youtube-client-name": "101",
      "x-youtube-client-version": "1.02",
      "x-goog-visitor-id": visitorData,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "VISIONOS",
          clientVersion: "1.02",
          deviceMake: "Apple",
          deviceModel: "RealityDevice17,1",
          userAgent: VISITOR_UA,
          osName: "visionOS",
          osVersion: "26.5.23O471",
          hl: "en",
          timeZone: "UTC",
          utcOffsetMinutes: 0,
        },
      },
      videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: "HTML5_PREF_WANTS",
          signatureTimestamp: 20712,
        },
      },
      contentCheckOk: true,
      racyCheckOk: true,
    }),
  });
  if (!response.ok) throw new Error("YouTube did not return playable audio for that link.");
  return asRecord(await response.json());
}

function pickAudioFormat(player: Record<string, unknown>): PlayerFormat {
  const streaming = asRecord(player.streamingData);
  const formats = [
    ...((streaming?.adaptiveFormats as PlayerFormat[]) || []),
    ...((streaming?.formats as PlayerFormat[]) || []),
  ].filter((format) => typeof format.url === "string" && String(format.mimeType || "").includes("audio"));

  if (!formats.length) {
    const status = asRecord(player.playabilityStatus);
    const reason = typeof status?.reason === "string" ? status.reason : "no audio formats";
    throw new Error(friendlyYouTubeError(reason));
  }

  // Prefer AAC/MP4 for browser playback, then highest bitrate.
  formats.sort((a, b) => {
    const aMp4 = String(a.mimeType || "").includes("mp4") ? 1 : 0;
    const bMp4 = String(b.mimeType || "").includes("mp4") ? 1 : 0;
    if (aMp4 !== bMp4) return bMp4 - aMp4;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
  return formats[0];
}

async function readBodyWithProgress(
  response: Response,
  onProgress?: ProgressFn,
  range: { from: number; to: number } = { from: 0, to: 100 },
): Promise<Uint8Array> {
  if (!response.body) throw new Error("The audio download returned an empty body.");
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastReported = -1;
  const span = Math.max(1, range.to - range.from);

  const report = async (ratio: number) => {
    const progress = Math.round(range.from + Math.min(1, Math.max(0, ratio)) * span);
    if (progress !== lastReported && onProgress) {
      lastReported = progress;
      await onProgress(progress);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    chunks.push(value);
    received += value.byteLength;
    if (total) await report(received / total);
    else await report(Math.min(0.9, received / 500_000));
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await report(1);
  return bytes;
}

export async function downloadYouTubeAudio(
  source: URL,
  onProgress?: ProgressFn,
): Promise<AudioDownloadResult> {
  const videoId = youtubeVideoId(source);
  if (!videoId) throw new Error("Paste a valid public YouTube or YouTube Music link.");

  if (onProgress) await onProgress(2);
  const visitorData = await getVisitorData();
  if (onProgress) await onProgress(5);

  const player = await fetchVisionOSPlayer(videoId, visitorData);
  const status = asRecord(player?.playabilityStatus)?.status;
  if (status && status !== "OK") {
    const reason = asRecord(player?.playabilityStatus)?.reason;
    throw new Error(
      typeof reason === "string" && reason
        ? friendlyYouTubeError(reason)
        : "Could not download audio from YouTube. Retrying…",
    );
  }
  if (!player) throw new Error("YouTube did not return playable audio for that link.");

  const format = pickAudioFormat(player);
  if (onProgress) await onProgress(8);

  const audioResponse = await fetch(format.url!, {
    headers: {
      "user-agent": VISITOR_UA,
      referer: "https://www.youtube.com/",
      origin: "https://www.youtube.com",
    },
  });
  if (!audioResponse.ok) throw new Error("The song audio could not be downloaded.");

  const contentType = audioResponse.headers.get("content-type") || format.mimeType || "audio/mp4";
  const bytes = await readBodyWithProgress(audioResponse, onProgress, { from: 8, to: 100 });
  if (!bytes.byteLength) throw new Error("The song audio download was empty.");

  const details = asRecord(player.videoDetails);
  const title = typeof details?.title === "string" ? details.title : undefined;
  const author = typeof details?.author === "string" ? details.author : undefined;
  const durationRaw = details?.lengthSeconds;
  const duration = typeof durationRaw === "string" || typeof durationRaw === "number"
    ? Number(durationRaw)
    : undefined;

  return {
    bytes,
    contentType,
    extension: extensionFor(contentType, format.mimeType),
    title,
    artist: author,
    duration: Number.isFinite(duration) ? duration : undefined,
    source: "youtube",
  };
}


export async function downloadViaCobalt(
  source: URL,
  cobaltBase: string,
  apiKey: string | undefined,
  onProgress?: ProgressFn,
): Promise<AudioDownloadResult> {
  if (onProgress) await onProgress(3);
  const base = cobaltBase.replace(/\/$/, "");
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (apiKey) {
    headers.authorization = apiKey.startsWith("Bearer ") ? apiKey : `Api-Key ${apiKey}`;
  }

  const resolve = await fetch(`${base}/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: source.toString(),
      downloadMode: "audio",
      audioFormat: "mp3",
      audioBitrate: "128",
    }),
  });
  const payload = asRecord(await resolve.json().catch(() => null));
  if (!resolve.ok || !payload) throw new Error("The Cobalt download service rejected the request.");
  if (payload.status === "error") {
    const code = asRecord(payload.error)?.code;
    throw new Error(
      typeof code === "string"
        ? `Cobalt could not download that song (${code}).`
        : "Cobalt could not download that song.",
    );
  }

  let fileUrl = typeof payload.url === "string" ? payload.url : null;
  if (!fileUrl && Array.isArray(payload.picker) && payload.picker.length) {
    const first = asRecord(payload.picker[0]);
    if (typeof first?.url === "string") fileUrl = first.url;
  }
  if (!fileUrl) throw new Error("Cobalt did not return an audio file URL.");

  if (onProgress) await onProgress(10);
  const audioResponse = await fetch(fileUrl, {
    headers: apiKey
      ? { authorization: apiKey.startsWith("Bearer ") ? apiKey : `Api-Key ${apiKey}` }
      : undefined,
  });
  if (!audioResponse.ok) throw new Error("Cobalt audio download failed.");
  const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
  const bytes = await readBodyWithProgress(audioResponse, onProgress, { from: 10, to: 100 });
  return {
    bytes,
    contentType,
    extension: extensionFor(contentType),
    source: "cobalt",
  };
}

/** Full-mix download via AK Studio processor (yt-dlp only — no stem separation). */
export async function downloadViaProcessor(
  source: URL,
  processorBase: string,
  webhookSecret: string,
  jobId: string,
  onProgress?: ProgressFn,
): Promise<AudioDownloadResult> {
  if (onProgress) await onProgress(4);
  const base = processorBase.replace(/\/$/, "");
  const response = await fetch(`${base}/download`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${webhookSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url: source.toString(), jobId }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      sanitizeDownloadError(message.slice(0, 280) || "The audio processor could not download that song."),
    );
  }
  if (onProgress) await onProgress(12);
  const manifest = await response.json() as {
    files?: { original?: string };
    title?: string;
    artist?: string;
    duration?: number;
  };
  const path = manifest.files?.original;
  if (!path) throw new Error("The audio processor did not return a downloadable file.");

  const fileResponse = await fetch(`${base}${path}`, {
    headers: { authorization: `Bearer ${webhookSecret}` },
  });
  if (!fileResponse.ok || !fileResponse.body) {
    throw new Error("The processor audio file could not be fetched.");
  }
  const contentType = fileResponse.headers.get("content-type") || "audio/flac";
  const bytes = await readBodyWithProgress(fileResponse, onProgress, { from: 12, to: 100 });
  if (!bytes.byteLength) throw new Error("The processor audio download was empty.");
  return {
    bytes,
    contentType,
    extension: extensionFor(contentType, "audio/flac"),
    title: manifest.title,
    artist: manifest.artist,
    duration: typeof manifest.duration === "number" ? manifest.duration : undefined,
    source: "processor",
  };
}
