export const COLORS = {
  white: { label: 'White', fill: '#fffdf3', stroke: '#777a62' },
  pink: { label: 'Pink', fill: '#e7a6b8', stroke: '#9d4c6c' },
  purple: { label: 'Purple', fill: '#ac88c2', stroke: '#684782' }
};
export const UNDETERMINED = 'cannot be determined';
export const TRAITS = {
  color: { label: 'Petal color', options: COLORS },
  veins: { label: 'Petal vein contrast', options: {
    low: { label: 'Low', fill: '#c2cbb5', stroke: '#66745b' },
    medium: { label: 'Medium', fill: '#bd9bc8', stroke: '#795986' },
    high: { label: 'High', fill: '#71508b', stroke: '#49335a' }
  } },
  ring: { label: 'White center ring', options: {
    present: { label: 'Present', fill: '#76b8ad', stroke: '#30665b' },
    absent: { label: 'Absent', fill: '#dca87d', stroke: '#8c603a' }
  } },
  variation: { label: 'Petal pigment variation', options: {
    none: { label: 'None', fill: '#ddd0bd', stroke: '#8c7961' },
    low: { label: 'Low', fill: '#df9caa', stroke: '#ad6b7b' },
    high: { label: 'High', fill: '#a54970', stroke: '#6a2547' }
  } }
};
export const normalize = value => String(value ?? '').trim().toLowerCase();
export function readField(fields, id, allowed) {
  const values = [...new Set((fields || []).filter(f => Number(f.field_id) === Number(id)).map(f => normalize(f.value)))];
  if (!values.length) return { value: null, state: 'missing' };
  if (values.length > 1) return { value: null, state: 'conflict' };
  return allowed.map(normalize).includes(values[0]) ? { value: values[0], state: values[0] === UNDETERMINED ? 'undetermined' : 'valid' } : { value: null, state: 'unrecognized' };
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
export function classify(o, config) {
  const traits = {};
  for (const [key, field] of Object.entries(config.fields)) {
    const result = readField(o.ofvs, field.id, field.values);
    traits[key] = result.value; traits[`${key}State`] = result.state;
  }
  const taxonId = config.taxa.find(t => t.id === o.taxon?.id || o.taxon?.ancestor_ids?.includes(t.id))?.id;
  return { ...o, taxonId, ...traits, coords: coordinates(o) };
}
export function summarizeTrait(records, trait) {
  const counts = Object.fromEntries(Object.keys(TRAITS[trait].options).map(key => [key, 0]));
  const summary = { counts, assessable: 0, undetermined: 0, missing: 0, conflict: 0, unrecognized: 0, total: records.length };
  for (const o of records) {
    const state = o[`${trait}State`];
    if (state === 'valid' && Object.hasOwn(counts, o[trait])) { counts[o[trait]]++; summary.assessable++; }
    else if (['undetermined', 'missing', 'conflict', 'unrecognized'].includes(state)) summary[state]++;
    else summary.unrecognized++;
  }
  return summary;
}
export function traitLabel(o, trait) {
  return TRAITS[trait].options[o[trait]]?.label || ({ undetermined: 'Cannot be determined', missing: 'Not labeled', conflict: 'Conflicting values', unrecognized: 'Unsupported value' })[o[`${trait}State`]] || 'Not labeled';
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
  const columns = ['observation_id', 'url', 'taxon', 'observed_on', ...Object.keys(TRAITS).flatMap(k => [k, `${k}_state`]), 'quality_grade', 'captive', 'obscured', 'longitude_public', 'latitude_public'];
  return [columns, ...records.map(o => [o.id, observationUrl(o.id), o.taxon.name, o.observed_on, ...Object.keys(TRAITS).flatMap(k => [o[k], o[`${k}State`]]), o.quality_grade, o.captive, o.obscured, o.coords?.[0], o.coords?.[1]])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
