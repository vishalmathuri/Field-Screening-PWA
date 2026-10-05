import {validateRecord, reviewStatuses} from './screening.mjs';
const read = db => db.prepare('SELECT * FROM submissions ORDER BY received_at DESC, id DESC LIMIT 500').all();
export async function listRecords(db) { return (await read(db)).results; }
export async function createRecord(db, input) {
 const r = validateRecord(input);
 await db.prepare('INSERT INTO submissions (id,participant,age,location,worker,date,outcome,notes,consent,received_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(r.id,r.participant,r.age,r.location,r.worker,r.date,r.outcome,r.notes,1,new Date().toISOString()).run();
 const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(r.id).first();
 // A UUID retry is only accepted if its immutable screening data match.
 if (['participant','age','location','worker','date','outcome','notes'].some(k=>row[k]!==r[k])) { const e=new Error('This record identifier already belongs to a different submission.'); e.code=409; throw e; }
 return row;
}
export async function reviewRecord(db, input) {
 if (!input || typeof input.id !== 'string' || !reviewStatuses.includes(input.status) || typeof input.reviewNote !== 'string' || input.reviewNote.length>1500) throw new Error('Choose a review status and keep notes under 1,500 characters.');
 const row = await db.prepare('UPDATE submissions SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ? RETURNING *').bind(input.status,input.reviewNote.trim(),new Date().toISOString(),input.id).first();
 if (!row) {const e=new Error('Submission no longer exists. Refresh the dashboard.');e.code=404;throw e;}
 return row;
}
