import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb } from "../db";
import * as schema from "../db/schema";
import {genericOAuth,patreon} from "better-auth/plugins/generic-oauth";

export const auth = betterAuth({
  appName:"AK Studio", baseURL:env.BETTER_AUTH_URL, secret:env.BETTER_AUTH_SECRET,
  trustedOrigins:["https://akstudiovocal.com"],
  onAPIError:{errorURL:"https://akstudiovocal.com/signin/error"},
  account:{accountLinking:{enabled:true,disableImplicitLinking:true,allowDifferentEmails:true}},
  plugins:env.PATREON_CLIENT_ID&&env.PATREON_CLIENT_SECRET?[genericOAuth({config:[{
    ...patreon({clientId:env.PATREON_CLIENT_ID,clientSecret:env.PATREON_CLIENT_SECRET,scopes:["identity","identity[email]"]}),
    getUserInfo:async(tokens)=>{
      const response=await fetch("https://www.patreon.com/api/oauth2/v2/identity?fields%5Buser%5D=email,full_name,image_url,is_email_verified",{headers:{Authorization:`Bearer ${tokens.accessToken}`,"User-Agent":"AK Studio Vocal - Sign In"},signal:AbortSignal.timeout(12000)});
      if(!response.ok)return null;
      const profile=await response.json() as {data:{id:string;attributes:{email?:string;full_name?:string;image_url?:string;is_email_verified?:boolean}}};
      if(!profile.data?.id||!profile.data.attributes?.email)return null;
      return {id:profile.data.id,email:profile.data.attributes.email,name:profile.data.attributes.full_name||"Patreon member",image:profile.data.attributes.image_url,emailVerified:profile.data.attributes.is_email_verified===true};
    },
  }]})]:[],
  database:drizzleAdapter(getDb(),{provider:"sqlite",schema:{user:schema.authUser,session:schema.authSession,account:schema.authAccount,verification:schema.authVerification}}),
  ...(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET?{socialProviders:{google:{clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET}}}:{}),
});
