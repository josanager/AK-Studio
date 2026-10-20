import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile=path=>ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const eventsScope={exports:{},TextDecoder,Response,ReadableStream};
vm.runInNewContext(compile("lib/audio-events.ts"),eventsScope);
const {readAudioEvents}=eventsScope.exports;
const id="22222222-2222-4222-8222-222222222222";
const manifest={files:{original:`/file/${id}/original`},title:"Test",artist:"Test artist"};
let mode="stream",calls=0;
const makeStream=(text)=>{const bytes=new TextEncoder().encode(text);return new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,7));c.enqueue(bytes.slice(7,25));c.enqueue(bytes.slice(25));c.close()}}),{headers:{"content-type":"application/x-ndjson"}})};
const scope={exports:{},URL,Response,ReadableStream,Uint8Array,TextDecoder,AbortSignal,setTimeout,
require:name=>name==="./audio-events"?{readAudioEvents}:{downloadFetch:async url=>{
 calls++;
 if(url.endsWith("/download")){
  if(mode==="json")return Response.json(manifest);
  if(mode==="error")return makeStream('{"status":"error","error":"Download failed"}\n');
  if(mode==="truncated")return makeStream('{"status":"progress","progress":26}\n');
  return makeStream(JSON.stringify({status:"progress",progress:20})+"\n\n"+JSON.stringify({status:"progress",progress:90})+"\n"+JSON.stringify({status:"ready",manifest})+"\n");
 }
 return new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"audio/flac","content-length":"3"}});
}}};
vm.runInNewContext(compile("lib/youtube-download.ts"),scope);
const progress=[];
let result=await scope.exports.downloadViaProcessor(new URL("https://youtube.com/watch?v=83p4T_eP-js"),"https://processor.example","test",id,n=>progress.push(n));
assert.deepEqual([...new Uint8Array(await new Response(result.body).arrayBuffer())],[1,2,3]);
assert.equal(calls,2);
assert.ok(progress.every((n,i)=>!i||n>=progress[i-1]));
assert.equal(result.title,"Test");
mode="json";
result=await scope.exports.downloadViaProcessor(new URL("https://youtube.com"),"https://processor.example","test",id);
assert.ok(result.body);
mode="error";await assert.rejects(scope.exports.downloadViaProcessor(new URL("https://youtube.com"),"https://processor.example","test",id),/Download failed/);
mode="truncated";await assert.rejects(scope.exports.downloadViaProcessor(new URL("https://youtube.com"),"https://processor.example","test",id),/before processing finished/);
await assert.rejects(readAudioEvents(makeStream("{broken}\n")),/invalid progress response/);
console.log("PASS: real multi-line processor protocol, chunk boundaries, legacy JSON, streaming audio, truncated responses and backend errors.");
