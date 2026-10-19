const LICENSES = new Map([['cc0', 'CC0'], ['cc-by', 'CC BY'], ['cc-by-nc', 'CC BY-NC']]);
const TRAIT_KEYS = ['color', 'veins', 'ring', 'variation'];

export function categoryId(traitKey, value) {
  return `${traitKey}-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export function licenseLabel(code) {
  return LICENSES.get(String(code).toLowerCase().replaceAll('_', '-'));
}

function requiredText(value, description) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${description}.`);
}

function secureLink(value, description) {
  requiredText(value, description);
  if (new URL(value).protocol !== 'https:') throw new Error(`Invalid ${description}.`);
}

// Fail closed on incomplete attribution or a photo license outside this collection's terms.
export function validateGuide(data) {
  requiredText(data.protocolVersion, 'protocol version');
  requiredText(data.reviewedAt, 'review date');
  if (Number.isNaN(Date.parse(data.reviewedAt))) throw new Error('Invalid review date.');
  requiredText(data.introduction, 'introduction');
  if (!Array.isArray(data.traits) || data.traits.length !== TRAIT_KEYS.length ||
      TRAIT_KEYS.some(key => data.traits.filter(trait => trait.key === key).length !== 1)) {
    throw new Error('The guide must include each of the four traits once.');
  }
  const categoryIds = new Set();
  for (const trait of data.traits) {
    requiredText(trait.label, 'trait label');
    requiredText(trait.summary, 'trait summary');
    if (trait.fieldName !== undefined) requiredText(trait.fieldName, 'field name');
    if (!Number.isSafeInteger(trait.fieldId) || trait.fieldId < 1) throw new Error('Invalid field ID.');
    if (!Array.isArray(trait.categories) || !trait.categories.some(c => c.value === 'Cannot be determined')) {
      throw new Error(`Missing uncertainty category for ${trait.key}.`);
    }
    for (const category of trait.categories) {
      requiredText(category.value, 'category value');
      requiredText(category.definition, 'category definition');
      const id = categoryId(trait.key, category.value);
      if (categoryIds.has(id)) throw new Error(`Duplicate category ${id}.`);
      categoryIds.add(id);
      if (!Array.isArray(category.examples)) throw new Error(`Missing examples array for ${id}.`);
      for (const example of category.examples) {
        if (!Number.isSafeInteger(example.observationId) || !Number.isSafeInteger(example.photoId)) throw new Error('Invalid example IDs.');
        if (example.displaySize !== undefined && (!Number.isInteger(example.displaySize) || example.displaySize < 100 || example.displaySize > 300)) throw new Error('Example displaySize must be an integer from 100 to 300.');
        for (const name of ['src', 'alt', 'title', 'caption', 'attribution', 'cropNote']) requiredText(example[name], `example ${name}`);
        if (!licenseLabel(example.licenseCode)) throw new Error(`Unsupported photo license: ${example.licenseCode}.`);
        for (const name of ['photoUrl', 'observationUrl', 'licenseUrl']) secureLink(example[name], name);
        // Project-relative images also work when Pages is deployed below a repository path.
        if (!/^assets\/[a-zA-Z0-9_./-]+$/.test(example.src) || example.src.includes('..')) throw new Error('Example image must be a project-relative asset.');
      }
    }
  }
  return data;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(text, href, className = '') {
  const node = element('a', className, text);
  node.href = href;
  if (href.startsWith('https://')) node.rel = 'noopener noreferrer';
  return node;
}

function exampleFigure(example) {
  const figure = element('figure', 'photo-example');
  const imageLink = link('', example.photoUrl, 'photo-example-image');
  imageLink.setAttribute('aria-label', `Open source photo: ${example.alt}`);
  const image = element('img');
  const displaySize = example.displaySize ?? 300;
  image.src = example.src;
  image.alt = example.alt;
  image.width = displaySize;
  image.height = displaySize;
  image.style.width = `${displaySize}px`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => imageLink.replaceChildren(element('span', 'photo-example-image-error', 'The close-up could not load. Open the source photo.')), { once: true });
  imageLink.append(image);
  const caption = element('figcaption');
  caption.append(element('h4', '', example.title), element('p', 'photo-example-explanation', example.caption));
  const source = element('p', 'photo-example-source');
  source.append(link(`Observation ${example.observationId} ↗`, example.observationUrl), document.createTextNode(' · '), link('Source photo', example.photoUrl));
  const credit = element('div', 'photo-example-credit');
  credit.append(element('p', '', example.attribution));
  const license = element('p');
  license.append(link(licenseLabel(example.licenseCode), example.licenseUrl));
  credit.append(license, element('p', 'crop-note', example.cropNote));
  caption.append(source, credit);
  figure.append(imageLink, caption);
  return figure;
}

