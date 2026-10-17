// Bounded chroma analysis with major/minor pitch-class profiles. An estimate,
// not a guarantee for modulating music or percussion-only recordings.
export function estimateTempo(samples:Float32Array,sampleRate:number):number|null {
  // A 200-Hz positive energy-onset envelope, bounded to two minutes. Ignore
  // sustained tones; tempo needs repeated transients, not pitch information.
  const hop=Math.max(1,Math.round(sampleRate/200)),count=Math.min(Math.floor(samples.length/hop),24000);
  if(count<400)return null;
  const onset=new Float64Array(count);
  let previous=0,mean=0;
  for(let frame=0;frame<count;frame++){
    let sum=0;
    for(let i=0;i<hop;i++){const x=samples[frame*hop+i];sum+=x*x;}
    const energy=Math.sqrt(sum/hop);
    onset[frame]=Math.max(0,energy-previous);mean+=onset[frame];previous=energy;
  }
  mean/=count;
  let variance=0;
  for(let i=0;i<count;i++){onset[i]=Math.max(0,onset[i]-mean);variance+=onset[i]**2;}
  if(variance<1e-8)return null;
  const rate=sampleRate/hop;
  const minLag=Math.floor(60*rate/200),maxLag=Math.ceil(60*rate/60);
  const correlations=new Float64Array(maxLag*2+2);
  for(let lag=minLag;lag<correlations.length;lag++){
    let sum=0,a=0,b=0;
    for(let i=lag;i<count;i++){sum+=onset[i]*onset[i-lag];a+=onset[i]**2;b+=onset[i-lag]**2;}
    correlations[lag]=sum/Math.max(1e-12,Math.sqrt(a*b));
  }
  let bestLag=0,bestScore=0;
  // Integrate adjacent bins: non-integer beat periods alternate between bins,
  // whereas their doubled period can land on one bin and falsely win.
  const peak=(lag:number)=>(correlations[lag-1]||0)+correlations[lag]+(correlations[lag+1]||0);
  for(let lag=minLag;lag<=maxLag;lag++){
    const score=peak(lag)+.25*peak(lag*2);
    if(score>bestScore){bestScore=score;bestLag=lag;}
  }
  const half=Math.round(bestLag/2);
  if(half>=minLag){
    let candidate=half;
    for(let lag=Math.max(minLag,half-1);lag<=half+1;lag++)if(peak(lag)>peak(candidate))candidate=lag;
    if(peak(candidate)>=.8*peak(bestLag))bestLag=candidate;
  }
  if(!bestLag||correlations[bestLag]<.08)return null;
  // Interpolate the peak instead of quantizing all results to 5-ms steps.
  const left=correlations[bestLag-1]||0,center=correlations[bestLag],right=correlations[bestLag+1]||0;
  const denominator=left-2*center+right;
  const offset=denominator?Math.max(-.5,Math.min(.5,.5*(left-right)/denominator)):0;
  return Math.round(60*rate/(bestLag+offset));
}

export async function estimateAudioMetadata(url: string): Promise<{key:string|null;bpm:number|null}> {
  // Decoding does not need an active output device or an autoplay permission.
  const context = new OfflineAudioContext(1,1,8000);
  try {
    const response = await fetch(url);
    if (!response.ok) return {key:null,bpm:null};
    const audio = await context.decodeAudioData(await response.arrayBuffer());
    const samples = audio.getChannelData(0), n = 2048, chroma = new Float64Array(12);
    const bpm=estimateTempo(samples,audio.sampleRate);
    for (let frame=0;frame<64;frame++) {
      const start = Math.floor(frame/64*Math.max(0,samples.length-n));
      for(let midi=48;midi<84;midi++) {
        const coefficient=2*Math.cos(2*Math.PI*(440*2**((midi-69)/12))/audio.sampleRate);
        let a=0,b=0;
        for(let i=0;i<n;i++) {const c=(samples[start+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(n-1)))+coefficient*a-b;b=a;a=c;}
        chroma[midi%12]+=Math.sqrt(Math.max(0,a*a+b*b-coefficient*a*b));
      }
      if(frame%8===0) await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
    const mean=chroma.reduce((a,b)=>a+b,0)/12;
    const norm=Math.sqrt(chroma.reduce((a,b)=>a+(b-mean)**2,0));
    if(norm<1e-5) return {key:null,bpm};
    const profiles=[[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17]];
    let best=-Infinity,key:string|null=null;
    for(let mode=0;mode<2;mode++) for(let root=0;root<12;root++) {
      const profile=profiles[mode], average=profile.reduce((a,b)=>a+b,0)/12;
      const score=chroma.reduce((sum,value,i)=>sum+(value-mean)*(profile[(i-root+12)%12]-average),0)/(norm*Math.sqrt(profile.reduce((a,b)=>a+(b-average)**2,0)));
      if(score>best){best=score;key=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][root]+(mode?' minor':' major');}
    }
    return {key:best>.2?key:null,bpm};
  } finally { /* Offline contexts do not hold an output device. */ }
}

export async function estimateAudioKey(url:string){return (await estimateAudioMetadata(url)).key;}
