import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { makeClient, queryUrl } from '../docs/js/api.js';
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const root = new URL(`../review-work/protocol-${config.protocolVersion}/`, import.meta.url);
await mkdir(root, { recursive: true });
const checkpoint = new URL('inventory-checkpoint.json', root);
const request = makeClient({ interval: config.requestIntervalMs });
const scope = config.taxa.map(t => t.id).join(',');
let state;
try { state = JSON.parse(await readFile(checkpoint, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
async function atomic(url, content) { const temp = new URL(url.href + '.tmp'); await writeFile(temp, content); await rename(temp, url); }
if (!state) {
  const latest = await request(queryUrl(config, { photos: 'true', per_page: '1', order: 'desc' }));
  state = { scope, protocolVersion: config.protocolVersion, startedAt: new Date().toISOString(), cutoffId: latest.results[0]?.id || 0, cursor: 0, count: 0, complete: false };
  await atomic(checkpoint, JSON.stringify(state, null, 2));
}
if (state.scope !== scope || state.protocolVersion !== config.protocolVersion) throw new Error('Taxon scope or protocol differs from checkpoint. Preserve this inventory and start a separate review-work directory.');
if (state.complete) { console.log(`Inventory complete through observation ${state.cutoffId}: ${state.count} records. See review-work/protocol-${config.protocolVersion}/candidates.jsonl.`); process.exit(0); }
// Each batch is named by its starting cursor. A crash before checkpointing safely replaces
// the same batch on resume, rather than appending duplicates to the final inventory.
while (true) {
  const data = state.cutoffId ? await request(queryUrl(config, { photos: 'true', id_above: String(state.cursor), id_below: String(state.cutoffId + 1) })) : { results: [] };
  if (data.results.length) {
    const next = Math.max(...data.results.map(o => o.id));
    if (next <= state.cursor || next > state.cutoffId) throw new Error('Unexpected pagination bounds; previous checkpoint retained.');
    const batch = data.results.map(o => ({ observation_id: o.id, url: `https://www.inaturalist.org/observations/${o.id}`, taxon_id: o.taxon?.id, taxon_name: o.taxon?.name, retrieved_at: new Date().toISOString(), observed_on: o.observed_on, photo_ids: (o.photos || []).map(p => p.id), photos: (o.photos || []).map(p => ({ id: p.id, url: p.url, license: p.license_code, attribution: p.attribution })), existing_fields: (o.ofvs || []).map(f => ({ field_id: f.field_id, value: f.value })) }));
    await atomic(new URL(`batch-${String(state.cursor).padStart(12, '0')}.jsonl`, root), batch.map(o => JSON.stringify(o)).join('\n') + '\n');
    state.cursor = next; state.count += batch.length;
  }
  const finished = data.results.length < 200 || state.cursor === state.cutoffId;
  if (finished) {
    // Assemble before marking complete, so interrupted assembly will be retried.
    const batches = (await readdir(root)).filter(n => /^batch-\d+\.jsonl$/.test(n)).sort();
    const unique = new Map();
    for (const name of batches) for (const line of (await readFile(new URL(name, root), 'utf8')).trim().split('\n').filter(Boolean)) { const record = JSON.parse(line); unique.set(record.observation_id, record); }
    await atomic(new URL('candidates.jsonl', root), [...unique.values()].sort((a, b) => a.observation_id - b.observation_id).map(o => JSON.stringify(o)).join('\n') + '\n');
    state.count = unique.size; state.complete = true; state.completedAt = new Date().toISOString();
  }
  await atomic(checkpoint, JSON.stringify(state, null, 2));
  console.log(`${state.count} candidates inventoried; cursor ${state.cursor}; cutoff ${state.cutoffId}${state.complete ? '; complete' : ''}.`);
  if (state.complete) break;
}
