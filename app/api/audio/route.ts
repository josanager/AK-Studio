import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../auth";
import { currentWeekKey, ensureAppUser, getPlanSnapshot } from "../../../lib/plans";

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
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to create a karaoke." }, { status: 401 });
  const body = await request.json() as { url?: string };
  const source = sourceURL(body.url || "");
  if (!source) return Response.json({ error: "Paste a valid public YouTube or YouTube Music link." }, { status: 400 });
  if (!env.GPU_PROCESSOR_URL || !env.PROCESSOR_WEBHOOK_SECRET) {
    return Response.json({ error: "The audio processor is not active yet." }, { status: 503 });
  }

  await ensureAppUser(user);
  const plan = await getPlanSnapshot(user);
  const usageId = crypto.randomUUID();
  if (plan.plan === "free") {
    try {
      await env.DB.prepare("INSERT INTO weekly_usage (id,user_id,week_key,status,created_at) VALUES (?,?,?,?,?)")
        .bind(usageId, user.userId, currentWeekKey(), "processing", Math.floor(Date.now() / 1000)).run();
    } catch {
      return Response.json({ error: "Your free karaoke for this week is already used. Upgrade to Pro for unlimited projects.", code: "WEEKLY_LIMIT" }, { status: 429 });
    }
  }

  try {
    const processorBase = env.GPU_PROCESSOR_URL.replace(/\/$/, "");
    const response = await fetch(`${processorBase}/process`, {
      method: "POST",
      headers: { "authorization": `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ url: source.toString(), jobId: usageId }),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message.slice(0, 300) || "The song could not be processed.");
    }
    const manifest = await response.json() as { files?:Record<string,string>; title?:string; artist?:string; duration?:number; bpm?:number; model?:string };
    if (!manifest.files?.original || !manifest.files?.backing || !manifest.files?.lead) throw new Error("The separator returned an incomplete result.");
    const stored:Record<string,string> = {};
    await Promise.all(Object.entries(manifest.files).map(async ([stem, path]) => {
      const fileResponse = await fetch(`${processorBase}${path}`, { headers: { authorization: `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}` } });
      if (!fileResponse.ok || !fileResponse.body) throw new Error(`The ${stem} stem could not be stored.`);
      await env.TEMP_BUCKET.put(`audio/${usageId}-${stem}.flac`, fileResponse.body, {
        httpMetadata: { contentType: "audio/flac", cacheControl: "private, max-age=3600" },
        customMetadata: { createdAt: new Date().toISOString(), source: "youtube", stem, userId: user.userId },
      });
      stored[stem] = `/api/audio/${usageId}?stem=${stem}`;
    }));
    if (plan.plan === "free") await env.DB.prepare("UPDATE weekly_usage SET status='completed',completed_at=? WHERE id=?").bind(Math.floor(Date.now()/1000), usageId).run();
    return Response.json({ id:usageId, audioUrl:stored.original, backingUrl:stored.backing, vocalUrl:stored.lead, format:"flac", expiresIn:86400, bpm:manifest.bpm, model:manifest.model, title:manifest.title, artist:manifest.artist, duration:manifest.duration, plan:plan.plan });
  } catch (error) {
    if (plan.plan === "free") await env.DB.prepare("DELETE FROM weekly_usage WHERE id=? AND status='processing'").bind(usageId).run().catch(()=>undefined);
    return Response.json({ error:error instanceof Error?error.message:"The song could not be processed." }, { status:502 });
  }
}
