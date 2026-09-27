"use client";
import {useEffect,useRef,useState} from "react";
import {EditHistory} from "../lib/edit-history";

export function useEditHistory<T>(value:T,apply:(value:T)=>void,resetKey:string,enabled:boolean){
 const latest=useRef(value);latest.current=value;
 const applyRef=useRef(apply);applyRef.current=apply;
 const history=useRef(new EditHistory(value,(a,b)=>JSON.stringify(a)===JSON.stringify(b)));
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const dragging=useRef(false);
 const [,refresh]=useState(0);
 const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null};
 const flush=()=>{clear();history.current.record(latest.current);refresh(n=>n+1)};
 useEffect(()=>{clear();history.current=new EditHistory(latest.current,(a,b)=>JSON.stringify(a)===JSON.stringify(b));refresh(n=>n+1)},[resetKey,enabled]);
 useEffect(()=>{if(!enabled)return;clear();if(!dragging.current)timer.current=setTimeout(flush,350);return clear},[value,enabled]);
 useEffect(()=>{const down=()=>{if(enabled){flush();dragging.current=true}};const up=()=>{dragging.current=false;if(enabled)flush()};window.addEventListener("pointerdown",down,true);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);return()=>{window.removeEventListener("pointerdown",down,true);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);clear()}},[enabled]);
 const travel=(redo:boolean)=>{if(!enabled)return;clear();history.current.record(latest.current);const next=redo?history.current.redo():history.current.undo();if(next){latest.current=next;applyRef.current(next)}refresh(n=>n+1)};
 const pending=JSON.stringify(history.current.present)!==JSON.stringify(value);
 return {canUndo:enabled&&(history.current.canUndo||pending),canRedo:enabled&&!pending&&history.current.canRedo,undo:()=>travel(false),redo:()=>travel(true)};
}
