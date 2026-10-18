import { COLORS, TRAITS, classify, summarizeTrait, traitLabel, filterRecords, observationUrl, photoUrl, publicRecord, recordsCsv } from './data.js';
import { fetchFieldRecords } from './api.js';
import { drawGuide } from './guide.js';
const $ = id => document.getElementById(id);
let config, snapshot, visible = [], chartRecords = [], selected = null, map, layer, recordLimit = 24;
const miniMaps = [];
function node(tag, text, className) { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; }
function link(text, href) { const a = node('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
function tiles(target) { return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(target); }
function initMap() {
  if (!window.L) { $('map-message').hidden = false; $('map-message').textContent = 'The map library could not load. Charts, records, and CSV exports remain available.'; return; }
  map = L.map('map', { scrollWheelZoom: false, minZoom: 2, worldCopyJump: true }).setView([43, -123], 5);
  layer = L.layerGroup().addTo(map);
  let warned = false;
  tiles(map).on('tileerror', () => { if (!warned) { $('map-caption').textContent = 'Some base-map tiles could not load. Observation markers and links remain available.'; warned = true; } });
  $('fit').addEventListener('click', fitMap);
  $('west').addEventListener('click', () => map.fitBounds([[35, -128], [51, -119]]));
  $('world').addEventListener('click', () => map.setView([20, 0], 2));
}
function fitMap() { if (!map) return; const pts = visible.map(o => [o.coords[1], o.coords[0]]); if (pts.length) map.fitBounds(pts, { padding: [35, 35], maxZoom: 11 }); }
function describe(o) { return Object.entries(TRAITS).map(([key, trait]) => `${trait.label}: ${traitLabel(o, key)}`).join(' · '); }
function popup(o) {
  const box = node('div'); box.append(node('h3', o.taxon.name), node('p', describe(o)));
  const p = o.photos?.find(p => photoUrl(p));
  if (p) { const img = node('img'); img.src = photoUrl(p); img.alt = `${o.taxon.name}, observation ${o.id}`; img.loading = 'lazy'; box.append(img, node('p', p.attribution || `${o.user?.login || 'iNaturalist contributor'} · ${p.license_code}`, 'credit')); }
  box.append(node('p', `${o.observed_on || 'Date unknown'} · ${o.user?.login || 'Observer unknown'}`), node('p', `${o.quality_grade?.replaceAll('_', ' ') || 'Unknown grade'}${o.captive ? ' · cultivated' : ''}${o.obscured ? ' · approximate public location' : ''}`), link(`Observation #${o.id} ↗`, observationUrl(o.id)));
  return box;
}
function marker(o, trait, target) {
  const info = TRAITS[trait].options[o[trait]]; if (!info) return;
  L.circleMarker([o.coords[1], o.coords[0]], { radius: 7, weight: 1.5, fillOpacity: .9, fillColor: info.fill, color: info.stroke, dashArray: o.obscured ? '3 3' : undefined }).bindPopup(() => popup(o)).addTo(target);
}
function activeFilters() { return { species: $('species').value, grade: $('grade').value, captive: $('captive').value, from: $('date-from').value, to: $('date-to').value }; }
function update() {
  if (!config) return;
  const trait = $('trait').value, styles = TRAITS[trait].options, filters = activeFilters();
  const invalidDate = filters.from && filters.to && filters.from > filters.to;
  $('filter-error').hidden = !invalidDate; $('filter-error').textContent = 'The start date must be on or before the end date.';
  const records = (snapshot?.records || []).map(o => classify(o, config));
  chartRecords = invalidDate ? [] : filterRecords(records, filters);
  const summary = summarizeTrait(chartRecords, trait);
  const tagged = chartRecords.filter(o => o[`${trait}State`] === 'valid');
  const mapped = tagged.filter(o => o.coords && (!o.obscured || $('approximate').checked));
  visible = mapped.filter(o => !selected || o[trait] === selected);
  $('mapped-count').textContent = visible.length.toLocaleString(); $('display-count').textContent = `${visible.length} records shown`;
  const noLocation = tagged.filter(o => !o.coords).length;
  const obscured = tagged.filter(o => o.coords && o.obscured && !$('approximate').checked).length;
  $('coverage').textContent = `${summary.assessable} assessable labels. ${summary.undetermined} Cannot be determined; ${summary.missing} not labeled; ${summary.conflict} conflicts; ${summary.unrecognized} unsupported. ${noLocation} assessable records without public coordinates; ${obscured} obscured locations hidden. Counts cover fetched records only.`;
  $('legend-title').textContent = TRAITS[trait].label; $('legend').replaceChildren();
  Object.entries(styles).forEach(([key, info]) => {
    const button = node('button', null, 'legend-item'); button.setAttribute('aria-pressed', String(selected === key));
    const label = node('span', null, 'label'), dot = node('span', null, 'color-dot'); dot.style.background = info.fill; dot.style.borderColor = info.stroke;
    label.append(dot, document.createTextNode(info.label)); button.append(label, node('span', String(mapped.filter(o => o[trait] === key).length), 'count'));
    button.addEventListener('click', () => { selected = selected === key ? null : key; recordLimit = 24; update(); }); $('legend').append(button);
  });
  if (layer) { layer.clearLayers(); visible.forEach(o => marker(o, trait, layer)); }
  if (map) { $('map-message').hidden = visible.length > 0; $('map-message').textContent = `No mapped ${TRAITS[trait].label.toLowerCase()} labels match these filters. ${snapshot?.records.length ? '' : 'The new fields need fresh reviews; earlier pilot labels are not converted. '}No records does not mean this trait is absent.`; }
  renderRecords(); renderCharts();
  if (!$('compare-panel').hidden) renderComparisons(chartRecords);
}
function renderCharts() {
  $('charts').replaceChildren(); $('chart-total').textContent = `${chartRecords.length.toLocaleString()} fetched records match the species, grade, establishment, and date filters.`;
  for (const [key, trait] of Object.entries(TRAITS)) {
    const summary = summarizeTrait(chartRecords, key), card = node('article', null, 'chart-card');
    card.append(node('h3', trait.label), node('p', `${summary.assessable} assessable labels`, 'chart-denominator'));
    const rows = node('ul', null, 'chart-bars');
    for (const [value, info] of Object.entries(trait.options)) {
      const count = summary.counts[value], percent = summary.assessable ? count / summary.assessable * 100 : 0;
      const row = node('li', null, 'chart-row'), label = node('div', null, 'chart-label');
      label.append(node('span', info.label), node('span', `${count} · ${summary.assessable ? `${percent.toFixed(1)}%` : '—'}`));
      const track = node('div', null, 'bar-track'), bar = node('span', null, 'bar-fill'); track.setAttribute('aria-hidden', 'true'); bar.style.width = `${percent}%`; bar.style.background = info.stroke; track.append(bar); row.append(label, track); rows.append(row);
    }
    card.append(rows, node('p', `Cannot be determined: ${summary.undetermined}`, 'chart-unknown'), node('p', `Not labeled: ${summary.missing} · Conflicts: ${summary.conflict} · Unsupported: ${summary.unrecognized}`, 'small'));
    if (!summary.assessable) card.append(node('p', 'No assessable labels in this selection yet.', 'small'));
    $('charts').append(card);
  }
}
function renderRecords() {
  $('records').replaceChildren(); $('record-total').textContent = `(${visible.length})`;
  if (!visible.length) $('records').append(node('p', 'No mapped records in this selection.', 'small'));
  visible.slice(0, recordLimit).forEach(o => { const card = node('article', null, 'record-card'); card.append(node('h3', o.taxon.name), node('p', describe(o), 'trait-value'), node('p', `${o.observed_on || 'Date unknown'} · ${o.user?.login || 'Unknown observer'}`), node('p', `Redwood Sorrel fields${o.obscured ? ' · obscured' : ''}`), link(`View #${o.id} ↗`, observationUrl(o.id))); $('records').append(card); });
  $('more-records').hidden = recordLimit >= visible.length;
}
function renderComparisons(base) {
  if (!map) return;
  if (!miniMaps.length) Object.entries(COLORS).forEach(([key, info]) => {
    const item = node('div', null, 'compare-item'), div = node('div', null, 'mini-map'), count = node('p'); div.setAttribute('aria-label', `${info.label} flower map`);
    item.append(node('h3', info.label), div, count); $('compare-maps').append(item);
    const m = L.map(div, { scrollWheelZoom: false, dragging: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomControl: false }).setView([43, -123], 4); tiles(m);
    miniMaps.push({ key, map: m, layer: L.layerGroup().addTo(m), count });
  });
  const set = base.filter(o => o.colorState === 'valid' && o.coords && (!o.obscured || $('approximate').checked));
  const bounds = set.length ? L.latLngBounds(set.map(o => [o.coords[1], o.coords[0]])) : L.latLngBounds([[35, -128], [51, -119]]);
  miniMaps.forEach(item => { item.map.invalidateSize(); item.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 7 }); item.layer.clearLayers(); const subset = set.filter(o => o.color === item.key); subset.forEach(o => marker(o, 'color', item.layer)); item.count.textContent = `${subset.length} mapped observations`; });
}
function statusText(prefix) { return `${prefix} · ${new Date(snapshot.fetchedAt).toLocaleString()} · ${snapshot.records.length} unique records across the four Redwood Sorrel fields${snapshot.complete ? '' : ' · PARTIAL DATA'}.`; }
async function refresh() {
  $('refresh').disabled = true;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const result = await fetchFieldRecords(config, { signal: controller.signal, onProgress: ({ loaded, field }) => { $('data-status').textContent = `Reading ${field}… ${loaded} unique records loaded.`; } });
    if (!result.complete) throw new Error('Page limit reached; incomplete data was not used.');
    snapshot = { ...result, protocolVersion: config.protocolVersion, records: result.records.map(publicRecord) }; $('data-status').textContent = statusText('Live public API'); update(); fitMap();
  } catch (e) { $('data-status').textContent = `Refresh failed: ${e.name === 'AbortError' ? 'request timed out' : e.message} ${snapshot ? statusText('Kept the previous dataset') : 'No dataset available. Please retry.'}`; }
  finally { clearTimeout(timeout); $('refresh').disabled = false; }
}
function download(records, name) { const url = URL.createObjectURL(new Blob([recordsCsv(records)], { type: 'text/csv;charset=utf-8' })); const a = node('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function bind() {
  ['species', 'trait', 'grade', 'captive', 'date-from', 'date-to', 'approximate'].forEach(id => $(id).addEventListener('change', () => { if (id === 'trait') selected = null; recordLimit = 24; update(); }));
  $('refresh').addEventListener('click', refresh);
  $('reset').addEventListener('click', () => { ['species', 'grade', 'captive', 'date-from', 'date-to'].forEach(id => $(id).value = ''); $('trait').value = 'color'; $('approximate').checked = false; selected = null; recordLimit = 24; update(); fitMap(); });
  $('more-records').addEventListener('click', () => { recordLimit += 24; renderRecords(); });
  $('download').addEventListener('click', () => download(visible, 'oxalis-mapped-observations.csv'));
  $('download-chart').addEventListener('click', () => download(chartRecords.map(o => o.obscured && !$('approximate').checked ? { ...o, coords: null } : o), 'oxalis-chart-records.csv'));
  $('compare-toggle').addEventListener('click', () => { const open = $('compare-panel').hidden; $('compare-panel').hidden = !open; $('compare-toggle').setAttribute('aria-expanded', String(open)); $('compare-toggle').textContent = open ? 'Close color comparison −' : 'Compare colors side by side +'; if (open) update(); });
}
try {
  const response = await fetch('data/project.json'); if (!response.ok) throw new Error('Field configuration could not load.'); config = await response.json();
  drawGuide(config); initMap(); bind();
  try {
    const res = await fetch('data/observations.json'); if (!res.ok) throw new Error(); snapshot = await res.json();
    if (!Array.isArray(snapshot.records) || snapshot.protocolVersion !== config.protocolVersion) throw new Error();
    $('data-status').textContent = statusText('Saved snapshot');
  } catch { snapshot = { records: [], fetchedAt: new Date().toISOString(), complete: false }; $('data-status').textContent = 'No compatible saved dataset available. Use Refresh from iNaturalist.'; }
  update(); fitMap();
} catch (e) { $('data-status').textContent = e.message; $('refresh').disabled = true; }
