import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const docs = new URL('../docs/', import.meta.url);
test('bundled Leaflet matches the official 1.9.4 integrity hashes', async () => {
  for (const [file, expected] of [['leaflet.js', '20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='], ['leaflet.css', 'p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=']]) {
    const bytes = await readFile(new URL(`vendor/${file}`, docs));
    assert.equal(createHash('sha256').update(bytes).digest('base64'), expected);
  }
});
test('all local HTML assets exist and remain relative for project Pages', async () => {
  for (const page of ['index.html', 'credits.html', 'calibration.html']) {
    const html = await readFile(new URL(page, docs), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(v => !v.startsWith('#') && !v.startsWith('https://'));
    for (const ref of refs) { assert.ok(!ref.startsWith('/'), `${page}: absolute path ${ref}`); assert.ok((await stat(new URL(ref, docs))).isFile(), ref); }
  }
});
test('public snapshot is real, deduplicated, stripped of private coordinates, and fully fetched', async () => {
  const data = JSON.parse(await readFile(new URL('data/observations.json', docs), 'utf8'));
  assert.ok(data.fetchedAt); assert.equal(data.complete, true); assert.ok(data.source.includes('iNaturalist'));
  const config = JSON.parse(await readFile(new URL('data/project.json', docs), 'utf8'));
  assert.equal(data.protocolVersion, config.protocolVersion);
  assert.deepEqual(data.fields.map(f => f.id).sort(), Object.values(config.fields).map(f => f.id).sort());
  assert.equal(new Set(data.records.map(o => o.id)).size, data.records.length);
  for (const o of data.records) { assert.ok(o.id > 1); assert.ok(o.ofvs.length > 0); assert.ok(!('private_geojson' in o)); assert.ok(!('private_location' in o)); }
});
test('new field configuration, schema, and display categories agree', async () => {
  const { TRAITS, normalize } = await import('../docs/js/data.js');
  const config = JSON.parse(await readFile(new URL('data/project.json', docs), 'utf8'));
  const schema = JSON.parse(await readFile(new URL('data/review.schema.json', docs), 'utf8'));
  assert.equal(schema.properties.protocol_version.const, config.protocolVersion);
  assert.deepEqual(Object.keys(config.fields), Object.keys(TRAITS));
  assert.equal(new Set(Object.values(config.fields).map(f => f.id)).size, 4);
  for (const [key, field] of Object.entries(config.fields)) {
    assert.match(field.name, /^Redwood Sorrel /); assert.doesNotMatch(field.name, /\bv\d|experimental/i);
    assert.ok(field.values.includes('Cannot be determined'));
    assert.deepEqual(field.values.map(normalize), [...Object.keys(TRAITS[key].options), 'cannot be determined']);
    assert.deepEqual(schema.$defs[key].allOf[1].properties.value.enum, [...field.values, null]);
    const anchors = Object.values(config.figure1Anchors[key]).flat();
    assert.equal(new Set(anchors).size, anchors.length);
    if (['color','veins'].includes(key)) assert.equal(anchors.length, 16);
  }
});
