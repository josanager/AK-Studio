import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import AccountPanel from "./panel";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
  return <AccountPanel user={{name:user.displayName,email:user.email}} signOutPath={chatGPTSignOutPath("/")}/>;
}
