import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGuide } from '../docs/js/photo-guide.js';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const REVIEW_ROOT = 'review-work/guide-review-2026-10-18';
const RING_REVIEW_ROOT = 'review-work/ring-edge-review-2026-10-18';
const REVIEW_DATE = '2026-10-18';
const LICENSE_URLS = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
  'cc-by-nc': 'https://creativecommons.org/licenses/by-nc/4.0/'
};

// Entries refer to the re-review manifest, not the original pilot/batch index.
// Each caption explains only this trait; the builder checks its current decision.
const TRAITS = [
  {
    key: 'color', label: 'Petal Color', fieldId: 23008,
    summary: 'Judge the broad upper petal tissue between the veins. Exclude the yellow/orange throat, any separate white center ring, and the vein lines themselves. Our Figure 1 key is Pink A–F, Purple G–H, and White I–P.',
    categories: [
      {
        value: 'White', definition: 'White or near-white interveinal tissue, including a cool cast. Colored veins alone do not make a flower Pink or Purple.',
        selections: [
          [102, 'White with very faint veins', 'The broad tissue is white and the fine lines are barely visible. Judge the petals outside the yellow throat.', 'An open white flower with very faint petal lines and a yellow-green center.'],
          [92, 'Cool near-white still counts as White', 'The tissue has a cool appearance but remains near-white. This project includes pale cool-looking flowers in White rather than treating every lilac cast as pigment.', 'A cool near-white flower with faint veins.'],
          [66, 'Purple lines, white background', 'The purple vein network is strong, but the spaces between its lines are white. This is White color with High vein contrast.', 'A white flower crossed by a bold purple vein network.']
        ]
      },
      {
        value: 'Pink', definition: 'Rose, magenta, or pale pink-lilac background tissue, matching A–F in our reference key. Saturation alone does not separate Pink from Purple.',
        selections: [
          [19, 'Saturated rose and magenta', 'The broad rose/magenta tissue fits Pink, as do C and D in our Figure 1 key. Its cupped center makes the ring uncertain, but does not erase the visible petal color.', 'A cupped flower with saturated rose-magenta upper petals.'],
          [60, 'Pale pink-lilac', 'The visible broad tissue is pale rose/lilac and falls in Pink. Soft detail makes some structural traits uncertain; the background color is still discernible.', 'A pale rose-lilac flower with diffuse inner paling.'],
          [63, 'Rose-pink with diffuse inner paling', 'The outer petal background is rose-pink. The diffuse pale inner area has no obvious outer edge, so its identity as a center ring versus broad pigment variation remains unresolved.', 'An open rose-pink flower with a diffuse pale inner area and no obvious outer boundary.']
        ]
      },
      {
        value: 'Purple', definition: 'Clearly violet background tissue like G and H. The violet must be in the broad tissue, not confined to vein lines.',
        selections: [
          [77, 'Violet with subtle veins', 'Clearly violet tissue occupies the broad parts of the petals. The fine veins are subtle against it, so the color is Purple even with Low vein contrast.', 'A violet flower with subtle veins and a white center ring.'],
          [99, 'Violet with diffuse inner paling', 'The broad outer tissue is violet. The pale inner zone blends into it without an obvious outer edge; color remains Purple while ring and pigment variation are both unresolved.', 'Violet outer petals grading into a broad diffuse pale inner zone.'],
          [38, 'Violet with visible vein lines', 'The spaces between the darker lines are themselves violet. Both background pigment and veins are visible; the background establishes Purple.', 'A violet flower with visible darker veins and a white basal ring.']
        ]
      },
      {
        value: 'Cannot be determined', definition: 'Use this when the visible background remains unresolved between categories or the available view does not provide reliable color evidence.',
        selections: [[13, 'Cool white or pale pigmented lilac?', 'The broad tissue cannot be placed confidently between cool white and pale lilac pigment. Its bold magenta veins can still be scored High independently.', 'A pale flower with bold magenta veins whose broad background is uncertain between cool white and pale lilac.']]
      }
    ]
  },
  {
    key: 'veins', label: 'Petal Vein Contrast', fieldId: 23010,
    summary: 'At the standard 300-pixel view, judge how strongly vein lines stand out from their immediate petal background. Assess prominence, not vein color, number, or branching.',
    categories: [
      {
        value: 'Low', definition: 'Lines are faint, subtle, or not visible in an otherwise adequate image. Low does not mean veins are anatomically absent.',
        selections: [
          [102, 'At the faint end', 'Fine lines are barely visible against the white tissue. The clear broad background supports Low rather than an uncertainty caused by blur.', 'A sharply shown white flower with very faint vein lines.'],
          [3, 'Pale lines remain subtle', 'The pale vein lines are visible on close inspection but remain subtle at this standard size. They do not carry the readily visible contrast required for Medium.', 'An ivory-white flower with pale subtle veins.'],
          [77, 'Low on colored petals', 'Fine veins blend into the saturated violet background. A deeply colored flower can still have Low vein contrast.', 'A violet flower whose fine veins remain subtle against the colored tissue.']
        ]
      },
      {
        value: 'Medium', definition: 'Veins are readily visible but remain secondary to the broad petal background. Figure 1 A, F, and H define this class.',
        selections: [
          [1, 'Visible pink lines on white', 'Pink vein lines are easy to see, but the pale background still leads the overall impression. Re-review placed this in Medium rather than High.', 'A white flower with readily visible pink vein lines.'],
          [38, 'Visible lines on violet', 'The darker lines stand out from nearby violet tissue without dominating the flower. Contrast is assessed against the local background.', 'A violet flower with visible but secondary darker vein lines.'],
          [65, 'Lines within pale pink-lilac', 'The lines are readily visible in the pink-lilac tissue but remain secondary. Broad changes in the background are assessed separately as pigment variation.', 'A pale pink-lilac flower with visible vein lines and a narrow white basal band.']
        ]
      },
      {
        value: 'High', definition: 'A strongly contrasting vein network is a dominant visual feature across the visible petals. Compare Figure 1 O and P.',
        selections: [
          [66, 'A dominant purple network', 'The bold purple network is a leading feature of the white petals. The white spaces between lines still establish White petal color.', 'A white flower with a dominant branching purple vein network.'],
          [57, 'Strong lines across the petals', 'The contrasting network draws attention across the flower at the standard size. This is prominence across broad visible petals, not simply the presence of a few colored lines.', 'A white flower with bold contrasting colored vein lines across the petals.'],
          [125, 'Dark network on white tissue', 'Dark lines dominate the visible white petals. The ridges, shadows, and colored lines do not by themselves establish pigment variation in the broad tissue.', 'An open white flower with a dark prominent vein network.']
        ]
      },
      {
        value: 'Cannot be determined', definition: 'Blur, inadequate source detail, glare, or clipped highlights prevent a reliable comparison between lines and background.',
        selections: [
          [23, 'Blur is not Low contrast', 'The white background is discernible, but defocus removes the detail needed to judge vein prominence. Do not turn missing detail into Low.', 'A defocused white flower whose vein detail is not resolved.'],
          [103, 'Highlights distort the comparison', 'Clipped bright tissue may exaggerate the contrast of surviving dark lines. The apparent line strength cannot be scored reliably.', 'A white flower with clipped highlights and visible dark lines.']
        ]
      }
    ]
  },
  {
    key: 'ring', label: 'White Center Ring', fieldId: 23011,
    summary: 'Inspect the transition immediately outside the yellow/orange throat on at least three visible petal bases. First decide whether a localized band can be separated from broad petal paling. Clear requires an obvious, traceable outer edge; diffuse paling alone does not establish a ring.',
    categories: [
      {
        value: 'Absent', definition: 'Colored petal tissue reaches the throat without an intervening pale or white band. The bases must be exposed well enough to establish absence.',
        note: 'After the ring-boundary correction, none of the 125 reviewed observations remains a verified Absent example. Figure 1 D and F remain the reference definition. The two former photo examples are now Faint because a weak localized band is visible.',
        selections: []
      },
      {
        value: 'Faint', definition: 'An actual weak, localized pale band is visible just outside the throat on at least three petal bases, but its outer edge blends softly into colored tissue. Faint is a visible band, not a substitute for uncertainty about diffuse paling.',
        note: 'The first two examples are owner-corrected Faint anchors. A weak visible band rules out Absent even when its edge is too soft for Clear.',
        selections: [
          [46, 'Owner’s anchor: a weak pale circle', 'A weak pale circle can be seen around the yellow center. Its presence rules out the earlier Absent label, while the softly defined outer boundary supports Faint.', 'A violet flower with a weak localized pale circle around the yellow center.'],
          [104, 'Owner’s anchor: a soft pale rim', 'The pale rim immediately around the yellow/orange center is visible but softly bounded. Score that localized band Faint; broader modest paling elsewhere in the petals remains Low variation.', 'A violet flower with a soft pale rim around the yellow-orange throat and broader modest petal paling.'],
          [121, 'A weak, localized basal band', 'A weak pale band is localized immediately outside the throat, but blends softly into the surrounding violet tissue. The modest broad changes farther out are scored separately as Low variation.', 'A violet flower with a weak localized pale basal band blending softly into outer tissue.']
        ]
      },
      {
        value: 'Clear', definition: 'A localized white band has an obvious outer edge that can be traced against the colored tissue on at least three visible petal bases. Width alone does not decide the category: a narrow band with an obvious edge can be Clear.',
        note: 'Observation 77541853 is the project owner’s Clear anchor. Locate the outer edge of the band before choosing Clear.',
        selections: [
          [38, 'Owner’s anchor: obvious edges', 'An obvious white band surrounds the yellow throat. Its outer edge can be traced against violet tissue on at least three petal bases, establishing Clear.', 'A violet flower with an obvious white band and a traceable outer edge around the yellow throat.'],
          [77, 'A defined edge against violet', 'The localized white band has a readily traceable outer edge against the saturated violet background on at least three petals. This edge separates a ring from diffuse inner paling.', 'A violet flower with a localized white basal band and a clearly traceable outer boundary.'],
          [65, 'A narrow band can be Clear', 'The narrow white band outside the orange throat has an obvious outer edge against pink-lilac tissue on at least three bases. Modest broad variation remains beyond the band.', 'A pink-lilac flower with a narrow white basal band and an obvious outer edge.']
        ]
      },
      {
        value: 'Cannot be determined', definition: 'Use this when diffuse inner paling cannot be separated into a localized ring versus broad pigment variation, when the transition is hidden or unresolved, or when white petals have no separate outer ring boundary.',
        selections: [
          [99, 'Diffuse paling is not a defined ring', 'The broad pale inner zone blends into violet tissue in both photographs. There is neither an obvious Clear edge nor enough evidence to isolate a localized Faint band from broad pigment variation.', 'A violet flower with a broad diffuse pale inner zone whose ring boundary cannot be isolated.'],
          [63, 'An unresolved pale inner area', 'The pale inner area grades into rose-pink tissue without an obvious outer edge. Other views do not resolve whether it is a separate center ring or broad background variation.', 'A rose-pink flower with a diffuse pale inner area that cannot be separated into a ring or broad variation.'],
          [19, 'A cupped center can hide a band', 'The oblique, cupped center may conceal a pale circle. The project owner corrected this to Cannot be determined; a partly hidden band cannot establish Absent.', 'A cupped magenta flower whose oblique center may hide a white basal band.'],
          [1, 'White tissue has no separate boundary', 'The petals are white, so no separate outer ring boundary can be identified. This is insufficient evidence for Absent, Faint, or Clear.', 'A white flower with no distinguishable outer boundary for a separate white center ring.']
        ]
      }
    ]
  },
  {
    key: 'variation', label: 'Petal Pigment Variation', fieldId: 23012,
    summary: 'Look for repeated changes in pigment intensity within the broad background of a petal. Exclude the throat, narrow veins, a separately established center ring, shadows, glare, folds, and damage. If an ambiguous pale zone changes the score depending on whether it is included, use Cannot be determined.',
    categories: [
      {
        value: 'None', definition: 'The broad background is nearly uniform after the exclusions above. Both pale and deeply colored flowers can be None; a center ring alone does not increase variation.',
        selections: [
          [19, 'Nearly uniform pink', 'The broad pink tissue is nearly uniform. Folds and small flecks do not form a repeated broad pigment gradient.', 'A magenta flower with nearly uniform broad petal color.'],
          [77, 'Nearly uniform violet', 'The colored background is approximately uniform once the separate white basal ring is excluded. A ring is not a pale middle zone within the colored petal.', 'A violet flower with uniform colored tissue outside a distinct white basal ring.'],
          [102, 'Nearly uniform white', 'The white tissue is approximately uniform outside the throat and fine veins. Neither the yellow center nor faint colored lines establishes broad variation.', 'A white flower with approximately uniform tissue outside the yellow center and fine veins.']
        ]
      },
      {
        value: 'Low', definition: 'A subtle but repeatable gradient or modest light/dark difference occurs across the broad tissue, without strongly separated pale and dark zones. An F-like near-white middle is not required.',
        note: 'The first two photographs are the project owner’s Low anchors. Compare the broad tissue rather than only the flower’s overall hue.',
        selections: [
          [104, 'Owner’s anchor: paler middle regions', 'The project owner assigns Low here. Broad middle regions are paler than other petal regions beyond the narrow veins; the modest difference is enough even without sharply separated zones.', 'A violet flower with modest broad paling in the petal middles and stronger pigment elsewhere.'],
          [121, 'Owner’s anchor: modest broad variation', 'The project owner assigns Low here. Modest lighter and darker regions occur within the colored petals, beyond the narrow vein lines and faint basal ring.', 'A violet flower showing modest lighter and darker background regions within the petals.'],
          [65, 'Modest variation beyond a clear band', 'The narrow center band has an obvious edge and can be excluded. Beyond it, modest broad lighter interiors and more pigmented outer regions repeat across the colored petals without F-like strongly separated zones.', 'A pink-lilac flower with modest broad petal variation beyond a clearly bounded narrow white center band.']
        ]
      },
      {
        value: 'High', definition: 'Clearly distinct pale and dark broad background regions occur across the petals, as in Figure 1 F: pink toward the base, a nearly white middle, and deeper pink near the margins.',
        note: 'No confident High example was found among the 125 reviewed observations. Figure 1 F remains the reference. Dark veins, stronger overall saturation, and a separate white center ring are not sufficient.',
        selections: []
      },
      {
        value: 'Cannot be determined', definition: 'Use this when broad light/dark changes cannot be separated from illumination or image quality, when category boundaries remain unresolved, or when including versus excluding an ambiguous pale inner zone would change the score.',
        selections: [
          [99, 'Ring exclusion would change the score', 'The pale inner zone cannot confidently be separated into a center ring versus broad pigment variation. Excluding it would suggest a different score from including it, so None, Low, and High are all unsupported until that distinction is resolved.', 'A violet flower with diffuse inner paling whose inclusion or exclusion would change the pigment-variation score.'],
          [35, 'Glare and shadow overlap the tissue', 'Direct glare and shadows change the apparent intensity across the petals. The available image cannot establish whether a broad pigment gradient is present.', 'A violet flower with glare and shadows across its petals.'],
          [89, 'Wet glare and soft focus', 'Bright wet surfaces and defocus prevent reliable comparison of background intensity. Apparent pale patches cannot be assigned to pigment variation.', 'A white flower with droplets, bright wet glare, and soft focus.'],
          [109, 'Uneven illumination is unresolved', 'Strong differences in illumination produce broad light and dark areas. They cannot confidently be attributed to pigment, so the score remains Cannot be determined.', 'An oblique violet flower with strongly uneven illumination across the petals.']
        ]
      }
    ]
  }
];

