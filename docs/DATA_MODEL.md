# TripDeck — Data Model & Sync

Everything is **one JSON document**: in IndexedDB locally, and in Drive at
`appDataFolder/tripdeck.json`. One file keeps merging simple, API calls few,
and offline sync predictable.

---

## 1. Root document

```jsonc
{
  "schemaVersion": 1,
  "docId": "uuid",              // created once, never changes
  "updatedAt": "2026-10-10T09:12:00Z",
  "deviceId": "uuid",           // which device wrote last
  "rev": 42,                    // +1 on every save
  "profile": {
    "name": "", "email": "", "picture": "",
    "homeBase": { "lat": 23.81, "lng": 90.41, "label": "…", "label_en": "…" },
    "units": "km",              // km | mi
    "lang": "bn",               // bn | en
    "theme": "system",          // system | light | dark
    "lastTripId": "trip_…"      // return to the same trip after a reload
  },
  "trips":     [ Trip ],
  "past":      [ PastTrip ],    // lightweight records of old journeys
  "visits":    [ Visit ],       // countries, for the world map
  "districts": [ "Rajshahi" ],  // Bangladesh districts, English names
  "settings":  Settings,
  "tombstones": { "<entityId>": "2026-10-10T09:12:00Z" }   // deletions
}
```

---

## 2. Trip

```jsonc
{
  "id": "trip_…",
  "title": "…", "title_en": "…",
  "subtitle": "…", "subtitle_en": "…",
  "scope": "local",             // local | international — drives UI, maths and map zoom
  "status": "planned",          // planned | active | completed | archived
  "startDate": "2026-11-02", "endDate": "2026-11-09",
  "travellers": 2,
  "coverEmoji": "🛫",
  "countries": ["764", "704"],  // ISO 3166-1 numeric
  "districts": ["Rajshahi"],    // when scope is local
  "currency": "USD",
  "budget": { "planned": 0, "spent": 0 },
  "origin": Place,
  "days":   [ Day ],
  "stays":  [ Stay ],
  "contacts": [ Contact ],
  "notes": "",
  "createdAt": "…", "updatedAt": "…"
}
```

`scope` matters:
- `local` → map zooms to Bangladesh, district coverage counts, countries don't
- `international` → world coverage counts, visa and flight fields appear

## 3. Day

```jsonc
{
  "id": "day_…",
  "index": 1,                   // 1-based; recompute after a reorder
  "date": "2026-11-02",
  "title": "…", "title_en": "…",
  "from": Place,                // where the day starts
  "to":   Place,                // where the night is spent
  "transport": "flight",        // flight|speedboat|car|train|bus|walk|ferry
  "transportNote": "",
  "legKm": 752.4,               // cached, recomputed on edit
  "activities": [ Activity ],
  "stayId": "stay_…",
  "journal": "", "photos": []
}
```

## 4. Activity — the unit of the checklist

```jsonc
{
  "id": "act_…",
  "title": "…", "title_en": "…",
  "type": "sightseeing",        // transfer|checkin|sightseeing|activity|meal|
                                // freetime|shopping|flight|rest
  "icon": "🏛️",
  "time": "08:30",              // optional, HH:mm
  "durationMin": 180,
  "place": Place | null,
  "cost": { "amount": 0, "currency": "THB", "included": true },
  "optional": false,            // "own cost" items don't count toward progress
  "done": false,
  "doneAt": null,
  "doneBy": "manual",           // manual | geofence
  "note": ""
}
```

## 5. Place

```jsonc
{ "lat": 13.75, "lng": 100.50, "label": "…", "label_en": "…", "countryCode": "764" }
```

## 6. Stay

```jsonc
{
  "id": "stay_…", "name": "…",
  "place": Place,
  "checkIn": "2026-11-02", "checkOut": "2026-11-04",
  "nights": 2, "stars": 3, "breakfast": true,
  "confirmation": "", "phone": "", "cost": 0
}
```

## 7. Visit — what the world map counts

```jsonc
{
  "id": "visit_…",
  "countryCode": "144",         // ISO numeric, matching the map data
  "firstVisit": "2026-09-18",
  "lastVisit":  "2026-09-23",
  "timesVisited": 1,
  "tripIds": ["trip_…"],
  "source": "trip"              // trip | manual | import
}
```

A Visit appears when a trip is marked `completed`, when the user taps a country
on the world map, or when a past trip is back-filled.

## 8. Settings

