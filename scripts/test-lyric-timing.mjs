import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/lyric-timing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const edit=context.exports.editLyricTiming;
const line={start:10,width:5}; // five seconds in a 100-second project
assert.equal(edit(line,.23,'move',100,100,null).start,10.23);
assert.equal(edit(line,.23,'move',100,100,.5).start,10);
assert.ok(Math.abs(edit(line,2,'end',100,100,null).width-7)<1e-9);
assert.equal(edit(line,2,'start',100,100,null).width,3);
assert.equal(edit(line,-100,'move',100,100,null).start,0);
assert.equal(edit(line,100,'move',100,100,null).start,95);
assert.ok(Math.abs(edit(line,-100,'end',100,100,null).width-.15)<1e-9);
assert.ok(Math.abs(edit(line,100,'start',100,100,null).width-.15)<1e-9);
assert.equal(edit(line,100,'end',100,100,null).width,90);
assert.equal(edit(line,.3,'end',100,100,.5).width,5.5);
console.log('PASS: free movement, beat snapping, both resize edges, minimum duration and timeline boundaries.');
