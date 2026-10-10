import { doc, edit, touch, setUI, setTrip, toast } from './state.js';
import { createTrip, createDay, createActivity, createContact, createStay, uid, nowISO, localDate, migrate, looksLikeDoc } from './schema.js';
import { haversine } from '../geo/distance.js';
import { nearestDistrict, areaOf, continentOf } from '../geo/places.js';
import { emergencyFor, BLANK_CONTACTS, BLANK_INTL } from '../data/emergency.js';
import { toNum } from '../data/iso.js';
import { seedTrip, seedPast, countries } from '../geo/data.js';
import { L, N } from '../i18n.js';

/* ---------------- trips ---------------- */

export function makeContacts(scope, countryCodes) {
  // Home-country numbers always travel with you
  const verified = emergencyFor(['BD', ...countryCodes]).map((e) => createContact({ ...e, verified: true }));
  const blanks = [...BLANK_CONTACTS, ...(scope === 'international' ? BLANK_INTL : [])]
    .map((b) => createContact({ ...b, verified: false }));
  return [...verified, ...blanks];
}

export function addTrip({ title, scope, from, to, startDate, days }) {
  const ids = scope === 'local' ? ['050'] : [...new Set([from.id, to.id].map(toNum))];
  const trip = createTrip({
    title: title || `${from.bn} → ${to.bn}`,
    title_en: title || `${from.en} → ${to.en}`,
    subtitle: `${N(days)} দিনের ট্রিপ`,
    subtitle_en: `${days}-day trip`,
    scope,
    startDate,
    coverEmoji: scope === 'local' ? '🛺' : '🧳',
    countries: ids,
    origin: place(from, scope),
    contacts: makeContacts(scope, scope === 'local' ? [] : ids),
  });
  const a = place(from, scope), z = place(to, scope);
  const mode = scope === 'local' ? 'car' : 'flight';
  for (let i = 0; i < days; i++) {
    const f = i === 0 ? a : z;
    const t = i === days - 1 ? a : z;
    trip.days.push(createDay({
      index: i + 1, date: shiftDate(startDate, i),
      title: i === 0 ? `${from.bn} → ${to.bn}` : `${to.bn} ঘোরা`,
      title_en: i === 0 ? `${from.en} → ${to.en}` : `Explore ${to.en}`,
      transport: i === 0 || i === days - 1 ? mode : 'car',
      from: f, to: t, legKm: haversine(f, t),
      activities: [createActivity({
        title: i === 0 ? 'রওনা দেওয়া' : 'দিনের পরিকল্পনা লেখো',
        title_en: i === 0 ? 'Set off' : 'Write the plan for this day',
        type: 'transfer', icon: scope === 'local' ? '🛺' : '✈️', place: f,
      })],
    }));
  }
  const endDate = shiftDate(startDate, days - 1);
  trip.endDate = endDate;
  edit((d) => { d.trips.unshift(trip); });
  setTrip(trip.id);
  setUI({ tab: 'plan' });
  return trip;
}

const place = (o, scope) => ({
  lat: o.lat, lng: o.lng, label: o.bn, label_en: o.en,
  countryCode: scope === 'local' ? 'BD' : o.id,
});

export function shiftDate(iso, n) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export function deleteTrip(id) {
  edit((d) => {
    d.trips = d.trips.filter((t) => t.id !== id);
    d.tombstones[id] = nowISO();
  });
  setUI({ tripId: null, dayIdx: 0, selNode: null });
}

export function updateTrip(id, patch) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    touch(t);
  });
}

export function setTripStatus(id, status) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === id);
    if (!t) return;
    if (status === 'active') d.trips.forEach((x) => { if (x.status === 'active') x.status = 'planned'; });
    t.status = status;
    touch(t);
    if (status === 'completed') harvest(d, t);
  });
}

/** When a trip is completed, add its countries and districts to the scoreboard */
function harvest(d, t) {
  (t.countries || []).map(toNum).forEach((code) => {
    if (code === '050') return;                       // home country isn't a 'visit'
    if (!d.visits.some((v) => v.countryCode === code)) {
      d.visits.push({
        id: uid('visit'), countryCode: code,
        firstVisit: t.startDate, lastVisit: t.endDate, timesVisited: 1,
        tripIds: [t.id], source: 'trip', updatedAt: nowISO(),
      });
    }
  });
  const pts = [];
  (t.days || []).forEach((day) => {
    if (day.from) pts.push(day.from);
    if (day.to) pts.push(day.to);
    (day.activities || []).forEach((a) => { if (a.place) pts.push(a.place); });
  });
  Promise.all(pts.filter((p) => p.countryCode === 'BD').map((p) => nearestDistrict(p.lat, p.lng)))
    .then((list) => {
      const found = [...new Set(list.filter(Boolean).map((x) => x.en))];
      if (found.length) edit((dd) => { dd.districts = [...new Set([...dd.districts, ...found])]; });
    }).catch(() => {});
}

/* ---------------- days & activities ---------------- */

