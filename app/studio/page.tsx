import Studio from "../studio";
import {requireCurrentUser} from "../auth";
import {getPlanSnapshot} from "../../lib/plans";
export const dynamic="force-dynamic";
export default async function StudioPage(){const user=await requireCurrentUser("/studio");const plan=await getPlanSnapshot(user);return <Studio user={{name:user.displayName,email:user.email}} plan={plan}/>}
