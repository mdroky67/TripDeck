import { get, set, del } from 'idb-keyval';

const KEY = 'tripdeck.doc';
const TRACK = 'tripdeck.track';   // GPS points — far too big to sync to Drive

export const loadDoc = () => get(KEY);
export const saveDoc = (doc) => set(KEY, doc);
export const clearDoc = () => del(KEY);

export const loadTrack = (tripId) => get(`${TRACK}.${tripId}`);
export const saveTrack = (tripId, pts) => set(`${TRACK}.${tripId}`, pts);

/** Cached OSRM answers — 90 days */
const R = 'tripdeck.road.';
export async function cachedRoad(key) {
  const v = await get(R + key);
  if (!v) return null;
  if (Date.now() - v.at > 90 * 864e5) return null;
  return v.data;
}
export const cacheRoad = (key, data) => set(R + key, { at: Date.now(), data });

/** Last known Drive file id, so we don't search every time */
export const getDriveFileId = () => get('tripdeck.driveFileId');
export const setDriveFileId = (id) => set('tripdeck.driveFileId', id);

/**
 * The Google session, kept only on the phone.
 *
 * The browser build deliberately does not store it: a static site can still be
 * hit by script injection, and a token sitting in IndexedDB is then readable.
 * An installed app has its own sandbox, and the alternative there is signing in
 * again every single time the app is reopened.
 */
const SESSION = 'tripdeck.session';
export const loadSession = () => get(SESSION);
export const saveSession = (s) => set(SESSION, s);
export const clearSession = () => del(SESSION);
