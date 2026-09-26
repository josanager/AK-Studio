const CACHE_NAME = "ak-studio-audio-v1";
const TTL_MS = 24 * 60 * 60 * 1000;

function absoluteUrl(url: string) {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/** Fetch audio once and keep a Cache Storage copy for ~24h; return a blob: URL for reliable playback. */
export async function cachedAudioUrl(url: string): Promise<string> {
  if (!url || url.startsWith("blob:") || typeof window === "undefined") return url;
  const abs = absoluteUrl(url);
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(abs);
    const stem = new URL(abs).searchParams.get("stem");
    // Backing initially contains the full mix and is replaced after separation.
    // Validate mutable stems instead of returning that old full-mix cache entry.
    const mutableStem = stem === "backing" || stem === "lead";
    if (hit) {
      const storedAt = Number(hit.headers.get("x-ak-cached-at") || 0);
      if (!mutableStem && storedAt && Date.now() - storedAt < TTL_MS) {
        return URL.createObjectURL(await hit.blob());
      }
      if (!storedAt || Date.now() - storedAt >= TTL_MS) await cache.delete(abs);
    }
    const etag = mutableStem ? hit?.headers.get("etag") : null;
    const response = await fetch(abs, { credentials: "same-origin", cache: mutableStem ? "no-store" : "force-cache",
      headers: etag ? { "if-none-match": etag } : undefined });
    if (response.status === 304 && hit) return URL.createObjectURL(await hit.blob());
    if (!response.ok) return url;
    const blob = await response.blob();
    const headers = new Headers();
    headers.set("content-type", blob.type || "audio/mp4");
    if (response.headers.get("etag")) headers.set("etag", response.headers.get("etag")!);
    headers.set("x-ak-cached-at", String(Date.now()));
    headers.set("cache-control", "private, max-age=86400");
    await cache.put(abs, new Response(blob.slice(), { status: 200, headers }));
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

export function revokeAudioUrl(url: string | null | undefined) {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}
