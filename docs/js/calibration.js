import {photoUrl, observationUrl} from './data.js';
const $ = id => document.getElementById(id);
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const link = (text, href) => {const a = el('a', text); a.href = href; return a;};
const human = value => value?.replaceAll('_', ' ') || 'withheld';
const species = id => id === 47757 ? 'O. oregana' : 'O. smalliana';
const sum = counts => Object.values(counts).reduce((a,b)=>a+b,0);
const descriptions = {
  4: ['White · conspicuous veins', 'Strong purple lines can coexist with white interveinal tissue. Several distal forks are visible, but this is not a validated branching class.'],
  14: ['White · faint / not visible', 'A contrasting vein state within the same background-color class. Faint means the contrast threshold was not met with adequate detail; it does not mean anatomical veins are absent.'],
  80: ['Purple · faint / not visible', 'A pigmented background does not automatically make the vein contrast conspicuous. This was one of only three faint-vein judgments.'],
  81: ['Two views, different apparent vein color', 'The diffuse-light view shows purple lines; the brighter view makes them much paler. The reviewer used the usable view for contrast and did not assign a vein-hue category.'],
  94: ['Blue · conspicuous veins', 'Distinct darker lines and distal forks on a blue background. The blue class was represented by only two scored observations.']
};
try {
  const response = await fetch('data/calibration-2026-10.json');
  if (!response.ok) throw new Error(`Audit unavailable (HTTP ${response.status}).`);
  const data = await response.json(), c = data.counts;
  $('verification').textContent = `All ${c.field_values_written} unique saved values confirmed by the public iNaturalist observation-detail API on ${new Date(data.api_verified_at).toLocaleString()}. Map snapshot reconciled with those responses.`;
  for (const [name, count] of [['Background color', sum(c.color_scored)], ['Vein contrast', sum(c.veins_scored)]]) {
    const item = el('div', undefined, 'coverage-item');
    item.append(el('h3', name));
    const track = el('div', undefined, 'coverage-track'), scored = el('span');
    scored.style.width = `${count}%`; track.append(scored); track.setAttribute('aria-hidden','true');
    item.append(track, el('p', `${count} scorable · ${100-count} withheld / unsuitable`));
    $('coverage-bars').append(item);
  }
  for (const name of ['white','blue','purple','pink']) $('class-counts').append(el('span', `${human(name)}: ${c.color_scored[name] || 0} scored / ${c.color_written[name] || 0} saved`));
  for (const name of ['conspicuous','faint_or_not_visible']) $('class-counts').append(el('span', `${human(name)}: ${c.veins_scored[name] || 0} scored / ${c.veins_written[name] || 0} saved`));
  // Put the paired-lighting example last so its two complete source photos have room.
  for (const example of [...data.examples].sort((a,b)=>(a.index===81)-(b.index===81))) {
    const [title, caption] = descriptions[example.index], card = el('article', undefined, 'pilot-example');
    card.append(el('h3', title));
    const photos = el('div', undefined, example.photos.length > 1 ? 'photo-pair' : 'photo-single');
    for (const photo of example.photos) {
      const url = photoUrl(photo, 'large');
      if (!url) continue;
      const a = link('', `https://www.inaturalist.org/photos/${photo.id}`);
      const img = el('img'); img.src = url; img.alt = `${title}; source photo ${photo.id}`; img.loading = 'lazy';
      a.append(img); photos.append(a);
    }
    card.append(photos, el('p', caption));
    card.append(link(`Observation ${example.observation_id} ↗`, observationUrl(example.observation_id)));
    const credit = el('p', [...new Set(example.photos.map(p=>p.attribution))].join(' · '), 'credit');
    credit.append(' · ', link('CC BY-NC 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'));
    card.append(credit); $('pilot-examples').append(card);
  }
  $('sampling-details').textContent = `Sample retrieved: ${data.sampled_at}\nSeed: ${data.seed}\n${data.pools.map(p=>`${species(p.taxon_id)}: ${p.candidates} candidates; ${p.sampled} selected; highest candidate ID ${p.max_observation_id}`).join('\n')}\n\n${data.sampling_method}\n\n${data.notes.join('\n')}`;
  function renderAudit() {
    const outcome = $('audit-outcome').value, taxon = $('audit-taxon').value, query = $('audit-search').value.trim();
    const rows = data.records.filter(r => (!taxon || r.taxon_id === Number(taxon)) && (!query || String(r.observation_id).includes(query))
      && (!outcome || (outcome === 'written' && r.verified_fields.length) || (outcome === 'blocked' && r.blocked_reason) || (outcome === 'withheld' && !r.color.value && !r.veins.value)));
    $('audit-count').textContent = `${rows.length} of ${data.records.length} observations`;
    $('audit-records').replaceChildren();
    for (const r of rows) {
      const detail = el('details', undefined, 'audit-row'), summary = el('summary');
      summary.append(el('span', `${String(r.index).padStart(3,'0')} · ${r.observation_id} · ${species(r.taxon_id)}`), el('span', `${human(r.color.value)} / ${human(r.veins.value)} · ${r.blocked_reason ? 'permission blocked' : `${r.verified_fields.length} saved`}`, 'audit-traits'));
      const body = el('div', undefined, 'audit-body');
      body.append(link('Open observation on iNaturalist ↗', observationUrl(r.observation_id)));
      for (const [name, trait] of [['Color', r.color], ['Veins', r.veins]]) body.append(el('p', `${name}: ${human(trait.value || trait.status)}. ${trait.reason}`));
      body.append(el('p', `Branching note: ${r.branching_note}`), el('p', `Vein-hue note: ${r.vein_color_note || 'Not separately recorded; hue notes began partway through the pilot.'}`));
      if (r.blocked_reason) body.append(el('p', r.blocked_reason));
      if (r.verified_fields.length) body.append(el('p', `Saved fields: ${r.verified_fields.map(f=>`#${f.field_id} = ${f.value}`).join('; ')}. API checked ${r.api_verified_at}.`));
      const evidence = r.color.evidence[0];
      if (evidence) body.append(el('p', `Selected source flower: photo ${evidence.photo_id}, approximately ${evidence.source_diameter_px}px diameter, ${evidence.visible_upper_petals} assessable upper petals; displayed in a 300px crop. Pixel size alone does not establish adequate focus.`));
      const photos = el('p', 'Examined photos: ');
      r.examined_photo_ids.forEach((id,i)=>{if(i)photos.append(', ');photos.append(link(String(id),`https://www.inaturalist.org/photos/${id}`));});
      body.append(photos); detail.append(summary,body); $('audit-records').append(detail);
    }
  }
  for (const id of ['audit-outcome','audit-taxon']) $(id).addEventListener('change',renderAudit);
  $('audit-search').addEventListener('input',renderAudit);
  renderAudit();
} catch (error) {
  $('verification').textContent = 'The audit could not be loaded; totals above describe the completed October pilot.';
  $('load-error').hidden = false; $('load-error').textContent = `${error.message} Use the downloadable audit or try reloading.`;
}
