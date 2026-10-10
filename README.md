# TripDeck

An offline-first trip planner. Plans both domestic trips (Bangladesh's 64
districts) and international ones, in English and Bengali. Your data lives in
your own Google Drive — **no server, no hosting bill**.

```bash
npm install
npm run dev          # http://localhost:5173
npm run serve        # build, then serve it like a static host would
```

To enable Google sign-in, follow [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md),
then paste the client ID into ⚙︎ Settings — no rebuild needed, which is how a
downloaded APK gets configured too. For local work, `.env` does the same job.
The app works fine without signing in; the data just stays on that one device.

**Android APK:** every `git push` builds one in CI. Actions → latest run →
Artifacts → `TripDeck-apk`. See [APK.md](APK.md).

## Five screens

| | What it does |
|---|---|
| 🧳 **Trips** | Domestic and international trips in one list · new trip · back-fill past trips · demo data |
| 🗓️ **Plan** | **List ⇄ Chain ⇄ Map**, all the same data · checklist · 🆘 emergency numbers |
| 🧭 **Live** | GPS tracking · "42 km to go" · arrival alarm · keep-screen-awake |
| 🌍 **World** | 195 countries and 64 districts covered · tap the map to mark |
| 📊 **Stats** | Progress, distance, new countries per year · Drive sync panel |

## How it is built

```
Vite + Preact + signals    UI (React API, ~5 KB runtime)
Leaflet + OpenStreetMap    trip route map
hand-drawn canvas          world and district maps — work offline
IndexedDB (idb-keyval)     local data; every write lands here first
Google Drive appDataFolder cloud backup, in the user's own 15 GB
hand-written service worker app shell + map tile cache
Capacitor                  wraps the same build into an Android APK
```

**Bundle: 85 KB gzip (JS) + 10 KB (CSS)**, against a 250 KB budget.
No charting library — every chart is inline SVG.

## Layout

```
src/
├─ i18n.js              L(bn,en) · N(numbers) · tx(data) — the whole bilingual layer
├─ store/               schema · db (IndexedDB) · state (signals) · sync (merge) · actions
├─ google/              auth (GIS) · drive (appDataFolder)
├─ geo/                 distance · chain · places · data · tracker
├─ data/                emergency (verified numbers) · iso (country codes)
├─ screens/             Trips · Plan · Live · World · Stats · Settings
└─ ui/                  Chain · MapView · WorldCanvas · DistrictCanvas · Charts · Sheet …
public/data/            64 districts · 180 countries · world grid · outlines · demo trips
android/                Capacitor's native project (permissions, icons)
```

## Documents

| File | What's in it |
|---|---|
| [PLAN.md](PLAN.md) | The master plan — scope, stack, architecture, phases |
| [docs/DESIGN.md](docs/DESIGN.md) | Colour, type, and a spec for every screen |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | JSON schema, sync/merge, the chain, bilingual rules |
| [docs/GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md) | OAuth and Drive setup, with the code |
| [docs/TASKS.md](docs/TASKS.md) | What is done, what is left |
| [docs/TESTING.md](docs/TESTING.md) | How to test everything, mostly without leaving home |
| [APK.md](APK.md) | The phone app — where to get it, what it asks for |
| [DEPLOY.md](DEPLOY.md) | Pushing and publishing |

## Known limits

- **Background GPS:** browsers cut location off when the screen sleeps, and a
  PWA cannot get around that. Hence the keep-awake toggle. Real background
  tracking needs a Capacitor plugin — the APK is already set up to take one.
- **Road distance** only works online (fetched from OSRM, cached 90 days).
  Offline you get straight-line distance, labelled as such.
- **Emergency numbers:** the app never invents one. Only verified government
  short codes ship with it; agent, driver and embassy numbers are yours to fill in.
- **Country names in Bengali** exist for about 80 of the 180; the rest fall back
  to English.

## A note for anyone picking this up

`PLAN.md`, `README.md`, `docs/`, `seed/` and `public/data/` are reference
material — don't delete them. New code goes in `src/`. Don't swap the stack and
don't add a server.
