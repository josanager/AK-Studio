import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/download-http.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { downloadFetch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async () => new Response("audio", { status: ++calls === 1 ? 503 : 200 });
  assert.equal((await downloadFetch("https://test.invalid")).status, 200);
  assert.equal(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("missing", { status: 404 }); };
  assert.equal((await downloadFetch("https://test.invalid")).status, 404);
  assert.equal(calls, 1);
  calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("Network disconnected"); };
  await assert.rejects(downloadFetch("https://test.invalid"), /Network disconnected/);
  assert.equal(calls, 3);
  console.log("PASS: temporary server error recovers, permanent errors stop, network retries are bounded.");
} finally { globalThis.fetch = originalFetch; }
