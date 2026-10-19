import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { categoryId, licenseLabel, validateGuide } from '../docs/js/photo-guide.js';
import { jpegDimensions } from '../scripts/build-photo-guide.mjs';

function fixture() {
  const example = { observationId: 123, photoId: 456, src: 'assets/photo-guide/example.jpg', alt: 'An open flower', title: 'A category boundary', caption: 'The feature establishing this category.', attribution: 'Photograph by Example Creator', licenseCode: 'cc-by-nc', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/', photoUrl: 'https://www.inaturalist.org/photos/456', observationUrl: 'https://www.inaturalist.org/observations/123', cropNote: 'Cropped around the flower; no color adjustment.' };
  return { protocolVersion: '2.1.0', reviewedAt: '2026-10-18', introduction: 'A reviewed example collection.', traits: ['color', 'veins', 'ring', 'variation'].map((key, i) => ({ key, label: key, fieldId: 23008 + i, summary: 'A trait definition.', categories: [{ value: 'Example', definition: 'A category definition.', examples: [structuredClone(example)] }, { value: 'Cannot be determined', definition: 'Evidence is inadequate.', examples: [] }] })) };
}

test('guide deep links distinguish shared category names across traits', () => {
  assert.equal(categoryId('veins', 'Cannot be determined'), 'veins-cannot-be-determined');
  assert.notEqual(categoryId('variation', 'Low'), categoryId('veins', 'Low'));
});

test('only the photo licenses authorized for this guide are accepted', () => {
  assert.deepEqual(['cc0', 'cc-by', 'cc-by-nc'].map(licenseLabel), ['CC0', 'CC BY', 'CC BY-NC']);
  for (const code of ['cc-by-sa', 'cc-by-nc-sa', 'cc-by-nd', 'all-rights-reserved', null]) {
    const data = fixture();
    data.traits[0].categories[0].examples[0].licenseCode = code;
    assert.throws(() => validateGuide(data), /Unsupported photo license/);
  }
});

test('a guide may have empty categories but requires attribution and usable source links', () => {
  const data = fixture();
  assert.equal(validateGuide(data), data);
  for (const name of ['attribution', 'cropNote', 'licenseUrl', 'photoUrl', 'observationUrl']) {
    const incomplete = fixture();
    incomplete.traits[0].categories[0].examples[0][name] = '';
    assert.throws(() => validateGuide(incomplete), /Missing/);
  }
  const unsafe = fixture();
  unsafe.traits[0].categories[0].examples[0].photoUrl = 'javascript:alert(1)';
  assert.throws(() => validateGuide(unsafe), /Invalid photoUrl/);
});

test('guide rejects duplicate anchor targets and images that break repository Pages paths', () => {
  const duplicate = fixture();
  duplicate.traits[0].categories.push(structuredClone(duplicate.traits[0].categories[0]));
  assert.throws(() => validateGuide(duplicate), /Duplicate category/);
  for (const src of ['/assets/example.jpg', '../example.jpg', 'https://example.org/image.jpg', 'assets/../example.jpg']) {
    const invalid = fixture();
    invalid.traits[0].categories[0].examples[0].src = src;
    assert.throws(() => validateGuide(invalid), /project-relative asset/);
  }
});

test('small-source examples retain a bounded optional display size', () => {
  for (const displaySize of [undefined, 100, 155, 300]) {
    const data = fixture();
    data.traits[0].categories[0].examples[0].displaySize = displaySize;
    assert.equal(validateGuide(data), data);
  }
  for (const displaySize of [99, 301, 155.5, '155', null]) {
    const data = fixture();
    data.traits[0].categories[0].examples[0].displaySize = displaySize;
    assert.throws(() => validateGuide(data), /displaySize/);
  }
});

test('an optional exact observation field name must be nonempty text', () => {
  const data = fixture();
  data.traits[0].fieldName = 'Redwood Sorrel Petal Color';
  assert.equal(validateGuide(data), data);
  data.traits[0].fieldName = '';
  assert.throws(() => validateGuide(data), /field name/);
});

test('the published photographic guide matches its licensed asset provenance and reviewed values', async () => {
  const readJson = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
  const guide = validateGuide(await readJson('../docs/data/photo-guide.json'));
  const provenance = await readJson('../docs/data/photo-guide-assets.json');
  const config = await readJson('../docs/data/project.json');
  const assets = new Map(provenance.assets.map(asset => [asset.src, asset]));
  assert.equal(assets.size, provenance.assets.length, 'One provenance entry per unique image');
  assert.equal(guide.protocolVersion, config.protocolVersion);
  for (const trait of guide.traits) {
    assert.equal(trait.fieldId, config.fields[trait.key].id);
    assert.equal(trait.fieldName, config.fields[trait.key].name);
    assert.deepEqual(trait.categories.map(category => category.value), config.fields[trait.key].values);
    for (const category of trait.categories) for (const example of category.examples) {
      const asset = assets.get(example.src);
      assert.ok(asset, `Missing provenance for ${example.src}`);
      assert.equal(asset.photoId, example.photoId);
      assert.equal(asset.observationId, example.observationId);
      assert.equal(asset.reviewedValues[trait.key], category.value);
      for (const key of ['attribution', 'licenseCode', 'licenseUrl', 'photoUrl', 'observationUrl', 'displaySize']) assert.equal(example[key], asset[key]);
      assert.ok(provenance.uses.some(use => use.trait === trait.key && use.value === category.value && use.src === example.src));
    }
  }
  for (const asset of assets.values()) {
    const bytes = await readFile(new URL(`../docs/${asset.src}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.deepEqual(jpegDimensions(bytes), asset.pixelDimensions);
    assert.ok(asset.displaySize <= Math.min(asset.pixelDimensions.width, asset.focalEvidence.source_diameter_px));
    assert.ok(licenseLabel(asset.licenseCode));
    assert.equal(asset.focalEvidence.photo_id, asset.photoId);
    assert.ok(asset.licenseCheckedAt);
  }
});

test('guide categories and license credits match local re-review inputs when those inputs are available', async t => {
  const base = new URL('../review-work/guide-review-2026-10-18/', import.meta.url);
  let decisions, baseline;
  try {
    decisions = JSON.parse(await readFile(new URL('decisions.json', base), 'utf8'));
    baseline = JSON.parse(await readFile(new URL('baseline.json', base), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return t.skip('Local review inputs are intentionally not included in the public repository.');
    throw error;
  }
  const guide = JSON.parse(await readFile(new URL('../docs/data/photo-guide.json', import.meta.url), 'utf8'));
  for (const trait of guide.traits) for (const category of trait.categories) for (const example of category.examples) {
    const decision = decisions.find(record => record.observation_id === example.observationId);
    const photo = baseline.records.find(record => record.id === example.observationId)?.photos.find(photo => photo.id === example.photoId);
    assert.equal(decision?.values[trait.key], category.value);
    assert.equal(photo?.license_code, example.licenseCode);
    assert.equal(photo?.attribution, example.attribution);
    assert.ok(decision.examined_photo_ids.includes(example.photoId));
  }
});
