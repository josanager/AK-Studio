import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=ts.transpileModule(fs.readFileSync("lib/lyrics.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {identifySong,normalizeSong,selectLyrics,findLyrics,parseLyrics}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
assert.deepEqual(identifySong("Pentatonix - Believe (Official Video)","PentatonixVEVO"),{title:"Believe",artist:"Pentatonix"});
assert.deepEqual(identifySong("Believe - Pentatonix","Pentatonix - Topic"),{title:"Believe",artist:"Pentatonix"});
assert.equal(normalizeSong("마법의 노래"),"마법의 노래");
const song={title:"Believe",artist:"Pentatonix"};
const wrong={trackName:"Another song",artistName:"Pentatonix",syncedLyrics:"[00:01]wrong"};
const empty={trackName:"Believe",artistName:"Pentatonix",syncedLyrics:null,plainLyrics:null};
const right={trackName:"Believe",artistName:"Pentatonix",syncedLyrics:"[00:01]one\n[00:03]two"};
assert.equal(selectLyrics([wrong,empty,right],song),right);
assert.equal(selectLyrics([wrong,empty],song),undefined);
const mashup={title:"La La Latch (Sam Smith/Disclosure/Naughty Boy Mashup)",artist:"Pentatonix",duration:221.5};
const mashupRight={trackName:"La La Latch",artistName:"Pentatonix",duration:221.52,syncedLyrics:"[00:01]test"};
const mashupLong={...mashupRight,duration:250.56};
assert.equal(selectLyrics([mashupLong,mashupRight],mashup),mashupRight);
assert.equal(selectLyrics([{...mashupRight,trackName:"La La"}],mashup),undefined);
assert.equal(parseLyrics(right)[0].end,3);
const oldFetch=globalThis.fetch;
let count=0;
globalThis.fetch=async()=>Response.json(++count===1?[wrong]:[right]);
try{
 const result=await findLyrics(song);
 assert.equal(result.record.trackName,"Believe");
 assert.equal(count,3);
 let queries=[];
 globalThis.fetch=async input=>{queries.push(new URL(input).searchParams);return Response.json([mashupRight])};
 const recovered=await findLyrics(mashup);
 assert.deepEqual(recovered.record,mashupRight);
 assert.equal(queries[0].get("track_name"),"La La Latch");
 let attempts=0;
 globalThis.fetch=async()=>++attempts===1?new Response("unavailable",{status:503}):Response.json([mashupRight]);
 assert.deepEqual((await findLyrics(mashup)).record,mashupRight);
 assert.equal(attempts,2);
 globalThis.fetch=async()=>Response.json({error:"upstream failure"});
 assert.equal((await findLyrics(mashup)).unavailable,true);
 globalThis.fetch=async input=>{
  const url=new URL(input);
  if(url.hostname==="lrclib.net")return new Response("busy",{status:503});
  if(url.pathname==="/api/search/get")return Response.json({code:200,result:{songs:[
   {id:1,name:"La La Latch",artists:[{name:"Wrong artist"}],duration:221520},
   {id:2,name:"La La Latch",artists:[{name:"Pentatonix"}],duration:221520}
  ]}});
  assert.equal(url.searchParams.get("id"),"2");
  return Response.json({lrc:{lyric:"[00:02.00]test line\n[00:04.00]another line"}});
 };
 const alternate=await findLyrics(mashup);
 assert.equal(alternate.record.source,"NetEase");
 assert.equal(parseLyrics(alternate.record).length,2);
 globalThis.fetch=async input=>{
  const url=new URL(input);
  if(url.hostname==="lrclib.net")return Response.json([]);
  if(url.hostname==="music.163.com")return Response.json({code:200,result:{songs:[]}});
  return Response.json({lyrics:"plain test lyric line\nsecond plain test line"});
 };
 assert.equal((await findLyrics(mashup)).record.source,"lyrics.ovh");
 globalThis.fetch=async()=>{throw Error("unavailable")};
 const missing=await findLyrics(song);
 assert.equal(missing.unavailable,true);
 assert.equal(missing.record,undefined);
}finally{globalThis.fetch=oldFetch}
console.log("PASS: artist/title cleanup, Unicode, wrong/empty record rejection, fallback search and missing lyrics.");
