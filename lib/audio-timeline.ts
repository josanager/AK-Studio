export type AudioClip={id:string;source:string;name:string;start:number;duration:number;offset?:number;sourceDuration?:number;lane:string;kind:'backing'|'vocal'|'recording';peaks:number[]|null};
export type AudioLane={id:string;name:string;muted:boolean};
export function overlaps(a:Pick<AudioClip,'start'|'duration'>,b:Pick<AudioClip,'start'|'duration'>){return a.start<b.start+b.duration-.001&&b.start<a.start+a.duration-.001}
export function availableLane(clips:AudioClip[],lanes:AudioLane[],start:number,duration:number){return lanes.find(l=>!clips.some(c=>c.lane===l.id&&overlaps(c,{start,duration})))?.id}
export function splitAudioClip(c:AudioClip,time:number,id:string):AudioClip[]|null{
 const length=time-c.start;if(length<.05||c.duration-length<.05)return null;
 const sourceDuration=c.sourceDuration??(c.offset||0)+c.duration;
 return [{...c,sourceDuration,duration:length},{...c,id,sourceDuration,start:time,offset:(c.offset||0)+length,duration:c.duration-length}];
}
export function trimAudioClip(c:AudioClip,delta:number,edge:'start'|'end'):AudioClip{
 const offset=c.offset||0,sourceDuration=c.sourceDuration??offset+c.duration;
 if(edge==='end')return {...c,sourceDuration,duration:Math.max(.05,Math.min(sourceDuration-offset,c.duration+delta))};
 const change=Math.max(-Math.min(offset,c.start),Math.min(c.duration-.05,delta));
 return {...c,sourceDuration,start:c.start+change,offset:offset+change,duration:c.duration-change};
}
