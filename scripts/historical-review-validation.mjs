export function validateReview(r, config) {
  const errors = [];
  const positiveInt = v => Number.isSafeInteger(v) && v > 0;
  const date = v => typeof v === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
  const nonempty = v => typeof v === 'string' && Boolean(v.trim());
  const keys = (o, allowed, path) => { if (!o || typeof o !== 'object' || Array.isArray(o)) { errors.push(`${path} must be an object`); return false; } for (const k of allowed) if (!(k in o)) errors.push(`${path}.${k} is required`); for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`${path}.${k} is not allowed`); return true; };
  if (!keys(r, ['observation_id', 'taxon_id', 'reviewer', 'reviewed_at', 'protocol_version', 'examined_photo_ids', 'color', 'veins', 'existing_fields', 'write_status', 'verified_fields'], 'review')) return errors;
  if (!positiveInt(r.observation_id) || !positiveInt(r.taxon_id)) errors.push('Observation and taxon IDs must be positive integers');
  if (!nonempty(r.reviewer) || !date(r.reviewed_at)) errors.push('Reviewer and ISO timestamp with timezone are required');
  if (r.protocol_version !== config.protocolVersion) errors.push('Protocol version does not match project configuration');
  if (!Array.isArray(r.examined_photo_ids) || r.examined_photo_ids.some(v => !positiveInt(v)) || new Set(r.examined_photo_ids).size !== r.examined_photo_ids.length) errors.push('examined_photo_ids must be unique positive integers');
  const statuses = ['scored', 'no_open_flower', 'unscorable', 'uncertain_color', 'mixed_flowers', 'conflicting_photos', 'subject_unclear', 'unexpected_trait', 'out_of_scope', 'not_assessed'];
  for (const name of ['color', 'veins']) {
    const t = r[name]; if (!keys(t, ['value', 'status', 'confidence', 'reason', 'evidence'], name)) continue;
    const allowed = name === 'color' ? config.colorField.values : config.patternField.values;
    if (t.value !== null && !allowed.includes(t.value)) errors.push(`${name}: unsupported value`);
    if (!statuses.includes(t.status) || !['high', 'medium', 'low', 'not_applicable'].includes(t.confidence) || !nonempty(t.reason)) errors.push(`${name}: status, confidence, or reason invalid`);
    if (!Array.isArray(t.evidence)) { errors.push(`${name}: evidence must be an array`); continue; }
    if (t.status === 'scored' && (t.value === null || t.value === 'unscorable' || !t.evidence.length || t.confidence === 'not_applicable')) errors.push(`${name}: scored requires a substantive value, confidence, and evidence`);
    if (t.status !== 'scored' && t.value !== null && !(name === 'veins' && t.status === 'unscorable' && t.value === 'unscorable')) errors.push(`${name}: abstentions must have null values (except unscorable veins)`);
    for (const e of t.evidence) {
      if (!keys(e, ['photo_id', 'flower', 'source_diameter_px', 'assessment_diameter_px', 'visible_upper_petals'], `${name}.evidence`)) continue;
      if (!positiveInt(e.photo_id) || !r.examined_photo_ids?.includes(e.photo_id) || !nonempty(e.flower)) errors.push(`${name}: evidence must refer to an examined photo and describe the flower`);
      if (![e.source_diameter_px, e.assessment_diameter_px].every(v => Number.isFinite(v) && v > 0) || !Number.isInteger(e.visible_upper_petals) || e.visible_upper_petals < 0 || e.visible_upper_petals > 5) errors.push(`${name}: invalid evidence measurements`);
      if (t.status === 'scored' && (e.source_diameter_px < (name === 'veins' ? 300 : 150) || e.visible_upper_petals < 3 || (name === 'veins' && e.assessment_diameter_px !== 300))) errors.push(`${name}: scored evidence fails size/petal/viewing rules`);
    }
  }
  if (!Array.isArray(r.existing_fields)) errors.push('existing_fields must be an array');
  else for (const f of r.existing_fields) if (keys(f, ['field_id', 'value'], 'existing_fields') && (!positiveInt(f.field_id) || typeof f.value !== 'string')) errors.push('Invalid existing field');
  if (!['not_attempted', 'already_present', 'conflict', 'blocked', 'attempted', 'verified', 'failed', 'withdrawn'].includes(r.write_status)) errors.push('Invalid write_status');
  if (r.write_status === 'withdrawn' && r.verified_fields?.length) errors.push('Withdrawn-only status cannot retain verified fields');
  if (!Array.isArray(r.verified_fields)) errors.push('verified_fields must be an array');
  else {
    if (r.write_status === 'verified' && !r.verified_fields.length) errors.push('Verified status requires returned field evidence');
    for (const f of r.verified_fields) {
      if (!keys(f, ['field_id', 'value', 'verified_at'], 'verified_fields')) continue;
      if (!positiveInt(f.field_id) || !date(f.verified_at)) errors.push('Invalid field verification');
      const t = f.field_id === config.colorField.id ? r.color : config.patternField.id && f.field_id === config.patternField.id ? r.veins : null;
      if (!t || t.value !== f.value || (r.write_status === 'verified' && (t.status !== 'scored' || t.confidence !== 'high'))) errors.push('Verified write must match a configured, high-confidence scored trait');
    }
  }
  return errors;
}
