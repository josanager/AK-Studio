import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../auth";
import { verifyStemAccessToken } from "../../../../lib/audio-stems";

const DAY_MS = 24 * 60 * 60 * 1000;
const STEM_EXTS = ["m4a", "mp4", "webm", "mp3", "ogg", "flac"] as const;

async function getStemObject(id: string, stem: string, range?: { offset: number; length?: number }) {
  for (const ext of STEM_EXTS) {
    const object = await env.TEMP_BUCKET.get(
      `audio/${id}-${stem}.${ext}`,
      range ? { range } : undefined,
    );
    if (object) return { object, ext };
  }
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const stem = url.searchParams.get("stem") || "original";
  if (!new Set(["original", "backing", "lead"]).has(stem)) return new Response("Not found", { status: 404 });

  const token = url.searchParams.get("token");
  const tokenOk = await verifyStemAccessToken(id, stem, token, env.PROCESSOR_WEBHOOK_SECRET);
  if (!tokenOk) {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
  }

  const rangeHeader = request.headers.get("range");
  const rangeMatch = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
  const range = rangeMatch
    ? { offset: Number(rangeMatch[1]), length: rangeMatch[2] ? Number(rangeMatch[2]) - Number(rangeMatch[1]) + 1 : undefined }
    : undefined;

  let found = await getStemObject(id, stem, range);
  // Full-mix mode stores original (+ backing). Serve original when lead/backing is missing.
  if (!found && stem !== "original") {
    found = await getStemObject(id, "original", range);
    if (found && found.object.customMetadata?.mode !== "full") found = null;
  }
  if (!found) return new Response("This temporary audio has expired.", { status: 404 });
  const { object, ext } = found;

  if (!tokenOk) {
    const user = await getCurrentUser();
    if (!user || object.customMetadata?.userId !== user.userId) return new Response("Forbidden", { status: 403 });
  }

  const createdAt = Date.parse(object.customMetadata?.createdAt || "");
  if (Number.isFinite(createdAt) && Date.now() - createdAt > DAY_MS) {
    try {
      await env.TEMP_BUCKET.delete(`audio/${id}-${stem}.${ext}`);
    } catch {
      /* best-effort */
    }
    return new Response("This temporary audio has expired.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  if (!headers.get("content-type")) {
    headers.set(
      "content-type",
      ext === "webm" ? "audio/webm"
        : ext === "mp3" ? "audio/mpeg"
          : ext === "ogg" ? "audio/ogg"
            : ext === "flac" ? "audio/flac"
              : "audio/mp4",
    );
  }
  headers.set("accept-ranges", "bytes");
  headers.set("content-disposition", `inline; filename="ak-studio-${id}-${stem}.${ext}"`);
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "private, max-age=86400");
  headers.set("cdn-cache-control", "private, max-age=86400");
  if (Number.isFinite(createdAt)) {
    headers.set("expires", new Date(createdAt + DAY_MS).toUTCString());
  }

  if (rangeMatch && "range" in object && object.range) {
    const offset = ("offset" in object.range ? object.range.offset : undefined) ?? Number(rangeMatch[1]);
    const length = ("length" in object.range ? object.range.length : undefined) ?? object.size;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
