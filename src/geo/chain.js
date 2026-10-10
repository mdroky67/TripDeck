import { haversine, lerp } from './distance.js';

/**
 * Builds a connected chain out of days and activities. The chain is derived,
 * never stored, which is why ticking an item in the list moves the chain and
 * the map at the same time. docs/DATA_MODEL.md §16
 */
export function chainOf(trip) {
  const nodes = [];
  if (!trip) return { nodes, target: 0 };

  const push = (place, meta) => {
    if (!place || typeof place.lat !== 'number') return;
    const last = nodes[nodes.length - 1];
    if (last && last.label === place.label) {
      // Merge consecutive repeats of the same place, keeping their activities
      Object.assign(last, meta, { acts: last.acts.concat(meta.acts || []) });
      return;
    }
    nodes.push({
      label: place.label, label_en: place.label_en,
      lat: place.lat, lng: place.lng, countryCode: place.countryCode,
      acts: [], ...meta,
    });
  };

  (trip.days || []).forEach((d, di) => {
    push(d.from, { day: di + 1, dayId: d.id, kind: 'start', acts: [] });
    (d.activities || []).forEach((a) => {
      if (a.place) push(a.place, { day: di + 1, dayId: d.id, icon: a.icon, time: a.time, acts: [a] });
      else if (nodes.length) nodes[nodes.length - 1].acts.push(a);
    });
    push(d.to, { day: di + 1, dayId: d.id, icon: '🌙', kind: 'night', acts: [] });
  });

  // The node after the last one with a ticked activity is where we are heading
  let last = -1;
  nodes.forEach((n, i) => { if (n.acts.some((a) => a.done)) last = i; });
  const target = nodes.length ? Math.min(last + 1, nodes.length - 1) : 0;

  nodes.forEach((n, i) => {
    n.state = i < target ? 'done' : i === target ? 'now' : 'next';
    n.done = i < target;
  });
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].kmNext = haversine(nodes[i], nodes[i + 1]);
  return { nodes, target };
}

/**
 * Where you are on the chain right now.
 * With a GPS fix, the real position. Without one, the start of the current leg
 * and `hasFix: false` — a guessed position is never shown as if it were real.
 */
export function liveOf(trip, fix = null) {
  const chain = chainOf(trip);
  const { nodes, target } = chain;
  if (!nodes.length) return { chain, from: null, to: null, pos: null, remaining: 0, legKm: 0, frac: 0, hasFix: false };
  const i = Math.max(1, target);
  const from = nodes[i - 1], to = nodes[i];
  const total = haversine(from, to);
  if (fix) {
    const remaining = haversine(fix, to);
    const frac = total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0;
    return { chain, from, to, pos: fix, remaining, legKm: total, frac, hasFix: true };
  }
  return { chain, from, to, pos: lerp(from, to, 0), remaining: total, legKm: total, frac: 0, hasFix: false };
}

/** For fitBounds on the map */
export function chainBounds(nodes) {
  if (!nodes?.length) return null;
  const la = nodes.map((n) => n.lat), ln = nodes.map((n) => n.lng);
  return [[Math.min(...la), Math.min(...ln)], [Math.max(...la), Math.max(...ln)]];
}
