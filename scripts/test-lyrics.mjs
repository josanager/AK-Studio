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
assert.equal(parseLyrics(right)[0].end,3);
const oldFetch=globalThis.fetch;
let count=0;
globalThis.fetch=async()=>Response.json(++count===1?[wrong]:[right]);
try{
 const result=await findLyrics(song);
 assert.equal(result.record.trackName,"Believe");
 assert.equal(count,3);
 globalThis.fetch=async()=>{throw Error("unavailable")};
 const missing=await findLyrics(song);
 assert.equal(missing.unavailable,true);
 assert.equal(missing.record,undefined);
}finally{globalThis.fetch=oldFetch}
console.log("PASS: artist/title cleanup, Unicode, wrong/empty record rejection, fallback search and missing lyrics.");
