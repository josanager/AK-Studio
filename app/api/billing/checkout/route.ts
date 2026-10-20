import {getCurrentUser} from "../../../auth";
import {PATREON_URL} from "../../../../lib/patreon-policy";
export async function POST(){
 if(!await getCurrentUser())return Response.json({error:"Sign in to manage your membership."},{status:401});
 return Response.json({url:PATREON_URL});
}