```jsonc
{
  "alarms":   { "enabled": true, "arrivalRadiusM": 500, "preDepartMin": 30,
                "sound": true, "vibrate": true },
  "tracking": { "enabled": false, "minIntervalSec": 30, "minDistanceM": 25,
                "keepAwake": true },
  "map":      { "style": "osm", "cacheTiles": true },
  "sync":     { "auto": true, "lastSyncAt": null }
}
```

---

## 9. World coverage, precisely

```js
const TOTAL_COUNTRIES = 195;     // 193 UN members + Vatican + Palestine
const WORLD_LAND_KM2  = 148_940_000;

worldPct     = visited.length / 195 * 100        // "World 6.2%"
continentPct = visitedIn(continent) / countriesIn(continent)
landPct      = Σ area(visited) / WORLD_LAND_KM2  // "3.1% of the land"
```

Show all three. Counting countries alone misleads — Vatican City is not Russia.

**Point → country** uses the dot grid in `public/data/worldgrid.json`. Works
offline, needs no API. Cells are about 1.5°, so borders are approximate; a
trip's own `countries` list is authoritative and the grid is only a hint.

---

## 10. Distance

```js
// straight line — always available, including offline
haversine(a, b) → km        // R = 6371.0088
legKm(day)      → haversine(day.from, day.to)
tripKm(trip)    → Σ legKm

// road distance — online only, fetched once and cached
GET https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
→ routes[0].distance (m), routes[0].duration (s)
cache key: `osrm:{lat1},{lng1}->{lat2},{lng2}` in IndexedDB, 90-day TTL
Never called for flights, speedboats or ferries — there is no road.
```

Always label which one is on screen — **"42 km direct"** versus
**"58 km by road"** — so nobody is misled.

---

## 11. Live tracking and ETA

```js
watchPosition({ enableHighAccuracy: true, maximumAge: 10000 })
  → throttle: store a point only after 25 m of movement or 30 s
  → remainingKm = haversine(current, targetNode)
  → progress    = 1 - remainingKm / legKm
  → eta         = remainingKm / averageSpeedOverLastFiveMinutes
  → geofence: remainingKm * 1000 ≤ settings.alarms.arrivalRadiusM
       → notify, beep, vibrate, and offer to tick that stop's activities
```

Track points stay in IndexedDB only — they are far too big for the synced
document. At the end of a day a summary (total km, max speed, a simplified
50-point path) can go into the document.

**Never fake a position.** With no GPS fix the app shows a "GPS off" chip
instead of guessing.

---

## 12. Sync

```
PULL  : download tripdeck.json from Drive
MERGE : the rules below
PUSH  : upload the merged document
```

**Entity-wise last-write-wins:**
```js
for each list (trips, past, visits):
   same id on both sides → the newer updatedAt wins
   present on one side only →
        if the other side has tombstones[id] newer than updatedAt → delete
        otherwise → keep
days and activities merge the same way, one level deeper
`done` is special: once true on either side it stays true — that is what a
traveller means by ticking something off
rev = max(localRev, remoteRev) + 1
```

**When it runs:** at startup, 5 seconds after a write (debounced), on
`visibilitychange → hidden`, and on the `online` event. Offline, writes queue up.

**Backups:** on the first sync each day, write
`tripdeck-backup-YYYYMMDD.json` alongside, keeping the last 7. A bad merge then
has a way back.

---

## 13. Export / import

- **Export** — the whole document as `tripdeck-YYYY-MM-DD.json`.
- **Import** — pick a file → check `schemaVersion` → migrate → show a preview
  ("3 new trips, 12 new countries") → merge on confirm. Nothing is deleted.
- **From Drive** — nothing to do. Sign in and the document pulls down.

---

## 14. Migration

```js
const MIGRATIONS = {
  1: doc => doc,
  // 2: doc => ({ ...doc, schemaVersion: 2, /* new fields with defaults */ }),
};
```
Run them in order on an older document. **Never remove a field — only add.**

---

## 15. A trap in the map data

`public/data/countries-110m.json` (Natural Earth 110m) is small and fast, but
leaves out micro-states: **Maldives, Singapore, Malta, Bahrain**. They are
listed separately in `geo/places.js` as `TINY_STATES` and drawn as single dots,
while still counting fully.

`public/data/worldgrid.json` is a 230×104 dot grid (39 KB) derived from the same
source. On a phone, drawing 7,435 dots on a canvas is far faster than filling
polygons, and hit-testing a tap is a simple cell lookup.

