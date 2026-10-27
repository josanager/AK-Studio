import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../components/audio-timeline.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source.slice(source.indexOf('export function AudioPlayback('),source.indexOf('\nexport function AudioLaneHeads')),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const refs=[],effects=[];let ri=0,ei=0,pending=[],tick,now=0;
const make=()=>({readyState:4,value:0,paused:true,seeking:false,playbackRate:1,plays:0,pauses:0,seeks:0,get currentTime(){return this.value},set currentTime(v){this.value=v;this.seeks++},play(){this.paused=false;this.plays++;return Promise.resolve()},pause(){this.paused=true;this.pauses++}});
const backing=make(),lead=make();
const context={exports:{},synchronizationRate:d=>Math.abs(d)<=.006?1:Math.max(.97,Math.min(1.03,1-d*.8)),useRef:v=>refs[ri++]??(refs[ri-1]={current:v}),useEffect:(f,deps)=>{const i=ei++;if(!effects[i]||deps.some((d,j)=>!Object.is(d,effects[i].deps[j])))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:f()}})},performance:{now:()=>now},requestAnimationFrame:f=>(tick=f,1),cancelAnimationFrame(){},React:{createElement:()=>null,Fragment:Symbol()}};
vm.runInNewContext(code,context);
function render(leadMuted,backingMuted=false,globalMuted=false,time=now/1000,seekRevision=0){ri=0;ei=0;pending=[];context.exports.AudioPlayback({clips:[{id:'backing',muted:backingMuted},{id:'lead',muted:leadMuted}].map(c=>({...c,start:0,duration:120,source:c.id})),time,seekRevision,playing:true,muted:globalMuted,onTime(){},onEnded(){},onError:e=>{throw Error(e)}});refs[0].current.set('backing',backing);refs[0].current.set('lead',lead);pending.forEach(f=>f())}
render(true);await new Promise(setImmediate);
assert.equal(lead.paused,false,'silent lead decoder stays running');assert.equal(lead.muted,true);
const baseline=[backing,lead].map(a=>[a.plays,a.pauses,a.seeks]);
for(let i=0;i<100;i++){
 now+=20;backing.value=lead.value=now/1000;
 render(i%2===0,i%3===0,i%5===0);tick(now);
 assert.equal(lead.muted,i%2===0||i%5===0);assert.equal(backing.muted,i%3===0||i%5===0);
 assert.deepEqual([backing,lead].map(a=>[a.plays,a.pauses,a.seeks]),baseline,'mute/unmute must not pause, seek or restart either track');
}
// Ordinary browser clock jitter must use smooth rate correction, not stop the group.
backing.value=3;lead.value=2.94;now+=20;tick(now);
assert.deepEqual([backing,lead].map(a=>[a.plays,a.pauses,a.seeks]),baseline);
assert.ok(lead.playbackRate>1);
render(false,false,false,30,1);tick(now);tick(now+20);
assert.equal(backing.currentTime,30);assert.equal(lead.currentTime,30);
console.log('PASS: 100 alternating stem/global mute changes cause zero playback restarts or seeks; explicit seek still aligns both tracks');
