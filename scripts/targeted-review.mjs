// Public reads, image retrieval and local audit only. No authenticated writes.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeClient} from '../docs/js/api.js';
import {publicRecord} from '../docs/js/data.js';
import {validateReview} from './review-validation.mjs';
const root=new URL('../review-work/targeted-examples-2026-10-18/',import.meta.url);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const config=await json(new URL('../docs/data/project.json',import.meta.url));
const request=makeClient();
const allowed=['cc0','cc-by','cc-by-nc'];
await mkdir(root,{recursive:true});
const mode=process.argv[2]||'screen';
async function download(p,folder,size){
 const dest=new URL(`${folder}/${p.id}.jpg`,root);try{await access(dest);return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const url=new URL(p.url.replace('/square.',`/${size}.`));
 if(url.protocol!=='https:'||!['static.inaturalist.org','inaturalist-open-data.s3.amazonaws.com'].includes(url.hostname))throw Error('Unexpected image URL');
 const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Photo ${p.id}: ${response.status}`);
 await writeFile(dest,new Uint8Array(await response.arrayBuffer()));
}
if(mode==='screen'){
 await mkdir(new URL('previews/',root),{recursive:true});
 let screen;try{screen=await json(new URL('screen.json',root));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!screen){
  const existing=await json(new URL('../docs/data/observations.json',import.meta.url)),old=await json(new URL('../review-work/calibration-2026-10/manifest.json',import.meta.url));
  const excluded=new Set([...existing.records.map(o=>o.id),...old.observations.map(o=>o.observation_id),5537385,5774777]);
  const pools=await Promise.all(config.taxa.map(t=>json(new URL(`../review-work/calibration-2026-10/pool-${t.id}.json`,import.meta.url))));
  const rank=o=>createHash('sha256').update('targeted-guide-2026-10-18:'+o.observation_id).digest('hex');
  const subsets=pools.map((pool,i)=>pool.filter(o=>!excluded.has(o.observation_id)&&o.observer!=='metsa'&&allowed.includes(o.photos[0]?.license_code)&&!o.existing_fields.some(f=>Object.values(config.fields).some(v=>v.id===f.field_id))).sort((a,b)=>rank(a).localeCompare(rank(b))).slice(0,i===0?12:36));
  screen={created_at:new Date().toISOString(),method:'Targeted guide-example search. Seeded screening of 12 O. oregana and 36 O. smalliana from the earlier Flowers-annotated pool, first-photo reuse license required; source-author leads considered separately. Screening images only prioritize original-photo review and never supply final labels.',observations:[...subsets[1],...subsets[0]].map((o,i)=>({...o,index:i+1}))};await save(new URL('screen.json',root),screen);
 }
 for(const o of screen.observations){await download(o.photos[0],'previews','medium');if(o.index%12===0)console.log(`Screen previews ${o.index}/${screen.observations.length}`);}
}else if(mode==='prepare'){
 await mkdir(new URL('originals/',root),{recursive:true});
 let manifest;try{manifest=await json(new URL('manifest.json',root));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!manifest)manifest={created_at:new Date().toISOString(),protocolVersion:config.protocolVersion,labelLimit:100,method:'Targeted search for guide examples of High petal pigment variation and Absent white center ring; selection is deliberately not representative. All four fields visually reviewed on each labeled observation. Stop when usable licensed examples of both are found, with no more than100 newly labeled observations.',observations:[]};
 const ids=process.argv.slice(3).map(Number);if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||!ids.length)throw Error('Pass observation IDs');
 const existing=await json(new URL('../docs/data/observations.json',import.meta.url));
 for(const id of ids){
  if(existing.records.some(o=>o.id===id))throw Error(`${id} already in current snapshot`);
  let o=manifest.observations.find(o=>o.id===id);
  if(!o){const raw=(await request(`https://api.inaturalist.org/v1/observations/${id}`)).results[0];if(!raw||raw.id!==id)throw Error('Missing observation');
   if(!config.taxa.some(t=>raw.taxon?.ancestor_ids?.includes(t.id)||raw.taxon?.id===t.id))throw Error('Out of scope');
   if(raw.ofvs.some(f=>Object.values(config.fields).some(v=>v.id===f.field_id)))throw Error(`${id} has new project labels already`);
   o={...publicRecord(raw),index:manifest.observations.length+1,observation_id:id,retrieved_at:new Date().toISOString(),photos:raw.photos.map(p=>({id:p.id,url:p.url,original_dimensions:p.original_dimensions,license_code:p.license_code,attribution:p.attribution}))};
   manifest.observations.push(o);await save(new URL('manifest.json',root),manifest);
  }
  for(const p of o.photos)await download(p,'originals','original');console.log(`Prepared ${id}: ${o.photos.length} photos`);
 }
}else if(mode==='verify'){
 const manifest=await json(new URL('manifest.json',root)),rows=(await readFile(new URL('reviews.jsonl',root),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse).filter(r=>['attempted','verified'].includes(r.write_status));
 if(!rows.length||rows.length>100||new Set(rows.map(r=>r.observation_id)).size!==rows.length)throw Error('Require1–100 unique attempted reviews');
 const records=[],mismatches=[],unrelatedChanges=[];
 for(const r of rows){const o=publicRecord((await request(`https://api.inaturalist.org/v1/observations/${r.observation_id}`)).results[0]);records.push(o);
  for(const [key,f] of Object.entries(config.fields)){const values=o.ofvs.filter(v=>v.field_id===f.id);if(!values.length||values.some(v=>v.value!==r[key].value))mismatches.push({observation_id:o.id,field_id:f.id,expected:r[key].value,actual:values.map(v=>v.value)});}
  const before=manifest.observations.find(p=>p.id===o.id),fieldIds=Object.values(config.fields).map(f=>f.id),other=x=>JSON.stringify(x.ofvs.filter(f=>!fieldIds.includes(f.field_id)).sort((a,b)=>a.field_id-b.field_id||a.value.localeCompare(b.value)));
  if(other(before)!==other(o))unrelatedChanges.push({observation_id:o.id,fields:true});if(before.photos.map(p=>p.id).join(',')!==o.photos.map(p=>p.id).join(','))unrelatedChanges.push({observation_id:o.id,photos:true});
 }
 const result={verified_at:new Date().toISOString(),records,mismatches,unrelatedChanges};await save(new URL('verification.json',root),result);console.log(JSON.stringify({observations:rows.length,field_values:rows.length*4,mismatches,unrelatedChanges}));if(mismatches.length||unrelatedChanges.length)process.exitCode=1;
}else if(mode==='finalize'){
 const manifest=await json(new URL('manifest.json',root)),v=await json(new URL('verification.json',root)),all=(await readFile(new URL('reviews.jsonl',root),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse),rows=all.filter(r=>['attempted','verified'].includes(r.write_status));
 if(!rows.length||rows.length>100||v.records.length!==rows.length||v.mismatches.length||v.unrelatedChanges.length)throw Error('Clean verification and <=100 required');
 for(const r of rows){const o=v.records.find(o=>o.id===r.observation_id);if(!o||Date.parse(v.verified_at)<Date.parse(r.reviewed_at))throw Error('Missing/stale verification');r.write_status='verified';r.verified_fields=Object.entries(config.fields).map(([key,f])=>{const values=o.ofvs.filter(x=>x.field_id===f.id);if(!values.length||values.some(x=>x.value!==r[key].value))throw Error('Value mismatch');return {field_id:f.id,value:r[key].value,verified_at:v.verified_at};});const errors=validateReview(r,config);if(errors.length)throw Error(`${r.observation_id}: ${errors.join('; ')}`);}
 const blocked=all.filter(r=>r.write_status==='blocked');
 if(all.some(r=>!['verified','blocked'].includes(r.write_status)))throw Error('Unresolved review status');
 const restrictions=await json(new URL('blocked.json',root));
 const skips=await json(new URL('skips.json',root));
 for(const r of blocked){if(r.verified_fields.length)throw Error('Blocked reference must have no verified fields');const errors=validateReview(r,config);if(errors.length)throw Error(`${r.observation_id}: ${errors.join('; ')}`);}
 const summary={protocol_version:config.protocolVersion,verified_at:v.verified_at,reviewed_observations:all.length,observations:rows.length,field_values:rows.length*4,blocked_observations:blocked.length,blocked_references:restrictions,skips,selection_method:manifest.method,counts:Object.fromEntries(Object.entries(config.fields).map(([key,f])=>[key,Object.fromEntries(f.values.map(value=>[value,rows.filter(r=>r[key].value===value).length]))])),mismatches:[],unrelated_changes:[]};
 await writeFile(new URL('reviews.jsonl',root),all.map(r=>JSON.stringify(r)).join('\n')+'\n');await writeFile(new URL('../docs/data/targeted-examples-2026-10-18.jsonl',import.meta.url),all.map(r=>JSON.stringify(r)).join('\n')+'\n');await save(new URL('../docs/data/targeted-examples-2026-10-18-summary.json',import.meta.url),summary);console.log(JSON.stringify(summary));
}else throw Error('Use screen, prepare IDS, verify, finalize');