const json = async relative => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function mergeReviewDecisions(original, updates) {
  const merged = new Map(original.map(decision => [decision.observation_id, structuredClone(decision)]));
  assert.equal(merged.size, original.length, 'Duplicate original review IDs');
  assert.equal(new Set(updates.map(decision => decision.observation_id)).size, updates.length, 'Duplicate boundary-review IDs');
  for (const update of updates) {
    const prior = merged.get(update.observation_id);
    assert.ok(prior, `Boundary review is outside the original set: ${update.observation_id}`);
    merged.set(update.observation_id, {
      ...prior, ...update, index: prior.index,
      values: { ...prior.values, ...update.values },
      reasons: { ...prior.reasons, ...update.reasons },
      examined_photo_ids: [...new Set([...prior.examined_photo_ids, ...update.examined_photo_ids])]
    });
  }
  return [...merged.values()];
}

export function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Expected a JPEG crop');
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    assert.equal(bytes[offset++], 0xff, 'Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (startOfFrame.has(marker)) return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2, 'Invalid JPEG segment');
    offset += length;
  }
  throw new Error('JPEG dimensions were not found');
}

export async function buildPhotoGuide() {
  const [manifest, baseline, originalDecisions, ringBaseline, ringDecisions] = await Promise.all([
    ...['manifest.json', 'baseline.json', 'decisions.json'].map(file => json(`${REVIEW_ROOT}/${file}`)),
    ...['baseline.json', 'decisions.json'].map(file => json(`${RING_REVIEW_ROOT}/${file}`))
  ]);
  assert.equal(originalDecisions.length, 125, 'Expected the complete 125-observation re-review');
  assert.equal(ringDecisions.length, 32, 'Expected all 32 determinate ring observations to be re-reviewed');
  assert.equal(ringBaseline.records.length, 32, 'Expected fresh photo metadata for all 32 boundary-review records');
  assert.deepEqual(new Set(ringBaseline.records.map(record => record.id)), new Set(ringDecisions.map(record => record.observation_id)), 'Fresh metadata must cover exactly the latest boundary-review set');
  const decisions = mergeReviewDecisions(originalDecisions, ringDecisions);
  assert.ok(decisions.every(decision => decision.values.ring !== 'Absent'), 'The empty Absent note no longer matches current decisions');
  const licensedRecords = new Map(baseline.records.map(record => [record.id, { record, checkedAt: baseline.checked_at, source: `${REVIEW_ROOT}/baseline.json` }]));
  for (const record of ringBaseline.records) {
    assert.ok(licensedRecords.has(record.id), `Fresh baseline record is outside the original set: ${record.id}`);
    licensedRecords.set(record.id, { record, checkedAt: ringBaseline.checked_at, source: `${RING_REVIEW_ROOT}/baseline.json` });
  }
  const sourceManifests = new Map();
  const assets = new Map();
  const uses = [];
  const traits = [];
  await mkdir(path.join(ROOT, 'docs/assets/photo-guide'), { recursive: true });
  for (const trait of TRAITS) {
    const categories = [];
    for (const category of trait.categories) {
      const examples = [];
      for (const [reviewIndex, title, caption, alt] of category.selections) {
        const entry = manifest.observations.find(record => record.index === reviewIndex);
        const decision = decisions.find(record => record.index === reviewIndex);
        assert.ok(entry && decision, `Missing review index ${reviewIndex}`);
        assert.equal(decision.observation_id, entry.observation_id, `Review ID mismatch at ${reviewIndex}`);
        assert.equal(decision.values[trait.key], category.value, `Reviewed category mismatch at ${reviewIndex}/${trait.key}`);
        const evidence = entry.old_review[trait.key].evidence;
        assert.equal(evidence.length, 1, `Ambiguous focal photo at ${reviewIndex}/${trait.key}`);
        const photoId = evidence[0].photo_id;
        assert.ok(decision.examined_photo_ids.includes(photoId), `Focal photo not re-reviewed at ${reviewIndex}`);
        if (!sourceManifests.has(entry.source_root)) sourceManifests.set(entry.source_root, await json(`${entry.source_root}/manifest.json`));
        const sourceManifest = sourceManifests.get(entry.source_root);
        const originalEntry = sourceManifest.observations.find((record, position) => (record.index ?? position + 1) === entry.source_index);
        assert.equal(originalEntry?.observation_id, entry.observation_id, `Source-index mismatch at ${reviewIndex}`);
        assert.ok(originalEntry.photos.some(photo => photo.id === photoId), `Evidence photo absent from source manifest at ${reviewIndex}`);
        assert.equal(entry.crop_path, `${entry.source_root}/crops/${String(entry.source_index).padStart(3, '0')}.jpg`, `Unexpected crop path at ${reviewIndex}`);
        const { record, checkedAt: licenseCheckedAt, source: licenseMetadataSource } = licensedRecords.get(entry.observation_id);
        const photo = record?.photos.find(photo => photo.id === photoId);
        assert.ok(photo && LICENSE_URLS[photo.license_code], `Photo license not authorized at ${reviewIndex}`);
        assert.ok(photo.attribution, `Missing exact API attribution at ${reviewIndex}`);
        const bytes = await readFile(path.join(ROOT, entry.crop_path));
        const dimensions = jpegDimensions(bytes);
        assert.equal(dimensions.width, dimensions.height, `Expected a square focal crop at ${reviewIndex}`);
        const displaySize = Math.min(300, dimensions.width, evidence[0].assessment_diameter_px);
        assert.ok(displaySize >= 100 && displaySize <= evidence[0].source_diameter_px, `Display would enlarge the evidence at ${reviewIndex}`);
        const src = `assets/photo-guide/${entry.observation_id}-${photoId}.jpg`;
        const photoUrl = `https://www.inaturalist.org/photos/${photoId}`;
        const observationUrl = `https://www.inaturalist.org/observations/${entry.observation_id}`;
        const cropNote = 'Cropped around the focal flower and resized for the scoring view; no color or contrast adjustment. Copied unchanged from the reviewed crop.';
        examples.push({ observationId: entry.observation_id, photoId, src, displaySize, alt, title, caption, attribution: photo.attribution, licenseCode: photo.license_code, licenseUrl: LICENSE_URLS[photo.license_code], photoUrl, observationUrl, cropNote });
        if (!assets.has(src)) {
          await copyFile(path.join(ROOT, entry.crop_path), path.join(ROOT, 'docs', src));
          assert.equal(hash(await readFile(path.join(ROOT, 'docs', src))), hash(bytes), `Copied crop changed at ${reviewIndex}`);
          assets.set(src, { src, observationId: entry.observation_id, photoId, reviewIndex, sourceRoot: entry.source_root, sourceIndex: entry.source_index, sourceCropPath: entry.crop_path, sha256: hash(bytes), pixelDimensions: dimensions, displaySize, focalEvidence: evidence[0], sourceManifestPhotoId: photoId, reviewedValues: decision.values, attribution: photo.attribution, licenseCode: photo.license_code, licenseUrl: LICENSE_URLS[photo.license_code], licenseCheckedAt, licenseMetadataSource, photoUrl, observationUrl, sourceApiPhotoUrl: photo.url, cropNote });
        } else assert.equal(assets.get(src).sha256, hash(bytes), 'Conflicting crops share an asset path');
        uses.push({ trait: trait.key, value: category.value, reviewIndex, observationId: entry.observation_id, photoId, src, reviewedReason: decision.reasons[trait.key] });
      }
      const { selections, ...definition } = category;
      categories.push({ ...definition, examples });
    }
    traits.push({ key: trait.key, label: trait.label, fieldName: `Redwood Sorrel ${trait.label}`, fieldId: trait.fieldId, summary: trait.summary, categories });
  }
  const guide = validateGuide({ protocolVersion: manifest.protocol_version, reviewedAt: REVIEW_DATE, introduction: 'All 125 observations carrying our four project fields were re-reviewed, followed by a ring-boundary review of all 32 previously determinate ring labels. These examples use the latest decisions and show both category ranges and unresolved boundaries. “Pigment variation” is a visual score of photographed tissue; it does not measure chemical pigment.', traits });
  const provenance = { reviewedAt: REVIEW_DATE, protocolVersion: manifest.protocol_version, reviewManifest: `${REVIEW_ROOT}/manifest.json`, decisionsSource: `${REVIEW_ROOT}/decisions.json`, latestDecisionsSource: `${RING_REVIEW_ROOT}/decisions.json`, licenseMetadataSource: `${REVIEW_ROOT}/baseline.json`, latestLicenseMetadataSource: `${RING_REVIEW_ROOT}/baseline.json`, licenseCheckedAt: ringBaseline.checked_at, sourceHashes: { manifest: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'manifest.json'))), decisions: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'decisions.json'))), baseline: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'baseline.json'))), ringDecisions: hash(await readFile(path.join(ROOT, RING_REVIEW_ROOT, 'decisions.json'))), ringBaseline: hash(await readFile(path.join(ROOT, RING_REVIEW_ROOT, 'baseline.json'))) }, method: 'Focal crops copied byte-for-byte from earlier review evidence. Original source index and evidence photo ID cross-checked against the source manifest. Latest ring-boundary decisions are merged by observation ID over the 125-observation re-review while preserving original review indexes; every example category matches the merged decision. Fresh ring-baseline photo metadata supersedes earlier metadata for those records. Each asset identifies its license check source and time. Only CC0, CC BY, and CC BY-NC photo licenses accepted.', assets: [...assets.values()], uses };
  await writeFile(path.join(ROOT, 'docs/data/photo-guide.json'), JSON.stringify(guide, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'docs/data/photo-guide-assets.json'), JSON.stringify(provenance, null, 2) + '\n');
  return { uniquePhotos: assets.size, examples: uses.length, categories: traits.reduce((sum, trait) => sum + trait.categories.length, 0), licenses: [...new Set([...assets.values()].map(asset => asset.licenseCode))] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildPhotoGuide(), null, 2));
