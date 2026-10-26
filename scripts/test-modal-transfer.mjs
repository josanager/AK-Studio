import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const root = new URL("../", import.meta.url);
function module(file, requires = {}, extra = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(file, root), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => { if (!(name in requires)) throw new Error(name); return requires[name]; },
    crypto, TextEncoder, TextDecoder, btoa, atob, escape, unescape, Date, Response, URL, AbortSignal, ...extra };
  vm.runInNewContext(source, context);
  return context;
}
const caps = module("lib/stem-capability.ts").exports;
const audioId = crypto.randomUUID(), generation = crypto.randomUUID(), userId = "owner-test";
const value = { audioId, generation, userId, action: "write", stem: "lead", expires: Math.floor(Date.now()/1000)+3600 };
const secret = "test-only";
const token = await caps.signStemCapability(value, secret);
assert.equal((await caps.verifyStemCapability(token, secret)).audioId, audioId);
assert.equal(await caps.verifyStemCapability(token, "wrong-secret"), null);
assert.equal(await caps.verifyStemCapability(token.slice(0,-1)+(token.endsWith("0")?"1":"0"), secret), null);
assert.equal(await caps.verifyStemCapability(await caps.signStemCapability({ ...value, expires: 1 }, secret), secret), null);
await assert.rejects(caps.signStemCapability({ ...value, action: "read" }, secret));
const events = [], stored = [], stages = new Map();
for (const stem of ["lead", "backing"]) stages.set(caps.stagedStemKey({ ...value, stem }), { userId, generation });
let posted;
const env = { MODAL_SEPARATOR_URL: "https://test.modal.run", MODAL_SHARED_SECRET: secret, SITE_URL: "https://akstudiovocal.com",
  TEMP_BUCKET: { get: async key => stages.has(key) ? { size: 100, body: new Response("audio").body, customMetadata: stages.get(key) } : null } };
const runner = module("lib/modal-separator.ts", { "cloudflare:workers": { env }, "./stem-capability": caps,
  "./audio-stems": { storeStem: async (...args) => { stored.push(args); return `/audio/${args[1]}`; } } }, {
  setTimeout: fn => { fn(); return 1; },
  fetch: async (url, init) => {
    if (url.endsWith("/process")) { posted = JSON.parse(init.body); return Response.json({status:"queued"}, {status:202}); }
    return Response.json({ status:"ready", manifest:{generation,duration:133} });
  },
});
await runner.exports.processWithModal({ usageId:audioId,userId,send:async e=>events.push(e) });
assert.equal(stored.length, 2);
assert.equal(events.at(-1).status,"ready");
const upload = new URL(posted.uploads.lead);
assert.equal(upload.origin,"https://akstudiovocal.com");
assert.equal((await caps.verifyStemCapability(upload.searchParams.get("token"),secret)).action,"write");
stages.delete(caps.stagedStemKey(value));
await assert.rejects(runner.exports.processWithModal({usageId:audioId,userId,send:async()=>{}}), /incomplete/);
assert.equal(stored.length,2,"Partial result must not promote any stem");
const transferEnv = { MODAL_SHARED_SECRET:secret, TEMP_BUCKET:{
  get:async()=>({body:new Response("original").body,size:8,httpMetadata:{contentType:"audio/ogg"}}),
  put:async(key,body,options)=>{ assert.equal(options.customMetadata.userId,userId); assert.ok(key.includes(generation)); await new Response(body).arrayBuffer(); return {size:100}; },
} };
const route=module("app/api/audio/stems/transfer/route.ts",{
  "cloudflare:workers":{env:transferEnv},"../../../../../lib/stem-capability":caps,
  "../../../../../lib/audio-stems":{findOwnedStem:async(id,stem,user)=>user===userId?{ext:"ogg"}:null},
}).exports;
const endpoint="https://akstudiovocal.com/api/audio/stems/transfer?token=";
const request=(t,method="GET",size=100)=>new Request(endpoint+encodeURIComponent(t),method==="GET"?{}:{method,headers:{"content-type":"audio/flac","content-length":String(size)},body:new Uint8Array(size)});
assert.equal((await route.GET(request(token))).status,401,"Write capability cannot read audio");
const read=await caps.signStemCapability({...value,action:"read",stem:"original"},secret);
assert.equal((await route.GET(request(read))).status,200);
assert.equal((await route.PUT(request(token,"PUT"))).status,200);
assert.equal((await route.PUT(request(token,"PUT",10))).status,400);
const wrongOwner=await caps.signStemCapability({...value,userId:"other-user"},secret);
assert.equal((await route.PUT(request(wrongOwner,"PUT"))).status,404);
console.log("PASS: signed bounded capabilities, tamper/expiry rejection, R2 generation validation, complete-only promotion. No network.");
