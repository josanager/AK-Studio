import { Container, getContainer } from "@cloudflare/containers";

export class AudioProcessor extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";

  private monitorScheduled = false;
  async ensureMonitor() {
    if (this.monitorScheduled) return;
    this.monitorScheduled = true;
    await this.schedule(30, "checkActiveJobs");
  }
  async onStart() { await this.ensureMonitor(); }

  async checkActiveJobs() {
    this.monitorScheduled = false;
    const state = await this.getState();
    if (state.status !== "running" && state.status !== "healthy") return;
    // A background inference is activity even when the editor disconnects.
    // Stop the checks once idle so this does not keep an unused server awake.
    const response = await this.containerFetch("http://container/health");
    const health = await response.json() as { activeJobs?: number };
    if (health.activeJobs) {
      this.renewActivityTimeout();
      await this.ensureMonitor();
    }
  }

  async processRequest(request: Request) {
    const response = await this.containerFetch(request);
    await this.ensureMonitor();
    return response;
  }
}

type Env = { AUDIO_PROCESSOR: DurableObjectNamespace<AudioProcessor>; PROCESSOR_WEBHOOK_SECRET: string; SERVICE_MODE?: string; DOWNLOAD_POOL_SIZE?: string };

function downloadInstance(jobId: string, env: Env) {
  const size = Math.max(1, Math.min(5, Number(env.DOWNLOAD_POOL_SIZE) || 5));
  return `download-${parseInt(jobId.replace(/-/g, "").slice(0, 8), 16) % size}`;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && env.SERVICE_MODE !== "separator") return getContainer(env.AUDIO_PROCESSOR, "download-0").fetch(new Request("http://container/health"));
    if (!env.PROCESSOR_WEBHOOK_SECRET || request.headers.get("authorization") !== `Bearer ${env.PROCESSOR_WEBHOOK_SECRET}`) return new Response("Unauthorized", { status: 401 });
    if (url.pathname === "/health") return getContainer(env.AUDIO_PROCESSOR, "separator").fetch(new Request("http://container/health"));
    if ((url.pathname === "/process" || url.pathname === "/download") && request.method === "POST") {
      const payload = await request.clone().json() as { jobId?:string };
      if (!payload.jobId || !/^[0-9a-f-]{36}$/i.test(payload.jobId)) return new Response("Invalid job", { status:400 });
      const container = getContainer(env.AUDIO_PROCESSOR, url.pathname === "/process" ? "separator" : downloadInstance(payload.jobId, env));
      return container.processRequest(new Request(`http://container${url.pathname}`, { method:"POST", headers:{"content-type":"application/json"}, body:request.body }));
    }
    const cancel = url.pathname.match(/^\/job\/([0-9a-f-]{36})\/cancel$/i);
    if (cancel && request.method === "POST") return getContainer(env.AUDIO_PROCESSOR, "separator").fetch(new Request(`http://container${url.pathname}`, {method:"POST"}));
    const job = url.pathname.match(/^\/job\/([0-9a-f-]{36})$/i);
    if (job && request.method === "GET") return getContainer(env.AUDIO_PROCESSOR, "separator").fetch(new Request(`http://container${url.pathname}`));
    const file = url.pathname.match(/^\/file\/([0-9a-f-]{36})\/(original|backing|lead)$/i);
    if (file && request.method === "GET") return getContainer(env.AUDIO_PROCESSOR, env.SERVICE_MODE === "separator" ? "separator" : downloadInstance(file[1], env)).fetch(new Request(`http://container${url.pathname}`));
    return new Response("Not found", { status: 404 });
  },
};
