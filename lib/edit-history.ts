// Snapshots share immutable media references; history never copies audio buffers.
export class EditHistory<T> {
 private past:T[]=[];
 private future:T[]=[];
 constructor(public present:T,private equal:(a:T,b:T)=>boolean,private limit=100){}
 get canUndo(){return this.past.length>0}
 get canRedo(){return this.future.length>0}
 record(value:T){if(this.equal(this.present,value))return;this.past.push(this.present);if(this.past.length>this.limit)this.past.shift();this.present=value;this.future=[]}
 undo(){if(!this.canUndo)return null;this.future.push(this.present);this.present=this.past.pop()!;return this.present}
 redo(){if(!this.canRedo)return null;this.past.push(this.present);this.present=this.future.pop()!;return this.present}
}
