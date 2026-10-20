import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";
const calls=[];
class Container {
 async schedule(delay,method){calls.push({delay,method})}
 async getState(){return {status:"running"}}
 async containerFetch(){return Response.json({activeJobs:this.activeJobs||0})}
 renewActivityTimeout(){calls.push({renew:true})}
}
class WorkerRequest extends Request { constructor(url,init){super(url,init?.body?{...init,duplex:"half"}:init)} }
const scope={exports:{},Response,Request:WorkerRequest,URL,Math,Number,parseInt,require:()=>({Container,getContainer:(_,name)=>({
 fetch:async request=>{calls.push({name,path:new URL(request.url).pathname});return new Response("ok")},
 processRequest:async request=>{calls.push({name,path:new URL(request.url).pathname});return new Response("ok")}
})})};
const source=ts.transpileModule(fs.readFileSync("processor/worker.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(source,scope);
const worker=scope.exports.default,env={AUDIO_PROCESSOR:{},PROCESSOR_WEBHOOK_SECRET:"test"};
for(let i=0;i<20;i++){
 const id=i.toString(16).padStart(8,"0")+"-0000-4000-8000-000000000000";
 const request=new Request("https://worker/download",{method:"POST",headers:{authorization:"Bearer test"},body:JSON.stringify({jobId:id})});
 await worker.fetch(request,env);
 const name=calls.at(-1).name;
 await worker.fetch(new Request("https://worker/file/"+id+"/original",{headers:{authorization:"Bearer test"}}),env);
 assert.equal(calls.at(-1).name,name);
}
assert.equal(new Set(calls.filter(c=>c.name).map(c=>c.name)).size,5);
await worker.fetch(new Request("https://worker/health"),env);
assert.equal(calls.at(-1).name,"download-0");
const instance=new scope.exports.AudioProcessor();
instance.activeJobs=1;await instance.checkActiveJobs();
assert.ok(calls.some(c=>c.renew));
const count=calls.length;
instance.activeJobs=0;await instance.checkActiveJobs();
assert.equal(calls.length,count);
console.log("PASS: downloads and files share five fixed instances; health adds no sixth instance; only active work renews lifetime.");
