import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const stem = new URL(request.url).searchParams.get("stem") || "original";
  if (!new Set(["original","backing","lead"]).has(stem)) return new Response("Not found", { status: 404 });
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
  const object = await env.TEMP_BUCKET.get(`audio/${id}-${stem}.flac`, range ? { range: { offset: Number(range[1]), length: range[2] ? Number(range[2]) - Number(range[1]) + 1 : undefined } } : undefined);
  if (!object) return new Response("This temporary audio has expired.", { status: 404 });
  if (object.customMetadata?.userId !== user.userId) return new Response("Forbidden", { status: 403 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("accept-ranges", "bytes");
  headers.set("content-disposition", `inline; filename="ak-studio-${id}.flac"`);
  headers.set("x-content-type-options", "nosniff");
  if (range && "range" in object && object.range) {
    const offset = ("offset" in object.range ? object.range.offset : undefined) ?? Number(range[1]);
    const length = ("length" in object.range ? object.range.length : undefined) ?? object.size;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
