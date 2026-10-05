export type Screening = {id:string; participant:string; age:number|string; location:string; worker:string; date:string; outcome:string; notes:string; consent:boolean};
export type QueueItem = {id:string; record:Screening; state:'queued'|'retry'|'blocked'|'synced'; error?:string; syncedAt?:string};
export const outcomes:string[];
export const reviewStatuses:string[];
export function validateRecord(value:unknown):Screening;
export function drainQueue(items:QueueItem[],options:{send:(record:Screening)=>Promise<{id:string}>;save:(item:QueueItem)=>Promise<unknown>;notify?:()=>void}):Promise<number>;