function categorySection(trait, category) {
  const uncertain = category.value === 'Cannot be determined';
  const section = element('section', `photo-category${uncertain ? ' photo-category-uncertain' : ''}`);
  section.id = categoryId(trait.key, category.value);
  section.tabIndex = -1;
  const headingId = `${section.id}-title`;
  section.setAttribute('aria-labelledby', headingId);
  const header = element('div', 'photo-category-heading');
  const heading = element('h3');
  heading.id = headingId;
  heading.append(link(category.value, `#${section.id}`, 'category-permalink'));
  const description = element('div');
  description.append(element('p', 'photo-category-definition', category.definition));
  if (category.note) description.append(element('p', 'photo-category-note', category.note));
  header.append(heading, description);
  section.append(header);
  if (category.examples.length) {
    const examples = element('div', 'photo-examples');
    for (const example of category.examples) examples.append(exampleFigure(example));
    section.append(examples);
  } else {
    const empty = element('div', 'photo-category-empty');
    empty.append(element('p', '', 'No photographic example is included in this reviewed collection. Use the definition above; do not infer a category from the lack of an example.'));
    section.append(empty);
  }
  return section;
}

function renderGuide(data) {
  document.getElementById('guide-introduction').textContent = data.introduction;
  const date = new Date(data.reviewedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  document.getElementById('guide-metadata').textContent = `Protocol ${data.protocolVersion} · Examples reviewed ${date}`;
  const navigation = document.getElementById('trait-navigation');
  const collection = document.getElementById('photo-traits');
  data.traits.forEach((trait, index) => {
    const number = String(index + 1).padStart(2, '0');
    const navLink = link('', `#${trait.key}`);
    navLink.append(element('span', 'nav-number', number), document.createTextNode(trait.label));
    navigation.append(navLink);
    const section = element('section', 'photo-trait');
    section.id = trait.key;
    section.tabIndex = -1;
    section.setAttribute('aria-labelledby', `${trait.key}-title`);
    const header = element('div', 'photo-trait-heading');
    const titles = element('div');
    titles.append(element('p', 'eyebrow', `${number} / Score independently`));
    const title = element('h2', '', trait.label);
    title.id = `${trait.key}-title`;
    titles.append(title);
    const summary = element('div');
    summary.append(element('p', 'photo-trait-summary', trait.summary));
    const field = element('p', 'photo-trait-field', 'iNaturalist field: ');
    field.append(link(`${trait.fieldName ?? `Redwood Sorrel ${trait.label}`} ↗`, `https://www.inaturalist.org/observation_fields/${trait.fieldId}`));
    summary.append(field);
    header.append(titles, summary);
    const categoryNav = element('nav', 'category-navigation');
    categoryNav.setAttribute('aria-label', `${trait.label} categories`);
    for (const category of trait.categories) categoryNav.append(link(category.value, `#${categoryId(trait.key, category.value)}`));
    section.append(header, categoryNav);
    for (const category of trait.categories) section.append(categorySection(trait, category));
    collection.append(section);
  });
  document.getElementById('guide-status').hidden = true;
  // Resolve deep links after the fetched collection has supplied their targets.
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* A malformed fragment does not invalidate the guide. */ }
  const target = document.getElementById(hash);
  if (target) requestAnimationFrame(() => {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
}

async function loadGuide() {
  try {
    const response = await fetch('data/photo-guide.json');
    if (!response.ok) throw new Error(`Guide request failed (${response.status}).`);
    renderGuide(validateGuide(await response.json()));
  } catch (error) {
    const status = document.getElementById('guide-status');
    status.dataset.error = 'true';
    status.replaceChildren(document.createTextNode('The photographic guide could not load. Reload the page or use the '), link('complete scoring rules', 'protocol.md'), document.createTextNode('.'));
    console.error('Photographic guide:', error);
  }
}

if (typeof document !== 'undefined') loadGuide();
