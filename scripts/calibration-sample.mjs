import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../review-work/calibration-2026-10/',import.meta.url);
await mkdir(root,{recursive:true});
try {
  const existing=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  console.log(`Retaining existing ${existing.observations.length}-observation manifest. Archive the review directory before starting a new sample.`);
  process.exit(0);
} catch(e) { if(e.code!=='ENOENT')throw e; }
const seed='oxalis-feasibility-2026-10-18-v1';
const candidates=[];
for(const taxon of [47757,1464017]){
  const cache=new URL(`pool-${taxon}.json`,root);
  let pool;
  try {pool=JSON.parse(await readFile(cache,'utf8'));} catch(e){if(e.code!=='ENOENT')throw e;}
  if(!pool){
    pool=[]; let cursor=0;
    while(true){
      const url=new URL('https://api.inaturalist.org/v1/observations');
      for(const [k,v] of Object.entries({taxon_id:taxon,photos:true,verifiable:'any',term_id:12,term_value_id:13,per_page:200,order_by:'id',order:'asc',id_above:cursor}))url.searchParams.set(k,v);
      const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      for(const o of data.results) pool.push({observation_id:o.id,taxon_id:o.taxon.id,observed_on:o.observed_on,quality_grade:o.quality_grade,captive:o.captive,photos:o.photos.map(p=>({id:p.id,url:p.url,original_dimensions:p.original_dimensions,license_code:p.license_code,attribution:p.attribution})),existing_fields:o.ofvs.map(f=>({field_id:f.field_id,value:f.value})),observer:o.user.login});
      console.log(`${taxon}: ${pool.length} candidates`);
      if(data.results.length<200)break;
      cursor=data.results.at(-1).id;
      await new Promise(r=>setTimeout(r,1100));
    }
    await writeFile(cache,JSON.stringify(pool,null,2));
  }
  const rank=o=>createHash('sha256').update(`${seed}:${o.observation_id}`).digest('hex');
  pool.sort((a,b)=>rank(a).localeCompare(rank(b)));
  candidates.push(...pool.slice(0,50));
}
candidates.sort((a,b)=>a.observation_id-b.observation_id);
const manifest={created_at:new Date().toISOString(),seed,method:'Fifty observations per currently identified taxon, selected by SHA256(seed:observation_id) ascending from the full public API pool with photos and Flowers annotation. All quality grades; no geographic/color filtering. This is a single-agent feasibility review, not independent-rater validation. Annotation and taxon-selection biases apply.',write_authorization:'User explicitly requested adding fields during this pilot. Only high-confidence photo-supported trait values will be added; uncertain values and existing differing values withheld. The earlier proposed independent-rater gate is not claimed satisfied.',target:100,observations:candidates};
await writeFile(new URL('manifest.json',root),JSON.stringify(manifest,null,2));
console.log(`Selected ${candidates.length} observations with ${candidates.reduce((n,o)=>n+o.photos.length,0)} photos.`);
