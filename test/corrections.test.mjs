import test from 'node:test';
import assert from 'node:assert/strict';
import {currentWrites, correctedReview} from '../scripts/calibration-corrections.mjs';

const original = {
  observation_id: 123, protocol_version: '1.0.0', reviewed_at: '2026-10-18T03:00:00Z',
  color: {value:'blue', status:'scored', confidence:'high', reason:'Original judgment', evidence:[]},
  veins: {value:'conspicuous'}, write_status:'verified',
  verified_fields:[{field_id:8625,value:'blue'},{field_id:23007,value:'conspicuous'}]
};
const writes = original.verified_fields.map(f=>({observation_id:123,...f}));
const correction = {
  observation_id:123, field_id:8625, previous_value:'blue', status:'proposed',
  protocol_version:'1.1.0', reviewed_at:'2026-10-18T05:00:00Z', reason:'White/blue unresolved'
};

test('proposed withdrawals never masquerade as completed external changes', () => {
  assert.deepEqual(currentWrites(writes,[correction]),writes);
  assert.deepEqual(correctedReview(original,[correction]),original);
});

test('verified withdrawal preserves the original judgment and independent vein field', () => {
  const done={...correction,status:'verified',submitted_at:'2026-10-18T05:01:00Z',verified_at:'2026-10-18T05:02:00Z'};
  const changed=correctedReview(original,[done]);
  assert.equal(changed.color.value,null);
  assert.equal(changed.color.status,'uncertain_color');
  assert.equal(changed.protocol_version,'1.1.0');
  assert.equal(original.color.value,'blue');
  assert.deepEqual(changed.veins,original.veins);
  assert.deepEqual(changed.verified_fields,[original.verified_fields[1]]);
  assert.deepEqual(currentWrites(writes,[done]),[writes[1]]);
  const colorOnly={...original,verified_fields:[original.verified_fields[0]]};
  assert.equal(correctedReview(colorOnly,[done]).write_status,'withdrawn');
  assert.throws(()=>correctedReview(original,[{...done,previous_value:'white'}]));
  assert.throws(()=>correctedReview(original,[{...done,verified_at:null}]));
});
