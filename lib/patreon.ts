import {env} from "cloudflare:workers";
import {auth} from "./auth";
import {evaluatePatreonMembership,type PatreonIdentity} from "./patreon-policy";
export type PatreonSnapshot={linked:boolean;status:string;amountCents:number;pro:boolean};
export async function getPatreonSnapshot(userId:string,force=false):Promise<PatreonSnapshot>{
 const account=await env.DB.prepare("SELECT id,account_id FROM auth_account WHERE user_id=? AND provider_id='patreon' LIMIT 1").bind(userId).first<{id:string;account_id:string}>();
 if(!account)return {linked:false,status:"not_linked",amountCents:0,pro:false};
 const now=Math.floor(Date.now()/1000);
 const cached=await env.DB.prepare("SELECT status,amount_cents,pro,checked_at FROM patreon_memberships WHERE user_id=? AND patreon_user_id=?").bind(userId,account.account_id).first<{status:string;amount_cents:number;pro:number;checked_at:number}>();
 if(cached&&cached.checked_at>now-(force?15:300))return {linked:true,status:cached.status,amountCents:cached.amount_cents,pro:cached.pro===1};
 try{
  const token=await auth.api.getAccessToken({body:{accountId:account.id,userId}});
  const query=new URLSearchParams({include:"memberships.campaign","fields[member]":"patron_status,currently_entitled_amount_cents,last_charge_status","fields[user]":"full_name","fields[campaign]":"currency"});
  const response=await fetch(`https://www.patreon.com/api/oauth2/v2/identity?${query}`,{headers:{Authorization:`Bearer ${token.accessToken}`,"User-Agent":"AK Studio Vocal - Membership Sync"},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("Patreon verification unavailable");
  const result=evaluatePatreonMembership(await response.json() as PatreonIdentity,account.account_id);
  await env.DB.prepare("INSERT INTO patreon_memberships(user_id,patreon_user_id,status,amount_cents,pro,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET patreon_user_id=excluded.patreon_user_id,status=excluded.status,amount_cents=excluded.amount_cents,pro=excluded.pro,checked_at=excluded.checked_at").bind(userId,account.account_id,result.status,result.amountCents,result.pro?1:0,now).run();
  return {linked:true,...result};
 }catch{return {linked:true,status:"verification_unavailable",amountCents:0,pro:false}}
}
