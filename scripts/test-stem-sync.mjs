import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const s=fs.readFileSync(new URL('../components/audio-timeline.tsx',import.meta.url),'utf8');const code=ts.transpileModule(s.slice(s.indexOf('export function AudioPlayback('),s.indexOf('\nexport function AudioLaneHeads')),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const effects=[],refs=[];let tick,now=0;
const make=ready=>({readyState:ready,currentTime:0,paused:true,seeking:false,playbackRate:1,plays:0,play(){this.paused=false;this.plays++;return Promise.resolve()},pause(){this.paused=true}});
const backing=make(4),lead=make(1);
const c={exports:{},synchronizationRate:d=>Math.abs(d)<=.006?1:Math.max(.97,Math.min(1.03,1-d*.8)),useRef:v=>{const r={current:v};refs.push(r);return r},useEffect:f=>effects.push(f),performance:{now:()=>now},requestAnimationFrame:f=>(tick=f,1),cancelAnimationFrame(){},React:{createElement:()=>null,Fragment:Symbol()}};vm.runInNewContext(code,c);
c.exports.AudioPlayback({clips:['backing','lead'].map(id=>({id,start:0,duration:90,offset:0,source:id,muted:false})),time:0,playing:true,muted:false,onTime(){},onEnded(){},onError:e=>{throw Error(e)}});refs[0].current.set('backing',backing);refs[0].current.set('lead',lead);effects.forEach(f=>f());assert.equal(backing.plays,0);assert.equal(lead.plays,1);assert.equal(lead.muted,true);await new Promise(setImmediate);
lead.readyState=4;now+=20;tick(now);assert.equal(backing.plays,1);assert.equal(lead.plays,2);await new Promise(setImmediate);
// A follower that falls behind by 400 ms is aligned, not tolerated for a second.
backing.currentTime=1;lead.currentTime=.6;now+=20;tick(now);assert.equal(backing.paused,true);assert.equal(lead.paused,true);assert.equal(lead.currentTime,1);
now+=20;tick(now);assert.equal(backing.paused,false);assert.equal(lead.paused,false);assert.equal(backing.currentTime,lead.currentTime);await new Promise(setImmediate);
// If either decoder stalls, both wait; recovery resumes them from one position.
backing.currentTime=2;lead.currentTime=1.9;lead.readyState=2;now+=20;tick(now);assert.equal(backing.paused,true);lead.readyState=4;now+=20;tick(now);now+=20;tick(now);assert.equal(backing.currentTime,lead.currentTime);assert.equal(backing.paused,false);assert.equal(lead.paused,false);
console.log('PASS: stems start together, correct 400ms drift, and pause/resume together on decoder buffering');

const timelineJs=ts.transpileModule(fs.readFileSync(new URL('../lib/audio-timeline.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const tc={exports:{},Math};vm.runInNewContext(timelineJs,tc);let drift=.023;for(let i=0;i<300;i++)drift+=(tc.exports.synchronizationRate(drift)-1)/60;assert.ok(Math.abs(drift)<=.0061);assert.equal(tc.exports.synchronizationRate(0),1);assert.ok(tc.exports.synchronizationRate(-.03)>1);assert.ok(tc.exports.synchronizationRate(.03)<1);console.log('PASS: small drift converges below 6ms without repeated decoder seeks');
