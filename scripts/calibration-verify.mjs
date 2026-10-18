// Read-only verification of the October pilot, using the observation detail endpoint.
import {readFile, writeFile} from 'node:fs/promises';
import {makeClient} from '../docs/js/api.js';
import {publicRecord} from '../docs/js/data.js';
const root = new URL('../review-work/calibration-2026-10/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const writes = JSON.parse(await readFile(new URL('writes.json', root), 'utf8'));
const request = makeClient();
const records = [];
for (const observation of manifest.observations) {
  const response = await request(`https://api.inaturalist.org/v1/observations/${observation.observation_id}`);
  records.push(...response.results.map(publicRecord));
  if (records.length % 10 === 0) console.log(`Verified detail response for ${records.length} observations`);
}
const missing = writes.filter(w => !records.some(o => o.id === w.observation_id && o.ofvs.some(f => f.field_id === w.field_id && f.value === w.value)));
const result = {verified_at: new Date().toISOString(), source: 'iNaturalist public API v1 observation detail endpoint', records, missing};
await writeFile(new URL('api-verification.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({observations: records.length, expectedValues: writes.length, missing}, null, 2));
if (records.length !== manifest.observations.length || missing.length) process.exitCode = 1;
else {
  const snapshotUrl = new URL('../docs/data/observations.json', import.meta.url);
  const snapshot = JSON.parse(await readFile(snapshotUrl, 'utf8'));
  snapshot.records = snapshot.records.map(o => records.find(r => r.id === o.id) || o);
  snapshot.pilotDetailVerificationAt = result.verified_at;
  if (!snapshot.source.includes('pilot records reconciled')) snapshot.source += '; pilot records reconciled with public observation detail responses';
  await writeFile(snapshotUrl, JSON.stringify(snapshot, null, 2) + '\n');
}
