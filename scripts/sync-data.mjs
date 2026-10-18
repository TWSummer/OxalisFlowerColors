import { readFile, writeFile, rename } from 'node:fs/promises';
import { fetchFieldRecords } from '../docs/js/api.js';
import { publicRecord } from '../docs/js/data.js';
const config = JSON.parse(await readFile(new URL('../docs/data/project.json', import.meta.url), 'utf8'));
try {
  const data = await fetchFieldRecords(config, { onProgress: ({ field, loaded }) => console.log(`${field}: ${loaded} unique records`) });
  if (!data.complete) throw new Error('Page safety limit reached. Refusing to replace the snapshot with partial data.');
  const snapshot = { ...data, protocolVersion: config.protocolVersion, source: 'iNaturalist public API v1; unauthenticated', fields: Object.values(config.fields), records: data.records.map(publicRecord) };
  const destination = new URL('../docs/data/observations.json', import.meta.url);
  const temp = new URL('../docs/data/observations.json.tmp', import.meta.url);
  await writeFile(temp, JSON.stringify(snapshot, null, 2) + '\n');
  await rename(temp, destination);
  console.log(`Saved ${snapshot.records.length} unique public records at ${snapshot.fetchedAt}.`);
} catch (e) { console.error(`Sync failed; previous snapshot retained. ${e.message}`); process.exitCode = 1; }
