import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  appName:"AK Studio", baseURL:env.BETTER_AUTH_URL, secret:env.BETTER_AUTH_SECRET,
  database:drizzleAdapter(getDb(),{provider:"sqlite",schema:{user:schema.authUser,session:schema.authSession,account:schema.authAccount,verification:schema.authVerification}}),
  ...(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET?{socialProviders:{google:{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET}}}:{}),
});
