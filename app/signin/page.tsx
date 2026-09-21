"use client";
import Link from "next/link";
import {Check} from "lucide-react";
import {authClient} from "../../lib/auth-client";
export default function SignInPage(){return <main className="signin-page"><section className="signin-panel"><Link className="signin-brand" href="/signin"><span>AK</span><b>Studio</b></Link><div><h1>Create your karaoke</h1><p>Sign in to use the editor. Your audio and video remain temporary and are deleted automatically.</p><ul><li><Check/> One karaoke video every week on Free</li><li><Check/> Lead vocal separation included</li><li><Check/> No projects or audio stored in your account</li></ul><button className="google-signin" onClick={()=>void authClient.signIn.social({provider:"google",callbackURL:"/"})}><span>G</span> Continue with Google</button><small>By continuing, you agree to process only content you own or have permission to use.</small></div></section></main>}
