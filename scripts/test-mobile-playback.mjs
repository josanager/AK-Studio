import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const source=fs.readFileSync(new URL('../components/audio-timeline.tsx',import.meta.url),'utf8');
const component=source.slice(source.indexOf('export function AudioPlayback('),source.indexOf('\nexport function AudioLaneHeads'));
const js=ts.transpileModule(component,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const effects=[],refs=[];let nextFrame,now=0,seekCount=0,reported=[];
const audio={readyState:4,playbackRate:1,currentTime:0,paused:true,seeking:false,muted:false,play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true}};
Object.defineProperty(audio,'currentTime',{get(){return this.value||0},set(v){seekCount++;this.value=v}});
const context={exports:{},synchronizationRate:()=>1,useRef(v){const r={current:v};refs.push(r);return r},useEffect(f){effects.push(f)},performance:{now:()=>now},requestAnimationFrame:f=>(nextFrame=f,1),cancelAnimationFrame(){},React:{createElement(){return null},Fragment:Symbol()}};
vm.runInNewContext(js,context);
context.exports.AudioPlayback({clips:[{id:'song',start:0,duration:120,offset:0,source:'song',muted:false}],time:0,playing:true,muted:false,onTime:t=>reported.push(t),onEnded(){},onError:e=>{throw Error(e)}});
refs[0].current.set('song',audio);effects.forEach(f=>f());
// Decoder stalls for 3 seconds: no catch-up seeks and no imaginary timeline progress.
for(let i=1;i<=180;i++){now=i*1000/60;nextFrame(now)}
assert.equal(seekCount,1);assert.equal(reported.at(-1),0);assert.ok(reported.length<=61);
// Media resumes; timeline follows actual decoded audio, including a long render pause.
audio.value=2;now+=1500;nextFrame(now);assert.equal(reported.at(-1),2);assert.equal(seekCount,1);
console.log('PASS: buffering does not seek/restart audio; media clock survives delayed rendering; UI updates bounded at 20fps');
// Peak callers share one decode and different sources do not decode concurrently.
const peaksJs=ts.transpileModule(fs.readFileSync(new URL('../lib/audio-peaks.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let decodes=0,active=0,maxActive=0;
class AC{async decodeAudioData(){decodes++;active++;maxActive=Math.max(active,maxActive);await Promise.resolve();return{duration:10,numberOfChannels:1,length:1000,getChannelData:()=>new Float32Array(1000).fill(.5)}}async close(){active--}}
const pc={exports:{},window:{AudioContext:AC},fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})};vm.runInNewContext(peaksJs,pc);
await Promise.all([pc.exports.computeAudioPeaks('a',500),pc.exports.computeAudioPeaks('a',1000),pc.exports.computeAudioPeaks('b',500)]);
assert.equal(decodes,2);assert.equal(maxActive,1);console.log('PASS: duplicate peak requests decode once; sources decode serially');
