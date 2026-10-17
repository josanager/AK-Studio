import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
let data = new Float32Array(8000*4), closed=0;
class AudioContext { async decodeAudioData(){return {sampleRate:8000,getChannelData:()=>data};} async close(){closed++;} }
const scope={exports:{},OfflineAudioContext:AudioContext,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),setTimeout};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/audio-key.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
assert.equal(await scope.exports.estimateAudioKey('test'),null);
// A tonic-weighted C-major triad should identify C major, not an arbitrary key.
for(let i=0;i<data.length;i++) data[i]=[60,64,67].reduce((v,m,j)=>v+[1,.5,.6][j]*Math.sin(2*Math.PI*440*2**((m-69)/12)*i/8000),0);
assert.equal(await scope.exports.estimateAudioKey('test'),'C major');
assert.equal(closed,0);
for(const bpm of [80,83,90,100,120,123,160]){
 const signal=new Float32Array(8000*20),period=60*8000/bpm;
 for(let beat=0;beat*period<signal.length;beat++)for(let i=0;i<160;i++){const index=Math.round(beat*period)+i;if(index<signal.length)signal[index]=Math.exp(-i/30)*Math.sin(i*.7);}
 assert.ok(Math.abs(scope.exports.estimateTempo(signal,8000)-bpm)<=2,`Tempo ${bpm}`);
}
assert.equal(scope.exports.estimateTempo(new Float32Array(8000*10),8000),null);
console.log('PASS: silence has no invented metadata; C-major triad and tempos 80–160 detected without an active audio output.');
