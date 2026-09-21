import { requireCurrentUser } from "../auth";
import AccountPanel from "./panel";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireCurrentUser();
  return <AccountPanel user={{name:user.displayName,email:user.email}}/>;
}
