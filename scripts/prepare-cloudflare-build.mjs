import { readFile, writeFile } from "node:fs/promises";

const generatedPath = new URL("../dist/server/wrangler.json", import.meta.url);
const outputPath = new URL("../dist/server/wrangler.cloudflare.json", import.meta.url);
const generated = JSON.parse(await readFile(generatedPath, "utf8"));

const config = {
  ...generated,
  name: "ak-studio",
  vars: {
    ...(generated.vars ?? {}),
    COMPLIMENTARY_PRO_EMAIL: "josanager@gmail.com",
    BETTER_AUTH_URL: "https://ak-studio.josanager.workers.dev",
    SITE_URL: "https://ak-studio.josanager.workers.dev",
  },
  compatibility_date: "2026-09-20",
  compatibility_flags: Array.from(new Set([...(generated.compatibility_flags ?? []), "nodejs_compat"])),
  d1_databases: [{
    binding: "DB",
    database_name: "ak-studio",
    database_id: "aab3937c-082e-4571-811b-465c49759235",
    migrations_dir: "../../drizzle",
  }],
  r2_buckets: [{ binding: "TEMP_BUCKET", bucket_name: "ak-studio-temp" }],
  queues: {
    producers: [{ binding: "PROCESSING_QUEUE", queue: "ak-studio-jobs" }],
    consumers: [],
  },
  observability: { enabled: true },
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Prepared ${outputPath.pathname}`);
