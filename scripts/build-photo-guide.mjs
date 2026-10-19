import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGuide } from '../docs/js/photo-guide.js';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const REVIEW_ROOT = 'review-work/guide-review-2026-10-18';
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
          [60, 'Pale pink-lilac', 'The visible broad tissue is pale rose/lilac and falls in Pink. Soft detail makes some structural traits uncertain; the background color is still discernible.', 'A pale rose-lilac flower with a white basal band.'],
          [63, 'Rose-pink around a white center', 'The outer petal background is rose-pink. Exclude the white basal band when deciding the flower’s background color.', 'An open rose-pink flower surrounding a distinct white basal band.']
        ]
      },
      {
        value: 'Purple', definition: 'Clearly violet background tissue like G and H. The violet must be in the broad tissue, not confined to vein lines.',
        selections: [
          [77, 'Violet with subtle veins', 'Clearly violet tissue occupies the broad parts of the petals. The fine veins are subtle against it, so the color is Purple even with Low vein contrast.', 'A violet flower with subtle veins and a white center ring.'],
          [99, 'Violet outside a broad white ring', 'Use the violet outer tissue for color. The broad white center band is a separately scored ring and does not make this a White flower.', 'Violet outer petals around a broad, distinct white basal ring.'],
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
    summary: 'Inspect the transition immediately outside the yellow/orange throat on at least three visible petal bases. Judge whether a separate pale band is absent, faint, or clearly bounded against the outer tissue.',
    categories: [
      {
        value: 'Absent', definition: 'Colored petal tissue reaches the throat without an intervening pale or white band. The bases must be exposed well enough to establish absence.',
        selections: [
          [46, 'Colored tissue reaches the throat', 'The visible violet background continues to the throat without a distinct intervening pale band. Subtle light and dark areas farther out are scored as variation instead.', 'A violet flower whose exposed colored petal bases reach the throat without a white ring.'],
          [104, 'Paler middles do not make a ring', 'Colored tissue reaches the yellow throat on the visible bases. The paler areas farther along the petals belong to Low variation, not a separate basal ring.', 'A violet flower with colored bases reaching the yellow throat and modest paler areas farther along the petals.']
        ]
      },
      {
        value: 'Faint', definition: 'A weak pale band is visible just outside the throat but blends softly into the outer colored tissue. Faint describes a visible feature, not uncertain evidence.',
        note: 'This is the only licensed Faint example selected from the 125 reviewed observations. Observation 294114815 remains a linked working comparison in the protocol; its all-rights-reserved photo is not reproduced here.',
        selections: [[121, 'A weak, softly blended band', 'A pale basal band is visible, but its boundary blends into the surrounding violet tissue. Its weak separation supports Faint rather than Clear.', 'A violet flower with a weak pale basal band blending softly into the outer tissue.']]
      },
      {
        value: 'Clear', definition: 'A distinct white band separates the throat from colored outer tissue on at least three petals. Width alone does not determine the category: a narrow but distinct band can be Clear.',
        selections: [
          [99, 'Broad and clearly bounded', 'The large white basal region has a distinct outer boundary against violet tissue. Its size is striking, but it remains a center ring and is excluded from pigment variation.', 'A violet flower with a broad white basal ring and a clearly defined outer boundary.'],
          [6, 'A distinct band outside the throat', 'The white band is clearly separate from both the yellow throat and violet outer tissue. Vein lines crossing the petals do not remove that distinction.', 'A violet flower with a distinct white band outside its yellow throat.'],
          [63, 'A white band against rose-pink', 'The white basal band stands apart from the rose-pink outer tissue across the visible petal bases. The background color of the flower does not change the ring rule.', 'A rose-pink flower with a distinct white ring around the throat.']
        ]
      },
      {
        value: 'Cannot be determined', definition: 'Use this for a hidden or unresolved transition, or for white petals with no distinguishable outer boundary for a separate ring. White petals are not automatically an absent ring.',
        selections: [
          [19, 'A cupped center can hide a band', 'The oblique, cupped center may conceal a pale circle. The project owner corrected this to Cannot be determined; a partly hidden band cannot establish Absent.', 'A cupped magenta flower whose oblique center may hide a white basal band.'],
          [1, 'White tissue has no separate boundary', 'The petals are white, so no separate outer ring boundary can be identified. This is insufficient evidence for Absent, Faint, or Clear.', 'A white flower with no distinguishable outer boundary for a separate white center ring.']
        ]
      }
    ]
  },
  {
    key: 'variation', label: 'Petal Pigment Variation', fieldId: 23012,
    summary: 'Look for repeated changes in pigment intensity within the broad background of a petal. Exclude the throat, narrow veins, a separate white center ring, shadows, glare, folds, and damage.',
    categories: [
      {
        value: 'None', definition: 'The broad background is nearly uniform after the exclusions above. Both pale and deeply colored flowers can be None; a center ring alone does not increase variation.',
        selections: [
          [19, 'Nearly uniform pink', 'The broad pink tissue is nearly uniform. Folds and small flecks do not form a repeated broad pigment gradient.', 'A magenta flower with nearly uniform broad petal color.'],
          [77, 'Nearly uniform violet', 'The colored background is approximately uniform once the separate white basal ring is excluded. A ring is not a pale middle zone within the colored petal.', 'A violet flower with uniform colored tissue outside a distinct white basal ring.'],
          [102, 'Nearly uniform white', 'The white tissue is approximately uniform outside the throat and fine veins. Neither the yellow center nor faint colored lines establishes broad variation.', 'A white flower with approximately uniform tissue outside the yellow center and fine veins.'],
          [99, 'A broad ring is still excluded', 'The violet outer tissue is nearly uniform. The large, separately bounded white center ring is excluded from this trait, so it does not push the score to Low or High.', 'A violet flower with nearly uniform outer tissue and a large separate white center ring.']
        ]
      },
      {
        value: 'Low', definition: 'A subtle but repeatable gradient or modest light/dark difference occurs across the broad tissue, without strongly separated pale and dark zones. An F-like near-white middle is not required.',
        note: 'The first two photographs are the project owner’s Low anchors. Compare the broad tissue rather than only the flower’s overall hue.',
        selections: [
          [104, 'Owner’s anchor: paler middle regions', 'The project owner assigns Low here. Broad middle regions are paler than other petal regions beyond the narrow veins; the modest difference is enough even without sharply separated zones.', 'A violet flower with modest broad paling in the petal middles and stronger pigment elsewhere.'],
          [121, 'Owner’s anchor: modest broad variation', 'The project owner assigns Low here. Modest lighter and darker regions occur within the colored petals, beyond the narrow vein lines and faint basal ring.', 'A violet flower showing modest lighter and darker background regions within the petals.'],
          [54, 'A more noticeable gradient, still Low', 'The repeated gradient toward stronger pink-purple outer regions is more noticeable, but the tissue does not form the strongly separated pale and dark zones of Figure 1 F.', 'A violet flower with a modest repeated gradient toward stronger pink-purple outer regions.']
        ]
      },
      {
        value: 'High', definition: 'Clearly distinct pale and dark broad background regions occur across the petals, as in Figure 1 F: pink toward the base, a nearly white middle, and deeper pink near the margins.',
        note: 'No confident High example was found among the 125 reviewed observations. Figure 1 F remains the reference. Dark veins, stronger overall saturation, and a separate white center ring are not sufficient.',
        selections: []
      },
      {
        value: 'Cannot be determined', definition: 'Use this when broad light/dark changes cannot be separated from illumination or image quality, or the boundary between variation categories remains unresolved.',
        selections: [
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
  const [manifest, baseline, decisions] = await Promise.all(['manifest.json', 'baseline.json', 'decisions.json'].map(file => json(`${REVIEW_ROOT}/${file}`)));
  assert.equal(decisions.length, 125, 'Expected the complete 125-observation re-review');
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
        const record = baseline.records.find(record => record.id === entry.observation_id);
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
          assets.set(src, { src, observationId: entry.observation_id, photoId, reviewIndex, sourceRoot: entry.source_root, sourceIndex: entry.source_index, sourceCropPath: entry.crop_path, sha256: hash(bytes), pixelDimensions: dimensions, displaySize, focalEvidence: evidence[0], sourceManifestPhotoId: photoId, reviewedValues: decision.values, attribution: photo.attribution, licenseCode: photo.license_code, licenseUrl: LICENSE_URLS[photo.license_code], licenseCheckedAt: baseline.checked_at, photoUrl, observationUrl, sourceApiPhotoUrl: photo.url, cropNote });
        } else assert.equal(assets.get(src).sha256, hash(bytes), 'Conflicting crops share an asset path');
        uses.push({ trait: trait.key, value: category.value, reviewIndex, observationId: entry.observation_id, photoId, src, reviewedReason: decision.reasons[trait.key] });
      }
      const { selections, ...definition } = category;
      categories.push({ ...definition, examples });
    }
    traits.push({ key: trait.key, label: trait.label, fieldName: `Redwood Sorrel ${trait.label}`, fieldId: trait.fieldId, summary: trait.summary, categories });
  }
  const guide = validateGuide({ protocolVersion: manifest.protocol_version, reviewedAt: REVIEW_DATE, introduction: 'All 125 observations carrying our four project fields were re-reviewed. These close-ups were chosen to show the range within categories and the boundaries between them. “Pigment variation” is a visual score of the photographed tissue; it does not measure chemical pigment.', traits });
  const provenance = { reviewedAt: REVIEW_DATE, protocolVersion: manifest.protocol_version, reviewManifest: `${REVIEW_ROOT}/manifest.json`, decisionsSource: `${REVIEW_ROOT}/decisions.json`, licenseMetadataSource: `${REVIEW_ROOT}/baseline.json`, licenseCheckedAt: baseline.checked_at, sourceHashes: { manifest: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'manifest.json'))), decisions: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'decisions.json'))), baseline: hash(await readFile(path.join(ROOT, REVIEW_ROOT, 'baseline.json'))) }, method: 'Focal crops copied byte-for-byte from earlier review evidence. Original source index and evidence photo ID cross-checked against the source manifest; each example category checked against the fresh 125-observation visual re-review. Only CC0, CC BY, and CC BY-NC photo licenses accepted from the fresh public API baseline.', assets: [...assets.values()], uses };
  await writeFile(path.join(ROOT, 'docs/data/photo-guide.json'), JSON.stringify(guide, null, 2) + '\n');
  await writeFile(path.join(ROOT, 'docs/data/photo-guide-assets.json'), JSON.stringify(provenance, null, 2) + '\n');
  return { uniquePhotos: assets.size, examples: uses.length, categories: traits.reduce((sum, trait) => sum + trait.categories.length, 0), licenses: [...new Set([...assets.values()].map(asset => asset.licenseCode))] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildPhotoGuide(), null, 2));
