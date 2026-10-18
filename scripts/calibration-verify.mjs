// Read-only verification of the October pilot, using the observation detail endpoint.
import {readFile, writeFile} from 'node:fs/promises';
import {makeClient} from '../docs/js/api.js';
import {publicRecord} from '../docs/js/data.js';
import {loadCorrections} from './calibration-corrections.mjs';
const root = new URL('../review-work/calibration-2026-10/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const writes = JSON.parse(await readFile(new URL('writes.json', root), 'utf8'));
const corrections = await loadCorrections(root);
const withdrawals = corrections.filter(c => ['submitted','verified'].includes(c.status));
const request = makeClient();
const records = [];
for (const observation of manifest.observations) {
  const response = await request(`https://api.inaturalist.org/v1/observations/${observation.observation_id}`);
  records.push(...response.results.map(publicRecord));
  if (records.length % 10 === 0) console.log(`Verified detail response for ${records.length} observations`);
}
const retainedWrites = writes.filter(w => !withdrawals.some(c => c.observation_id === w.observation_id && c.field_id === w.field_id));
const missing = retainedWrites.filter(w => !records.some(o => o.id === w.observation_id && o.ofvs.some(f => f.field_id === w.field_id && f.value === w.value)));
const failedWithdrawals = withdrawals.filter(c => !records.some(o => o.id === c.observation_id && !o.ofvs.some(f => f.field_id === c.field_id)));
const result = {verified_at: new Date().toISOString(), source: 'iNaturalist public API v1 observation detail endpoint', records, missing, failed_withdrawals: failedWithdrawals};
await writeFile(new URL('api-verification.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({observations: records.length, expectedValues: retainedWrites.length, missing, failedWithdrawals}, null, 2));
if (records.length !== manifest.observations.length || missing.length || failedWithdrawals.length) process.exitCode = 1;
else {
  for (const c of withdrawals) { c.status = 'verified'; c.verified_at = result.verified_at; }
  await writeFile(new URL('corrections.json', root), JSON.stringify(corrections, null, 2) + '\n');
  const snapshotUrl = new URL('../docs/data/archive/observations-v1.1.0.json', import.meta.url);
  const snapshot = JSON.parse(await readFile(snapshotUrl, 'utf8'));
  snapshot.records = snapshot.records.map(o => records.find(r => r.id === o.id) || o).filter(o => o.ofvs.some(f => [8625,43,23007].includes(f.field_id)));
  snapshot.pilotDetailVerificationAt = result.verified_at;
  if (withdrawals.length) snapshot.pilotCorrections = {protocolVersion:'1.1.0', verifiedAt:result.verified_at, colorValuesWithdrawn:withdrawals.length};
  if (!snapshot.source.includes('pilot records reconciled')) snapshot.source += '; pilot records reconciled with public observation detail responses';
  await writeFile(snapshotUrl, JSON.stringify(snapshot, null, 2) + '\n');
}