---

## 16. The chain — turning a list into a connected thread

The chain is **derived** from `days[].activities[]`, not stored. That is why
ticking something in the list moves the chain and the map at the same time.

```js
export function chainOf(trip) {
  const nodes = [];
  const push = (place, meta) => {            // merge consecutive repeats
    const last = nodes[nodes.length - 1];
    if (last && last.label === place.label) return Object.assign(last, meta);
    nodes.push({ ...place, ...meta, acts: [] });
  };
  trip.days.forEach((d, i) => {
    push(d.from, { day: i + 1, kind: 'start' });
    d.activities.forEach(a => {
      if (a.place) push(a.place, { day: i + 1, icon: a.icon, time: a.time });
      nodes[nodes.length - 1].acts.push(a);  // place-less items hang off the previous node
    });
    push(d.to, { day: i + 1, kind: 'night' });
  });

  // the node after the last one with a ticked activity is where we are heading
  let last = -1;
  nodes.forEach((n, i) => { if (n.acts.some(a => a.done)) last = i; });
  const target = Math.min(last + 1, nodes.length - 1);

  nodes.forEach((n, i) => {
    n.state = i < target ? 'done' : i === target ? 'now' : 'next';
  });
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].kmNext = haversine(nodes[i], nodes[i + 1]);
  return { nodes, target };
}
```

**One chain, three views:**

| | `done` | `now` | `next` |
|---|---|---|---|
| List | ticked, struck through | — | empty box |
| Chain | filled teal dot, solid wire | coral dot + "x km to go" | hollow dot, grey wire |
| Map | solid teal line | dashed coral line + pulsing dot | faded dashed line |

Live position is `lerp(nodes[target-1], nodes[target], frac)` where `frac` comes
from GPS. With no fix, show the start of the leg and a "GPS off" chip.

Tapping a node shows: distance from you · distance from the start · distance to
the next stop.

---

## 17. Contacts — emergency numbers

```jsonc
{
  "id": "c…",
  "role": "…", "role_en": "…",
  "name": "…", "name_en": "…",
  "phone": "1912",
  "kind": "emergency",   // emergency | police | ambulance | agent | driver |
                         // hotel | embassy | insurance | family | other
  "verified": true,      // true only for official short codes
  "note": ""
}
```

**Hard rule: the app never invents a number.** Only verified government short
codes ship built in (`src/data/emergency.js`); everything else starts blank with
an amber "add it" chip. A wrong emergency number is worse than none.

Contacts live inside the trip document, so they open with no network. Browsers
cannot be trusted to dial a `tel:` link, so the number is shown as selectable
text with a copy button; a native build can add a dial button.

---

## 18. Districts (Bangladesh)

`public/data/bd-districts.json` — 64 records:
```jsonc
{ "id": "15", "en": "Rajshahi", "bn": "রাজশাহী", "lat": 24.3723, "lng": 88.5631, "div": "…" }
```

```js
districtPct = visitedDistricts.size / 64 * 100
divisionPct = divisionsWithAtLeastOne / 8
nearestDistrict(lat, lng)   // within 50 km, else null — don't mark by accident
```

Completing a trip resolves each of its places to the nearest district and adds
them. `public/data/outlines.json` holds country outlines (Natural Earth 50m) for
the offline schematic maps.

---

## 19. Past trips

Nobody will retype a full itinerary for a trip from 2019, so past trips are
deliberately thin:

```jsonc
{
  "id": "past_…", "kind": "past", "scope": "local",
  "title": "…", "title_en": "…",
  "year": 2023, "emoji": "📍", "flag": "🇧🇩",
  "districts": ["Coxsbazar"],
  "countries": []
}
```

Saving one updates `visits` and `districts` immediately, so coverage jumps right
away. It can be upgraded to a full itinerary later.

---

## 20. Two languages

**The rule: the app's own text is translated; the user's writing is not.**

| What | Where it lives | On language switch |
|---|---|---|
| Buttons, headings, menus | `src/i18n.js` | translated |
| Numbers (42.3 ⇄ ৪২.৩) | the `N()` formatter | digits change |
| District and country names | `bn` + `en` in the data files | changes |
| Trip names, activity names, notes | the user's document | **unchanged** |

There is no translation API (there is no server), and machine-translating a
place name would mangle it. What the user typed stays as typed.

