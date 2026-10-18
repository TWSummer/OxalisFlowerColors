import {readFile,writeFile} from 'node:fs/promises';
import {validateReview} from './historical-review-validation.mjs';
const base=new URL('../review-work/calibration-2026-10/',import.meta.url);
const json=async n=>JSON.parse(await readFile(new URL(n,base),'utf8'));
const manifest=await json('manifest.json'), decisions=await json('decisions.json');
const writes=await json('writes.json');
let blocked=[];try{blocked=await json('blocked.json');}catch(e){if(e.code!=='ENOENT')throw e;}
const config=JSON.parse(await readFile(new URL('../docs/data/archive/project-v1.1.0.json',import.meta.url),'utf8'));
const records=decisions.map(d=>{
  const o=manifest.observations[d.index-1];
  if(!o || !o.photos.some(p=>p.id===d.photo_id))throw new Error(`Invalid evidence photo at index ${d.index}`);
  if(/pending/i.test(`${d.color_reason} ${d.vein_reason} ${d.branching}`))throw new Error(`Unfinished review ${d.index}`);
  const evidence=d.crop?[{photo_id:d.photo_id,flower:'Manually selected open flower; crop coordinates in decisions.json; diameter is an approximate visual measurement.',source_diameter_px:d.crop[2],assessment_diameter_px:300,visible_upper_petals:d.petals}]:[];
  const trait=(name)=>({value:d[name]||null,status:d[name]?'scored':(d[name==='color'?'color_status':'vein_status']||(name==='color'?'uncertain_color':'unscorable')),confidence:d[name]?'high':'not_applicable',reason:d[name==='color'?'color_reason':'vein_reason'],evidence});
  const verified=writes.filter(w=>w.observation_id===o.observation_id).map(({field_id,value,verified_at})=>({field_id,value,verified_at}));
  return {observation_id:o.observation_id,taxon_id:o.taxon_id,reviewer:'Codex single-agent visual review; not an independent-rater calibration',reviewed_at:d.reviewed_at||manifest.created_at,protocol_version:'1.0.0',examined_photo_ids:o.photos.map(p=>p.id),color:trait('color'),veins:trait('veins'),existing_fields:o.existing_fields,write_status:verified.length?'verified':blocked.some(b=>b.observation_id===o.observation_id)?'blocked':'not_attempted',verified_fields:verified};
});
// This file regenerates the historical v1.0.0 judgments, never upgrades them silently.
// Verified corrections are overlaid by calibration-report.mjs.
for(const r of records){const errors=validateReview(r,{...config,protocolVersion:'1.0.0'});if(errors.length)throw new Error(`${r.observation_id}: ${errors.join('; ')}`);}
await writeFile(new URL('reviews.jsonl',base),records.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(JSON.stringify({reviewed:records.length,color:records.filter(r=>r.color.status==='scored').length,veins:records.filter(r=>r.veins.status==='scored').length,verifiedWrites:writes.length,blocked:blocked.length}));
