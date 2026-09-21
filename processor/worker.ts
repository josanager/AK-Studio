import { Container, getContainer } from "@cloudflare/containers";

export class AudioProcessor extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

type Env = { AUDIO_PROCESSOR: DurableObjectNamespace<AudioProcessor>; PROCESSOR_WEBHOOK_SECRET: string };

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return getContainer(env.AUDIO_PROCESSOR, "health").fetch(new Request("http://container/health"));
    if (url.pathname !== "/download" || request.method !== "POST") return new Response("Not found", { status: 404 });
    if (request.headers.get("authorization") !== `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}`) return new Response("Unauthorized", { status: 401 });
    const container = getContainer(env.AUDIO_PROCESSOR, crypto.randomUUID());
    return container.fetch(new Request("http://container/download", { method: "POST", headers: { "content-type": "application/json" }, body: request.body }));
  },
};
