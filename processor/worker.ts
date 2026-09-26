import { Container, getContainer } from "@cloudflare/containers";

export class AudioProcessor extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
}

type Env = { AUDIO_PROCESSOR: DurableObjectNamespace<AudioProcessor>; PROCESSOR_WEBHOOK_SECRET: string; SERVICE_MODE?: string };

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && env.SERVICE_MODE !== "separator") return getContainer(env.AUDIO_PROCESSOR, "health").fetch(new Request("http://container/health"));
    if (!env.PROCESSOR_WEBHOOK_SECRET || request.headers.get("authorization") !== `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}`) return new Response("Unauthorized", { status: 401 });
    if (url.pathname === "/health") return getContainer(env.AUDIO_PROCESSOR, "separator").fetch(new Request("http://container/health"));
    if ((url.pathname === "/process" || url.pathname === "/download") && request.method === "POST") {
      const payload = await request.clone().json() as { jobId?:string };
      if (!payload.jobId || !/^[0-9a-f-]{36}$/i.test(payload.jobId)) return new Response("Invalid job", { status:400 });
      const container = getContainer(env.AUDIO_PROCESSOR, url.pathname === "/process" ? "separator" : payload.jobId);
      return container.fetch(new Request(`http://container${url.pathname}`, { method:"POST", headers:{"content-type":"application/json"}, body:request.body }));
    }
    const job = url.pathname.match(/^\/job\/([0-9a-f-]{36})$/i);
    if (job && request.method === "GET") return getContainer(env.AUDIO_PROCESSOR, "separator").fetch(new Request(`http://container${url.pathname}`));
    const file = url.pathname.match(/^\/file\/([0-9a-f-]{36})\/(original|backing|lead)$/i);
    if (file && request.method === "GET") return getContainer(env.AUDIO_PROCESSOR, env.SERVICE_MODE === "separator" ? "separator" : file[1]).fetch(new Request(`http://container${url.pathname}`));
    return new Response("Not found", { status: 404 });
  },
};
