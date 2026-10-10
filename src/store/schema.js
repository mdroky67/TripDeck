/**
 * The TripDeck document schema. docs/DATA_MODEL.md is the reference.
 * Rule: never remove a field, only add one — and write a migration.
 */
export const SCHEMA_VERSION = 1;

export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const nowISO = () => new Date().toISOString();

/** Local calendar date as YYYY-MM-DD. Do not use toISOString(): it converts
 *  to UTC, which shifts every date back a day east of Greenwich. */
export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function createDoc(profile = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    docId: uid('doc'),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    deviceId: deviceId(),
    rev: 1,
    profile: {
      name: '', email: '', picture: '',
      homeBase: { lat: 23.8103, lng: 90.4125, label: 'ঢাকা', label_en: 'Dhaka', countryCode: 'BD' },
      googleClientId: '',        // web client, used in a browser
      googleAndroidClientId: '',  // Android client, used by the phone app
      units: 'km',
      lang: 'en',
      theme: 'light',
      ...profile,
    },
    trips: [],
    past: [],
    visits: [],            // দেশ
    districts: [],         // বাংলাদেশের জেলা (en নাম)
    settings: createSettings(),
    tombstones: {},
  };
}

export const createSettings = () => ({
  alarms: { enabled: true, arrivalRadiusM: 500, preDepartMin: 30, sound: true, vibrate: true },
  tracking: { enabled: false, minIntervalSec: 30, minDistanceM: 25, keepAwake: true },
  map: { style: 'osm', cacheTiles: true },
  sync: { auto: true, lastSyncAt: null },
});

export function createTrip(p = {}) {
  const id = uid('trip');
  return {
    id,
    title: '', title_en: '',
    subtitle: '', subtitle_en: '',
    scope: 'local',                 // local | international
    status: 'planned',              // planned | active | completed | archived
    startDate: '', endDate: '',
    travellers: 1,
    coverEmoji: '🧳',
    countries: [], districts: [],
    currency: 'BDT',
    budget: { planned: 0, spent: 0 },
    origin: null,
    days: [], stays: [], contacts: [],
    notes: '',
    createdAt: nowISO(), updatedAt: nowISO(),
    ...p,
  };
}

export function createDay(p = {}) {
  return {
    id: uid('day'), index: 1, date: '',
    title: '', title_en: '',
    transport: 'car', transportNote: '',
    from: null, to: null, legKm: 0,
    stayId: null, activities: [],
    journal: '', photos: [],
    ...p,
  };
}

export function createActivity(p = {}) {
  return {
    id: uid('act'),
    title: '', title_en: '',
    type: 'activity', icon: '📍',
    time: '', durationMin: 0,
    place: null,
    cost: { amount: 0, currency: 'BDT', included: false },
    optional: false,
    done: false, doneAt: null, doneBy: 'manual',
    note: '',
    ...p,
  };
}

export const createPlace = (lat, lng, label, label_en, countryCode = 'BD') => ({
  lat, lng, label, label_en, countryCode,
});

export function createStay(p = {}) {
  return {
    id: uid('stay'), name: '', place: null,
    checkIn: '', checkOut: '', nights: 1, stars: 3, breakfast: false,
    confirmation: '', phone: '', cost: 0, currency: 'BDT', note: '',
    updatedAt: nowISO(),
    ...p,
  };
}

export function createContact(p = {}) {
  return {
    id: uid('c'), role: '', role_en: '', name: '', name_en: '',
    phone: '', kind: 'other', verified: false, note: '',
    ...p,
  };
}

/** Device id — tells the merge which side wrote last */
export function deviceId() {
  try {
    let d = localStorage.getItem('tripdeck.device');
    if (!d) { d = uid('dev'); localStorage.setItem('tripdeck.device', d); }
    return d;
  } catch { return 'dev_unknown'; }
}

const MIGRATIONS = {
  // 2: (doc) => ({ ...doc, schemaVersion: 2 }),
};

export function migrate(doc) {
  if (!doc || typeof doc !== 'object') return createDoc();
  let d = doc;
  let v = d.schemaVersion || 1;
  while (v < SCHEMA_VERSION && MIGRATIONS[v + 1]) { d = MIGRATIONS[++v](d); }
  // Older documents may be missing newer containers
  d.trips ||= []; d.past ||= []; d.visits ||= []; d.districts ||= [];
  d.tombstones ||= {};
  d.settings = { ...createSettings(), ...(d.settings || {}) };
  d.profile ||= createDoc().profile;
  d.schemaVersion = SCHEMA_VERSION;
  return d;
}

/** Is an imported file really a TripDeck document? */
export function looksLikeDoc(o) {
  return !!o && typeof o === 'object' && Array.isArray(o.trips) && 'schemaVersion' in o;
}
