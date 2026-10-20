import {getCurrentUser} from "../../auth";
import {getPlanSnapshot} from "../../../lib/plans";
export async function GET(){
 const user=await getCurrentUser();
 if(!user)return Response.json({error:"Sign in first."},{status:401,headers:{"cache-control":"no-store"}});
 return Response.json({plan:await getPlanSnapshot(user)},{headers:{"cache-control":"no-store"}});
}
