import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('../lib/separation-client.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const statuses=[new TypeError('offline'),{status:'processing',progress:100},{status:'ready',backingUrl:'b',vocalUrl:'v'}],progress=[];let calls=0;
const ctx={exports:{},Error,TypeError,DOMException,AbortController,encodeURIComponent,Date,Math,Number,String,setTimeout:f=>{queueMicrotask(f);return 1},clearTimeout(){},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},fetch:async()=>{calls++;const item=statuses.shift();if(item instanceof Error)throw item;return{ok:true,json:async()=>item}}};vm.runInNewContext(code,ctx);
const result=await ctx.exports.waitForSeparation('job',new AbortController().signal,n=>progress.push(n));assert.equal(result.status,'ready');assert.equal(calls,3);assert.deepEqual(progress,[94]);
const abort=new AbortController();abort.abort();await assert.rejects(ctx.exports.waitForSeparation('job',abort.signal,()=>{}),/Cancelled/);
console.log('PASS: transient disconnect resumes same job; 100 is capped until ready; cancellation stops polling');
