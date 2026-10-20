export function validateReview(r, config) {
  const errors = [];
  const positiveInt = v => Number.isSafeInteger(v) && v > 0;
  const date = v => typeof v === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
  const nonempty = v => typeof v === 'string' && Boolean(v.trim());
  const keys = (o, allowed, path) => { if (!o || typeof o !== 'object' || Array.isArray(o)) { errors.push(`${path} must be an object`); return false; } for (const k of allowed) if (!(k in o)) errors.push(`${path}.${k} is required`); for (const k of Object.keys(o)) if (!allowed.includes(k)) errors.push(`${path}.${k} is not allowed`); return true; };
  if (!keys(r, ['observation_id', 'taxon_id', 'reviewer', 'reviewed_at', 'protocol_version', 'examined_photo_ids', ...Object.keys(config.fields), 'existing_fields', 'write_status', 'verified_fields'], 'review')) return errors;
  if (!positiveInt(r.observation_id) || !positiveInt(r.taxon_id)) errors.push('Observation and taxon IDs must be positive integers');
  if (!nonempty(r.reviewer) || !date(r.reviewed_at)) errors.push('Reviewer and ISO timestamp with timezone are required');
  if (r.protocol_version !== config.protocolVersion) errors.push('Protocol version does not match project configuration');
  if (!Array.isArray(r.examined_photo_ids) || r.examined_photo_ids.some(v => !positiveInt(v)) || new Set(r.examined_photo_ids).size !== r.examined_photo_ids.length) errors.push('examined_photo_ids must be unique positive integers');
  const statuses = ['scored', 'cannot_be_determined', 'no_open_flower', 'out_of_scope', 'not_assessed'];
  for (const name of Object.keys(config.fields)) {
    const t = r[name]; if (!keys(t, ['value', 'status', 'confidence', 'reason', 'evidence'], name)) continue;
    const allowed = config.fields[name].values;
    if (t.value !== null && !allowed.includes(t.value)) errors.push(`${name}: unsupported value`);
    if (!statuses.includes(t.status) || !['high', 'medium', 'low', 'not_applicable'].includes(t.confidence) || !nonempty(t.reason)) errors.push(`${name}: status, confidence, or reason invalid`);
    if (!Array.isArray(t.evidence)) { errors.push(`${name}: evidence must be an array`); continue; }
    if (t.status === 'scored' && (t.value === null || t.value === 'Cannot be determined' || !t.evidence.length || t.confidence === 'not_applicable')) errors.push(`${name}: scored requires a substantive value, confidence, and evidence`);
    if (t.status === 'cannot_be_determined' && (t.value !== 'Cannot be determined' || !t.evidence.length)) errors.push(`${name}: indeterminate requires the exact field value and evidence of an examined open flower`);
    if (!['scored', 'cannot_be_determined'].includes(t.status) && t.value !== null) errors.push(`${name}: unassessed, out-of-scope, and nonflowering entries must have null values`);
    for (const e of t.evidence) {
      if (!keys(e, ['photo_id', 'flower', 'source_diameter_px', 'assessment_diameter_px', 'visible_upper_petals'], `${name}.evidence`)) continue;
      if (!positiveInt(e.photo_id) || !r.examined_photo_ids?.includes(e.photo_id) || !nonempty(e.flower)) errors.push(`${name}: evidence must refer to an examined photo and describe the flower`);
      if (![e.source_diameter_px, e.assessment_diameter_px].every(v => Number.isFinite(v) && v > 0) || !Number.isInteger(e.visible_upper_petals) || e.visible_upper_petals < 0 || e.visible_upper_petals > 5) errors.push(`${name}: invalid evidence measurements`);
      // The legacy assessment_diameter_px key records square crop width, not flower diameter.
      if (t.status === 'scored' && (e.source_diameter_px < (name === 'color' ? 150 : 300) || e.visible_upper_petals < 3 || (name !== 'color' && e.assessment_diameter_px !== 300))) errors.push(`${name}: scored evidence fails source-size/petal/crop-width rules`);
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
      const name = Object.keys(config.fields).find(key => config.fields[key].id === f.field_id), t = r[name];
      if (!t || t.value !== f.value || !(t.status === 'cannot_be_determined' || (t.status === 'scored' && t.confidence === 'high'))) errors.push('Verified write must match a configured high-confidence score or documented indeterminate outcome');
    }
  }
  return errors;
}
