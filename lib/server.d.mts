export function listRecords(db:D1Database):Promise<Record<string,unknown>[]>;
export function createRecord(db:D1Database,input:unknown):Promise<Record<string,unknown>>;
export function reviewRecord(db:D1Database,input:unknown):Promise<Record<string,unknown>>;
