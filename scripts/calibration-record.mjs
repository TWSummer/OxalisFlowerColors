import {readFile,writeFile} from 'node:fs/promises';
const path=new URL('../review-work/calibration-2026-10/decisions.json',import.meta.url);
const input=await readFile(0,'utf8').catch(async()=>{let s='';for await(const c of process.stdin)s+=c;return s;});
const updates=JSON.parse(input.replace(/^\uFEFF/,''));
const decisions=JSON.parse(await readFile(path,'utf8'));
for(const u of updates){const at=decisions.findIndex(d=>d.index===u.index);const d={...(at<0?{}:decisions[at]),...u,reviewed_at:new Date().toISOString()}; if(at<0)decisions.push(d);else decisions[at]=d;}
decisions.sort((a,b)=>a.index-b.index);
await writeFile(path,JSON.stringify(decisions,null,2));
console.log(`Saved ${updates.length} manual judgments; ${decisions.length} total.`);
