import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=ts.transpileModule(fs.readFileSync("lib/patreon-policy.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {evaluatePatreonMembership}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
function fixture(amount=1500,status="active_patron",campaign="9673516",currency="USD",charge="Paid"){return {data:{id:"u1",type:"user",relationships:{memberships:{data:[{id:"m1",type:"member"}]}}},included:[{id:"m1",type:"member",attributes:{currently_entitled_amount_cents:amount,patron_status:status,last_charge_status:charge},relationships:{campaign:{data:{id:campaign,type:"campaign"}}}},{id:campaign,type:"campaign",attributes:{currency}}]}}
for(const amount of [0,500,1499,-1500,"1500",NaN])assert.equal(evaluatePatreonMembership(fixture(amount),"u1").pro,false);
for(const amount of [1500,2500])assert.equal(evaluatePatreonMembership(fixture(amount),"u1").pro,true);
for(const status of ["declined_patron","former_patron",null])assert.equal(evaluatePatreonMembership(fixture(1500,status),"u1").pro,false);
assert.equal(evaluatePatreonMembership(fixture(1500,"active_patron","other"),"u1").pro,false);
assert.equal(evaluatePatreonMembership(fixture(1500,"active_patron","9673516","EUR"),"u1").pro,false);
assert.equal(evaluatePatreonMembership(fixture(1500,"active_patron","9673516","USD","Declined"),"u1").pro,false);
assert.throws(()=>evaluatePatreonMembership(fixture(),"different-user"));
const empty=fixture();empty.data.relationships.memberships.data=[];assert.equal(evaluatePatreonMembership(empty,"u1").pro,false);
const plans=fs.readFileSync("lib/plans.ts","utf8");assert.ok(!plans.includes("FROM subscriptions"));assert.ok(!plans.includes("COMPLIMENTARY_PRO_EMAIL"));
const checkout=fs.readFileSync("app/api/billing/checkout/route.ts","utf8");assert.ok(!checkout.includes("stripe.com"));
const auth=fs.readFileSync("lib/auth.ts","utf8");assert.ok(auth.includes("disableImplicitLinking:true"));
console.log("Patreon policy passed: amount boundary, status, campaign, currency, identity, no Stripe entitlement, explicit linking.");
