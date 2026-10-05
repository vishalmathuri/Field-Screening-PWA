import type {QueueItem,Screening} from './screening.mjs';
export type Draft={id:string;record:Screening;updatedAt:string};
let connection:Promise<IDBDatabase>|undefined;
function open() {
 if(!connection) connection=new Promise((resolve,reject)=>{
  const request=indexedDB.open('field-screening-v1',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'id'});request.result.createObjectStore('queue',{keyPath:'id'});};
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=undefined;};resolve(request.result);};
  request.onerror=()=>{connection=undefined;reject(new Error('Device storage is unavailable. Enable browser storage before collecting records.'));};
 });
 return connection;
}
async function transaction<T>(store:string, mode:IDBTransactionMode, operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const req=operation(tx.objectStore(store));tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(new Error('Could not save on this device. Check free storage and retry.'));});
}
export const drafts=()=>transaction<Draft[]>('drafts','readonly',s=>s.getAll());
export const queue=()=>transaction<QueueItem[]>('queue','readonly',s=>s.getAll());
export const saveDraft=(d:Draft)=>transaction('drafts','readwrite',s=>s.put(d));
export const removeDraft=(id:string)=>transaction('drafts','readwrite',s=>s.delete(id));
export const saveQueue=(q:QueueItem)=>transaction('queue','readwrite',s=>s.put(q));
export async function submitDraft(record:Screening) {
 const db=await open();return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['drafts','queue'],'readwrite');
  tx.objectStore('queue').put({id:record.id,record,state:'queued'});tx.objectStore('drafts').delete(record.id);
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('Could not queue this record. Your draft is kept; retry.'));
 });
}
export async function editBlocked(item:QueueItem) {
 const db=await open();return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['drafts','queue'],'readwrite');
  tx.objectStore('drafts').put({id:item.id,record:item.record,updatedAt:new Date().toISOString()});tx.objectStore('queue').delete(item.id);
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('Could not reopen the record. Retry.'));
 });
}
