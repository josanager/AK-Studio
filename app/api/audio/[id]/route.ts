import { env } from "cloudflare:workers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
  const object = await env.TEMP_BUCKET.get(`audio/${id}.flac`, range ? { range: { offset: Number(range[1]), length: range[2] ? Number(range[2]) - Number(range[1]) + 1 : undefined } } : undefined);
  if (!object) return new Response("This temporary audio has expired.", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("accept-ranges", "bytes");
  headers.set("content-disposition", `inline; filename="ak-studio-${id}.flac"`);
  headers.set("x-content-type-options", "nosniff");
  if (range && "range" in object && object.range) {
    const offset = "offset" in object.range ? object.range.offset : Number(range[1]);
    const length = "length" in object.range ? object.range.length : object.size;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
