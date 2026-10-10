import { get, set } from 'idb-keyval';

/**
 * Place search, so an activity can point at an actual hotel or landmark
 * instead of a country.
 *
 * Why this matters: every distance in the app is measured between the pinned
 * points. Pick "Thailand" and the pin lands on the country's centroid, roughly
 * 450 km from Bangkok, and every kilometre figure built on it is fiction.
 *
 * Uses Nominatim (OpenStreetMap), which is free and needs no key. It is the
 * one online-only part of planning; results are cached for 30 days so a place
 * looked up once keeps working offline.
 */
const CACHE = 'tripdeck.geo.';
const TTL = 30 * 864e5;
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export async function searchPlaces(query, { near = null, signal } = {}) {
  const q = norm(query);
  if (q.length < 2) return [];

  const key = CACHE + q + (near ? `@${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : '');
  const hit = await get(key).catch(() => null);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  if (!navigator.onLine) return hit?.rows || [];

  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '8', addressdetails: '1',
  });
  // Bias towards where you are, so "station" finds the one nearby first
  if (near) {
    const d = 2;
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','));
    params.set('bounded', '0');
  }

  const r = await fetch(`${ENDPOINT}?${params}`, {
    signal, headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`search failed: ${r.status}`);
  const raw = await r.json();

  const rows = raw.map((x) => ({
    lat: Number(x.lat), lng: Number(x.lon),
    name: shortName(x), detail: contextOf(x),
    countryCode: (x.address?.country_code || '').toUpperCase(),
  }));
  await set(key, { at: Date.now(), rows }).catch(() => {});
  return rows;
}

/** "Sigiriya Rock" rather than the full postal address */
function shortName(x) {
  const a = x.address || {};
  return x.name
    || a.attraction || a.tourism || a.building || a.road
    || a.suburb || a.village || a.town || a.city
    || String(x.display_name || '').split(',')[0];
}

/** The two or three parts that tell you which "Riverside" this is */
function contextOf(x) {
  const a = x.address || {};
  const parts = [a.suburb || a.village || a.town || a.city || a.county,
                 a.state, a.country].filter(Boolean);
  return [...new Set(parts)].slice(0, 3).join(', ');
}
