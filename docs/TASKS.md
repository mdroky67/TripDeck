# TripDeck — Task Checklist

> **v1 is built.** Below: what shipped, and what is still open.
> To run it: `npm install && npm run dev`

## ✅ Done

### P0 — Setup
- [x] Vite + Preact + signals + Leaflet + idb-keyval
- [x] `src/styles.css` — every token, dark/light, safe areas
- [x] `src/app.jsx` — five tabs, hash routing, no router library
- [x] `public/manifest.webmanifest` + icons (192/512/maskable)

### P1 — Data
- [x] `store/schema.js` — createDoc/Trip/Day/Activity/Contact, migrate, localDate
- [x] `store/db.js` — IndexedDB, track points, OSRM cache
- [x] `store/state.js` — signals, `edit()`, toast, sheet, boot
- [x] `store/actions.js` — every mutation for trips, days, activities, contacts, visits
- [x] Demo data: one international and one domestic sample trip, plus past trips

### P2 — Itinerary
- [x] Day strip (and add-day), day card, 44px checkboxes
- [x] Per-day and per-trip progress, excluding optional items
- [x] Activity sheet — add, edit, delete, reorder, time, icon, place, note
- [x] Day sheet — title, date, transport, journal
- [x] 🆘 Emergency numbers card and sheet, with copy buttons

### P3 — Map, chain and distance
- [x] `geo/distance.js` — haversine, legs, ETA, OSRM road distance cached 90 days
- [x] `geo/chain.js` — `chainOf()` and `liveOf()`
- [x] `ui/Chain.jsx` — three node states, distance and time on every leg
- [x] `ui/MapView.jsx` — Leaflet, numbered pins, three-colour polyline, live dot
- [x] Selected-stop card sits below the map so it cannot cover the pins

### P4 — Google
- [x] `google/auth.js` — GIS token flow, token in memory only
- [x] `google/drive.js` — appDataFolder find/download/upload, 7-day backups
- [x] `store/sync.js` — pull → merge (entity-wise LWW + tombstones) → push
- [x] Sync status chip and banners

### P5 — Offline / PWA
- [x] `public/sw.js` — app shell, data (stale-while-revalidate), tiles (LRU 2000)
- [x] Online/offline banner, queued writes
- [x] "Prepare for offline" button

### P6 — World and stats
- [x] `ui/WorldCanvas.jsx` — dot-grid globe, tap to toggle
- [x] `ui/DistrictCanvas.jsx` — 64 districts, per-division meters
- [x] Three separate measures: countries, continents, land area
- [x] Stats — four tiles, donut, bars, columns, all inline SVG

### P7 — Export / import
- [x] Export `.json`
- [x] Import — file picker → preview sheet → merge

### P8 — Live
- [x] `geo/tracker.js` — watchPosition (25 m / 30 s), Wake Lock, track summary
- [x] Geofence → notification, beep, vibrate, auto-tick suggestion
- [x] Arrival radius slider

### P9 — Polish
- [x] Bengali/English toggle — UI, numbers, place names; the user's own text untouched
- [x] Dark / light / system themes, km / mi
- [x] Empty states, skeletons, toasts, bottom sheets
- [x] Settings — account, data, erase-everything with typed confirmation
- [x] End-to-end tests in headless Chrome: dev, production and fully offline
- [x] **Contrast measured on every screen in both themes — zero failures**
- [x] Bundle at 85 KB gzip against a 250 KB budget

### P10 — Packaging
- [x] Capacitor Android project, permissions, launcher icons
- [x] GitHub Actions: APK on every push, Pages deploy, release on tag

### P11 — After the first real use on a phone
- [x] Search a place by name (Nominatim), so distances rest on a real point
- [x] Map picker opens at street zoom and carries the same search
- [x] Stays: add, edit, delete, reuse one across several nights
- [x] Costs on activities, a trip budget, and a money card in Stats
- [x] Drag-and-drop reordering, pointer events, handle only
- [x] Client ID can be pasted in Settings — an APK needs no rebuild
- [x] Export works inside the Android WebView
- [x] Header clears the status bar on Android 15 edge-to-edge
- [x] Per-leg transport in the chain

## ⏳ Open

- [ ] **Google sign-in inside the APK.** Needs an Android OAuth client, which
      needs a stable signing key, which needs a committed or secret keystore.
      Deferred by choice; file export/import covers backup meanwhile.
- [ ] **Background GPS** — same keystore question, plus
      `@capacitor-community/background-geolocation`
- [ ] Per-day photos
- [ ] Time-based alarms (only arrival alarms exist)
- [ ] Download a map region for offline (currently only what you have viewed)
- [ ] Bengali names for the remaining ~100 countries
- [ ] A real `id → continent` table (currently guessed from the centroid)
- [ ] Signed release APK (CI builds a debug APK)
