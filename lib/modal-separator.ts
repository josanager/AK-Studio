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

export async function startModalSeparation(usageId:string,userId:string) {
  const generation = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const origin = env.SITE_URL!.replace(/\/$/, "");
  const cap = (action: "read" | "write", stem: StemCapability["stem"]): StemCapability => ({ action, stem, audioId: usageId, userId, generation, expires });
  const transfer = async (action: "read" | "write", stem: StemCapability["stem"]) => `${origin}/api/audio/stems/transfer?token=${encodeURIComponent(await signStemCapability(cap(action, stem), env.MODAL_SHARED_SECRET!))}`;
  await control("/process", { jobId: usageId, generation, audioUrl: await transfer("read", "original"),
    uploads: { lead: await transfer("write", "lead"), backing: await transfer("write", "backing") } });
  return {status:"processing",progress:5,message:"Please wait while your audio is processed."};
}

export async function pollModalSeparation(usageId:string,userId:string){
  const status=await (await control(`/job/${usageId}`)).json() as {status:string;progress?:number;manifest?:{generation:string;duration:number}};
  if(["error","cancelled","cancelling"].includes(status.status))throw new Error(status.status==="error"?"Audio processing failed. Please retry.":"Separation cancelled.");
  if(status.status!=="ready"||!status.manifest)return{status:"processing",progress:Math.max(5,Math.min(88,status.progress||5)),message:"Please wait while your audio is processed."};
  const result=status.manifest;
  const cap=(action:"read"|"write",stem:StemCapability["stem"]):StemCapability=>({action,stem,audioId:usageId,userId,generation:result.generation,expires:Math.floor(Date.now()/1000)+3600});
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

  const urls: Record<string, string> = {};
  for (const { stem, object } of stages) urls[stem] = await storeStem(usageId, stem, object.body, "audio/flac", "flac", userId,
    { mode: "stems", model: "Mel-RoFormer Karaoke · GPU", generation: result.generation });
  // Keep staging copies until the bucket's temporary-audio lifecycle expires:
  // a lost HTTP response can safely recover the same completed Modal job.
  return { status: "ready", progress: 100, id: usageId, mode: "stems", format: "flac", expiresIn: 86400,
    audioUrl: `/api/audio/${usageId}?stem=original`, backingUrl: urls.backing, vocalUrl: urls.lead,
    model: "Mel-RoFormer Karaoke · GPU", duration: result.duration };
}

// Compatibility for download flows still using NDJSON. Standalone separation uses
// short start/status requests; a suspended browser cannot cancel the spawned job.
export async function processWithModal({usageId,userId,send}:{usageId:string;userId:string;send:(event:NdjsonEvent)=>Promise<void>}){
 await startModalSeparation(usageId,userId);
 const deadline=Date.now()+20*60_000;
 while(Date.now()<deadline){const result=await pollModalSeparation(usageId,userId);await send(result);if(result.status==="ready")return;await new Promise(r=>setTimeout(r,3000))}
 throw new Error("Audio processing timed out. Please retry.");
}
