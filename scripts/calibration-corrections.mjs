// Apply only verified field withdrawals to the public audit; preserve original decisions.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function loadCorrections(root) {
  try { return JSON.parse(await readFile(new URL('corrections.json', root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export function currentWrites(writes, corrections) {
  return writes.filter(w => !corrections.some(c => c.status === 'verified' && c.observation_id === w.observation_id && c.field_id === w.field_id));
}

export function correctedReview(review, corrections) {
  const result = structuredClone(review);
  for (const c of corrections.filter(c => c.status === 'verified' && c.observation_id === review.observation_id)) {
    assert.equal(c.field_id, 8625, 'This correction pass only withdraws color labels');
    assert.equal(c.previous_value, result.color.value);
    assert.ok(c.verified_at && c.submitted_at, 'A correction needs submission and public API verification');
    result.color = {...result.color, value: null, status: 'uncertain_color', confidence: 'not_applicable', reason: c.reason};
    result.protocol_version = c.protocol_version;
    result.reviewed_at = c.reviewed_at;
    result.verified_fields = result.verified_fields.filter(f => f.field_id !== c.field_id);
    if (!result.verified_fields.length) result.write_status = 'withdrawn';
  }
  return result;
}
