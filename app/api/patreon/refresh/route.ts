import {getCurrentUser} from "../../../auth";
import {getPatreonSnapshot} from "../../../../lib/patreon";
export async function POST(request:Request){
 if(request.headers.get("origin")!=="https://akstudiovocal.com")return Response.json({error:"Invalid origin."},{status:403});
 const user=await getCurrentUser();
 if(!user)return Response.json({error:"Sign in first."},{status:401});
 const membership=await getPatreonSnapshot(user.userId,true);
 return Response.json({membership},{status:membership.status==="verification_unavailable"?503:200});
}
