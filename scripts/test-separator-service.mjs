import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

// Tests orchestration only: never contacts a processor or runs paid inference.
const id = "8ddebdd4-70ab-44a5-8302-0a48561a17e5";
const source = ts.transpileModule(fs.readFileSync(new URL("../lib/audio-stems.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const writes = [], events = [];
let polls = 0;
const env = { SEPARATOR_PROCESSOR_URL: "https://separator.example", SEPARATOR_WEBHOOK_SECRET: "test-only",
  TEMP_BUCKET: { put: async (...args) => writes.push(args[0]) } };
const sandbox = { exports: {}, require: (name) => name === "cloudflare:workers" ? { env } : { sanitizeDownloadError: (s) => s },
  ReadableStream, TextEncoder, crypto, Date, Response, AbortSignal, setInterval, clearInterval,
  setTimeout: (fn) => { fn(); return 1; },
  fetch: async (url) => {
    if (url.endsWith("/process")) return Response.json({ status: "processing" }, { status: 202 });
    if (url.includes("/job/")) {
      polls += 1;
      return Response.json({ status: "ready", manifest: { files: { lead: `/file/${id}/lead`, backing: `/file/${id}/backing` }, model: "karaoke" } });
    }
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/flac" } });
  } };
vm.runInNewContext(source, sandbox);
const options = { audioUrl: "https://stored.example/audio", usageId: id, jobId: id, userId: "test-user", skipOriginal: true,
  send: async (event) => events.push(event) };
await sandbox.exports.processWithGpu(options);
assert.equal(polls, 1);
assert.equal(writes.length, 2);
assert.equal(events.at(-1).status, "ready");
sandbox.fetch = async () => new Response("The separator is busy. Try again shortly.", { status: 429 });
await assert.rejects(sandbox.exports.processWithGpu(options), /busy/);
sandbox.fetch = async () => Response.json({ files: { lead: "https://untrusted.example/audio", backing: `/file/${id}/backing` } });
await assert.rejects(sandbox.exports.processWithGpu(options), /invalid audio file path/);
let starts = 0;
sandbox.fetch = async (url) => {
  if (url.endsWith("/process") && starts++ === 0) return new Response("There is no Container instance available; currently provisioning", { status: 500 });
  if (url.endsWith("/process")) return Response.json({ files: { lead: `/file/${id}/lead`, backing: `/file/${id}/backing` } });
  return new Response(new Uint8Array([1, 2, 3]));
};
await sandbox.exports.processWithGpu(options);
assert.equal(starts, 2);
console.log("PASS: async polling, two R2 stems, ready event, busy error, and invalid output path rejection. No inference executed.");
