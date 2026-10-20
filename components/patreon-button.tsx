"use client";
import {useState} from "react";
import {authClient} from "../lib/auth-client";
function PatreonMark(){return <svg className="patreon-mark" viewBox="0 0 436 476" aria-hidden="true"><path fill="currentColor" d="M436 143c-.084-60.778-47.57-110.591-103.285-128.565C263.528-7.884 172.279-4.649 106.214 26.424 26.142 64.089.988 146.596.051 228.883c-.77 67.653 6.004 245.841 106.83 247.11 74.917.948 86.072-95.279 120.737-141.623 24.662-32.972 56.417-42.285 95.507-51.929C390.309 265.865 436.097 213.011 436 143Z"/></svg>}
export function PatreonButton({link=false}:{link?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function connect(){if(busy)return;setBusy(true);setError("");try{
  const options={provider:"patreon",callbackURL:"https://akstudiovocal.com/account/plans",errorCallbackURL:"https://akstudiovocal.com/signin/error"};
  const result=link?await authClient.linkSocial(options):await authClient.signIn.social(options);
  if(result.error){setError("Patreon could not be connected. Please try again.");setBusy(false)}
 }catch{setError("Could not connect to Patreon. Check your connection and try again.");setBusy(false)}}
 return <><button type="button" className="google-signin" onClick={()=>void connect()} disabled={busy} aria-busy={busy}><span><PatreonMark/></span>{busy?"Connecting to Patreon…":link?"Connect Patreon":"Continue with Patreon"}</button>{error&&<p role="alert">{error}</p>}</>;
}