export function addDay(tripId) {
  let idx = 0;
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    const last = t.days[t.days.length - 1];
    t.days.push(createDay({
      index: t.days.length + 1,
      date: last ? shiftDate(last.date, 1) : t.startDate,
      title: 'নতুন দিন', title_en: 'New day',
      from: last ? last.to : t.origin, to: last ? last.to : t.origin, legKm: 0,
    }));
    t.endDate = t.days[t.days.length - 1].date;
    idx = t.days.length - 1;
    touch(t);
  });
  setUI({ dayIdx: idx });
}

export function deleteDay(tripId, dayId) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.days = t.days.filter((x) => x.id !== dayId);
    t.days.forEach((x, i) => { x.index = i + 1; });
    d.tombstones[dayId] = nowISO();
    touch(t);
  });
  setUI({ dayIdx: 0, selNode: null });
}

export function updateDay(tripId, dayId, patch) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    Object.assign(day, patch);
    if (day.from && day.to) day.legKm = haversine(day.from, day.to);
    touch(t);
  });
}

export function addActivity(tripId, dayId, data) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    day.activities.push(createActivity(data));
    touch(t);
  });
}

export function updateActivity(tripId, dayId, actId, patch) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    const a = day?.activities.find((x) => x.id === actId);
    if (!a) return;
    Object.assign(a, patch, { updatedAt: nowISO() });
    touch(t);
  });
}

export function deleteActivity(tripId, dayId, actId) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    day.activities = day.activities.filter((x) => x.id !== actId);
    d.tombstones[actId] = nowISO();
    touch(t);
  });
}

export function toggleActivity(tripId, dayId, actId, done, by = 'manual') {
  updateActivity(tripId, dayId, actId, { done, doneAt: done ? nowISO() : null, doneBy: by });
  if (done && navigator.vibrate) navigator.vibrate(10);
}

/** Move an activity to an exact position — what dragging produces. */
export function reorderActivity(tripId, dayId, from, to) {
  if (from === to) return;
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    const list = day.activities;
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
    const [a] = list.splice(from, 1);
    list.splice(to, 0, a);
    touch(t);
  });
}

export function moveActivity(tripId, dayId, actId, dir) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    const i = day.activities.findIndex((x) => x.id === actId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= day.activities.length) return;
    const [a] = day.activities.splice(i, 1);
    day.activities.splice(j, 0, a);
    touch(t);
  });
}

/* ---------------- stays ---------------- */

/** Add a place to sleep and pin it to the given day. */
export function addStay(tripId, dayId, data) {
  let id = null;
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    const stay = createStay(data);
    id = stay.id;
    t.stays.push(stay);
    const day = t.days.find((x) => x.id === dayId);
    if (day) day.stayId = stay.id;
    touch(t);
  });
  return id;
}

export function updateStay(tripId, stayId, patch) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const s = t?.stays.find((x) => x.id === stayId);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: nowISO() });
    touch(t);
  });
}

export function deleteStay(tripId, stayId) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.stays = t.stays.filter((x) => x.id !== stayId);
    t.days.forEach((day) => { if (day.stayId === stayId) day.stayId = null; });
    d.tombstones[stayId] = nowISO();
    touch(t);
  });
}

/** Reuse one hotel across several nights without duplicating it. */
export function setDayStay(tripId, dayId, stayId) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const day = t?.days.find((x) => x.id === dayId);
    if (!day) return;
    day.stayId = stayId || null;
    touch(t);
  });
}

/* ---------------- contacts ---------------- */
export function addContact(tripId, data) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.contacts.push(createContact(data));
    touch(t);
  });
}
export function updateContact(tripId, cid, patch) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    const c = t?.contacts.find((x) => x.id === cid);
    if (!c) return;
    Object.assign(c, patch);
    touch(t);
  });
}
export function deleteContact(tripId, cid) {
  edit((d) => {
    const t = d.trips.find((x) => x.id === tripId);
    if (!t) return;
    t.contacts = t.contacts.filter((x) => x.id !== cid);
    touch(t);
  });
}

/* ---------------- visits ---------------- */
export function toggleCountry(code, year) {
  edit((d) => {
    const i = d.visits.findIndex((v) => v.countryCode === code);
    if (i >= 0) { d.tombstones[d.visits[i].id] = nowISO(); d.visits.splice(i, 1); }
    else d.visits.push({
      id: uid('visit'), countryCode: code,
      firstVisit: year ? `${year}-01-01` : localDate(),
      lastVisit: year ? `${year}-01-01` : localDate(),
      timesVisited: 1, tripIds: [], source: 'manual', updatedAt: nowISO(),
    });
  });
}

export function toggleDistrict(en) {
  edit((d) => {
    d.districts = d.districts.includes(en)
      ? d.districts.filter((x) => x !== en)
      : [...d.districts, en];
  });
}

