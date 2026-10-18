export const COLORS = {
  white: { label: 'White', fill: '#fffdf3', stroke: '#777a62' },
  blue: { label: 'Blue', fill: '#88b6df', stroke: '#35688e' },
  purple: { label: 'Purple', fill: '#ac88c2', stroke: '#684782' },
  pink: { label: 'Pink', fill: '#e7a6b8', stroke: '#9d4c6c' }
};
export const PATTERNS = {
  conspicuous: { label: 'Conspicuous veins', fill: '#71508b', stroke: '#49335a' },
  faint_or_not_visible: { label: 'Faint / not visible', fill: '#c2cbb5', stroke: '#66745b' }
};
export const normalize = value => String(value ?? '').trim().toLowerCase();
export function readField(fields, id, allowed) {
  const values = [...new Set((fields || []).filter(f => Number(f.field_id) === Number(id)).map(f => normalize(f.value)))];
  if (!values.length) return { value: null, state: 'missing' };
  if (values.length > 1) return { value: null, state: 'conflict' };
  return allowed.includes(values[0]) ? { value: values[0], state: 'valid' } : { value: null, state: 'unrecognized' };
}
export function coordinates(observation) {
  // Never read private_geojson, private_location, EXIF, or private place fields.
  const c = observation.geojson?.coordinates;
  if (!Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) return null;
  return c;
}
export function publicRecord(o) {
  return {
    id: o.id, observed_on: o.observed_on, quality_grade: o.quality_grade, license_code: o.license_code ?? null,
    captive: o.captive ?? null, obscured: Boolean(o.obscured || o.geoprivacy === 'obscured' || o.taxon_geoprivacy === 'obscured'),
    geoprivacy: o.geoprivacy, taxon_geoprivacy: o.taxon_geoprivacy,
    geojson: coordinates(o) ? { type: 'Point', coordinates: coordinates(o) } : null,
    positional_accuracy: o.public_positional_accuracy ?? o.positional_accuracy ?? null,
    taxon: { id: o.taxon?.id, name: o.taxon?.name, ancestor_ids: o.taxon?.ancestor_ids || [] },
    user: { login: o.user?.login },
    ofvs: (o.ofvs || []).map(f => ({ field_id: f.field_id, name: f.name, value: f.value })),
    photos: (o.photos || []).map(p => ({ id: p.id, url: p.url, license_code: p.license_code, attribution: p.attribution }))
  };
}
export function classify(o, config, includeLegacy = false) {
  const color = readField(o.ofvs, config.colorField.id, Object.keys(COLORS));
  const legacy = readField(o.ofvs, config.legacyColorField.id, Object.keys(COLORS));
  let chosen = { ...color, source: 'primary' };
  if (includeLegacy) {
    if (color.state === 'missing') chosen = { ...legacy, source: 'legacy' };
    else if (legacy.state === 'conflict' || (legacy.value && color.value && legacy.value !== color.value)) chosen = { value: null, state: 'conflict', source: 'conflict' };
  }
  const pattern = config.patternField.id ? readField(o.ofvs, config.patternField.id, Object.keys(PATTERNS)) : { value: null, state: 'not_configured' };
  const taxonId = config.taxa.find(t => t.id === o.taxon?.id || o.taxon?.ancestor_ids?.includes(t.id))?.id;
  return { ...o, taxonId, color: chosen.value, colorState: chosen.state, colorSource: chosen.source, pattern: pattern.value, patternState: pattern.state, coords: coordinates(o) };
}
export function filterRecords(records, filters) {
  return records.filter(o => o.taxonId && (!filters.species || o.taxonId === Number(filters.species))
    && (!filters.grade || o.quality_grade === filters.grade)
    && (!filters.captive || (filters.captive === 'wild' ? o.captive === false : o.captive === true))
    && (!filters.from || (o.observed_on && o.observed_on >= filters.from))
    && (!filters.to || (o.observed_on && o.observed_on <= filters.to)));
}
export function observationUrl(id) { return `https://www.inaturalist.org/observations/${Number(id)}`; }
export function photoUrl(photo, size = 'medium') {
  if (!photo?.url || !['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa', 'cc-by-nd', 'cc-by-nc-nd'].includes(photo.license_code)) return null;
  try {
    const u = new URL(photo.url);
    if (u.protocol !== 'https:' || !['static.inaturalist.org', 'inaturalist-open-data.s3.amazonaws.com'].includes(u.hostname)) return null;
    return u.href.replace(/\/(square|small|medium|large|original)\./, `/${size}.`);
  } catch { return null; }
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function recordsCsv(records) {
  const columns = ['observation_id', 'url', 'taxon', 'observed_on', 'color', 'color_source', 'vein_contrast', 'quality_grade', 'captive', 'obscured', 'longitude_public', 'latitude_public'];
  return [columns, ...records.map(o => [o.id, observationUrl(o.id), o.taxon.name, o.observed_on, o.color, o.colorSource, o.pattern, o.quality_grade, o.captive, o.obscured, o.coords?.[0], o.coords?.[1]])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
