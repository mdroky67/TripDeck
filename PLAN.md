# TripDeck — Master Plan

> ✅ **v1 is built.** The code is in `src/`; run it with `npm run dev`.
> What's done and what's left: [docs/TASKS.md](docs/TASKS.md). The plan below
> is kept as a reference and has not been rewritten after the fact.
>
> **This file is the single source of truth.** Any AI or developer who reads
> this plus `docs/` can build the whole app without asking questions. Every
> decision is locked here — don't swap the stack.

---

## 0. In one line

**TripDeck** is an offline-first PWA trip planner with a visited-world map.
Data lives in the user's own **Google Drive** (appDataFolder). **No server, no
hosting cost, no database bill.**

---

## 1. Scope

### v1 — shipped
| # | Feature | Notes |
|---|---|---|
| F1 | Google sign-in | GIS token client, `drive.appdata` scope. No backend. |
| F2 | Trip → Day → Activity | Build an itinerary, reorder items |
| F3 | Checklist | Tick each activity → progress % |
| F4 | Map | Every point pinned, legs drawn between them |
| F5 | Distance | Haversine always; road distance when online |
| F6 | Visited world | Mark countries → map fill + "World 6.2% (12/195)" |
| F7 | Offline | Service worker, IndexedDB, map tile cache |
| F8 | Drive sync | Auto-save, conflict merge; survives uninstall/reinstall |
| F9 | Dashboard | Charts: progress, km, countries, districts |
| F10 | Export / import | `.json` download and upload |
| F11 | **Domestic trips** | Bangladesh's 64 districts, district coverage % |
| F12 | **Route chain** | List ⇄ chain ⇄ map, one dataset, live position on the chain |
| F13 | **Emergency numbers** | Verified short codes + agent, driver, hotel, embassy, insurance |
| F14 | **Back-fill past trips** | Add old journeys → world and district coverage jump |
| F15 | **Bengali + English** | Whole app in both; the user's own writing is never translated |

### v2 — next
| # | Feature | Notes |
|---|---|---|
| F16 | Live tracking | `watchPosition` → "42 km to Kandy" |
| F17 | Arrival alarm | 500 m geofence → notification + sound |
| F18 | Time alarms | "07:00 — leave for the fortress" |
| F19 | Auto check-in | Suggest ticking activities on arrival |
| F20 | Trip journal | Per-day notes and photos (photos on Drive, thumbnails local) |
| F21 | SOS screen | Emergency numbers plus your live coordinates, one tap from the lock screen |

### v3 — nice to have
Budget and expense splitting, packing-list templates, sharing a trip through a
Drive file, offline map region download, PDF export.

### Never
Our own server, our own database, a paid API key, passwords at sign-in, or
sending the user's data to a third party.

---

## 2. Stack (locked)

```
Build      : Vite 8
UI         : Preact 10 + @preact/signals   (React API, ~5 KB runtime)
Language   : plain JS with JSDoc types     (TypeScript optional, not strict)
Styling    : one hand-written CSS file with custom properties (no Tailwind, no UI kit)
Map        : Leaflet 1.9 + OpenStreetMap raster tiles
Geo data   : Natural Earth, pre-processed into small JSON files
Charts     : no library — inline SVG, drawn by hand
Local DB   : IndexedDB via idb-keyval (~1 KB)
Cloud      : Google Drive REST v3, appDataFolder
Auth       : Google Identity Services — implicit token flow
PWA        : hand-written service worker (no Workbox)
Packaging  : Capacitor → Android APK
Hosting    : GitHub Pages (free, static)
```

**Bundle budget: 250 KB gzip including the map library.** Cut features before
exceeding it. (Shipped at ~95 KB.)

Why Leaflet and not MapLibre: raster tiles are far easier to cache offline and
the library is a fifth of the size. "Lightweight" was a requirement.

---

## 3. Architecture

```
┌──────────────── Browser / WebView ────────────────┐
│                                                   │
│  Preact UI  ──────► state.js (signals, in memory) │
│                        │                          │
│                        ├──► IndexedDB  (source of truth, offline)
│                        │                          │
│                        └──► syncQueue ──► Drive ──┼──► Google Drive
│                                                   │     appDataFolder/
│  Service worker: app shell cache + tile cache     │     └ tripdeck.json
└───────────────────────────────────────────────────┘
            No server. No secret key anywhere.
```

**Golden rule:** the UI never writes to the network directly. Every write goes
to IndexedDB first, then syncs in the background. That is what makes the app
work with no connection at all.

---

## 4. How it runs with no hosting

| Need | Solution | Cost |
|---|---|---|
| Serving the HTML/JS | GitHub Pages | 0 |
| The user's data | Google Drive appDataFolder (their own 15 GB) | 0 |
| Sign-in | Google Identity Services, entirely client-side | 0 |
| Map tiles | OpenStreetMap tile servers (attribution required) | 0 |
| Country borders | A static file inside the bundle | 0 |
| Notifications | The browser's own Notification API | 0 |
| Android APK | GitHub Actions (free for public repos) | 0 |

**appDataFolder** is a hidden folder in Drive. The user never sees it, but the
data is in their own account. Uninstall → reinstall → sign in → everything is back.

> ⚠️ The public OSM tile servers have a fair-use policy. Fine for personal use;
> a popular app should move to a free MapTiler or Protomaps key.

---

## 5. Limits we are not hiding

1. **Background tracking:** with the screen off, iOS stops GPS for a PWA
   entirely and Android Chrome throttles it. Tracking runs while the app is
   open, with a Wake Lock. Real background work needs the Capacitor
   background-geolocation plugin.
2. **iOS notifications** only work for a PWA added to the Home Screen (iOS 16.4+).
3. **OAuth verification:** `drive.appdata` is a non-sensitive scope, so a
   project in Testing mode works for up to 100 test users with no review.
4. **Road distance** is impossible offline. Offline shows straight-line
   distance, always labelled as such; online fetches and caches the real one.

---

## 6. Phases

| Phase | Work | Visible result |
|---|---|---|
| **P0** | Vite + Preact, styles.css, tab shell | An empty app that runs |
| **P1** | schema + db + demo import | A trip shows up in the list |
| **P2** | Itinerary + checklist + progress + emergency numbers | Days can be ticked off |
| **P3** | Map + chain + pins + distance | Route and km on a map |
| **P4** | Google auth + Drive sync | Same data on two devices |
| **P5** | Service worker + offline + install prompt | Works in flight mode |
| **P6** | World map, district map, dashboard | "World 6.2% · districts 34%" |
| **P7** | Export / import | A `.json` goes out and comes back |
| **P8** | Live tracking + geofence alarm | "42 km to go" and an alarm |
| **P9** | Both languages, animation, empty states, accessibility | Release |

Tick each phase off in `docs/TASKS.md`.

---

## 7. Instructions for whoever builds next

```
You are working on TripDeck.
1. Read: PLAN.md → docs/DATA_MODEL.md → docs/DESIGN.md → docs/TASKS.md
2. Start at the first unchecked task in docs/TASKS.md.
3. Don't change the stack. Check the bundle budget before adding a dependency.
4. After each task: run `npm run build`, report the gzip size, tick the task.
5. If a feature seems to need a server — stop and find another way. There is no server.
6. Don't delete PLAN.md, README.md, docs/, seed/ or public/data/. New code goes in src/.
```

---

## 8. Reference data

`seed/` holds two sample trips (one international, one domestic) and a few past
trips. They are fictional, used for the "load demo" button, and double as a
living example of the schema.