export function addPastTrip({ scope, year, keys, names }) {
  edit((d) => {
    d.past.unshift({
      id: uid('past'), kind: 'past', scope, year,
      emoji: scope === 'local' ? '📍' : '✈️',
      title: names.bn, title_en: names.en,
      date: String(year), date_en: String(year),
      flag: scope === 'local' ? '🇧🇩' : '🌏',
      districts: scope === 'local' ? keys : [],
      countries: scope === 'local' ? [] : keys,
      updatedAt: nowISO(),
    });
    if (scope === 'local') {
      d.districts = [...new Set([...d.districts, ...keys])];
    } else {
      keys.forEach((code) => {
        if (!d.visits.some((v) => v.countryCode === code)) {
          d.visits.push({
            id: uid('visit'), countryCode: code,
            firstVisit: `${year}-01-01`, lastVisit: `${year}-01-01`,
            timesVisited: 1, tripIds: [], source: 'manual', updatedAt: nowISO(),
          });
        }
      });
    }
  });
}

export function deletePast(id) {
  edit((d) => { d.past = d.past.filter((p) => p.id !== id); d.tombstones[id] = nowISO(); });
}

/* ---------------- demo + import/export ---------------- */
export async function loadDemo() {
  const [intl, local, past] = await Promise.all([
    seedTrip('demo-international'), seedTrip('demo-local'), seedPast(),
  ]);
  edit((d) => {
    const have = new Set(d.trips.map((t) => t.id));
    [intl, local].forEach((t) => {
      if (have.has(t.id)) return;
      const copy = JSON.parse(JSON.stringify(t));
      copy.updatedAt = nowISO();
      copy.countries = (copy.countries || []).map(toNum);
      copy.contacts = makeContacts(copy.scope, copy.countries);
      copy.days.forEach((day) => { day.legKm = haversine(day.from, day.to); });
      d.trips.push(copy);
    });
    past.forEach((p) => {
      if (d.past.some((x) => x.id === p.id)) return;
      d.past.push({ ...p, updatedAt: nowISO() });
      (p.districts || []).forEach((x) => { if (!d.districts.includes(x)) d.districts.push(x); });
      (p.countries || []).map(toNum).forEach((code) => {
        if (d.visits.some((v) => v.countryCode === code)) return;
        d.visits.push({
          id: uid('visit'), countryCode: code,
          firstVisit: `${p.year || 2020}-01-01`, lastVisit: `${p.year || 2020}-01-01`,
          timesVisited: 1, tripIds: [], source: 'import', updatedAt: nowISO(),
        });
      });
    });
    if (!d.trips.some((t) => t.status === 'active')) {
      const t = d.trips[0]; if (t) t.status = 'active';
    }
  });
  const t = doc.value.trips.find((x) => x.status === 'active') || doc.value.trips[0];
  if (t) { setTrip(t.id); setUI({ tab: 'plan' }); }
  toast(L('ডেমো ট্রিপ ঢুকেছে', 'Demo trips loaded'));
}

const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

/**
 * Save the whole document as a .json file.
 *
 * In a browser an <a download> is enough. Inside the Android WebView it is not:
 * blob: downloads are silently dropped there, so the file is written to the
 * app's documents folder and handed to the system share sheet instead.
 */
export async function exportDoc() {
  const data = JSON.stringify(doc.value, null, 2);
  const name = `tripdeck-${localDate()}.json`;

  if (isNative()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    await Filesystem.writeFile({
      path: name, data, directory: Directory.Documents, encoding: Encoding.UTF8,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Documents });
    try {
      await Share.share({ title: name, text: L('TripDeck-এর ব্যাকআপ', 'TripDeck backup'), url: uri });
    } catch {
      // The share sheet was dismissed — the file is still saved.
    }
    return { saved: true, where: 'Documents/' + name };
  }

  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { saved: true, where: name };
}

/** Import preview: what would be added, before anything is merged */
export function previewImport(raw) {
  if (!looksLikeDoc(raw)) return null;
  const incoming = migrate(raw);
  const cur = doc.value;
  const newTrips = incoming.trips.filter((t) => !cur.trips.some((x) => x.id === t.id)).length;
  const newPast = (incoming.past || []).filter((p) => !cur.past.some((x) => x.id === p.id)).length;
  const newCountries = (incoming.visits || [])
    .filter((v) => !cur.visits.some((x) => x.countryCode === v.countryCode)).length;
  const newDistricts = (incoming.districts || []).filter((x) => !cur.districts.includes(x)).length;
  return { incoming, newTrips, newPast, newCountries, newDistricts };
}

export function applyImport(incoming, mergeDocs) {
  const merged = mergeDocs(doc.value, incoming);
  doc.value = merged;
  edit(() => {});
}

export function resetAll() {
  edit((d) => {
    d.trips = []; d.past = []; d.visits = []; d.districts = []; d.tombstones = {};
  });
}

/** Country code → name, area, continent (used to score visits) */
export async function countryMeta(code) {
  const list = await countries();
  const c = list.find((x) => x.id === code);
  return c ? { ...c, area: areaOf(code), cont: continentOf(c.lat, c.lng) } : null;
}
