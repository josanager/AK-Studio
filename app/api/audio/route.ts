import { env } from "cloudflare:workers";

const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"]);

function sourceURL(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0].replace(/[),.;!?\]}]+$/, ""));
    return allowedHosts.has(url.hostname.toLowerCase()) ? url : null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const body = await request.json() as { url?: string };
  const source = sourceURL(body.url || "");
  if (!source) return Response.json({ error: "Paste a valid public YouTube or YouTube Music link." }, { status: 400 });
  if (!env.GPU_PROCESSOR_URL || !env.PROCESSOR_WEBHOOK_SECRET) {
    return Response.json({ error: "The audio processor is not active yet." }, { status: 503 });
  }

  const response = await fetch(env.GPU_PROCESSOR_URL, {
    method: "POST",
    headers: { "authorization": `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ url: source.toString() }),
  });
  if (!response.ok || !response.body) {
    const message = await response.text().catch(() => "");
    return Response.json({ error: message.slice(0, 300) || "The song could not be downloaded." }, { status: response.status >= 400 && response.status < 500 ? 422 : 502 });
  }

  const id = crypto.randomUUID();
  const key = `audio/${id}.flac`;
  const encodedMetadata = response.headers.get("x-ak-metadata") || "e30=";
  let metadata = "{}";
  try { metadata = atob(encodedMetadata.replace(/-/g, "+").replace(/_/g, "/")); } catch { /* keep empty metadata */ }
  await env.TEMP_BUCKET.put(key, response.body, {
    httpMetadata: { contentType: "audio/flac", cacheControl: "private, max-age=3600" },
    customMetadata: { createdAt: new Date().toISOString(), source: "youtube", metadata: metadata.slice(0, 1800) },
  });
  const parsed = JSON.parse(metadata) as { title?: string; artist?: string; duration?: number };
  return Response.json({ id, audioUrl: `/api/audio/${id}`, format: "flac", expiresIn: 86400, ...parsed });
}
