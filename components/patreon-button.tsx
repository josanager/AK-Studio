"use client";
import {useState} from "react";
import {authClient} from "../lib/auth-client";
export function PatreonButton({link=false}:{link?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function connect(){if(busy)return;setBusy(true);setError("");try{
  const options={provider:"patreon",callbackURL:"https://akstudiovocal.com/account/plans",errorCallbackURL:"https://akstudiovocal.com/signin/error"};
  const result=link?await authClient.linkSocial(options):await authClient.signIn.social(options);
  if(result.error){setError("Patreon could not be connected. Please try again.");setBusy(false)}
 }catch{setError("Could not connect to Patreon. Check your connection and try again.");setBusy(false)}}
 return <><button type="button" className="google-signin" onClick={()=>void connect()} disabled={busy} aria-busy={busy}>{busy?"Connecting to Patreon…":link?"Connect Patreon":"Continue with Patreon"}</button>{error&&<p role="alert">{error}</p>}</>;
}
