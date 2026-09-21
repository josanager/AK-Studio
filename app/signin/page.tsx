"use client";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {authClient} from "../../lib/auth-client";
export default function SignInPage(){return <main className="account-page"><div className="account-wrap"><Link className="back-link" href="/"><ArrowLeft size={16}/> Editor</Link><section className="account-card" style={{maxWidth:480,margin:"10vh auto"}}><div className="account-card-title"><span className="account-mark">AK</span><h1>Sign in</h1></div><p>Save font collections and manage your subscription. Projects, audio, and video are never stored.</p><button className="checkout" onClick={()=>void authClient.signIn.social({provider:"google",callbackURL:"/account"})}>Continue with Google</button></section></div></main>}
