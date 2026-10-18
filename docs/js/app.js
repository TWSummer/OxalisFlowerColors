import { COLORS, PATTERNS, classify, filterRecords, observationUrl, photoUrl, publicRecord, recordsCsv } from './data.js';
import { fetchFieldRecords } from './api.js';
import { flowerSvg } from './flowers.js';
const $ = id => document.getElementById(id);
let config, snapshot, records = [], visible = [], selected = null, map, layer, recordLimit = 24;
const miniMaps = [];
const colorText = {
  white: ['Clearly neutral or ivory tissue can have dark purple veins. Near-white with an unresolved cool tint: withhold.', 'Paper Figure 1: M–P'],
  blue: ['The paper includes nearly white-looking blue examples. Coolness alone does not establish blue; withhold white/blue ambiguity.', 'Paper Figure 1: I–L · boundary unresolved'],
  purple: ['Violet or lilac background: blue and red together, from pale to deep.', 'Paper Figure 1: E–H'],
  pink: ['A rose or magenta background, visibly warmer than violet.', 'Paper Figure 1: A–D']
};
function node(tag, text, className) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
function link(text, href) { const a = node('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
function licenseLink(code) { return code === 'cc0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : `https://creativecommons.org/licenses/${code.replace('cc-', '')}/4.0/`; }
function drawGuide() {
  $('hero-flower').innerHTML = flowerSvg('white', true, true);
  Object.entries(COLORS).forEach(([key, info], i) => {
    const card = node('article', null, 'color-card');
    card.innerHTML = `<div class="specimen"><span class="specimen-id">0${i + 1} / SCHEMATIC</span>${flowerSvg(key, key === 'white')}</div><h3><span class="color-dot" style="background:${info.fill};border-color:${info.stroke}"></span>${info.label}</h3><p>${colorText[key][0]}</p><p class="paper-reference">${colorText[key][1]}</p>`;
    $('color-cards').append(card);
  });
  const patterns = [
    ['conspicuous', 'Conspicuous veins', 'At least two clearly pigmented lines on each of three petals, each continuing along at least half the exposed petal length.', flowerSvg('white', true)],
    ['faint_or_not_visible', 'Faint / not visible', 'Adequate detail and light, but no conspicuous network under the same rule. This does not mean the flower has no veins.', flowerSvg('white', false)],
    ['unscorable', 'Cannot score', 'Blur, glare, too few visible upper petals, inadequate source resolution, or a borderline contrast judgment.', '<div class="unscorable-symbol" aria-hidden="true">?</div>']
  ];
  patterns.forEach(([key, title, desc, svg]) => { const card = node('article', null, 'pattern-card'); card.innerHTML = `${svg}<h3>${title}</h3><p>${desc}</p><code>${key}</code>`; $('pattern-cards').append(card); });
  const tabs = [$('tab-color'), $('tab-veins')];
  function selectTab(index) { tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; $(tab.getAttribute('aria-controls')).hidden = i !== index; }); }
  tabs.forEach((tab, index) => { tab.addEventListener('click', () => selectTab(index)); tab.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - index; selectTab(next); tabs[next].focus(); } }); });
}
function addTeachingPhotos() {
  const examples = [
    { id: 70158331, title: 'White background, colored veins', note: 'Look at the pale areas between the lines, not the overall pink impression.', photo: { url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/113996957/medium.jpeg', license_code: 'cc-by-nc', attribution: 'Levin Pratte (justthatpratte)' } },
    { id: 200170716, title: 'A label worth reviewing', note: 'This image appears violet, while its community field says pink. Inspect all source photos before deciding. This illustrates uncertainty; it is not a pink reference standard.', photo: { url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/353112768/medium.jpeg', license_code: 'cc0', attribution: 'Anne Parsons (truthseqr)' } }
  ];
  examples.forEach(ex => { const figure = node('figure'); const img = node('img'); img.src = photoUrl(ex.photo); img.alt = ex.title; img.loading = 'lazy'; const cap = node('figcaption'); cap.append(node('strong', ex.title), node('p', ex.note), link(ex.photo.attribution, observationUrl(ex.id)), document.createTextNode(' · '), link(ex.photo.license_code.toUpperCase(), licenseLink(ex.photo.license_code))); figure.append(img, cap); $('teaching-photos').append(figure); });
}
function tiles(target) { return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(target); }
function initMap() {
  if (!window.L) { $('map-message').hidden = false; $('map-message').textContent = 'The map library could not load. You can still browse or export the records below.'; return; }
  map = L.map('map', { scrollWheelZoom: false, minZoom: 2, worldCopyJump: true }).setView([43, -123], 5);
  layer = L.layerGroup().addTo(map);
  let warned = false;
  tiles(map).on('tileerror', () => { if (!warned) { $('map-caption').textContent = 'Some base-map tiles could not load. Observation markers and links remain available.'; warned = true; } });
  $('fit').addEventListener('click', fitMap);
  $('west').addEventListener('click', () => map.fitBounds([[35, -128], [51, -119]]));
  $('world').addEventListener('click', () => map.setView([20, 0], 2));
}
function fitMap() { if (!map) return; const pts = visible.map(o => [o.coords[1], o.coords[0]]); if (pts.length) map.fitBounds(pts, { padding: [35, 35], maxZoom: 11 }); }
function popup(o) {
  const box = node('div'); box.append(node('h3', o.taxon.name), node('p', `${COLORS[o.color]?.label || 'No color label'} · ${PATTERNS[o.pattern]?.label || 'Veins not scored'}`));
  const p = o.photos?.find(p => photoUrl(p));
  if (p) { const img = node('img'); img.src = photoUrl(p); img.alt = `${o.taxon.name}, observation ${o.id}`; img.loading = 'lazy'; box.append(img, node('p', p.attribution || `${o.user?.login || 'iNaturalist contributor'} · ${p.license_code}`, 'credit')); }
  box.append(node('p', `${o.observed_on || 'Date unknown'} · ${o.user?.login || 'Observer unknown'}`), node('p', `${o.quality_grade?.replaceAll('_', ' ') || 'Unknown grade'}${o.captive ? ' · cultivated' : ''}${o.obscured ? ' · approximate public location' : ''}`), link(`Observation #${o.id} ↗`, observationUrl(o.id)));
  return box;
}
function marker(o, trait, target) {
  const info = (trait === 'color' ? COLORS : PATTERNS)[o[trait]];
  if (!info) return;
  L.circleMarker([o.coords[1], o.coords[0]], { radius: 7, weight: 1.5, fillOpacity: .9, fillColor: info.fill, color: info.stroke, dashArray: o.obscured ? '3 3' : undefined }).bindPopup(() => popup(o)).addTo(target);
}
function activeFilters() { return { species: $('species').value, grade: $('grade').value, captive: $('captive').value, from: $('date-from').value, to: $('date-to').value }; }
function update() {
  if (!config) return;
  const trait = $('trait').value;
  const styles = trait === 'color' ? COLORS : PATTERNS;
  const filters = activeFilters();
  const invalidDate = filters.from && filters.to && filters.from > filters.to;
  $('filter-error').hidden = !invalidDate;
  $('filter-error').textContent = 'The start date must be on or before the end date.';
  records = (snapshot?.records || []).map(o => classify(o, config, $('legacy').checked));
  const base = invalidDate ? [] : filterRecords(records, filters);
  const tagged = base.filter(o => o[trait]);
  const mapped = tagged.filter(o => o.coords && (!o.obscured || $('approximate').checked));
  visible = mapped.filter(o => !selected || o[trait] === selected);
  $('mapped-count').textContent = visible.length.toLocaleString();
  $('display-count').textContent = `${visible.length} record${visible.length === 1 ? '' : 's'} shown`;
  const noLocation = tagged.filter(o => !o.coords).length;
  const obscured = tagged.filter(o => o.coords && o.obscured && !$('approximate').checked).length;
  const conflicting = base.filter(o => o[trait === 'color' ? 'colorState' : 'patternState'] === 'conflict').length;
  const other = base.length - tagged.length - conflicting;
  $('coverage').textContent = `${tagged.length} usable ${trait === 'color' ? 'color' : 'vein'} labels in this selection. ${noLocation} without public coordinates; ${obscured} obscured locations hidden. ${conflicting} conflicts; ${other} missing or unsupported values. Counts refer only to records fetched for the configured fields.`;
  $('legend-title').textContent = trait === 'color' ? 'Petal background' : 'Vein contrast · pilot';
  $('legend').replaceChildren();
  Object.entries(styles).forEach(([key, info]) => {
    const button = node('button', null, 'legend-item'); button.setAttribute('aria-pressed', String(selected === key));
    const label = node('span', null, 'label'); const dot = node('span', null, 'color-dot'); dot.style.background = info.fill; dot.style.borderColor = info.stroke; label.append(dot, document.createTextNode(info.label)); button.append(label, node('span', String(mapped.filter(o => o[trait] === key).length), 'count')); button.addEventListener('click', () => { selected = selected === key ? null : key; recordLimit = 24; update(); }); $('legend').append(button);
  });
  if (layer) { layer.clearLayers(); visible.forEach(o => marker(o, trait, layer)); }
  if (map) {
    const noField = trait === 'pattern' && !config.patternField.id;
    $('map-message').hidden = visible.length > 0;
    $('map-message').textContent = noField ? 'Vein contrast is a proposed pilot field. Complete the pilot, create or select the field, and set its ID in data/project.json to activate this map.' : `No mapped ${trait === 'color' ? 'color' : 'vein'} labels match these filters. This means no matching labels in the loaded data, not absence of these flowers.`;
  }
  recordLimit = Math.max(24, recordLimit);
  renderRecords();
  if (!$('compare-panel').hidden) renderComparisons(base);
}
function renderRecords() {
  $('records').replaceChildren(); $('record-total').textContent = `(${visible.length})`;
  if (!visible.length) $('records').append(node('p', 'No mapped records in this selection.', 'small'));
  visible.slice(0, recordLimit).forEach(o => { const card = node('article', null, 'record-card'); card.append(node('h3', o.taxon.name), node('p', `${COLORS[o.color]?.label || 'Color unset'} · ${PATTERNS[o.pattern]?.label || 'Veins unset'}`, 'trait-value'), node('p', `${o.observed_on || 'Date unknown'} · ${o.user?.login || 'Unknown observer'}`), node('p', `${o.colorSource === 'legacy' ? 'Alternate color field #43' : 'Primary color field #8625'}${o.obscured ? ' · obscured' : ''}`), link(`View #${o.id} ↗`, observationUrl(o.id))); $('records').append(card); });
  $('more-records').hidden = recordLimit >= visible.length;
}
function renderComparisons(base) {
  if (!map) return;
  if (!miniMaps.length) {
    Object.entries(COLORS).forEach(([key, info]) => { const item = node('div', null, 'compare-item'); const div = node('div', null, 'mini-map'); div.setAttribute('aria-label', `${info.label} flower map`); const count = node('p'); item.append(node('h3', info.label), div, count); $('compare-maps').append(item); const m = L.map(div, { scrollWheelZoom: false, dragging: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomControl: false }).setView([43, -123], 4); tiles(m); miniMaps.push({ key, map: m, layer: L.layerGroup().addTo(m), count }); });
  }
  const set = base.filter(o => o.color && o.coords && (!o.obscured || $('approximate').checked));
  const bounds = set.length ? L.latLngBounds(set.map(o => [o.coords[1], o.coords[0]])) : L.latLngBounds([[35, -128], [51, -119]]);
  miniMaps.forEach(item => { item.map.invalidateSize(); item.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 7 }); item.layer.clearLayers(); const subset = set.filter(o => o.color === item.key); subset.forEach(o => marker(o, 'color', item.layer)); item.count.textContent = `${subset.length} mapped observations`; });
}
function statusText(prefix) { return `${prefix} · ${new Date(snapshot.fetchedAt).toLocaleString()} · ${snapshot.records.length} unique records across configured fields${snapshot.complete ? '' : ' · PARTIAL DATA'}.`; }
async function refresh() {
  $('refresh').disabled = true;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const result = await fetchFieldRecords(config, { signal: controller.signal, onProgress: ({ loaded, field }) => { $('data-status').textContent = `Reading ${field}… ${loaded} unique records loaded.`; } });
    snapshot = { ...result, records: result.records.map(publicRecord) }; $('data-status').textContent = statusText('Live public API'); update(); fitMap();
  } catch (e) {
    $('data-status').textContent = `Refresh failed: ${e.name === 'AbortError' ? 'request timed out' : e.message} ${snapshot ? statusText('Kept the previous dataset') : 'No dataset available. Please retry.'}`;
  } finally { clearTimeout(timeout); $('refresh').disabled = false; }
}
function bind() {
  ['species', 'trait', 'grade', 'captive', 'date-from', 'date-to', 'approximate', 'legacy'].forEach(id => $(id).addEventListener('change', () => { if (id === 'trait') selected = null; recordLimit = 24; update(); }));
  $('refresh').addEventListener('click', refresh);
  $('reset').addEventListener('click', () => { ['species', 'grade', 'captive', 'date-from', 'date-to'].forEach(id => $(id).value = ''); $('trait').value = 'color'; $('approximate').checked = false; $('legacy').checked = false; selected = null; update(); fitMap(); });
  $('more-records').addEventListener('click', () => { recordLimit += 24; renderRecords(); });
  $('download').addEventListener('click', () => { const blob = new Blob([recordsCsv(visible)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = node('a'); a.href = url; a.download = 'oxalis-mapped-observations.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  $('compare-toggle').addEventListener('click', () => { const open = $('compare-panel').hidden; $('compare-panel').hidden = !open; $('compare-toggle').setAttribute('aria-expanded', String(open)); $('compare-toggle').textContent = open ? 'Close color comparison −' : 'Compare colors side by side +'; if (open) update(); });
}
drawGuide(); addTeachingPhotos(); initMap(); bind();
try {
  const response = await fetch('data/project.json'); if (!response.ok) throw new Error('Field configuration could not load.'); config = await response.json();
  try { const res = await fetch('data/observations.json'); if (!res.ok) throw new Error(); snapshot = await res.json(); if (!Array.isArray(snapshot.records)) throw new Error(); $('data-status').textContent = statusText('Saved snapshot'); }
  catch { snapshot = { records: [], fetchedAt: new Date().toISOString(), complete: false }; $('data-status').textContent = 'No saved dataset available. Use Refresh from iNaturalist.'; }
  update(); fitMap();
} catch (e) { $('data-status').textContent = e.message; $('refresh').disabled = true; }
