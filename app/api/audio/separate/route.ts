import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../auth";
import {
  GPU_UNAVAILABLE_MESSAGE,
  canRunGpuSeparator,
  createStemAccessToken,
  findOwnedStem,
  ndjsonResponse,
  processWithGpu,
} from "../../../../lib/audio-stems";

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

/**
 * POST /api/audio/separate
 * Body: { audioId: string, url?: string }
 *
 * Separates lead vocal + backing from an existing project audio in R2.
 * Prefers feeding the stored original to the GPU processor via a short-lived
 * signed audioUrl so YouTube is not re-downloaded when possible.
 * Uses the existing R2 file; a failed inference is never repeated automatically.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to separate stems." }, { status: 401 });

  const body = await request.json() as { audioId?: string; url?: string };
  const audioId = typeof body.audioId === "string" ? body.audioId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(audioId)) {
    return Response.json({ error: "Missing or invalid audioId." }, { status: 400 });
  }

  const owned = await findOwnedStem(audioId, "original", user.userId);
  if (!owned) {
    return Response.json({
      error: "Original audio is missing or expired. Create karaoke again to download the song.",
    }, { status: 404 });
  }

  const [backing, lead] = await Promise.all([
    findOwnedStem(audioId, "backing", user.userId),
    findOwnedStem(audioId, "lead", user.userId),
  ]);
  if (backing && lead) {
    return Response.json({ status: "ready", progress: 100, id: audioId, mode: "stems",
      audioUrl: `/api/audio/${audioId}?stem=original`, backingUrl: `/api/audio/${audioId}?stem=backing`,
      vocalUrl: `/api/audio/${audioId}?stem=lead`, model: backing.meta.model, expiresIn: 86400 });
  }

  if (!canRunGpuSeparator()) {
    return Response.json({ error: GPU_UNAVAILABLE_MESSAGE, code: "GPU_UNAVAILABLE" }, { status: 503 });
  }

  const youtube = sourceURL(body.url || "");
  const origin = env.SITE_URL || new URL(request.url).origin;
  const token = await createStemAccessToken(audioId, "original", env.PROCESSOR_WEBHOOK_SECRET!);
  const audioUrl = `${origin.replace(/\/$/, "")}/api/audio/${audioId}?stem=original&token=${encodeURIComponent(token)}`;

  return ndjsonResponse(async (send) => {
    await send({
      status: "downloading",
      progress: 1,
      phase: "processor",
      message: "Separating lead vocal…",
    });
    await processWithGpu({
        audioUrl,
        youtubeUrl: youtube?.toString(),
        usageId: audioId,
        jobId: audioId,
        userId: user.userId,
        send,
        skipOriginal: true,
      });
  });
}
