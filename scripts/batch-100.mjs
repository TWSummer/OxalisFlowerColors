// Public reads and local audit preparation only; field submissions use the browser UI.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeClient } from '../docs/js/api.js';
import { publicRecord } from '../docs/js/data.js';
import { validateReview } from './review-validation.mjs';
const root = new URL('../review-work/additional-100-2026-10-18/', import.meta.url);
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
await mkdir(new URL('originals/',root),{recursive:true});
const json = async path => JSON.parse(await readFile(path,'utf8'));
const save = (path,value) => writeFile(path,JSON.stringify(value,null,2)+'\n');
const request = makeClient();
const mode = process.argv[2] || 'prepare';
if (mode === 'prepare') {
  let manifest;
  try { manifest = await json(new URL('manifest.json',root)); } catch(e) { if(e.code!=='ENOENT') throw e; }
  if (!manifest) {
    const old = await json(new URL('../review-work/calibration-2026-10/manifest.json',import.meta.url));
    const labeled = await json(new URL('../docs/data/observations.json',import.meta.url));
    const excluded = new Set([...old.observations.map(o=>o.observation_id),...labeled.records.map(o=>o.id)]);
    const seed='redwood-additional100-2026-10-18-v2.1.0';
    const ranked=[];
    for(const taxon of config.taxa){
      const pool=await json(new URL(`../review-work/calibration-2026-10/pool-${taxon.id}.json`,import.meta.url));
      const rank=o=>createHash('sha256').update(seed+':'+o.observation_id).digest('hex');
      ranked.push(pool.filter(o=>!excluded.has(o.observation_id)&&!o.existing_fields.some(f=>Object.values(config.fields).some(v=>v.id===f.field_id))).sort((a,b)=>rank(a).localeCompare(rank(b))).slice(0,90));
    }
    const candidates=ranked[0].flatMap((o,i)=>[o,ranked[1][i]]).filter(Boolean);
    manifest={created_at:new Date().toISOString(),protocolVersion:config.protocolVersion,target:100,seed,method:'Interleaved seeded ordering within both taxa from the previously retrieved Flowers-annotated public pool. All historical-pilot and already-new-field-labeled observations excluded. Current public details and photos refreshed before review. Convenience/annotation-selected sample, not population frequency or independent validation. Continue candidates until 100 new observations are verified.',candidates:candidates.map(o=>o.observation_id),observations:[]};
    await save(new URL('manifest.json',root),manifest);
  }
  const limit=Number(process.argv[3]||140);
  for(let i=0;i<Math.min(limit,manifest.candidates.length);i++){
    const id=manifest.candidates[i];
    let record=manifest.observations.find(o=>o.observation_id===id);
    if(!record){
      const data=await request(`https://api.inaturalist.org/v1/observations/${id}`); const o=data.results[0];
      if(!o||o.id!==id)throw Error(`Missing observation ${id}`);
      record={index:i+1,observation_id:id,retrieved_at:new Date().toISOString(),...publicRecord(o),photos:o.photos.map(p=>({id:p.id,url:p.url,original_dimensions:p.original_dimensions,license_code:p.license_code,attribution:p.attribution}))};
      manifest.observations.push(record);await save(new URL('manifest.json',root),manifest);
    }
    for(const p of record.photos){const dest=new URL(`originals/${p.id}.jpg`,root);try{await access(dest);continue}catch(e){if(e.code!=='ENOENT')throw e;}
      const url=new URL(p.url.replace('/square.','/original.'));
      if(url.protocol!=='https:'||!['static.inaturalist.org','inaturalist-open-data.s3.amazonaws.com'].includes(url.hostname))throw Error('Unexpected photo host');
      const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Photo ${p.id}: ${response.status}`);
      await writeFile(dest,new Uint8Array(await response.arrayBuffer()));
    }
    if((i+1)%10===0)console.log(`Prepared ${i+1} candidates`);
  }
  console.log(`Prepared ${manifest.observations.length} candidates, ${manifest.observations.reduce((n,o)=>n+o.photos.length,0)} photos`);
} else if(mode==='verify') {
  const manifest=await json(new URL('manifest.json',root));
  const rows=(await readFile(new URL('reviews.jsonl',root),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse).filter(r=>['attempted','verified','already_present'].includes(r.write_status));
  const records=[],mismatches=[],otherChanges=[];
  for(const r of rows){const data=await request(`https://api.inaturalist.org/v1/observations/${r.observation_id}`);const o=publicRecord(data.results[0]);records.push(o);
    for(const [key,f] of Object.entries(config.fields)){
      const returned=o.ofvs.filter(v=>v.field_id===f.id);
      if(!returned.some(v=>v.value===r[key].value))mismatches.push({observation_id:o.id,field_id:f.id,value:r[key].value});
      if(returned.some(v=>v.value!==r[key].value))mismatches.push({observation_id:o.id,field_id:f.id,conflicting_values:returned.map(v=>v.value)});
    }
    const before=manifest.observations.find(p=>p.id===o.id);
    for(const f of before.ofvs){if(!o.ofvs.some(v=>v.field_id===f.field_id&&v.value===f.value))otherChanges.push({observation_id:o.id,missing_old_field:f});}
    if(o.photos.map(p=>p.id).sort().join(',')!==before.photos.map(p=>p.id).sort().join(','))otherChanges.push({observation_id:o.id,photos_changed:true});
  }
  const result={verified_at:new Date().toISOString(),source:'iNaturalist public observation-detail API; unauthenticated',records,mismatches,otherChanges};
  await save(new URL('api-verification.json',root),result);
  console.log(JSON.stringify({observations:rows.length,expected_values:rows.length*4,mismatches,otherChanges}));
  if(mismatches.length||otherChanges.length)process.exitCode=1;
} else if(mode==='finalize') {
  const manifest=await json(new URL('manifest.json',root));
  const verification=await json(new URL('api-verification.json',root));
  const allRows=(await readFile(new URL('reviews.jsonl',root),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const rows=allRows.filter(r=>['attempted','verified','already_present'].includes(r.write_status));
  const old=await json(new URL('../review-work/calibration-2026-10/manifest.json',import.meta.url));
  const excluded=new Set(old.observations.map(o=>o.observation_id));
  if(rows.length!==100||new Set(rows.map(r=>r.observation_id)).size!==100||rows.some(r=>excluded.has(r.observation_id)))throw Error('Require 100 distinct additional observations outside the historical pilot.');
  if(verification.records.length!==100||verification.mismatches.length||verification.otherChanges.length)throw Error('Verification is incomplete or failed.');
  for(const r of rows){
    const record=verification.records.find(o=>o.id===r.observation_id);
    if(!record||Date.parse(verification.verified_at)<Date.parse(r.reviewed_at))throw Error('Missing or stale verification.');
    const before=manifest.observations.find(o=>o.id===r.observation_id);
    for(const f of record.ofvs){
      if(!before.ofvs.some(v=>v.field_id===f.field_id&&v.value===f.value)&&
        !Object.entries(config.fields).some(([key,v])=>v.id===f.field_id&&r[key].value===f.value))throw Error(`Unexpected new field on ${r.observation_id}`);
    }
    r.write_status='verified';
    r.verified_fields=Object.entries(config.fields).map(([key,f])=>{
      const values=record.ofvs.filter(v=>v.field_id===f.id);
      if(!values.length||values.some(v=>v.value!==r[key].value))throw Error(`Missing/conflicting field on ${r.observation_id}`);
      return {field_id:f.id,value:r[key].value,verified_at:verification.verified_at};
    });
    const errors=validateReview(r,config);if(errors.length)throw Error(`${r.observation_id}: ${errors.join('; ')}`);
  }
  const skips=await json(new URL('skips.json',root));
  const counts=Object.fromEntries(Object.entries(config.fields).map(([key,f])=>[key,Object.fromEntries(f.values.map(value=>[value,rows.filter(r=>r[key].value===value).length]))]));
  const summary={protocol_version:config.protocolVersion,verified_at:verification.verified_at,source:verification.source,observations:rows.length,field_values:rows.length*4,examined_photos:rows.reduce((sum,r)=>sum+r.examined_photo_ids.length,0),taxa:Object.fromEntries(config.taxa.map(t=>[t.id,rows.filter(r=>r.taxon_id===t.id).length])),counts,selection_method:manifest.method,seed:manifest.seed,candidates_reviewed:new Set([...rows.map(r=>r.observation_id),...skips.map(s=>s.observation_id)]).size,skipped_or_blocked:skips,missing_values:[],conflicting_values:[],preexisting_field_changes:[],unexpected_new_fields:[],photo_list_changes:[]};
  await writeFile(new URL('reviews.jsonl',root),allRows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await writeFile(new URL('../docs/data/additional-100-2026-10-18.jsonl',import.meta.url),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await save(new URL('../docs/data/additional-100-2026-10-18-summary.json',import.meta.url),summary);
  console.log(JSON.stringify({...summary,skipped_or_blocked:skips.length}));
} else throw Error('Use prepare, verify, or finalize');
