import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync(new URL("../lib/audio-cache.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const cached = new Map(), blobs = [], requests = [];
class BrowserURL extends URL {
  static createObjectURL(blob) { blobs.push(blob); return `blob:test-${blobs.length}`; }
  static revokeObjectURL() {}
}
const base = "https://studio.example";
const backing = `${base}/api/audio/test?stem=backing`;
const original = `${base}/api/audio/test?stem=original`;
const cacheHeaders = { "x-ak-cached-at": String(Date.now()) };
cached.set(backing, new Response("stale-full-mix", { headers: cacheHeaders }));
cached.set(original, new Response("original", { headers: cacheHeaders }));
const cache = { match: async (key) => cached.get(key)?.clone(), delete: async (key) => cached.delete(key),
  put: async (key, response) => cached.set(key, response.clone()) };
const sandbox = { exports: {}, window: { location: { origin: base } }, URL: BrowserURL, Date, Headers, Response,
  caches: { open: async () => cache }, fetch: async (url, init) => {
    requests.push(init);
    if (init.headers?.["if-none-match"] === '"separated"') return new Response(null, { status: 304 });
    return new Response("real-backing", { headers: { etag: '"separated"', "content-type": "audio/flac" } });
  } };
vm.runInNewContext(source, sandbox);
await sandbox.exports.cachedAudioUrl(backing);
assert.equal(await blobs.at(-1).text(), "real-backing");
assert.equal(requests[0].cache, "no-store");
await sandbox.exports.cachedAudioUrl(backing);
assert.equal(await blobs.at(-1).text(), "real-backing");
assert.equal(requests[1].headers["if-none-match"], '"separated"');
await sandbox.exports.cachedAudioUrl(original);
assert.equal(await blobs.at(-1).text(), "original");
assert.equal(requests.length, 2);
console.log("PASS: stale full-mix backing is replaced, unchanged stems use ETag/304, original cache remains reusable.");
