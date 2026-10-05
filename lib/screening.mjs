export const outcomes = ['No follow-up', 'Follow-up recommended', 'Referral requested'];
export const reviewStatuses = ['Pending review', 'Reviewed', 'Needs follow-up'];
export function validateRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) { const e=new Error('Enter a screening record.');e.fields={record:'Invalid record.'};throw e; }
  const errors = {};
  const text = (key, min, max) => {
    const v = typeof value[key] === 'string' ? value[key].trim() : '';
    if (v.length < min || v.length > max) errors[key] = `Enter ${min}–${max} characters.`;
    return v;
  };
  const id = text('id', 36, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) errors.id = 'Invalid record identifier.';
  const participant = text('participant', 2, 40), location = text('location', 2, 100), worker = text('worker', 2, 80);
  const age = Number(value.age);
  if (value.age === '' || value.age === null || !['string','number'].includes(typeof value.age) || !Number.isInteger(age) || age < 0 || age > 120) errors.age = 'Enter a whole age from 0 to 120.';
  const date = typeof value.date === 'string' ? value.date : '';
  const parsed = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date > new Date(Date.now()+86400000).toISOString().slice(0,10)) errors.date = 'Enter a valid screening date, no later than today.';
  if (!outcomes.includes(value.outcome)) errors.outcome = 'Choose a screening outcome.';
  const notes = text('notes', 0, 1500);
  if (value.consent !== true) errors.consent = 'Confirm consent before submitting.';
  if (Object.keys(errors).length) { const e = new Error('Check the highlighted fields.'); e.fields = errors; throw e; }
  return {id, participant, location, worker, age, date, outcome:value.outcome, notes, consent:true};
}
export async function drainQueue(items, {send, save, notify = () => {}}) {
  let sent = 0;
  for (const item of items.filter(x => x.state === 'queued' || x.state === 'retry')) {
    try {
      const response = await send(item.record);
      if (response.id !== item.record.id) throw new Error('The server did not confirm this record.');
      await save({...item, state:'synced', error:'', syncedAt:new Date().toISOString()});
      sent++;
    } catch (e) {
      await save({...item, state: e.permanent ? 'blocked' : 'retry', error:e.message || 'Could not connect. Retry when online.'});
    }
    notify();
  }
  return sent;
}
