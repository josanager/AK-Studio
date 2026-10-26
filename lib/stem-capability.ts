// Single-file, short-lived capabilities; never grant bucket-wide R2 access.
export type StemCapability = { action: "read" | "write"; audioId: string; userId: string; generation: string; stem: "original" | "lead" | "backing"; expires: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function valid(v: StemCapability) {
  return v && uuid.test(v.audioId) && uuid.test(v.generation) && typeof v.userId === "string" && v.userId.length > 0 && v.userId.length <= 200
    && Number.isSafeInteger(v.expires) && (v.action === "read" ? v.stem === "original" : v.action === "write" && ["lead", "backing"].includes(v.stem));
}
async function key(secret: string) { return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]); }
function hex(buffer: ArrayBuffer) { return Array.from(new Uint8Array(buffer), x => x.toString(16).padStart(2, "0")).join(""); }
export async function signStemCapability(value: StemCapability, secret: string) {
  if (!valid(value) || !secret) throw new Error("Invalid stem capability");
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${payload}.${hex(await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload)))}`;
}
export async function verifyStemCapability(token: string, secret?: string): Promise<StemCapability | null> {
  if (!secret || token.length > 2000) return null;
  try {
    const [payload, sig, extra] = token.split(".");
    if (extra || !/^[0-9a-f]{64}$/.test(sig)) return null;
    const bytes = Uint8Array.from(sig.match(/../g)!, x => parseInt(x, 16));
    if (!await crypto.subtle.verify("HMAC", await key(secret), bytes, new TextEncoder().encode(payload))) return null;
    const value = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))))) as StemCapability;
    const now = Math.floor(Date.now() / 1000);
    return valid(value) && value.expires > now && value.expires <= now + 3700 ? value : null;
  } catch { return null; }
}
export function stagedStemKey(v: StemCapability) { return `audio/${v.audioId}-pending-${v.generation}-${v.stem}.flac`; }
