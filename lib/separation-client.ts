/** Short polling requests survive browser suspension; the inference is a remote job. */
export async function waitForSeparation(audioId:string,signal:AbortSignal,onProgress:(n:number)=>void){
 const deadline=Date.now()+25*60_000;
 while(true){
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  try{
   const response=await fetch(`/api/audio/separate?audioId=${encodeURIComponent(audioId)}`,{signal,cache:'no-store'});
   const result=await response.json() as Record<string,unknown>;
   if(!response.ok){if(response.status===401||response.status===404||typeof result.error==='string'&&/failed|cancelled|expired|invalid|incomplete/i.test(result.error))throw new Error(String(result.error||'Could not process audio.'))}
   else if(result.status==='ready')return result;
   else onProgress(Math.max(5,Math.min(94,Number(result.progress)||5)));
  }catch(e){if(signal.aborted||e instanceof Error&&!(e instanceof TypeError))throw e}
  if(Date.now()>=deadline)throw new Error('Audio processing is taking longer than expected. Return to this project to check again.');
  await new Promise<void>((resolve,reject)=>{
   const finish=()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visible);signal.removeEventListener('abort',abort);resolve()};
   const visible=()=>{if(document.visibilityState==='visible')finish()};
   const abort=()=>{finish();reject(new DOMException('Cancelled','AbortError'))};
   const timer=setTimeout(finish,3000);document.addEventListener('visibilitychange',visible);signal.addEventListener('abort',abort,{once:true});
  });
 }
}

