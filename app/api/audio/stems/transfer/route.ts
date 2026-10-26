import { env } from "cloudflare:workers";
import { findOwnedStem } from "../../../../../lib/audio-stems";
import { stagedStemKey, verifyStemCapability } from "../../../../../lib/stem-capability";

async function capability(request: Request) {
  return verifyStemCapability(new URL(request.url).searchParams.get("token") || "", env.MODAL_SHARED_SECRET);
}
export async function GET(request: Request) {
  const v = await capability(request);
  if (!v || v.action !== "read") return new Response("Unauthorized", { status: 401 });
  const owned = await findOwnedStem(v.audioId, "original", v.userId);
  if (!owned) return new Response("Expired audio", { status: 404 });
  const object = await env.TEMP_BUCKET.get(`audio/${v.audioId}-original.${owned.ext}`);
  if (!object) return new Response("Expired audio", { status: 404 });
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "content-length": String(object.size), "cache-control": "no-store" } });
}
export async function PUT(request: Request) {
  const v = await capability(request);
  if (!v || v.action !== "write") return new Response("Unauthorized", { status: 401 });
  if (!await findOwnedStem(v.audioId, "original", v.userId)) return new Response("Expired audio", { status: 404 });
  const size = Number(request.headers.get("content-length"));
  if (!request.body || !Number.isSafeInteger(size) || size < 42 || size > 95 * 1024 * 1024 || request.headers.get("content-type") !== "audio/flac")
    return new Response("Invalid audio upload", { status: 400 });
  const object = await env.TEMP_BUCKET.put(stagedStemKey(v), request.body, {
    httpMetadata: { contentType: "audio/flac", cacheControl: "private, max-age=86400" },
    customMetadata: { userId: v.userId, generation: v.generation, stem: v.stem, createdAt: new Date().toISOString(), mode: "stems", model: "Mel-RoFormer Karaoke · GPU" },
  });
  if (!object || object.size !== size) return new Response("Incomplete audio", { status: 502 });
  return Response.json({ stored: true });
}
