// Export real manual judgments and verified writes; never manufacture atlas labels.
import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadCorrections, currentWrites, correctedReview} from './calibration-corrections.mjs';
const root = new URL('../review-work/calibration-2026-10/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const [manifest, decisions, originalWrites, blocked, verification] = await Promise.all(
  ['manifest.json', 'decisions.json', 'writes.json', 'blocked.json', 'api-verification.json'].map(json));
const originalReviews = (await readFile(new URL('reviews.jsonl', root), 'utf8')).trim().split('\n').map(JSON.parse);
const corrections = await loadCorrections(root);
assert.ok(corrections.every(c => ['proposed','verified'].includes(c.status)), 'Verify submitted corrections before exporting');
const writes = currentWrites(originalWrites, corrections);
const reviews = originalReviews.map(r => correctedReview(r, corrections));
assert.equal(reviews.length, 100);
assert.equal(new Set(reviews.map(r => r.observation_id)).size, 100);
assert.equal(verification.records.length, 100);
assert.equal(verification.missing.length, 0, 'Resolve missing persisted values before exporting');
assert.equal(verification.failed_withdrawals?.length || 0, 0, 'Resolve failed withdrawals before exporting');
for (const c of corrections.filter(c => c.status === 'verified')) {
  assert.ok(!verification.records.find(r => r.id === c.observation_id)?.ofvs.some(f => f.field_id === c.field_id), 'Withdrawn color remains in API response');
}
assert.equal(new Set(writes.map(w => `${w.observation_id}:${w.field_id}`)).size, writes.length);
const rows = reviews.map((r, i) => {
  const d = decisions[i], o = manifest.observations[i];
  assert.equal(d.index, i + 1);
  assert.equal(r.observation_id, o.observation_id);
  assert.equal(verification.records.find(v => v.id === o.observation_id)?.taxon.id, o.taxon_id);
  const blockedReason = blocked.find(b => b.observation_id === o.observation_id);
  for (const [trait, field] of [['color', 8625], ['veins', 23007]]) {
    const saved = writes.find(w => w.observation_id === o.observation_id && w.field_id === field);
    if (r[trait].value) assert.ok(saved || blockedReason, `Eligible value not handled: ${o.observation_id}`);
    if (saved) {
      assert.equal(saved.value, r[trait].value);
      assert.ok(verification.records.find(v => v.id === o.observation_id).ofvs.some(f => f.field_id === field && f.value === saved.value));
    }
  }
  return {...r, index: d.index, crop: d.crop, branching_note: d.branching,
    vein_color_note: d.vein_color_note || null, timestamp_note: d.timestamp_note || null,
    revisions: corrections.filter(c => c.observation_id === o.observation_id).map(c => ({...c, original_color: originalReviews[i].color})),
    blocked_reason: blockedReason ? 'Observer only allows site curators to add observation fields' : null,
    api_verified_at: r.verified_fields.length ? verification.verified_at : null};
});
const tally = values => Object.fromEntries([...new Set(values)].map(v => [v, values.filter(x => x === v).length]));
const pools = await Promise.all([47757,1464017].map(async taxon => {
  const pool = await json(`pool-${taxon}.json`);
  return {taxon_id: taxon, candidates: pool.length, sampled: 50, max_observation_id: Math.max(...pool.map(o => o.observation_id))};
}));
const examples = [4,14,80,81,94].map(index => {
  const d = decisions[index - 1], o = manifest.observations[index - 1];
  const photos = index === 81 ? o.photos : o.photos.filter(p => p.id === d.photo_id);
  return {index, observation_id: o.observation_id, photos};
});
const result = {
  title: 'October 2026 Oxalis feasibility pilot', protocol_version: corrections.length ? '1.1.0' : '1.0.0',
  original_protocol_version: '1.0.0', original_audit: 'calibration-2026-10-v1.0.0.json',
  corrections,
  reviewer: 'Codex, one AI reviewer; no independent human or second-rater validation',
  sampled_at: manifest.created_at, api_verified_at: verification.verified_at,
  seed: manifest.seed, sampling_method: manifest.method, pools,
  notes: ['All 174 photographs were inspected in observation sheets; selected source crops were examined at a 300px square view without sharpening or recoloring.',
    'Crop widths are approximate manual flower diameters. Color-only crops below 300 source pixels do not support vein scores.',
    'Vein-hue notes began partway through the review and are exploratory, not a systematic hue census.',
    'The owner authorized pilot field additions before independent validation. The reliability gate is not met.',
    'Initial in-page confirmations were reconciled against fresh pages and the public observation detail API; only final unique saved values are counted.',
    'The v1.1.0 source-paper recheck screened all 74 available selected crops, including all 52 original color judgments, against Figure 1; all source-photo sheets were reopened for the seven revised cases. This was a targeted self-review, not a second full independent review.',
    'Unchanged records retain protocol version 1.0.0. Corrected records carry 1.1.0; the original audit and each original color judgment are preserved. No author clarification or author-labeled original image set has been obtained.'],
  counts: {reviewed: rows.length, photos: manifest.observations.reduce((s,o)=>s+o.photos.length,0),
    observations_with_writes: rows.filter(r=>r.verified_fields.length).length, field_values_written: writes.length,
    originally_written: originalWrites.length, values_withdrawn: corrections.filter(c=>c.status==='verified').length,
    blocked_observations: blocked.length, no_eligible_traits: rows.filter(r=>!r.color.value&&!r.veins.value).length,
    color_scored: tally(rows.filter(r=>r.color.value).map(r=>r.color.value)),
    color_abstentions: tally(rows.filter(r=>!r.color.value).map(r=>r.color.status)),
    veins_scored: tally(rows.filter(r=>r.veins.value).map(r=>r.veins.value)),
    veins_abstentions: tally(rows.filter(r=>!r.veins.value).map(r=>r.veins.status)),
    color_written: tally(writes.filter(w=>w.field_id===8625).map(w=>w.value)),
    veins_written: tally(writes.filter(w=>w.field_id===23007).map(w=>w.value))},
  examples, records: rows
};
await writeFile(new URL('../docs/data/calibration-2026-10.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
await writeFile(new URL('reviews-current.jsonl', root), reviews.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(JSON.stringify(result.counts, null, 2));
