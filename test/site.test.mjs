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
  assert.equal(new Set(data.records.map(o => o.id)).size, data.records.length);
  for (const o of data.records) { assert.ok(o.id > 1); assert.ok(o.ofvs.length > 0); assert.ok(!('private_geojson' in o)); assert.ok(!('private_location' in o)); }
});
