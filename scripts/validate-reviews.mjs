import { readFile } from 'node:fs/promises';
import { validateReview } from './review-validation.mjs';
const file = process.argv[2];
if (!file) { console.error('Usage: npm run validate-reviews -- path/to/reviews.jsonl (or one .json entry)'); process.exit(1); }
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
const input = await readFile(file, 'utf8');
const entries = file.endsWith('.jsonl') ? input.split(/\r?\n/).filter(x => x.trim()).map(x => JSON.parse(x)) : [JSON.parse(input)];
let failed = 0;
const seen = new Set();
for (const [index, entry] of entries.entries()) {
  const errors = validateReview(entry, config);
  if (seen.has(entry.observation_id)) errors.push('Duplicate observation ID in this review batch');
  seen.add(entry.observation_id);
  if (errors.length) { failed++; console.error(`Entry ${index + 1} (${entry.observation_id}): ${errors.join('; ')}`); }
}
console.log(`${entries.length} entries checked; ${failed} failed. This validates structure, not visual accuracy, pilot completion, or permission to write.`);
if (failed || !entries.length) process.exitCode = 1;
