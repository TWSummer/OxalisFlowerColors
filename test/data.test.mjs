import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readField, coordinates, publicRecord, classify, summarizeTrait, filterRecords, photoUrl, csvCell, recordsCsv } from '../docs/js/data.js';
import { fetchFieldRecords, makeClient } from '../docs/js/api.js';
import { validateReview } from '../scripts/review-validation.mjs';
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const example = JSON.parse(await readFile(new URL('../docs/data/review.example.json', import.meta.url), 'utf8'));
const observation = (id, color = 'White') => ({ id, taxon: { id: 47757, name: 'Oxalis oregana', ancestor_ids: [] }, ofvs: [{ field_id: config.fields.color.id, value: color }], geojson: { type: 'Point', coordinates: [-123, 44] }, captive: false, quality_grade: 'research', observed_on: '2026-04-01' });
test('normalizes only known values; no invented lavender mapping or unknown default', () => {
  assert.deepEqual(readField([{ field_id: config.fields.color.id, value: ' White ' }], config.fields.color.id, config.fields.color.values), { value: 'white', state: 'valid' });
  for (const color of ['blue', 'lavender', 'unknown', '', 'n/a']) assert.equal(classify(observation(1, color), config).color, null);
  assert.equal(classify({ ...observation(1), ofvs: [] }, config).color, null);
});
test('duplicate agreeing values deduplicate; disagreements never become a color', () => {
  const o = observation(1); o.ofvs.push({ field_id: config.fields.color.id, value: 'white' }); assert.equal(classify(o, config).color, 'white');
  o.ofvs.push({ field_id: config.fields.color.id, value: 'pink' }); assert.equal(classify(o, config).colorState, 'conflict');
});
test('old fields never supply or override new labels', () => {
  const o = observation(1); o.ofvs.push({ field_id: 43, value: 'pink' }, { field_id: 8625, value: 'purple' }, { field_id: 23007, value: 'conspicuous' });
  assert.equal(classify(o, config).color, 'white'); assert.equal(classify(o, config).veins, null);
  o.ofvs.shift(); assert.equal(classify(o, config).color, null);
});
test('never falls back to private coordinates; accepts zero and rejects invalid positions', () => {
  assert.equal(coordinates({ private_geojson: { coordinates: [12, 34] } }), null);
  for (const c of [[181, 30], [1, -91], ['1', 4], [NaN, 4], [null, 3], []]) assert.equal(coordinates({ geojson: { coordinates: c } }), null);
  assert.deepEqual(coordinates({ geojson: { coordinates: [0, 0] } }), [0, 0]);
  const scrubbed = publicRecord({ ...observation(1), private_location: 'secret', private_geojson: { coordinates: [10, 20] }, ofvs: [{ field_id: 1, name: 'a', value: 'b', user: { email: 'private' } }] });
  assert.equal(JSON.stringify(scrubbed).includes('secret'), false); assert.equal(JSON.stringify(scrubbed).includes('email'), false);
  assert.equal(publicRecord({ ...observation(1), taxon_geoprivacy: 'obscured' }).obscured, true);
});
test('filters respect taxa, descendants, unknown cultivation, grade, dates', () => {
  const a = classify(observation(1), config), b = classify({ ...observation(2), captive: null }, config), c = classify({ ...observation(3), taxon: { id: 123, ancestor_ids: [1464017] } }, config);
  assert.equal(c.taxonId, 1464017);
  assert.equal(filterRecords([a, b, c], { captive: 'wild' }).length, 2);
  assert.equal(filterRecords([a, b, c], { species: '1464017' }).length, 1);
  assert.equal(filterRecords([a], { from: '2026-05-01' }).length, 0);
  assert.equal(filterRecords([a], { grade: 'needs_id' }).length, 0);
  assert.equal(filterRecords([classify({ ...observation(4), taxon: { id: 3 } }, config)], {}).length, 0);
});
test('each trait is independent and indeterminate is distinct from missing and conflicting', () => {
  for (const [key, field] of Object.entries(config.fields)) {
    const o = observation(1); o.ofvs = [{ field_id: field.id, value: 'Cannot be determined' }];
    const c = classify(o, config); assert.equal(c[key], 'cannot be determined'); assert.equal(c[`${key}State`], 'undetermined');
    for (const other of Object.keys(config.fields).filter(k => k !== key)) assert.equal(c[other], null);
    o.ofvs.push({ field_id: field.id, value: field.values[0] }); assert.equal(classify(o, config)[`${key}State`], 'conflict');
  }
});
test('chart denominators count only assessable labels, without requiring map coordinates', () => {
  const fixtures = [observation(1), {...observation(2,'Pink'),geojson:null}, observation(3,'Cannot be determined'), {...observation(4),ofvs:[]}, observation(5,'invalid'), {...observation(6),ofvs:[{field_id:config.fields.color.id,value:'White'},{field_id:config.fields.color.id,value:'Pink'}]}];
  const summary=summarizeTrait(fixtures.map(o=>classify(o,config)),'color');
  assert.deepEqual(summary,{counts:{white:1,pink:1,purple:0},assessable:2,undetermined:1,missing:1,conflict:1,unrecognized:1,total:6});
  assert.equal(summarizeTrait([],'ring').assessable,0);
});

