import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../auth";
import { currentWeekKey, ensureAppUser, getPlanSnapshot } from "../../../lib/plans";
import {
  downloadViaCobalt,
  downloadViaProcessor,
  downloadYouTubeAudio,
  sanitizeDownloadError,
  type AudioDownloadResult,
} from "../../../lib/youtube-download";
import {
  canRunGpuSeparator,
  ndjsonResponse,
  processWithGpu,
  storeStem,
  type NdjsonEvent,
} from "../../../lib/audio-stems";

const allowedHosts = new Set(["youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "m.youtube.com"]);

function sourceURL(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0].replace(/[),.;!?\]}]+$/, ""));
    return allowedHosts.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

async function downloadFullMix(
  source: URL,
  usageId: string,
  onProgress: (progress: number) => Promise<void>,
  send: (event: NdjsonEvent) => Promise<void>,
): Promise<AudioDownloadResult> {
  const errors: string[] = [];

  if (env.COBALT_API_URL) {
    try {
      await send({ status: "downloading", progress: 2, phase: "download", message: "Downloading song…" });
      return await downloadViaCobalt(source, env.COBALT_API_URL, env.COBALT_API_KEY, onProgress);
    } catch (error) {
      errors.push(sanitizeDownloadError(error instanceof Error ? error.message : "Cobalt failed"));
      await send({ status: "downloading", progress: 3, phase: "download", message: "Trying another download method…" });
    }
  }

  if (env.GPU_PROCESSOR_URL && env.PROCESSOR_WEBHOOK_SECRET) {
    try {
      await send({ status: "downloading", progress: 4, phase: "download", message: "Downloading song…" });
      return await downloadViaProcessor(
        source,
        env.GPU_PROCESSOR_URL,
        env.PROCESSOR_WEBHOOK_SECRET,
        usageId,
        onProgress,
      );
    } catch (error) {
      errors.push(sanitizeDownloadError(error instanceof Error ? error.message : "Processor download failed"));
      await send({ status: "downloading", progress: 5, phase: "download", message: "Trying another download method…" });
    }
  }

  try {
    await send({ status: "downloading", progress: 6, phase: "download", message: "Downloading song…" });
    return await downloadYouTubeAudio(source, onProgress);
  } catch (error) {
    errors.push(sanitizeDownloadError(error instanceof Error ? error.message : "YouTube download failed"));
    const detail = errors.filter(Boolean).slice(-2).join(" ");
    throw new Error(
      detail
        ? `Could not download audio from YouTube. ${detail}`
        : "Could not download audio from YouTube. Please try again in a moment.",
    );
  }
}

async function processFullMix(source: URL, usageId: string, userId: string, send: (event: NdjsonEvent) => Promise<void>) {
  await send({ status: "downloading", progress: 1, phase: "download", message: "Downloading song…" });

  const onProgress = async (progress: number) => {
    const mapped = Math.max(1, Math.min(90, Math.round(progress * 0.9)));
    await send({ status: "downloading", progress: mapped, phase: "download", message: "Downloading song…" });
  };

  const downloaded = await downloadFullMix(source, usageId, onProgress, send);

  await send({ status: "downloading", progress: 92, phase: "storing", message: "Saving audio…" });
  const meta = { mode: "full", model: "full-mix" };
  const audioUrl = await storeStem(
    usageId,
    "original",
    downloaded.bytes,
    downloaded.contentType,
    downloaded.extension,
    userId,
    meta,
  );
  const backingUrl = `/api/audio/${usageId}?stem=backing`;

  await send({
    status: "ready",
    progress: 100,
    id: usageId,
    mode: "full",
    audioUrl,
    backingUrl,
    vocalUrl: null,
    format: downloaded.extension,
    expiresIn: 86400,
    bpm: null,
    model: "full-mix",
    title: downloaded.title,
    artist: downloaded.artist,
    duration: downloaded.duration,
    source: downloaded.source,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to create a karaoke." }, { status: 401 });
  const body = await request.json() as { url?: string };
  const source = sourceURL(body.url || "");
  if (!source) return Response.json({ error: "Paste a valid public YouTube or YouTube Music link." }, { status: 400 });

  await ensureAppUser(user);
  const plan = await getPlanSnapshot(user);
  const usageId = crypto.randomUUID();
  if (plan.plan === "free") {
    try {
      await env.DB.prepare(
        "INSERT INTO weekly_usage (id,user_id,week_key,status,created_at) VALUES (?,?,?,?,?)",
      ).bind(usageId, user.userId, currentWeekKey(), "processing", Math.floor(Date.now() / 1000)).run();
    } catch {
      return Response.json({
        error: "Your free karaoke for this week is already used. Upgrade to Pro for unlimited projects.",
        code: "WEEKLY_LIMIT",
      }, { status: 429 });
    }
  }

  const canSeparate = canRunGpuSeparator();

  return ndjsonResponse(async (send) => {
    try {
      await send({
        status: "downloading",
        progress: 0,
        phase: canSeparate ? "processor" : "download",
        plan: plan.plan,
        message: "Downloading song…",
      });
      if (canSeparate) {
        try {
          await processWithGpu({
            youtubeUrl: source.toString(),
            usageId,
            userId: user.userId,
            send,
          });
        } catch {
          await send({
            status: "downloading",
            progress: 8,
            phase: "download",
            message: "Stem separation unavailable — downloading full mix…",
          });
          await processFullMix(source, usageId, user.userId, send);
        }
      } else {
        await processFullMix(source, usageId, user.userId, send);
      }
      if (plan.plan === "free") {
        await env.DB.prepare("UPDATE weekly_usage SET status='completed',completed_at=? WHERE id=?")
          .bind(Math.floor(Date.now() / 1000), usageId).run();
      }
    } catch (error) {
      if (plan.plan === "free") {
        await env.DB.prepare("DELETE FROM weekly_usage WHERE id=? AND status='processing'")
          .bind(usageId).run().catch(() => undefined);
      }
      throw error;
    }
  });
}
