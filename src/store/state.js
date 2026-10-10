import { signal, computed, effect } from '@preact/signals';
import { createDoc, migrate, nowISO, deviceId } from './schema.js';
import { loadDoc, saveDoc } from './db.js';
import { lang } from '../i18n.js';
import { setClientId } from '../google/auth.js';

/* ---------- signals ---------- */
export const doc      = signal(null);                 // null = not loaded yet
export const ready    = signal(false);
export const user     = signal(null);                 // Google profile
export const syncState= signal({ state: 'idle', at: null, error: null });
export const online   = signal(navigator.onLine);
export const toastMsg = signal(null);
export const sheet    = signal(null);                 // { title, render }
export const fix      = signal(null);                 // latest GPS fix { lat,lng,accuracy,at }

export const ui = signal({
  tab: 'trips', tripId: null, planView: 'chain', dayIdx: 0,
  selNode: null, worldView: 'globe',
});
export const setUI = (patch) => { ui.value = { ...ui.value, ...patch }; };

export const theme = signal('light');

/* ---------- derived ---------- */
export const trips = computed(() => doc.value?.trips || []);
/** Current trip — ui.tripId, else the active one, else the first */
export const activeTrip = computed(() => {
  const d = doc.value;
  if (!d) return null;
  const list = d.trips;
  if (!list.length) return null;
  const id = ui.value.tripId;
  return list.find((t) => t.id === id) || list.find((t) => t.status === 'active') || list[0];
});

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = null; }, 2600);
}

/* ---------- sheet ---------- */
export const openSheet = (render, title) => { sheet.value = { render, title }; };
export const closeSheet = () => { sheet.value = null; };

/* ---------- mutations ---------- */
let persistTimer, syncHook = null;
export const onAfterChange = (fn) => { syncHook = fn; };

/**
 * The only way to change the document. Never mutate doc.value directly:
 * the UI will not update and nothing will be saved.
 */
export function edit(mutator, { sync = true } = {}) {
  const d = doc.value;
  if (!d) return;
  mutator(d);
  d.updatedAt = nowISO();
  d.deviceId = deviceId();
  d.rev = (d.rev || 0) + 1;
  // Give every collection a fresh reference. Mutating in place and only
  // replacing the root leaves the arrays identical, and both signals and
  // useMemo then conclude nothing changed — the data moves, the screen does
  // not. Cloning a handful of shallow arrays costs nothing.
  doc.value = {
    ...d,
    trips: d.trips.map((t) => ({ ...t })),
    visits: [...d.visits],
    past: [...d.past],
    districts: [...d.districts],
  };
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveDoc(doc.value).catch(() => {});
    if (sync && syncHook) syncHook();
  }, 300);
}

/** Touch updatedAt whenever a trip changes — the merge decides on it */
export const touch = (entity) => { if (entity) entity.updatedAt = nowISO(); };

export function setTrip(id) {
  setUI({ tripId: id, dayIdx: 0, selNode: null });
  edit((d) => { d.profile.lastTripId = id; }, { sync: false });
}

/* ---------- boot ---------- */
export async function boot() {
  let d = null;
  try { d = await loadDoc(); } catch {}
  doc.value = d ? migrate(d) : createDoc();
  setClientId(doc.value.profile.googleClientId);
  lang.value = doc.value.profile.lang || 'en';
  theme.value = doc.value.profile.theme || 'light';
  applyTheme(theme.value);
  if (!ui.value.tripId && doc.value.trips.length) {
    const last = doc.value.profile.lastTripId;
    const act = doc.value.trips.find((t) => t.id === last)
      || doc.value.trips.find((t) => t.status === 'active')
      || doc.value.trips[0];
    setUI({ tripId: act.id });
  }
  ready.value = true;
}

export function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

export function setLang(l) {
  lang.value = l;
  document.documentElement.lang = l;
  edit((d) => { d.profile.lang = l; });
}

export function setTheme(t) {
  theme.value = t;
  applyTheme(t);
  edit((d) => { d.profile.theme = t; });
}

/* Online / offline */
addEventListener('online',  () => { online.value = true;  if (syncHook) syncHook(); });
addEventListener('offline', () => { online.value = false; });

/* Save as soon as the tab is hidden, so closing the browser loses nothing */
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && doc.value) {
    saveDoc(doc.value).catch(() => {});
    if (syncHook) syncHook({ immediate: true });
  }
});

effect(() => { if (doc.value) document.documentElement.lang = lang.value; });

/* A handy hook for the browser console in development: window.__td.doc.value */
if (import.meta.env.DEV) window.__td = { doc, ui, activeTrip };
