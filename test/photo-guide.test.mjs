import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { categoryId, licenseLabel, validateGuide } from '../docs/js/photo-guide.js';
import { jpegDimensions, mergeReviewDecisions } from '../scripts/build-photo-guide.mjs';

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
  const targetedAudit = (await readFile(new URL('../docs/data/targeted-examples-2026-10-18.jsonl', import.meta.url), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
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
      if (asset.sourceKind === 'targeted-follow-up') {
        assert.equal(example.fieldWriteStatus, asset.fieldWriteStatus);
        assert.equal(example.publicAuditSource, asset.publicAuditSource);
        assert.equal(asset.publicAuditSource, 'data/targeted-examples-2026-10-18.jsonl');
        assert.ok(['verified', 'blocked'].includes(asset.fieldWriteStatus));
        if (asset.fieldWriteStatus === 'blocked') assert.match(example.caption, /Scored reference only: observation fields were not submitted because the observer restricts additions to site curators\./);
      }
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
    if (asset.sourceKind === 'targeted-follow-up') {
      const review = targetedAudit.find(record => record.observation_id === asset.observationId);
      assert.equal(review?.write_status, asset.fieldWriteStatus, 'Published audit distinguishes saved labels from blocked references');
      for (const key of Object.keys(config.fields)) assert.equal(review[key].value, asset.reviewedValues[key]);
      if (asset.fieldWriteStatus === 'blocked') assert.deepEqual(review.verified_fields, []);
      else for (const [key, field] of Object.entries(config.fields)) assert.ok(review.verified_fields.some(item => item.field_id === field.id && item.value === asset.reviewedValues[key]));
    }
  }
});

