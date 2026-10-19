// Public reads and local audit only. Existing iNaturalist values are edited in the UI.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {makeClient} from '../docs/js/api.js';
import {publicRecord} from '../docs/js/data.js';
import {validateReview} from './review-validation.mjs';
const root = new URL('../review-work/ring-edge-review-2026-10-18/', import.meta.url);
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const save = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const config = await json(new URL('../docs/data/project.json', import.meta.url));
await mkdir(root, {recursive:true});
const mode=process.argv[2] || 'prepare';
if(mode==='prepare') {
  const prior=(await readFile(new URL('../docs/data/guide-review-2026-10-18.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
  const source=await json(new URL('../review-work/guide-review-2026-10-18/manifest.json',import.meta.url));
  const records=prior.filter(r=>r.ring.value!=='Cannot be determined').map((r,i)=>({...source.observations.find(o=>o.observation_id===r.observation_id),index:i+1,prior_review:r,before:Object.fromEntries(Object.keys(config.fields).map(k=>[k,r[k].value]))}));
  if(records.length!==32)throw Error('Expected 32 determinate ring labels');
  await save(new URL('manifest.json',root),{created_at:new Date().toISOString(),observations:records});
  console.log('Prepared 32 ring reviews; previous audits retained.');
} else if(mode==='baseline'||mode==='verify') {
  const manifest=await json(new URL('manifest.json',root));
  const notes=mode==='verify'?await json(new URL('decisions.json',root)):[];
  const before=mode==='verify'?await json(new URL('baseline.json',root)):null;
  const request=makeClient(),records=[],mismatches=[],unrelatedChanges=[];
  for(const item of manifest.observations){
    const data=await request(`https://api.inaturalist.org/v1/observations/${item.observation_id}`);
    const record=publicRecord(data.results[0]); if(record.id!==item.observation_id)throw Error('Wrong observation'); records.push(record);
    const target=mode==='verify'?notes.find(n=>n.observation_id===item.observation_id)?.values:item.before;
    if(!target)throw Error('Missing decision');
    for(const [key,f] of Object.entries(config.fields)){const values=record.ofvs.filter(v=>v.field_id===f.id);if(!values.length||values.some(v=>v.value!==target[key]))mismatches.push({observation_id:record.id,field_id:f.id,expected:target[key],actual:values.map(v=>v.value)});}
    if(before){const original=before.records.find(o=>o.id===record.id),ids=Object.values(config.fields).map(f=>f.id); const unrelated=o=>JSON.stringify(o.ofvs.filter(f=>!ids.includes(f.field_id)).sort((a,b)=>a.field_id-b.field_id||a.value.localeCompare(b.value)));if(unrelated(original)!==unrelated(record))unrelatedChanges.push(record.id);if(JSON.stringify(original.photos.map(p=>p.id))!==JSON.stringify(record.photos.map(p=>p.id)))unrelatedChanges.push({observation_id:record.id,photos_changed:true});}
    if(records.length%8===0)console.log(`Read ${records.length}/32`);
  }
  await save(new URL(mode==='baseline'?'baseline.json':'verification.json',root),{checked_at:new Date().toISOString(),records,mismatches,unrelatedChanges});
  console.log(JSON.stringify({observations:records.length,fields:records.length*4,mismatches,unrelatedChanges}));if(mismatches.length||unrelatedChanges.length)process.exitCode=1;
} else if(mode==='finalize'){
  const manifest=await json(new URL('manifest.json',root)),baseline=await json(new URL('baseline.json',root)),decisions=await json(new URL('decisions.json',root)),verified=await json(new URL('verification.json',root));
  if(verified.records.length!==32||verified.mismatches.length||verified.unrelatedChanges.length)throw Error('Clean verification required');
  if(decisions.length!==32||new Set(decisions.map(d=>d.observation_id)).size!==32)throw Error('Expected 32 unique decisions');
  for(const d of decisions)for(const [key,f] of Object.entries(config.fields)){
    const returned=verified.records.find(r=>r.id===d.observation_id)?.ofvs.filter(v=>v.field_id===f.id);
    if(!returned?.length||returned.some(v=>v.value!==d.values[key]))throw Error('Verification does not match current decisions');
  }
  const reviews=decisions.map(d=>{
    const item=manifest.observations.find(o=>o.observation_id===d.observation_id),r=structuredClone(item.prior_review);
    r.reviewer='Codex ring-edge re-review following owner examples; color and vein scores retained from prior audit';r.reviewed_at=d.reviewed_at;r.examined_photo_ids=[...new Set([...r.examined_photo_ids,...d.examined_photo_ids])];
    for(const key of ['ring','variation'])if(d.reasons[key]){const value=d.values[key],uncertain=value==='Cannot be determined';r[key]={...r[key],value,status:uncertain?'cannot_be_determined':'scored',confidence:uncertain?'not_applicable':'high',reason:d.reasons[key]};}
    r.existing_fields=baseline.records.find(o=>o.id===r.observation_id).ofvs.map(({field_id,value})=>({field_id,value}));r.write_status=d.changes.length?'verified':'already_present';
    r.verified_fields=Object.entries(config.fields).map(([key,f])=>({field_id:f.id,value:d.values[key],verified_at:verified.checked_at}));
    const errors=validateReview(r,config);if(errors.length)throw Error(`${r.observation_id}: ${errors.join('; ')}`);return r;
  });
  await writeFile(new URL('../docs/data/ring-edge-review-2026-10-18.jsonl',import.meta.url),reviews.map(r=>JSON.stringify(r)).join('\n')+'\n');
  const prior=(await readFile(new URL('../docs/data/guide-review-2026-10-18.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
  const current=prior.map(r=>reviews.find(n=>n.observation_id===r.observation_id)||r);
  const summary={protocol_version:config.protocolVersion,review_scope:'All 32 previously determinate ring scores; 93 existing indeterminate ring scores retained. Other traits revisited only where separating a ring from pigment variation was unresolved.',verified_at:verified.checked_at,observations:32,verified_field_values:128,mismatches:verified.mismatches,unrelated_changes:verified.unrelatedChanges,corrections:decisions.filter(d=>d.changes.length),ring_counts_in_review:Object.fromEntries(config.fields.ring.values.map(v=>[v,reviews.filter(r=>r.ring.value===v).length])),current_counts_all_125:Object.fromEntries(Object.entries(config.fields).map(([key,f])=>[key,Object.fromEntries(f.values.map(v=>[v,current.filter(r=>r[key].value===v).length]))]))};
  await save(new URL('../docs/data/ring-edge-review-2026-10-18-summary.json',import.meta.url),summary);
  const totalChanges=summary.corrections.reduce((n,d)=>n+d.changes.length,0);
  const report=[
    '# White center ring: clarified boundaries and re-review',
    '18 October 2026 (local project date) · protocol 2.1.0 · later than the initial photographic-guide review',
    `The owner’s feedback led to a fresh check of **all 32 previously determinate ring scores** among the 125 labeled observations. **${summary.corrections.length} observations changed, covering ${totalChanges} field values**: 15 ring scores and eight pigment-variation scores. The 93 already-indeterminate ring scores were retained. Color and vein scores were retained from the earlier review.`,
    '## Boundary decisions',
    '- **Clear requires obvious edges.** [77541853](https://www.inaturalist.org/observations/77541853) remains Clear and is now the leading photographic anchor. At the standard 300 px view, the outer edge of the white band must be locatable on at least three petal bases. A pale center alone is insufficient.\n- **Faint requires an identifiable weak, localized band.** The owner’s examples [113980346](https://www.inaturalist.org/observations/113980346) and [159722286](https://www.inaturalist.org/observations/159722286) changed from Absent to Faint. Their Low pigment-variation scores remain.\n- **Diffuse inner paling can be unresolved.** [362970560](https://www.inaturalist.org/observations/362970560) and [27136204](https://www.inaturalist.org/observations/27136204) now have Cannot be determined for both ring and variation. The pale region cannot confidently be isolated as a ring; excluding it could change the variation score. This uncertainty does not automatically establish Faint or High variation.',
    'The [photographic guide](photo-guide.html#ring) and [protocol](protocol.md#white-center-ring) now show those boundaries. No confirmed Absent-ring photograph remains in the reviewed 125; Figure 1 D/F retain that definition. High pigment variation also still lacks a confirmed photographic example in this set. These gaps are stated rather than filled with ambiguous images.',
    '## Scope and verification',
    'This pass re-examined the standard-size focal crops for all 32 determinate ring scores and consulted alternate views for borderline cases. Earlier photo inventories and source-size measurements remain in the audit. This is a same-reviewer correction following owner feedback, not independent validation. The other 93 ring scores were already Cannot be determined and were not newly visually reviewed in this pass.',
    `Existing entries added by twsummer were edited through the iNaturalist interface. Fresh public observation-detail responses confirmed **all 128 expected field values** for the 32 observations at **${verified.checked_at}**, with **zero mismatches and zero unrelated field or photo-list changes**. No identification, location, license, or comment edits were made.`,
    'The [32-row audit](data/ring-edge-review-2026-10-18.jsonl) records the current decisions, reasons, photo evidence and verification. The [machine-readable summary](data/ring-edge-review-2026-10-18-summary.json) records exact before/after values. Apply this audit over the [earlier 125-row review](data/guide-review-2026-10-18.jsonl) when reconstructing the current labels; preserve both as history. The live atlas reads the iNaturalist fields, not these audit files.',
    '## Current counts across all 125',
    ...Object.entries(config.fields).map(([key,f])=>`- **${f.name.replace('Redwood Sorrel ','')}:** ${Object.entries(summary.current_counts_all_125[key]).map(([v,n])=>`${n} ${v}`).join(', ')}.`),
    'These are convenience-sample counts, not population frequencies. Field names, IDs, and allowed values are unchanged.',
    '## Corrections',
    ...summary.corrections.map(d=>`- [${d.observation_id}](https://www.inaturalist.org/observations/${d.observation_id}) — ${d.changes.map(c=>`${config.fields[c.trait].name.replace('Redwood Sorrel ','')}: **${c.before} → ${c.after}**`).join('; ')}. ${d.reasons.ring}`)
  ].join('\n\n')+'\n';
  await writeFile(new URL('../docs/ring-edge-review-report.md',import.meta.url),report);
  console.log(JSON.stringify({reviewed:reviews.length,changedObservations:summary.corrections.length,changedValues:summary.corrections.reduce((n,d)=>n+d.changes.length,0),ringCounts:summary.ring_counts_in_review}));
} else if(mode==='snapshot'){
  const snapshot=await json(new URL('../docs/data/observations.json',import.meta.url));
  const prior=(await readFile(new URL('../docs/data/guide-review-2026-10-18.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
  const latest=(await readFile(new URL('../docs/data/ring-edge-review-2026-10-18.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
  const current=prior.map(r=>latest.find(n=>n.observation_id===r.observation_id)||r),mismatches=[];
  if(!snapshot.complete||snapshot.records.length!==125)throw Error('Expected a complete 125-observation snapshot');
  for(const r of current)for(const [key,f] of Object.entries(config.fields)){
    const values=snapshot.records.find(o=>o.id===r.observation_id)?.ofvs.filter(v=>v.field_id===f.id);
    if(!values?.length||values.some(v=>v.value!==r[key].value))mismatches.push({observation_id:r.observation_id,trait:key,expected:r[key].value,actual:values});
  }
  const result={fetched_at:snapshot.fetchedAt,observations:125,expected_values:500,mismatches};
  await save(new URL('snapshot-verification.json',root),result);
  if(mismatches.length)throw Error(`Snapshot has ${mismatches.length} mismatches`);
  const summaryFile=new URL('../docs/data/ring-edge-review-2026-10-18-summary.json',import.meta.url),summary=await json(summaryFile);
  summary.snapshot_verification=result;await save(summaryFile,summary);
  const reportFile=new URL('../docs/ring-edge-review-report.md',import.meta.url),report=await readFile(reportFile,'utf8');
  await writeFile(reportFile,report.replace('## Current counts across all 125',`The public-field atlas snapshot was refreshed at **${snapshot.fetchedAt}** and checked against the latest combined audits: **all 500 expected values across 125 observations matched**. The ring field’s short description was also updated in iNaturalist to require obvious Clear edges and distinguish localized Faint bands from unresolved ring/variation. Its name, ID, and allowed values were preserved.\n\n## Current counts across all 125`));
  console.log(JSON.stringify(result));
} else throw Error('Use prepare, baseline, verify, finalize, or snapshot');
