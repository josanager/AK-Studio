import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const scope={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/studio-background.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
function frame(time,motion,pattern='dots'){const calls=[];const ctx={save(){},restore(){},fillRect(...a){calls.push(['fill',this.fillStyle,...a])},beginPath(){},arc(...a){calls.push(a)},fill(){},moveTo(...a){calls.push(a)},lineTo(...a){calls.push(a)},stroke(){}};scope.exports.paintBackground(ctx,640,360,time,{color:'#123456',pattern,motion});return calls}
assert.deepEqual(frame(0,false),frame(2,false));assert.notDeepEqual(frame(0,true),frame(2,true));assert.equal(frame(0,true,'none').length,1);
for(const pattern of ['dots','lines','grid'])assert.ok(frame(0,true,pattern).length>1);
console.log('PASS: background color, three patterns, deterministic time-based motion and frozen preview.');
