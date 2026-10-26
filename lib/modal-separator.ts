import { env } from "cloudflare:workers";
import { storeStem, type NdjsonEvent } from "./audio-stems";
import { signStemCapability, stagedStemKey, type StemCapability } from "./stem-capability";

async function control(path: string, body?: unknown) {
  const base = env.MODAL_SEPARATOR_URL?.replace(/\/$/, "");
  if (!base || !env.MODAL_SHARED_SECRET) throw new Error("The vocal separator is not configured.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
        headers: { authorization: `Bearer ${env.MODAL_SHARED_SECRET}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      if (response.ok) return response;
      if (response.status < 500) throw new Error(response.status === 429 ? "The vocal separator is busy. Please try again shortly." : "The separation job could not be reached.");
      await response.body?.cancel();
    } catch (error) { if (error instanceof Error && /busy|could not be reached/.test(error.message)) throw error; }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("The vocal separator is unavailable. Your original audio is still safe; retry shortly.");
}

export async function processWithModal({ usageId, userId, send }: { usageId: string; userId: string; send: (event: NdjsonEvent) => Promise<void> }) {
  const generation = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const origin = env.SITE_URL!.replace(/\/$/, "");
  const cap = (action: "read" | "write", stem: StemCapability["stem"]): StemCapability => ({ action, stem, audioId: usageId, userId, generation, expires });
  const transfer = async (action: "read" | "write", stem: StemCapability["stem"]) => `${origin}/api/audio/stems/transfer?token=${encodeURIComponent(await signStemCapability(cap(action, stem), env.MODAL_SHARED_SECRET!))}`;
  await send({ status: "downloading", progress: 5, phase: "queue", message: "Preparing the cloud GPU… You can keep editing or cancel." });
  await control("/process", { jobId: usageId, generation, audioUrl: await transfer("read", "original"),
    uploads: { lead: await transfer("write", "lead"), backing: await transfer("write", "backing") } });
  const deadline = Date.now() + 20 * 60_000;
  let result: { generation: string; duration: number } | undefined;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const status = await (await control(`/job/${usageId}`)).json() as { status: string; progress?: number; message?: string; manifest?: { generation: string; duration: number } };
    if (["cancelled", "cancelling"].includes(status.status)) throw new Error("Separation cancelled.");
    if (status.status === "error") throw new Error("Vocal separation failed. Retry or keep editing with the original audio.");
    if (status.status === "ready" && status.manifest) { result = status.manifest; break; }
    await send({ status: "downloading", progress: Math.max(5, Math.min(88, status.progress || 5)), phase: status.status === "queued" ? "queue" : "processor", message: status.message || "Separating lead vocal on the cloud GPU…" });
  }
  if (!result) {
    await control(`/job/${usageId}/cancel`, {}).catch(() => undefined);
    throw new Error("Vocal separation timed out. Please retry shortly.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(result.generation) || !Number.isFinite(result.duration) || result.duration <= 0 || result.duration > 1200)
    throw new Error("The vocal separator returned an invalid result.");
  // Promote only a complete generation. A partial/cancelled result cannot be cached.
  const stages = await Promise.all((["backing", "lead"] as const).map(async stem => {
    const key = stagedStemKey({ ...cap("write", stem), generation: result!.generation });
    const object = await env.TEMP_BUCKET.get(key);
    if (!object || object.customMetadata?.userId !== userId || object.customMetadata?.generation !== result!.generation || object.size < 42) {
      await object?.body.cancel();
      throw new Error("The separated tracks are incomplete. Please retry.");
    }
    return { stem, object, key };
  }));
  await send({ status: "downloading", progress: 94, phase: "storing", message: "Finishing the separated tracks…" });
  const urls: Record<string, string> = {};
  for (const { stem, object } of stages) urls[stem] = await storeStem(usageId, stem, object.body, "audio/flac", "flac", userId,
    { mode: "stems", model: "Mel-RoFormer Karaoke · GPU", generation: result.generation });
  // Keep staging copies until the bucket's temporary-audio lifecycle expires:
  // a lost HTTP response can safely recover the same completed Modal job.
  await send({ status: "ready", progress: 100, id: usageId, mode: "stems", format: "flac", expiresIn: 86400,
    audioUrl: `/api/audio/${usageId}?stem=original`, backingUrl: urls.backing, vocalUrl: urls.lead,
    model: "Mel-RoFormer Karaoke · GPU", duration: result.duration });
}
