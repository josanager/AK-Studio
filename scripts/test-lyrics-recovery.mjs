import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const file=ts.createSourceFile("studio.tsx",fs.readFileSync("app/studio.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
function visit(node){
 if(ts.isCallExpression(node)&&node.expression.getText(file)==="useEffect"&&node.arguments[0]?.getText(file).includes("recoveredLyrics.current"))effect=node.arguments[0].getText(file);
 ts.forEachChild(node,visit);
}
visit(file);assert.ok(effect);
const js=ts.transpileModule("var run="+effect,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+"\nrun();";
let timer,cleanup,requests=[],applied,notice;
const scope={hydrating:false,processing:false,separating:false,exporting:false,analyzed:true,
 audioId:"existing-audio",url:"https://music.youtube.com/watch?v=KeXGgoixuT4",
 lyrics:[],track:{title:"La La Latch (Sam Smith/Disclosure/Naughty Boy Mashup)",artist:"Pentatonix"},
 audioDuration:221.52,duration:221.52,recoveredLyrics:{current:new Set()},
 isYouTubeLink:()=>true,AbortController,
 window:{setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{}},
 setLyrics:lines=>{applied=lines},setSelected:()=>{},setNotice:value=>{notice=value},
 fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return Response.json({lyrics:[{text:"test",start:2,end:5}]})}};
vm.createContext(scope);
function run(){cleanup=vm.runInContext(js,scope)}
run();assert.equal(requests.length,0);timer();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(requests.length,1);assert.equal(requests[0].url,"/api/analyze");
assert.equal(requests[0].body.audioId,"existing-audio");
assert.equal(applied.length,1);assert.equal(applied[0].start,2);assert.equal(notice.kind,"success");
// Existing/manual text is never overwritten or regenerated after deletion.
scope.recoveredLyrics.current.clear();scope.lyrics=[{text:"manual"}];timer=null;run();
scope.lyrics=[];run();assert.equal(timer,null);
// Interrupted lookups can retry, rather than marking the audio permanently done.
scope.recoveredLyrics.current.clear();run();cleanup();
assert.equal(scope.recoveredLyrics.current.size,0);
console.log("PASS: missing restored lyrics recover through analyze only; existing/manual text is preserved; interrupted lookup may retry.");
