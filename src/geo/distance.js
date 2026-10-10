import { cachedRoad, cacheRoad } from '../store/db.js';

const R = 6371.0088;
const rad = (x) => (x * Math.PI) / 180;

/** Straight-line distance — always available, including offline */
export function haversine(a, b) {
  if (!a || !b) return 0;
  const dp = rad(b.lat - a.lat), dl = rad(b.lng - a.lng);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat))
          - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export const legKm = (day) => (day?.from && day?.to ? haversine(day.from, day.to) : 0);
export const tripKm = (trip) => (trip?.days || []).reduce((s, d) => s + legKm(d), 0);

/** Rough average speeds, used only for an ETA */
export const SPEED = { flight: 700, train: 45, car: 40, bus: 35, speedboat: 45, ferry: 25, walk: 4.5 };
export const etaMins = (km, mode = 'car') => Math.max(1, Math.round((km / (SPEED[mode] || 40)) * 60));

/**
 * Real road distance, online only, from the public OSRM demo server.
 * Never called for flights or boats (there is no road), and answers are
 * cached for 90 days. Returns null on failure, so the caller falls back
 * to the straight-line distance.
 */
export async function roadDistance(a, b, mode = 'car') {
  if (!a || !b || mode === 'flight' || mode === 'speedboat' || mode === 'ferry') return null;
  if (!navigator.onLine) return null;
  const key = `${a.lat.toFixed(3)},${a.lng.toFixed(3)}->${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
  const hit = await cachedRoad(key);
  if (hit) return hit;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route) return null;
    const out = { km: route.distance / 1000, mins: Math.round(route.duration / 60) };
    await cacheRoad(key, out);
    return out;
  } catch { return null; }
}
