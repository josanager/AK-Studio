import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
let source=fs.readFileSync("lib/plans.ts","utf8").replace(/^import .*\n/gm,"");
source="const {env,getPatreonSnapshot}=globalThis.__ownerPlanTest;\n"+source;
let verified=true,patreonPro=false,ownerChecks=0,patreonChecks=0;
globalThis.__ownerPlanTest={env:{DB:{prepare(sql){return {bind(...params){return {async run(){},async first(){if(sql.includes("FROM auth_user")){ownerChecks++;assert.ok(sql.includes("email_verified=1"));assert.ok(sql.includes("lower(email)='josanager@gmail.com'"));return verified&&params[0]==="owner-id"?{id:"owner-id"}:null}return {total:1}}}}}}}},async getPatreonSnapshot(){patreonChecks++;return {linked:true,status:"none",amountCents:0,pro:patreonPro}}};
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {getPlanSnapshot}=await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const owner={userId:"owner-id",email:"josanager@gmail.com",displayName:"Owner",fullName:null};
const plan=await getPlanSnapshot(owner);
assert.equal(plan.plan,"pro");assert.equal(plan.weeklyLimit,null);assert.equal(plan.canCreate,true);assert.equal(plan.ownerAccess,true);assert.equal(patreonChecks,0);
for(const email of ["other@gmail.com","josanager+test@gmail.com","josan862003@gmail.com","someone@josanager@gmail.com"]){const before=ownerChecks;const result=await getPlanSnapshot({...owner,userId:"other-id",email});assert.equal(result.plan,"free");assert.equal(result.canCreate,false);assert.equal(ownerChecks,before)}
assert.equal((await getPlanSnapshot({...owner,userId:"other-id"})).plan,"free");
verified=false;assert.equal((await getPlanSnapshot(owner)).plan,"free");
patreonPro=true;assert.equal((await getPlanSnapshot({...owner,userId:"patron-id",email:"patron@example.com"})).plan,"pro");
delete globalThis.__ownerPlanTest;
console.log("Owner exception passed: verified exact account only; aliases, other IDs and unverified identity denied; Patreon unchanged.");
