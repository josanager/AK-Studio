import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {auth} from "../lib/auth";
export type AppUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getCurrentUser():Promise<AppUser|null>{const session=await auth.api.getSession({headers:await headers()});if(!session?.user)return null;return{userId:session.user.id,displayName:session.user.name||session.user.email,email:session.user.email,fullName:session.user.name||null}}
export async function requireCurrentUser(returnTo="/account"){const user=await getCurrentUser();if(user)return user;redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`)}