test('guide categories and license credits match local re-review inputs when those inputs are available', async t => {
  const base = new URL('../review-work/guide-review-2026-10-18/', import.meta.url);
  const ringBase = new URL('../review-work/ring-edge-review-2026-10-18/', import.meta.url);
  const targetedBase = new URL('../review-work/targeted-examples-2026-10-18/', import.meta.url);
  let decisions, baseline, ringDecisions, ringBaseline, targetedDecisions, targetedManifest, targetedReviews;
  try {
    decisions = JSON.parse(await readFile(new URL('decisions.json', base), 'utf8'));
    baseline = JSON.parse(await readFile(new URL('baseline.json', base), 'utf8'));
    ringDecisions = JSON.parse(await readFile(new URL('decisions.json', ringBase), 'utf8'));
    ringBaseline = JSON.parse(await readFile(new URL('baseline.json', ringBase), 'utf8'));
    targetedDecisions = JSON.parse(await readFile(new URL('decisions.json', targetedBase), 'utf8'));
    targetedManifest = JSON.parse(await readFile(new URL('manifest.json', targetedBase), 'utf8'));
    targetedReviews = (await readFile(new URL('reviews.jsonl', targetedBase), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return t.skip('Local review inputs are intentionally not included in the public repository.');
    throw error;
  }
  const guide = JSON.parse(await readFile(new URL('../docs/data/photo-guide.json', import.meta.url), 'utf8'));
  const provenance = JSON.parse(await readFile(new URL('../docs/data/photo-guide-assets.json', import.meta.url), 'utf8'));
  for (const trait of guide.traits) for (const category of trait.categories) for (const example of category.examples) {
    const asset = provenance.assets.find(asset => asset.src === example.src);
    if (asset.sourceKind === 'targeted-follow-up') {
      const decision = targetedDecisions.find(record => record.observation_id === example.observationId);
      const record = targetedManifest.observations.find(record => record.observation_id === example.observationId);
      const photo = record?.photos.find(photo => photo.id === example.photoId);
      const review = targetedReviews.find(record => record.observation_id === example.observationId);
      assert.equal(decision?.values[trait.key], category.value);
      assert.equal(review?.[trait.key].value, category.value);
      assert.equal(photo?.license_code, example.licenseCode);
      assert.equal(photo?.attribution, example.attribution);
      assert.equal(decision.photo_id, example.photoId);
      assert.ok(decision.examined_photo_ids.includes(example.photoId));
      assert.equal(asset.reviewIndex, null, 'Targeted observations have no old-125 review index');
      assert.equal(asset.sourceIndex, record.index);
      assert.equal(asset.licenseCheckedAt, record.retrieved_at);
      assert.equal(asset.licenseMetadataSource, 'review-work/targeted-examples-2026-10-18/manifest.json');
      assert.equal(asset.fieldWriteStatus, review.write_status);
      continue;
    }
    const prior = decisions.find(record => record.observation_id === example.observationId);
    const latest = ringDecisions.find(record => record.observation_id === example.observationId);
    const freshRecord = ringBaseline.records.find(record => record.id === example.observationId);
    const photo = (freshRecord ?? baseline.records.find(record => record.id === example.observationId))?.photos.find(photo => photo.id === example.photoId);
    assert.equal(latest?.values[trait.key] ?? prior?.values[trait.key], category.value);
    assert.equal(photo?.license_code, example.licenseCode);
    assert.equal(photo?.attribution, example.attribution);
    assert.ok(prior.examined_photo_ids.includes(example.photoId) || latest?.examined_photo_ids.includes(example.photoId));
    assert.equal(asset.reviewIndex, prior.index, 'Original manifest index is preserved');
    assert.equal(asset.licenseCheckedAt, freshRecord ? ringBaseline.checked_at : baseline.checked_at);
    assert.equal(asset.licenseMetadataSource, `review-work/${freshRecord ? 'ring-edge-review' : 'guide-review'}-2026-10-18/baseline.json`);
  }
});

test('latest decisions merge by observation ID without losing original indexes or other trait reasons', () => {
  const original = [
    { observation_id: 100, index: 9, values: { ring: 'Clear', variation: 'None' }, reasons: { ring: 'Earlier interpretation', variation: 'Earlier variation interpretation' }, examined_photo_ids: [5] },
    { observation_id: 200, index: 12, values: { ring: 'Absent', variation: 'Low' }, reasons: { ring: 'Earlier absence', variation: 'Modest broad changes' }, examined_photo_ids: [7] }
  ];
  const latest = [
    { observation_id: 200, values: { ring: 'Faint' }, reasons: { ring: 'Weak localized band is visible' }, examined_photo_ids: [7, 8] },
    { observation_id: 100, index: 999, values: { ring: 'Cannot be determined', variation: 'Cannot be determined' }, reasons: { ring: 'Diffuse area cannot be isolated', variation: 'Exclusion would change the score' }, examined_photo_ids: [6] }
  ];
  const merged = mergeReviewDecisions(original, latest);
  assert.deepEqual(merged.map(record => record.index), [9, 12]);
  assert.deepEqual(merged[0].values, { ring: 'Cannot be determined', variation: 'Cannot be determined' });
  assert.deepEqual(merged[0].examined_photo_ids, [5, 6]);
  assert.equal(merged[1].values.variation, 'Low');
  assert.equal(merged[1].reasons.variation, 'Modest broad changes');
  assert.equal(original[0].values.ring, 'Clear', 'Merge does not mutate historical decisions');
  assert.throws(() => mergeReviewDecisions(original, [{ ...latest[0], observation_id: 999 }]), /outside the original set/);
});

test('the latest ring guide preserves owner anchors and treats diffuse paling as unresolved', async () => {
  const guide = JSON.parse(await readFile(new URL('../docs/data/photo-guide.json', import.meta.url), 'utf8'));
  const category = (trait, value) => guide.traits.find(item => item.key === trait).categories.find(item => item.value === value);
  const ids = (trait, value) => category(trait, value).examples.map(example => example.observationId);
  assert.deepEqual(ids('ring', 'Absent'), [262772803, 25044378]);
  assert.match(category('ring', 'Absent').note, /targeted follow-up/);
  assert.deepEqual(ids('variation', 'High'), [25044378]);
  assert.match(category('variation', 'High').note, /One working High reference/);
  assert.equal(category('variation', 'High').examples[0].fieldWriteStatus, 'blocked');
  assert.equal(category('ring', 'Absent').examples[0].fieldWriteStatus, 'verified');
  assert.deepEqual(ids('ring', 'Clear'), [77541853, 215814088, 349126189]);
  assert.deepEqual(ids('ring', 'Faint'), [113980346, 159722286, 272127265]);
  assert.ok(ids('ring', 'Cannot be determined').includes(362970560));
  assert.ok(ids('ring', 'Cannot be determined').includes(27136204));
  assert.ok(ids('variation', 'Cannot be determined').includes(362970560));
  assert.ok(!ids('variation', 'None').includes(362970560));
  assert.deepEqual(ids('variation', 'Low'), [159722286, 272127265, 349126189]);
  assert.match(category('ring', 'Clear').definition, /obvious outer edge/);
  assert.match(category('ring', 'Faint').definition, /localized/);
});
