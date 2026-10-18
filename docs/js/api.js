const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function makeClient({ interval = 1100, fetcher = fetch, pause = sleep } = {}) {
  let last = 0;
  return async function request(url, { signal } = {}) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await pause(Math.max(0, last + interval - Date.now()));
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      last = Date.now();
      // Public reads only. Never pass account credentials to the atlas.
      const response = await fetcher(url, { signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        const retry = Number(response.headers?.get('Retry-After'));
        await pause(Math.min(60000, Math.max(Number.isFinite(retry) ? retry * 1000 : 0, 2000 * 2 ** attempt)));
        continue;
      }
      if (!response.ok) throw new Error(`iNaturalist returned HTTP ${response.status}. Try again later.`);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error('Unexpected iNaturalist response.');
      return data;
    }
  };
}
export function queryUrl(config, parameters = {}) {
  const params = new URLSearchParams({ taxon_id: config.taxa.map(t => t.id).join(','), verifiable: 'any', per_page: '200', order_by: 'id', order: 'asc', ...parameters });
  return `${config.apiBase}/observations?${params}`;
}
export async function fetchFieldRecords(config, { request = makeClient({ interval: config.requestIntervalMs }), onProgress = () => {}, signal, maxPages = 250 } = {}) {
  const fields = [config.colorField, config.legacyColorField, ...(config.patternField.id ? [config.patternField] : [])];
  const records = new Map();
  let complete = true;
  for (const field of fields) {
    let cursor = 0, finished = false;
    for (let page = 0; page < maxPages; page++) {
      const data = await request(queryUrl(config, { [`field:${field.name}`]: '', id_above: String(cursor) }), { signal });
      for (const o of data.results) records.set(o.id, o);
      onProgress({ field: field.name, loaded: records.size });
      if (data.results.length < 200) { finished = true; break; }
      const next = Math.max(...data.results.map(o => o.id));
      if (!Number.isSafeInteger(next) || next <= cursor) throw new Error('The API pagination did not advance; stopped to avoid an incomplete map.');
      cursor = next;
    }
    if (!finished) complete = false;
  }
  return { records: [...records.values()].sort((a, b) => a.id - b.id), complete, fetchedAt: new Date().toISOString() };
}
