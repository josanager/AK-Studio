"use client";
import {useRef,useState,type ReactNode} from "react";
import {authClient} from "../lib/auth-client";

export function GoogleSignInButton({children}:{children:ReactNode}){
  const[busy,setBusy]=useState(false);
  const pending=useRef(false);
  async function signIn(){
    if(pending.current)return;
    pending.current=true;setBusy(true);
    try{
      const result=await authClient.signIn.social({provider:"google",callbackURL:"https://akstudiovocal.com/studio",errorCallbackURL:"https://akstudiovocal.com/signin/error"});
      if(result.error)window.location.assign("/signin/error");
    }catch{window.location.assign("/signin/error")}
    finally{pending.current=false;setBusy(false)}
  }
  return <button type="button" className="google-signin" disabled={busy} aria-busy={busy} onClick={()=>void signIn()}><span>{children}</span>{busy?"Connecting…":"Continue with Google"}</button>;
}
