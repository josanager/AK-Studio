import { env } from "cloudflare:workers";

type StripeObject = {
  id: string;
  customer?: string | null;
  subscription?: string | null;
  status?: string;
  current_period_end?: number | null;
  client_reference_id?: string | null;
  metadata?: { user_id?: string };
};

type StripeEvent = { type: string; data: { object: StripeObject } };

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

async function verifySignature(payload: string, header: string, secret: string) {
  const parts = header.split(",").map(part => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some(value => { const candidate = fromHex(value); return candidate ? safeEqual(digest, candidate) : false; });
}

async function upsertSubscription(object: StripeObject, forcedStatus?: string) {
  const userId = object.metadata?.user_id || object.client_reference_id;
  if (!userId) return;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO subscriptions (id,user_id,stripe_customer_id,stripe_subscription_id,status,plan,current_period_end,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,plan=excluded.plan,current_period_end=excluded.current_period_end,updated_at=excluded.updated_at")
    .bind(`sub_${userId}`, userId, object.customer ?? null, object.subscription ?? object.id, forcedStatus ?? object.status ?? "inactive", "pro", object.current_period_end ?? null, now).run();
}

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Webhook secret is not configured." }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  if (!await verifySignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) return Response.json({ error: "Invalid signature." }, { status: 400 });
  let event: StripeEvent;
  try { event = JSON.parse(payload) as StripeEvent; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (event.type === "checkout.session.completed") await upsertSubscription(event.data.object, "active");
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) await upsertSubscription(event.data.object);
  return Response.json({ received: true });
}
