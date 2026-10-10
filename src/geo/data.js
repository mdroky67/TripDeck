/** public/data/*.json — fetched once, on demand, then held in memory. */
const cache = new Map();

async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const p = fetch(`${import.meta.env.BASE_URL}data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name} লোড হয়নি`);
    return r.json();
  });
  cache.set(name, p);
  return p;
}

export const districts   = () => load('bd-districts');     //  7 KB — 64 districts
export const countries   = () => load('countries-list');   // 16 KB — 177 countries
export const worldGrid   = () => load('worldgrid');        // 40 KB — dot-grid world
export const outlines    = () => load('outlines');         // 31 KB — country outlines
export const seedTrip    = (n) => load(`seed-${n}`);
export const seedPast    = () => load('seed-past');

/** Pull everything down ahead of time — the "prepare for offline" button */
export const prefetchAll = () =>
  Promise.all([districts(), countries(), worldGrid(), outlines()]);
