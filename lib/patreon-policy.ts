export const PATREON_CAMPAIGN_ID="9673516";
export const PATREON_URL="https://www.patreon.com/c/acapellakaraoke/membership";
export type PatreonResource={id:string;type:string;attributes?:Record<string,unknown>;relationships?:Record<string,{data?:{id:string;type:string}|{id:string;type:string}[]|null}>};
export type PatreonIdentity={data:PatreonResource;included?:PatreonResource[]};
export function evaluatePatreonMembership(document:PatreonIdentity,expectedUserId:string){
 if(document.data?.type!=="user"||document.data.id!==expectedUserId)throw new Error("Patreon identity mismatch");
 const ids=document.data.relationships?.memberships?.data;
 if(!Array.isArray(ids))throw new Error("Patreon memberships missing");
 const member=(document.included||[]).find(r=>{const c=r.relationships?.campaign?.data;return r.type==="member"&&ids.some(id=>id.id===r.id)&&c&&!Array.isArray(c)&&c.id===PATREON_CAMPAIGN_ID});
 const amount=member?.attributes?.currently_entitled_amount_cents;
 const amountCents=typeof amount==="number"&&Number.isSafeInteger(amount)&&amount>=0?amount:0;
 const status=typeof member?.attributes?.patron_status==="string"?member.attributes.patron_status:"none";
 const charge=member?.attributes?.last_charge_status;
 const currency=(document.included||[]).find(r=>r.type==="campaign"&&r.id===PATREON_CAMPAIGN_ID)?.attributes?.currency;
 const pro=currency==="USD"&&status==="active_patron"&&amountCents>=1500&&!["Declined","Refunded","Fraud","Deleted"].includes(String(charge));
 return {pro,status,amountCents};
}
