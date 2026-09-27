import {requireCurrentUser} from "../../auth";
import {getPlanSnapshot} from "../../../lib/plans";
import AccountPanel from "../panel";

export const dynamic="force-dynamic";

export default async function FontCollectionsPage(){
 const user=await requireCurrentUser("/account/fonts");
 const plan=await getPlanSnapshot(user);
 return <AccountPanel user={{name:user.displayName,email:user.email}} plan={plan} section="fonts"/>;
}
