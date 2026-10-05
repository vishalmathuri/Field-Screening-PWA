import {database} from '@/db/raw';
import {listRecords,createRecord,reviewRecord} from '@/lib/server.mjs';
const headers = {'Cache-Control':'no-store'};
export async function GET() {
 try {return Response.json({records:await listRecords(database())}, {headers});}
 catch(e) {console.error('List submissions',e);return Response.json({error:'Submissions are unavailable. Check your connection and retry.'},{status:503,headers});}
}
async function mutate(request:Request, review:boolean) {
 const origin=request.headers.get('origin');
 if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Request origin is not allowed.'},{status:403,headers});
 if (Number(request.headers.get('content-length'))>12000) return Response.json({error:'Record is too large.'},{status:413,headers});
 let payload:unknown;
 try {const body=await request.text();if(body.length>12000) throw new Error();payload=JSON.parse(body);}
 catch {return Response.json({error:'Send a valid JSON record.'},{status:400,headers});}
 try {const record=await (review?reviewRecord: createRecord)(database(),payload);return Response.json({record},{status:review?200:201,headers});}
 catch(e) {
  const error=e as Error & {fields?:Record<string,string>;code?:number};
  if(error.fields || error.code || (review && error.message.startsWith('Choose'))) return Response.json({error:error.message,fields:error.fields},{status:error.code||422,headers});
  console.error('Save submission',e);return Response.json({error:'Could not save to the server. Your device copy is kept; retry shortly.'},{status:503,headers});
 }
}
export const POST=(r:Request)=>mutate(r,false);
export const PATCH=(r:Request)=>mutate(r,true);
