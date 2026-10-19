// Public API reads and local evidence only. Authenticated edits use the browser UI.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {makeClient} from '../docs/js/api.js';
import {publicRecord} from '../docs/js/data.js';
import {validateReview} from './review-validation.mjs';
const root=new URL('../review-work/guide-review-2026-10-18/',import.meta.url);
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const lines=async p=>(await readFile(p,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const save=(p,o)=>writeFile(p,JSON.stringify(o,null,2)+'\n');
const config=await read(new URL('../docs/data/project.json',import.meta.url));
await mkdir(root,{recursive:true});
const mode=process.argv[2]||'prepare';
if(mode==='prepare'){
  const trial=await read(new URL('../review-work/redwood-trial-25/manifest.json',import.meta.url));
  const extra=await read(new URL('../review-work/additional-100-2026-10-18/manifest.json',import.meta.url));
  const rings=await lines(new URL('../docs/data/ring-revision-2026-10-18.jsonl',import.meta.url));
  const rows=[...await lines(new URL('../docs/data/trial-25-2026-10-18.jsonl',import.meta.url)),...await lines(new URL('../docs/data/additional-100-2026-10-18.jsonl',import.meta.url))];
  const snapshot=await read(new URL('../docs/data/observations.json',import.meta.url));
  const observations=[];
  for(let i=0;i<rows.length;i++){
    const row=rings.find(r=>r.observation_id===rows[i].observation_id)||rows[i];
    const old=i<25;const item=(old?trial:extra).observations.find(o=>o.observation_id===row.observation_id);
    const sourceIndex=old?item.old_index:item.index;
    const sourceRoot=old?'calibration-2026-10':'additional-100-2026-10-18';
    const record=snapshot.records.find(o=>o.id===row.observation_id);
    const before=Object.fromEntries(Object.entries(config.fields).map(([key,f])=>{const values=[...new Set(record.ofvs.filter(v=>v.field_id===f.id).map(v=>v.value))];if(values.length!==1)throw Error('Missing/conflicting baseline');return[key,values[0]];}));
    let cropPath=`review-work/${sourceRoot}/crops/${String(sourceIndex).padStart(3,'0')}.jpg`;
    try{await access(new URL('../'+cropPath,import.meta.url));}catch{console.log(`No prior crop: ${sourceIndex} / ${row.observation_id}`);cropPath=null;}
    observations.push({index:i+1,observation_id:row.observation_id,source_index:sourceIndex,source_root:`review-work/${sourceRoot}`,crop_path:cropPath,old_review:row,before,photos:item.photos});
  }
  if(observations.length!==125)throw Error('Expected 125');
  await save(new URL('manifest.json',root),{created_at:new Date().toISOString(),protocol_version:config.protocolVersion,observations});
  console.log('Prepared 125 review records');
}else if(mode==='baseline'){
  const manifest=await read(new URL('manifest.json',root));
  const request=makeClient();const records=[];
  for(const item of manifest.observations){const data=await request(`https://api.inaturalist.org/v1/observations/${item.observation_id}`);const o=data.results[0];if(o?.id!==item.observation_id)throw Error('Wrong observation');records.push({...publicRecord(o),photos:o.photos.map(p=>({id:p.id,url:p.url,license_code:p.license_code,attribution:p.attribution,original_dimensions:p.original_dimensions}))});if(records.length%25===0)console.log(`Read ${records.length} observations`);}
  await save(new URL('baseline.json',root),{checked_at:new Date().toISOString(),records});console.log('Refreshed field and photo-license baseline');
}else if(mode==='stage'){
  const manifest=await read(new URL('manifest.json',root));
  const baseline=await read(new URL('baseline.json',root));
  const notes=await read(new URL('review-notes.json',root));
  const decisions=notes.map(([index,changes,reasons])=>{
    const item=manifest.observations.find(o=>o.index===index);const current=baseline.records.find(o=>o.id===item.observation_id);
    for(const[key,f]of Object.entries(config.fields)){const vals=current.ofvs.filter(v=>v.field_id===f.id);if(!vals.length||vals.some(v=>v.value!==item.before[key]))throw Error(`Baseline changed ${current.id}: ${key}`);}
    if(item.photos.map(p=>p.id).join(',')!==current.photos.map(p=>p.id).join(','))throw Error(`Photo list changed ${current.id}`);
    return {index,observation_id:item.observation_id,taxon_id:current.taxon.id,reviewed_at:new Date().toISOString(),protocol_version:config.protocolVersion,before:item.before,values:{...item.before,...changes},reasons:Object.fromEntries(Object.keys(config.fields).map((key,i)=>[key,reasons[i]])),examined_photo_ids:[...new Set(Object.values(item.old_review).flatMap(t=>t?.evidence?.map(e=>e.photo_id)||[]))],changes:Object.entries(changes).map(([key,value])=>({trait:key,field_id:config.fields[key].id,before:item.before[key],after:value})),write_status:Object.keys(changes).length?'pending':'unchanged'};
  });
  await save(new URL('decisions.json',root),decisions);
  console.log(JSON.stringify(decisions.filter(r=>r.changes.length).map(r=>({index:r.index,id:r.observation_id,changes:r.changes,source:manifest.observations[r.index-1].source_root+'/'+String(manifest.observations[r.index-1].source_index).padStart(3,'0'),photos:baseline.records.find(o=>o.id===r.observation_id).photos.map(p=>({id:p.id,license:p.license_code}))})),null,2));
}else if(mode==='verify'){
  const baseline=await read(new URL('baseline.json',root));
  const reviews=await read(new URL('decisions.json',root));
  if(reviews.length!==125||new Set(reviews.map(r=>r.observation_id)).size!==125)throw Error('All 125 reviews required');
  const request=makeClient(),records=[],mismatches=[],unrelatedChanges=[];
  for(const r of reviews){const d=await request(`https://api.inaturalist.org/v1/observations/${r.observation_id}`);const o=publicRecord(d.results[0]);records.push(o);
    for(const[key,f]of Object.entries(config.fields)){const vals=o.ofvs.filter(v=>v.field_id===f.id);if(!vals.length||vals.some(v=>v.value!==r.values[key]))mismatches.push({observation_id:o.id,field_id:f.id,expected:r.values[key],returned:vals.map(v=>v.value)});}
    const before=baseline.records.find(b=>b.id===o.id);const fieldIds=Object.values(config.fields).map(f=>f.id);
    for(const f of before.ofvs.filter(f=>!fieldIds.includes(f.field_id)))if(!o.ofvs.some(v=>v.field_id===f.field_id&&v.value===f.value))unrelatedChanges.push({observation_id:o.id,missing:f});
    for(const f of o.ofvs.filter(f=>!fieldIds.includes(f.field_id)))if(!before.ofvs.some(v=>v.field_id===f.field_id&&v.value===f.value))unrelatedChanges.push({observation_id:o.id,unexpected:f});
    if(before.photos.map(p=>p.id).join(',')!==o.photos.map(p=>p.id).join(','))unrelatedChanges.push({observation_id:o.id,photo_list_changed:true});
    if(records.length%25===0)console.log(`Verified ${records.length} observations`);
  }
  await save(new URL('verification.json',root),{verified_at:new Date().toISOString(),source:'iNaturalist public observation-detail API',records,mismatches,unrelatedChanges});
  console.log(JSON.stringify({observations:records.length,expected_values:records.length*4,mismatches,unrelatedChanges}));if(mismatches.length||unrelatedChanges.length)process.exitCode=1;
}else if(mode==='finalize'){
  const manifest=await read(new URL('manifest.json',root));
  const baseline=await read(new URL('baseline.json',root));
  const decisions=await read(new URL('decisions.json',root));
  const verification=await read(new URL('verification.json',root));
  if(verification.records.length!==125||verification.mismatches.length||verification.unrelatedChanges.length)throw Error('A clean complete verification is required');
  const alternateViews=new Set([2,3,24,26,29,46,63,65,70,83,97,121]);
  const audit=decisions.map(d=>{
    const item=manifest.observations[d.index-1],old=item.old_review;
    const examined=[...new Set([...d.examined_photo_ids,...(alternateViews.has(d.index)?item.photos.map(p=>p.id):[])])];
    const row={observation_id:d.observation_id,taxon_id:d.taxon_id,reviewer:'Codex visual re-review of all 125 focal-flower records, with alternate views checked for proposed corrections; not independent validation',reviewed_at:d.reviewed_at,protocol_version:config.protocolVersion,examined_photo_ids:examined};
    for(const key of Object.keys(config.fields)){
      const value=d.values[key],uncertain=value==='Cannot be determined';
      row[key]={value,status:uncertain?'cannot_be_determined':'scored',confidence:uncertain?'not_applicable':'high',reason:d.reasons[key],evidence:structuredClone(old[key].evidence)};
    }
    // The more frontal alternate, rather than the cupped focal view, resolves this ring.
    if(d.index===83)row.ring.evidence=[{photo_id:119210099,flower:'More frontal alternate view; narrow white rim around yellow throat visible across at least three bases. Approximate source flower width.',source_diameter_px:1400,assessment_diameter_px:300,visible_upper_petals:5}];
    row.existing_fields=baseline.records.find(o=>o.id===d.observation_id).ofvs.map(({field_id,value})=>({field_id,value}));
    row.write_status=d.changes.length?'verified':'already_present';
    const returned=verification.records.find(o=>o.id===d.observation_id);
    row.verified_fields=Object.entries(config.fields).map(([key,f])=>{
      const found=returned.ofvs.filter(v=>v.field_id===f.id);
      if(!found.length||found.some(v=>v.value!==d.values[key]))throw Error('Verification no longer matches decisions');
      return{field_id:f.id,value:d.values[key],verified_at:verification.verified_at};
    });
    const errors=validateReview(row,config);if(errors.length)throw Error(`${row.observation_id}: ${errors.join('; ')}`);
    return row;
  });
  const counts=Object.fromEntries(Object.entries(config.fields).map(([key,f])=>[key,Object.fromEntries(f.values.map(value=>[value,audit.filter(r=>r[key].value===value).length]))]));
  const corrections=decisions.filter(d=>d.changes.length).map(d=>({observation_id:d.observation_id,changes:d.changes.map(c=>({...c,reason:d.reasons[c.trait]})),verified_at:verification.verified_at}));
  const output=new URL('../docs/data/',import.meta.url);
  await writeFile(new URL('guide-review-2026-10-18.jsonl',output),audit.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await save(new URL('guide-review-2026-10-18-summary.json',output),{protocol_version:config.protocolVersion,review_scope:'All 125 observations labeled with the four Redwood Sorrel fields. Focal close-ups re-reviewed; alternate views checked for proposed corrections. Earlier full-photo audits preserved.',observations:audit.length,expected_fields:500,corrected_values:corrections.reduce((n,r)=>n+r.changes.length,0),unchanged_values:500-corrections.reduce((n,r)=>n+r.changes.length,0),verified_at:verification.verified_at,verification_source:verification.source,mismatches:verification.mismatches,unrelated_changes:verification.unrelatedChanges,counts,corrections});
  const changeList=corrections.map(r=>r.changes.map(c=>`- [${r.observation_id}](https://www.inaturalist.org/observations/${r.observation_id}) — ${config.fields[c.trait].name}: **${c.before} → ${c.after}**. ${c.reason}`).join('\n')).join('\n');
  const countList=Object.entries(counts).map(([key,values])=>`- **${config.fields[key].name.replace('Redwood Sorrel ','')}:** ${Object.entries(values).map(([value,count])=>`${count} ${value}`).join(', ')}.`).join('\n');
  const report=`# Photographic guide and 125-observation re-review

18 October 2026 (local project date) · protocol 2.1.0, with clarified photographic anchors

All **125 observations carrying the four Redwood Sorrel fields** were re-reviewed for all four traits. **17 field values changed and 483 stayed unchanged.** The owner's examples [159722286](https://www.inaturalist.org/observations/159722286) and [272127265](https://www.inaturalist.org/observations/272127265) now both have **Low Petal Pigment Variation**. There were 13 None-to-Low variation corrections and four reductions in vein contrast. No petal-color or ring score changed.

The [photographic scoring guide](photo-guide.html) contains **39 trait-specific example cards from 25 licensed photographs**, with close-ups, explanations, original-photo links, attribution, and individual licenses. It illustrates ranges within categories and why a trait may be indeterminate. All displayed sources carry CC0, CC BY, or CC BY-NC photo licenses, checked against fresh public metadata. Crops preserve the source colors and are displayed at no more than 300 pixels wide.

## What changed in the interpretation

The two owner-specified examples establish that modest, repeated broad paling within the petal qualifies as Low, even when the flower has a single overall hue. None remains appropriate when the background is nearly uniform after excluding narrow veins, the throat, and a separate white basal ring. A compact ring alone does not establish variation. See the [updated protocol](protocol.md#petal-pigment-variation).

Fine visible lines were also distinguished more consistently from a dominant vein network: two High scores became Medium and two Medium scores became Low. Other traits were checked independently. A possible ring downgrade on observation 73049976 was rejected after alternate photo 119210099 exposed a distinct white rim; its Clear score was retained.

No confident High-variation example was found within the 125. Figure 1 F remains the High reference; the guide states this gap explicitly. Only one of the four Faint-ring observations had a photo under the three permitted license types, so the guide shows one Faint close-up. The working comparison 294114815 is linked in the protocol but its all-rights-reserved photo is not reproduced.

## Review and verification

This pass re-examined the focal flower evidence for every record and checked alternate views for proposed corrections. The earlier full-photo reviews and their source-size measurements are retained as history. The new [125-row audit](data/guide-review-2026-10-18.jsonl) records each retained or revised trait, its reason, photo evidence, existing fields, and returned field values. This is a refinement by the same reviewer, not an independent inter-rater validation study.

The iNaturalist interface was used to edit existing entries added by twsummer. Reload checks were followed by fresh public observation-detail API reads of all 125 observations. Verification completed at **${verification.verified_at}**: all **500 expected field values** matched, with **zero mismatches and zero unrelated field or photo-list changes**. The atlas snapshot was refreshed separately from the public field API after verification.

The [machine-readable summary and correction log](data/guide-review-2026-10-18-summary.json) contains the exact before/after values. The [photo provenance manifest](data/photo-guide-assets.json) preserves source IDs, image license metadata, crop evidence, and file hashes. Local evidence caches remain outside the public repository.

## Current values across all 125 observations

${countList}

These are 311 determinate and 189 explicitly indeterminate assessments. They are convenience-sample counts, not population frequencies or an estimate of biological trait prevalence.

## Corrections

${changeList}

## Historical records

The [first 25-observation trial](trial-25-report.md), [ring revision](data/ring-revision-2026-10-18.jsonl), and [additional 100-observation batch](additional-100-report.md) remain unchanged as historical audits. This re-review supersedes their affected current-field judgments. The older, different-field feasibility pilot is outside this re-review's scope and does not feed the current atlas.
`;
  await writeFile(new URL('../docs/guide-review-report.md',import.meta.url),report);
  console.log(JSON.stringify({audit_rows:audit.length,corrections:corrections.length,counts}));
}else throw Error('Use prepare, baseline, stage, verify, or finalize');
