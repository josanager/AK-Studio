import {env} from "cloudflare:workers";
import {createHmac,timingSafeEqual} from "node:crypto";
import {PATREON_CAMPAIGN_ID,type PatreonResource} from "../../../../lib/patreon-policy";
export async function POST(request:Request){
 if(!env.PATREON_WEBHOOK_SECRET)return Response.json({error:"Not configured."},{status:503});
 const payload=await request.text();
 if(payload.length>1000000)return new Response(null,{status:413});
 const signature=request.headers.get("x-patreon-signature")||"";
 const digest=createHmac("md5",env.PATREON_WEBHOOK_SECRET).update(payload).digest();
 if(!/^[a-f0-9]{32}$/i.test(signature)||!timingSafeEqual(digest,Buffer.from(signature,"hex")))return Response.json({error:"Invalid signature."},{status:401});
 let member:PatreonResource;
 try{member=(JSON.parse(payload) as {data:PatreonResource}).data}catch{return new Response(null,{status:400})}
 const campaign=member?.relationships?.campaign?.data;
 const user=member?.relationships?.user?.data;
 if(member?.type==="member"&&campaign&&!Array.isArray(campaign)&&campaign.id===PATREON_CAMPAIGN_ID&&user&&!Array.isArray(user)){
  // Invalidate only. Replays and out-of-order events cannot grant access.
  await env.DB.prepare("UPDATE patreon_memberships SET checked_at=0 WHERE patreon_user_id=?").bind(user.id).run();
 }
 return Response.json({received:true});
}
