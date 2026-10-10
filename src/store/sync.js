import { doc, syncState, online, user, onAfterChange, edit, toast } from './state.js';
import { saveDoc } from './db.js';
import { migrate, nowISO, localDate } from './schema.js';
import * as drive from '../google/drive.js';
import { hasToken, isConfigured, consumeRedirectResult, fetchProfile } from '../google/auth.js';

/* ---------------- merge ----------------
 * Entity-wise last-write-wins plus tombstones. docs/DATA_MODEL.md §12
 * `done` is special: once true on either side it stays true, which is what
 * ticking something off means to a traveller.
 */
const newer = (a, b) => (new Date(a || 0) > new Date(b || 0));

function mergeList(local = [], remote = [], tombLocal = {}, tombRemote = {}, deep) {
  const out = new Map();
  const put = (item, side) => {
    const prev = out.get(item.id);
    if (!prev) { out.set(item.id, { ...item }); return; }
    const win = newer(item.updatedAt, prev.updatedAt) ? item : prev;
    const lose = win === item ? prev : item;
    const merged = { ...lose, ...win };
    if (deep) deep(merged, win, lose);
    out.set(item.id, merged);
  };
  local.forEach((i) => put(i, 'l'));
  remote.forEach((i) => put(i, 'r'));

  const tomb = { ...tombLocal, ...tombRemote };
  for (const [id, at] of Object.entries(tomb)) {
    const e = out.get(id);
    if (e && !newer(e.updatedAt, at)) out.delete(id);
  }
  return [...out.values()];
}

function mergeTrip(merged, win, lose) {
  // Merge days and activities separately, or one device's ticks get lost
  const days = new Map();
  [...(lose.days || []), ...(win.days || [])].forEach((d) => {
    const prev = days.get(d.id);
    if (!prev) { days.set(d.id, { ...d }); return; }
    const acts = new Map();
    [...(prev.activities || []), ...(d.activities || [])].forEach((a) => {
      const p = acts.get(a.id);
      if (!p) { acts.set(a.id, { ...a }); return; }
      const done = p.done || a.done;                       // once done, always done
      const win2 = newer(a.doneAt || a.updatedAt, p.doneAt || p.updatedAt) ? a : p;
      acts.set(a.id, { ...p, ...win2, done, doneAt: p.doneAt || a.doneAt });
    });
    days.set(d.id, { ...prev, ...d, activities: [...acts.values()] });
  });
  merged.days = [...days.values()].sort((a, b) => (a.index || 0) - (b.index || 0));
}

export function mergeDocs(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const base = newer(local.updatedAt, remote.updatedAt) ? local : remote;
  const other = base === local ? remote : local;
  return {
    ...other, ...base,
    rev: Math.max(local.rev || 0, remote.rev || 0) + 1,
    updatedAt: nowISO(),
    profile: { ...other.profile, ...base.profile },
    settings: { ...other.settings, ...base.settings },
    trips: mergeList(local.trips, remote.trips, local.tombstones, remote.tombstones, mergeTrip),
    past:  mergeList(local.past,  remote.past,  local.tombstones, remote.tombstones),
    visits: mergeList(local.visits, remote.visits, local.tombstones, remote.tombstones),
    districts: [...new Set([...(local.districts || []), ...(remote.districts || [])])],
    tombstones: { ...other.tombstones, ...base.tombstones },
  };
}

/* ---------------- sync ---------------- */
let timer = null, running = false, lastBackupDay = null;

export function canSync() {
  return isConfigured() && hasToken() && online.value;
}

export async function syncNow({ silent = false } = {}) {
  if (running) return;
  if (!canSync()) {
    if (!silent) syncState.value = { state: online.value ? 'idle' : 'offline', at: syncState.value.at, error: null };
    return;
  }
  running = true;
  syncState.value = { ...syncState.value, state: 'saving', error: null };
  try {
    const file = await drive.findFile();
    let remote = null;
    if (file) { try { remote = migrate(await drive.download(file.id)); } catch {} }

    const merged = remote ? mergeDocs(doc.value, remote) : doc.value;
    doc.value = merged;
    await saveDoc(merged);
    await drive.upload(merged, file?.id);

    const today = localDate();
    if (lastBackupDay !== today) {
      lastBackupDay = today;
      drive.rotateBackups(merged).catch(() => {});
    }
    const at = nowISO();
    syncState.value = { state: 'saved', at, error: null };
    doc.value.settings.sync.lastSyncAt = at;
  } catch (e) {
    syncState.value = { state: 'error', at: syncState.value.at, error: String(e.message || e) };
  } finally {
    running = false;
  }
}

/** Five seconds after a write, so typing doesn't upload on every keystroke */
export function scheduleSync({ immediate = false } = {}) {
  if (!canSync()) {
    if (!online.value) syncState.value = { ...syncState.value, state: 'offline' };
    return;
  }
  clearTimeout(timer);
  timer = setTimeout(() => syncNow({ silent: true }), immediate ? 0 : 5000);
}

onAfterChange(scheduleSync);

/** Right after sign-in: pull from Drive and merge */
export async function pullAfterSignIn(profile) {
  user.value = profile;
  await syncNow();
}

/**
 * Finish a redirect sign-in. Called once the document is loaded, because the
 * profile it fetches is written into it.
 */
export async function finishRedirectSignIn() {
  const r = consumeRedirectResult();
  if (!r) return;
  if (r.error) {
    toast(r.error === 'access_denied'
      ? 'Sign-in was cancelled'
      : `Sign-in failed: ${r.error}`);
    return;
  }
  try {
    const prof = await fetchProfile();
    user.value = prof;
    edit((d) => {
      d.profile.name = prof.name;
      d.profile.email = prof.email;
      d.profile.picture = prof.picture;
    });
    await syncNow();
    toast('Signed in — your data now saves to Drive');
  } catch (e) {
    toast('Signed in, but the profile could not be read');
  }
}
