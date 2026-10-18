// Read-only public API reconciliation of the explicitly reviewed ring corrections.
import { readFile, writeFile } from 'node:fs/promises';
import { makeClient } from '../docs/js/api.js';
import { publicRecord } from '../docs/js/data.js';
import { validateReview } from './review-validation.mjs';
const working = new URL('../review-work/redwood-trial-25/', import.meta.url);
const docs = new URL('../docs/', import.meta.url);
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const config = await readJson(new URL('data/project.json', docs));
const revision = await readJson(new URL('ring-revision/changes.json', working));
const before = await readJson(new URL('api-verification.json', working));
const original = (await readFile(new URL('data/trial-25-2026-10-18.jsonl', docs), 'utf8')).trim().split('\n').map(JSON.parse);
if (revision.protocol_version !== config.protocolVersion || revision.field_id !== config.fields.ring.id ||
    before.records.length !== 25 || original.length !== 25 || revision.changes.length !== 9 ||
    new Set(revision.changes.map(c => c.observation_id)).size !== 9) throw Error('Unexpected revision scope');
for (const c of revision.changes) {
  if (!config.fields.ring.values.includes(c.after) || !c.ui_verified_at ||
      original.find(r => r.observation_id === c.observation_id)?.ring.value !== c.before) throw Error('Unreviewed or mismatched change');
}
const request = makeClient(), records = [];
for (const r of original) {
  const data = await request(`https://api.inaturalist.org/v1/observations/${r.observation_id}`);
  if (data.results.length !== 1 || data.results[0].id !== r.observation_id) throw Error(`Missing observation ${r.observation_id}`);
  records.push(publicRecord(data.results[0]));
}
const same = (a, b) => a.field_id === b.field_id && a.value === b.value;
const errors = [];
for (const r of original) {
  const current = records.find(o => o.id === r.observation_id);
  const previous = before.records.find(o => o.id === r.observation_id);
  const change = revision.changes.find(c => c.observation_id === r.observation_id);
  const expected = previous.ofvs.map(f => change && f.field_id === revision.field_id ? { ...f, value: change.after } : f);
  for (const f of expected) if (!current.ofvs.some(v => same(v, f))) errors.push({ observation_id: r.observation_id, missing: f });
  for (const f of current.ofvs) if (!expected.some(v => same(v, f))) errors.push({ observation_id: r.observation_id, unexpected: f });
  if (current.photos.map(p => p.id).sort().join(',') !== previous.photos.map(p => p.id).sort().join(',')) errors.push({ observation_id: r.observation_id, photo_list_changed: true });
}
const verified_at = new Date().toISOString();
await writeFile(new URL('ring-revision/api-verification.json', working), JSON.stringify({ verified_at, source: 'iNaturalist public observation-detail API; unauthenticated', records, errors }, null, 2) + '\n');
if (errors.length) { console.error(JSON.stringify(errors)); process.exitCode = 1; }
else {
  const audits = revision.changes.map(c => {
    const r = structuredClone(original.find(o => o.observation_id === c.observation_id));
    r.protocol_version = config.protocolVersion;
    r.reviewed_at = c.ui_verified_at;
    r.reviewer = 'Codex ring-only reassessment following user feedback; color, veins and variation retained from the original protocol 2.0.0 trial, not freshly rescored here';
    r.ring = { ...r.ring, value: c.after, status: c.after === 'Cannot be determined' ? 'cannot_be_determined' : 'scored', confidence: c.after === 'Cannot be determined' ? 'not_applicable' : 'high', reason: c.reason };
    r.existing_fields = before.records.find(o => o.id === r.observation_id).ofvs.map(({ field_id, value }) => ({ field_id, value }));
    r.verified_fields = [{ field_id: revision.field_id, value: c.after, verified_at }];
    r.write_status = 'verified';
    const problems = validateReview(r, config);
    if (problems.length) throw Error(problems.join('; '));
    return r;
  });
  await writeFile(new URL('data/ring-revision-2026-10-18.jsonl', docs), audits.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ verified_at, observations_checked: 25, project_values_checked: 100, ring_values_changed: 9, unrelated_field_changes: 0, photo_changes: 0, errors }));
}
