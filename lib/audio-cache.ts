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
    if (hit) {
      const storedAt = Number(hit.headers.get("x-ak-cached-at") || 0);
      if (storedAt && Date.now() - storedAt < TTL_MS) {
        return URL.createObjectURL(await hit.blob());
      }
      await cache.delete(abs);
    }
    const response = await fetch(abs, { credentials: "same-origin", cache: "force-cache" });
    if (!response.ok) return url;
    const blob = await response.blob();
    const headers = new Headers();
    headers.set("content-type", blob.type || "audio/flac");
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
