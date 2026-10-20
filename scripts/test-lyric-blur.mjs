import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
const source=ts.createSourceFile("studio.tsx",fs.readFileSync("app/studio.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==="commitLyricText")handler=node.getText(source);ts.forEachChild(node,visit)}
visit(source);assert.ok(handler,"Missing lyric blur handler");
const js=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let deferred;const scope={setLyrics:updater=>{deferred=updater}};vm.createContext(scope);vm.runInContext(js,scope);
const event={currentTarget:{textContent:"Edited line"}};
scope.commitLyricText(0,event);
event.currentTarget=null; // React clears currentTarget after the event dispatch.
const before=[{text:"Original",start:2,width:4},{text:"Other",start:8,width:4}];
const after=deferred(before);
assert.equal(after[0].text,"Edited line");assert.equal(after[1].text,"Other");assert.equal(before[0].text,"Original");
scope.commitLyricText(0,{currentTarget:{textContent:""}});
assert.equal(deferred(before)[0].text,"Original");
console.log("PASS: editing/blur remains safe when React clears currentTarget before the deferred update.");
