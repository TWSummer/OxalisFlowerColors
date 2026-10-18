// Read-only public API baseline/verification for the new-field trial.
import { readFile, writeFile } from 'node:fs/promises';
import { makeClient } from '../docs/js/api.js';
import { publicRecord } from '../docs/js/data.js';
const root = new URL('../review-work/redwood-trial-25/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const baseline = process.argv.includes('--baseline');
const rows = baseline ? [] : (await readFile(new URL('reviews.jsonl', root), 'utf8')).trim().split('\n').map(JSON.parse);
if (!baseline && (rows.length !== 25 || new Set(rows.map(r => r.observation_id)).size !== 25 ||
  rows.some(r => !manifest.observations.some(o => o.observation_id === r.observation_id) ||
    r.verified_fields.length !== 4 || Object.entries(config.fields).some(([key, f]) =>
      !r.verified_fields.some(v => v.field_id === f.id && v.value === r[key].value))))) {
  throw new Error('Verification requires exactly 25 distinct reviews with all four expected field values.');
}
const destination = new URL(baseline ? 'baseline.json' : 'api-verification.json', root);
if (baseline) { try { await readFile(destination); throw new Error('Baseline exists; preserve it.'); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
const request = makeClient(), records = [];
for (const o of manifest.observations) {
  const result = await request(`https://api.inaturalist.org/v1/observations/${o.observation_id}`);
  if (result.results.length !== 1 || result.results[0].id !== o.observation_id) throw new Error(`Missing observation ${o.observation_id}`);
  records.push(publicRecord(result.results[0]));
}
const result = { checked_at: new Date().toISOString(), source: 'iNaturalist public observation-detail API', records };
if (!baseline) {
  result.mismatches = rows.flatMap(r => r.verified_fields.filter(f => !records.find(o => o.id === r.observation_id)?.ofvs.some(v => v.field_id === f.field_id && v.value === f.value)).map(f => ({ observation_id: r.observation_id, ...f })));
  const before = JSON.parse(await readFile(new URL('baseline.json', root), 'utf8'));
  result.previousFieldChanges = before.records.flatMap(o => o.ofvs.filter(f =>
    !records.find(r => r.id === o.id)?.ofvs.some(v => v.field_id === f.field_id && v.value === f.value))
    .map(f => ({ observation_id: o.id, ...f })));
  result.unexpectedNewFields = records.flatMap(o => o.ofvs.filter(f =>
    !before.records.find(r => r.id === o.id)?.ofvs.some(v => v.field_id === f.field_id && v.value === f.value) &&
    !rows.find(r => r.observation_id === o.id)?.verified_fields.some(v => v.field_id === f.field_id && v.value === f.value))
    .map(f => ({ observation_id: o.id, ...f })));
  result.expectedValues = rows.reduce((sum, r) => sum + r.verified_fields.length, 0);
  if (result.mismatches.length || result.previousFieldChanges.length || result.unexpectedNewFields.length) process.exitCode = 1;
}
await writeFile(destination, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mode: baseline ? 'baseline' : 'verification', records: records.length, expectedValues: result.expectedValues, mismatches: result.mismatches, previousFieldChanges: result.previousFieldChanges, unexpectedNewFields: result.unexpectedNewFields, photoChanges: records.filter(o => o.photos.map(p => p.id).sort().join(',') !== manifest.observations.find(m => m.observation_id === o.id).photos.map(p => p.id).sort().join(',')).map(o => o.id) }));
