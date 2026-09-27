"use client";
import {useEffect,useRef,useState} from "react";
import {ChevronDown,CreditCard,LogOut,Type,UserRound} from "lucide-react";
import {authClient} from "../lib/auth-client";

export function ProfileMenu({name,email}:{name:string;email:string}){
 const[open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const onPointer=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);trigger.current?.focus()}};window.addEventListener("pointerdown",onPointer,true);window.addEventListener("keydown",onKey);return()=>{window.removeEventListener("pointerdown",onPointer,true);window.removeEventListener("keydown",onKey)}},[open]);
 const close=()=>setOpen(false);
 return <div className="profile-menu" ref={root}><button ref={trigger} type="button" className="account-button profile-button profile-menu-trigger" aria-label={`Account options for ${name}`} aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(v=>!v)}><UserRound/><span>{name.split(" ")[0]}</span><ChevronDown className="profile-menu-chevron"/></button>{open&&<section className="profile-popover" role="dialog" aria-label="Account options"><div className="profile-popover-identity"><strong>{name}</strong><span>{email}</span></div><nav aria-label="Account"><a className="profile-popover-link" href="/account" onClick={close}><UserRound/> Profile</a><a className="profile-popover-link" href="/account/plans" onClick={close}><CreditCard/> Plans</a><a className="profile-popover-link" href="/account/fonts" onClick={close}><Type/> Font collections</a></nav><div className="profile-popover-divider"/><button type="button" className="profile-popover-signout" onClick={()=>void authClient.signOut({fetchOptions:{onSuccess:()=>{window.location.href="/"}}})}><LogOut/> Sign out</button></section>}</div>;
}