test('ring revision counts Faint and Clear separately and never translates old Present', () => {
  const values = ['Absent', 'Faint', 'Clear', 'Cannot be determined', 'Present'];
  const rows = values.map((value, i) => classify({ ...observation(i + 1), ofvs: [{ field_id: config.fields.ring.id, value }] }, config));
  assert.deepEqual(summarizeTrait(rows, 'ring'), { counts: { absent: 1, faint: 1, clear: 1 }, assessable: 3, undetermined: 1, missing: 0, conflict: 0, unrecognized: 1, total: 5 });
  assert.equal(rows[4].ring, null);
  assert.equal(rows[4].ringState, 'unrecognized');
});
test('photo URLs require recognized licenses and trusted HTTPS hosts', () => {
  assert.equal(photoUrl({ url: 'https://static.inaturalist.org/photos/1/square.jpg', license_code: null }), null);
  assert.equal(photoUrl({ url: 'javascript:alert(1)', license_code: 'cc0' }), null);
  assert.equal(photoUrl({ url: 'https://evil.test/square.jpg', license_code: 'cc0' }), null);
  assert.equal(photoUrl({ url: 'https://static.inaturalist.org/photos/1/square.jpg', license_code: 'cc0' }), 'https://static.inaturalist.org/photos/1/medium.jpg');
});
test('CSV quotes special characters and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell(-123.5), '"-123.5"');
  const csv = recordsCsv([classify(observation(1), config)]);
  assert.ok(csv.includes('longitude_public')); assert.ok(csv.includes('https://www.inaturalist.org/observations/1'));
});
test('cursor pagination crosses 10,000 results and deduplicates field queries', async () => {
  let calls = 0;
  const request = async url => {
    calls++; const params = new URL(url).searchParams; assert.equal(params.get('verifiable'), 'any'); assert.equal(params.get('order_by'), 'id');
    const cursor = Number(params.get('id_above'));
    if (!params.has(`field:${config.fields.color.name}`)) return { results: [observation(1)] };
    const length = Math.min(200, Math.max(0, 10205 - cursor));
    return { results: Array.from({ length }, (_, i) => observation(cursor + i + 1)) };
  };
  const data = await fetchFieldRecords(config, { request });
  assert.equal(data.records.length, 10205); assert.equal(data.complete, true);
  assert.equal(calls, 52 + 3);
});
test('partial limit is explicit and stuck pagination fails', async () => {
  const full = Array.from({ length: 200 }, (_, i) => observation(i + 1));
  const partial = await fetchFieldRecords(config, { request: async () => ({ results: full }), maxPages: 1 });
  assert.equal(partial.complete, false);
  await assert.rejects(fetchFieldRecords(config, { request: async () => ({ results: full }) }), /did not advance/);
});
test('429 honors retry delay and retries; nonretryable errors remain errors', async () => {
  let n = 0; const delays = [];
  const request = makeClient({ interval: 0, pause: async ms => delays.push(ms), fetcher: async () => ++n === 1 ? { status: 429, ok: false, headers: { get: () => '3' } } : { status: 200, ok: true, json: async () => ({ results: [] }) } });
  await request('https://example.test'); assert.equal(n, 2); assert.ok(delays.includes(3000));
  const bad = makeClient({ interval: 0, pause: async () => {}, fetcher: async () => ({ status: 403, ok: false }) });
  await assert.rejects(bad('https://example.test'), /403/);
});
test('review audit rejects insufficient visual evidence, fake verifications, and leaked fields', () => {
  assert.deepEqual(validateReview(example, config), []);
  const low = structuredClone(example); low.color.evidence[0].source_diameter_px = 70; assert.ok(validateReview(low, config).length);
  const fake = structuredClone(example); fake.write_status = 'verified'; assert.ok(validateReview(fake, config).length);
  const unsafe = structuredClone(example); unsafe.token = 'secret'; assert.ok(validateReview(unsafe, config).some(x => x.includes('not allowed')));
  for (const key of ['veins','variation']) { const bad = structuredClone(example); bad[key].evidence[0].assessment_diameter_px = 600; assert.ok(validateReview(bad, config).length); }
});
test('audit accepts verified indeterminate outcomes and rejects fabricated or mismatched ones', () => {
  const r = structuredClone(example); r.write_status='verified'; r.verified_fields=[{field_id:config.fields.ring.id,value:'Cannot be determined',verified_at:r.reviewed_at}];
  assert.deepEqual(validateReview(r,config),[]);
  r.ring.evidence=[]; assert.ok(validateReview(r,config).length);
  const bad=structuredClone(example); bad.ring.status='no_open_flower'; assert.ok(validateReview(bad,config).length);
  const fake=structuredClone(example); fake.write_status='verified'; fake.verified_fields=[{field_id:8625,value:'White',verified_at:fake.reviewed_at}]; assert.ok(validateReview(fake,config).length);
});
