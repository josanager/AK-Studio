import { requireCurrentUser } from "../auth";
import AccountPanel from "./panel";
import { getPlanSnapshot } from "../../lib/plans";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireCurrentUser();
  const plan = await getPlanSnapshot(user);
  return <AccountPanel user={{name:user.displayName,email:user.email}} plan={plan}/>;
}