Data fields carry an `_en` sibling where both are needed:

```jsonc
{ "title": "পুরনো রাজবাড়ি", "title_en": "Old palace grounds",
  "place": { "label": "নাটোর", "label_en": "Natore", "lat": 24.42, "lng": 89.0 } }
```

```js
// src/i18n.js
export const L  = (bn, en) => state.lang === 'bn' ? bn : en;
export const N  = n => state.lang === 'bn'
  ? String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]) : String(n);
export const tx = (o, k) =>
  state.lang === 'en' && o[k + '_en'] ? o[k + '_en'] : (o[k] || o[k + '_en'] || '');
```

Anything the user creates fills only the base field; `tx()` falls back to it, so
nothing breaks. `lang` lives in `profile`, so it syncs across devices. Set
`<html lang>` too — screen readers need it.

---

## 21. Country list

`public/data/countries-list.json` — 177 countries:
```jsonc
{ "id": "144", "en": "Sri Lanka", "bn": "শ্রীলঙ্কা", "lat": 7.701, "lng": 80.667, "a2": "LK" }
```

`id` is ISO 3166-1 numeric, matching the map data so countries can be coloured.
`a2` bridges to the emergency-number table, which is keyed by alpha-2.
`lat/lng` is the centroid of the largest polygon — good enough as a starting
position when creating a trip; the user pins the real place later.

Maldives, Singapore and Bahrain are missing from the 110m source and were added
by hand. Bengali names exist for about 80; the rest fall back to English.

**In the new-trip form,** changing `scope` must swap the list underneath:
`local` → 64 districts, `international` → 177 countries. Showing the same list
for both is the single biggest mistake to avoid here.

**Continents** aren't in the data; they are guessed from the centroid in
`continentOf(lat, lng)`. Replace that with a real 177-line `id → continent`
table when you get a chance — Russia and Türkiye straddle two.

---

## 22. One mistake already made and fixed

The selected-stop card used to float over the map (`position:absolute; bottom`).
It covered the lower pins, so they could not be tapped at all.

**Rule: only things nobody needs to tap may float over a map** — the chips in
the top corner (total km, km remaining). The detail card sits *below* the map in
normal flow, with a ✕ to dismiss it. The same goes everywhere: toasts and sheets
never park permanently over something tappable.

---

## 23. A reactivity trap in Preact signals

Components skip re-rendering when their props are shallow-equal. Mutating a trip
in place and only replacing the root document left the trip object identical, so
`<ListView trip={t} />` never re-rendered — ticking a checkbox changed the data
but not the screen.

The fix is in `edit()`:

```js
doc.value = { ...d, trips: d.trips.map(t => ({ ...t })) };
```

Give every trip a fresh reference on each write. It costs nothing and removes a
whole class of "the data changed but the UI didn't" bugs.

---

## 24. Dates: never use `toISOString()` for a calendar date

`new Date('2026-10-10T00:00:00').toISOString().slice(0, 10)` returns
**2026-10-09** anywhere east of UTC. Every date in this app is a calendar date,
not an instant, so use the local formatter:

```js
export function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
```

---

## 25. Signing in from inside a WebView

Google's own library signs in through a popup and returns the result with
`postMessage`. That return path does not exist inside an Android WebView: the
login completes and the popup is left blank, with no error anywhere.

So native uses a plain redirect instead. The app sends the WebView to Google
with `redirect_uri` set to its own origin (`https://localhost`, which is what
Capacitor serves), and Google comes back with the token in the URL fragment.

```js
// going out
location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id, redirect_uri: location.origin, response_type: 'token',
  scope, include_granted_scopes: 'true', prompt: 'consent', state,
}));

// coming back, read before anything touches location.hash
const p = new URLSearchParams(location.hash.slice(1));
token = p.get('access_token');
history.replaceState(null, '', location.pathname);
```

Two things to keep in mind:

1. **Read the fragment before the router runs.** The router writes the current
   tab into `location.hash` when it mounts, which would wipe the token first.
   The read therefore happens at the top of `main.jsx`, and its answer is
   cached for the sign-in code to pick up later.
2. **A silent renew cannot redirect.** Sending the whole app to Google without
   being asked would be hostile, so on native `signIn({ silent: true })`
   refuses and the user is asked to sign in again when the token expires.

Both `https://localhost` entries are needed in the Google console — one under
Authorized JavaScript origins, one under Authorized redirect URIs.
