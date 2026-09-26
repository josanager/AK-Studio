import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const context={exports:{},require:()=>({}),DOMException,AbortController,setTimeout,clearTimeout};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/export-video.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const abort=new AbortController();abort.abort();
await assert.rejects(context.exports.exportKaraokeVideo({signal:abort.signal}),e=>e.name==='AbortError');
console.log('PASS: cancelled export exits with AbortError before encoding or fallback.');
