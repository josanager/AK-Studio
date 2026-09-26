export type AudioClip={id:string;source:string;name:string;start:number;duration:number;lane:string;kind:'backing'|'vocal'|'recording';peaks:number[]|null};
export type AudioLane={id:string;name:string;muted:boolean};
export function overlaps(a:Pick<AudioClip,'start'|'duration'>,b:Pick<AudioClip,'start'|'duration'>){return a.start<b.start+b.duration-.001&&b.start<a.start+a.duration-.001}
export function availableLane(clips:AudioClip[],lanes:AudioLane[],start:number,duration:number){return lanes.find(l=>!clips.some(c=>c.lane===l.id&&overlaps(c,{start,duration})))?.id}
