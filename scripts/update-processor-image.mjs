// Patch service code onto the deployed image; preserve its model and dependencies.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
const mode = process.argv[2];
if (!["download", "separator"].includes(mode)) throw Error("Choose download or separator");
const account = "1293e708f0dd291ae3c8da2be92d0ff5";
const appId = mode === "separator" ? "a03b1a03-8c65-44bb-8452-5865182a057b" : "a03d463b-c33d-4db5-add3-2867d44aff54";
const name = mode === "separator" ? "ak-studio-separator-audioprocessor" : "ak-studio-audio-processor-audioprocessor";
const repo = `${account}/${name}`, registry = "https://registry.cloudflare.com";
const wrangler = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url).pathname;
function cli(args) {
 const r = spawnSync(process.execPath, [wrangler, ...args], { encoding: "utf8" });
 if (r.status) throw Error("Wrangler command failed");
 return JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
}
const app = cli(["containers", "info", appId]);
const credentials = cli(["containers", "registries", "credentials", "registry.cloudflare.com", "--push", "--pull", "--json"]);
let authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`;
async function request(path, init = {}) {
 let response = await fetch(new URL(path, registry), { ...init, headers: { authorization, ...init.headers } });
 if (response.status === 401) {
  const challenge = response.headers.get("www-authenticate") || "";
  const values = Object.fromEntries([...challenge.matchAll(/(\w+)="([^"]+)"/g)].map(m => [m[1], m[2]]));
  if (!values.realm) throw Error("Registry authentication failed");
  const tokenUrl = new URL(values.realm);
  if (values.service) tokenUrl.searchParams.set("service", values.service);
  tokenUrl.searchParams.set("scope", `repository:${repo}:pull,push`);
  const result = await fetch(tokenUrl, { headers: { authorization } });
  if (!result.ok) throw Error("Registry token request failed");
  const token = await result.json();
  authorization = `Bearer ${token.token || token.access_token}`;
  response = await fetch(new URL(path, registry), { ...init, headers: { authorization, ...init.headers } });
 }
 if (!response.ok) throw Error(`Registry request failed (${response.status})`);
 return response;
}
const accept = "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json";
let digest = app.configuration.image.split("@")[1];
let manifest = await (await request(`/v2/${repo}/manifests/${digest}`, { headers: { accept } })).json();
if (manifest.manifests) {
 digest = manifest.manifests.find(x => x.platform?.architecture === "amd64" && x.platform?.os === "linux").digest;
 manifest = await (await request(`/v2/${repo}/manifests/${digest}`, { headers: { accept } })).json();
}
const config = await (await request(`/v2/${repo}/blobs/${manifest.config.digest}`)).json();
if (process.argv.includes("--inspect")) {
 const last = manifest.layers.at(-1);
 const layerBytes = Buffer.from(await (await request(`/v2/${repo}/blobs/${last.digest}`)).arrayBuffer());
 console.log(JSON.stringify({ mode, command: config.config.Cmd, entrypoint: config.config.Entrypoint, workingDirectory: config.config.WorkingDir, layerType: last.mediaType, repairCode: gunzipSync(layerBytes).includes(Buffer.from("repair-20261020")) }));
 process.exit(0);
}
if (config.architecture !== "amd64" || config.os !== "linux") throw Error("Expected linux/amd64 service image");
const model = config.config?.Env?.find(value => value.startsWith("SEPARATOR_MODEL="))?.slice(16);
if (mode === "separator" && model !== "mel_band_roformer_karaoke_aufr33_viperx_sdr_10.1956.ckpt") throw Error("Unexpected deployed model; refusing to replace it");
function tarEntry(name, bytes) {
 const header = Buffer.alloc(512);
 const field = (offset, length, value) => header.write(value, offset, Math.min(length, Buffer.byteLength(value)));
 field(0,100,name); field(100,8,"0000644\0"); field(108,8,"0000000\0"); field(116,8,"0000000\0");
 field(124,12,bytes.length.toString(8).padStart(11,"0")+"\0"); field(136,12,Math.floor(Date.now()/1000).toString(8).padStart(11,"0")+"\0");
 header.fill(32,148,156); field(156,1,"0"); field(257,6,"ustar\0"); field(263,2,"00");
 field(148,8,[...header].reduce((a,b)=>a+b,0).toString(8).padStart(6,"0")+"\0 ");
 return Buffer.concat([header,bytes,Buffer.alloc((512-bytes.length%512)%512)]);
}
const files = ["server.py","warm_separator.py","inference_worker.py"];
const layer = Buffer.concat([...files.map(file => tarEntry(`app/${file}`, readFileSync(new URL(`../processor/${file}`, import.meta.url)))), Buffer.alloc(1024)]);
const sha = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
async function upload(bytes) {
 const digest = sha(bytes);
 const start = await request(`/v2/${repo}/blobs/uploads/`, { method: "POST" });
 const url = new URL(start.headers.get("location"), registry);
 url.searchParams.set("digest", digest);
 await request(url.href, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: bytes });
 return { digest, size: bytes.length };
}
const layerInfo = await upload(gzipSync(layer));
config.rootfs.diff_ids.push(sha(layer));
config.history ??= [];
config.history.push({ created: new Date().toISOString(), created_by: "AK Studio: repair processing reliability" });
const configInfo = await upload(Buffer.from(JSON.stringify(config)));
manifest.config = { ...manifest.config, ...configInfo };
manifest.layers.push({ ...layerInfo, mediaType: manifest.layers.at(-1).mediaType });
const bytes = Buffer.from(JSON.stringify(manifest));
await request(`/v2/${repo}/manifests/repair-20261020`, { method: "PUT", headers: { "content-type": manifest.mediaType }, body: bytes });
console.log(JSON.stringify({ mode, image: `${registry.slice(8)}/${repo}@${sha(bytes)}`, model: model || null }));
