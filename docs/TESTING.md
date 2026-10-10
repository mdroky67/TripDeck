# Testing TripDeck without going anywhere

Most of the app can be checked from a chair. The only parts that need movement
are live tracking and the arrival alarm, and those work over a few hundred
metres — a walk to the end of the street is enough.

Allow about 30 minutes for the whole pass.

---

## 0. Install

Grab the APK from **Actions → latest run → Artifacts → `TripDeck-apk`**, unzip,
open it on the phone. Android asks to allow installs from unknown sources the
first time.

---

## 1. First run — 2 minutes

| Check | Expected |
|---|---|
| App opens | Header clear of the status bar; "No trips yet" |
| Tap **Load demo** | Two sample trips appear, plus four past trips |
| Bottom tabs | All five open without a blank screen or a flash |
| Header **বাং** button | Whole app switches to Bengali, digits become ০১২৩ |
| Tap it again | Back to English |
| ⚙︎ → theme **Dark** | Everything stays readable; no white-on-white anywhere |

If any text disappears in dark mode, that is a bug — screenshot it.

## 2. The checklist — 3 minutes

1. **Plan → List**
2. Tick the first activity. The day counter, the day-strip chip and the
   percentage at the top all move at once.
3. Switch to **Chain**. The ticked stop is now a filled teal dot and the next
   one is coral.
4. Switch to **Map**. The first leg is a solid teal line; the rest are dashed.
5. Tap a pin. The card **below** the map names the stop and its distances.
   It must not cover the pins.
6. Back in **List**, tap **+ Add activity**, type something, save. It appears
   in all three views.
7. Tap the day title → change it → save.

## 3. Offline — 3 minutes

1. Open **Plan → Map** and let the tiles load, then pan around a little.
2. Turn on **flight mode**.
3. Close the app from recents and reopen it.
   - It opens.
   - A yellow banner says there is no internet.
   - Everything still works: tick things, add a day, switch tabs.
   - The map shows the tiles you had already looked at.
4. Turn flight mode off. The banner goes. Everything you did is still there.

This is the single most important test. The app is built offline-first, so a
failure here matters more than anything cosmetic.

## 4. Data survives — 2 minutes

1. Tick a few things.
2. Force-close the app (swipe it away from recents) and reopen.
   Everything is where you left it, on the same trip.
3. ⚙︎ → **Export .json** → a file lands in Downloads.
4. ⚙︎ → **Erase all data** → type the confirmation word.
5. ⚙︎ → **Import** → pick the file you just exported → confirm the preview.
   Everything comes back.

## 5. World and districts — 2 minutes

1. **World → 🌍 World**. Tap a few countries. The percentage, the country
   count and the continent meters all update.
2. **🇧🇩 Districts**. Tap a few. The division meters update.
3. **Trips → + Past trip** → pick three districts, set a year, add.
   The district percentage jumps immediately.

## 6. Live tracking — 10 minutes, and the only part needing legs

GPS cannot tell two corners of a room apart — it is accurate to roughly
10–30 metres outdoors and worse indoors. So the test needs a walk of a few
hundred metres. The end of the street is plenty.

**Set up a two-point trip, at home:**

1. **Trips → + New trip** → Local → anything → Create.
2. **Plan → List → + Add activity**
   - Title: `Point A`
   - Tap **📍 Use my current location** → it shows coordinates and an accuracy
   - Save.
3. Walk 200–300 m away (end of the street, the shop, the next corner).
4. **+ Add activity** → Title `Point B` → **📍 Use my current location** → Save.
5. Walk back to Point A.

**Now test it:**

6. **Chain** shows `Point A → Point B` with a distance of roughly 200–300 m.
   If it says 0.0 km, the two captures were too close together — redo step 3
   further away.
7. **Live** tab → **▶ Start trip**. Android asks for location permission; allow.
8. Within a few seconds the big number becomes real: about **0.2 km to go**.
9. ⚙︎ Set the **arrival radius** slider to **100 m**.
10. Walk towards Point B. The number counts down, the ring fills, and the map
    dot follows you.
11. Within 100 m of Point B: a notification fires, the phone buzzes, and a card
    offers to tick that stop's activities.

**What to watch for:**

| Symptom | Likely cause |
|---|---|
| Number never changes | Location permission denied, or GPS has no sky view |
| Jumps by 50–100 m while standing still | Normal GPS noise; go outdoors |
| Alarm never fires | Radius smaller than the GPS accuracy — raise it to 200 m |
| Tracking stops when the screen sleeps | Expected. Turn on **🔋 Keep awake** |

That last one is a real limit of a WebView, not a bug. Real background tracking
needs the Capacitor background-geolocation plugin.

## 7. Google sign-in — 3 minutes

1. ⚙︎ → **Sign in with Google**.
2. If it works: the name, picture and "On Drive: x KB" appear.
3. Tick something, wait five seconds, then open the app on another phone or in
   a desktop browser and sign in with the same account — the same data is there.
4. Uninstall and reinstall the APK, sign in: everything comes back.

**If sign-in fails**, read the error:

| Error | Fix |
|---|---|
| `origin_mismatch` | Add `https://localhost` to **Authorized JavaScript origins** |
| `redirect_uri_mismatch` | Add `https://localhost` to **Authorized redirect URIs** too |
| Blank screen after a successful login | An old APK using the popup flow — rebuild |
| `access_denied` | Add your address under Test users on the consent screen |
| `403 … Drive API has not been used` | Enable the Google Drive API |
| Sign-in button says "not configured" | `VITE_GOOGLE_CLIENT_ID` missing from the build |

The app is fully usable without an account; the data simply stays on that phone.

## 8. Emergency numbers — 1 minute

**Plan → 🆘 Emergency numbers → See all**

- The official short codes are there with a ✓
- Agent, driver, hotel and embassy are blank with an amber "add it" chip
- **Copy** puts the number on the clipboard
- Tap a row to fill it in, save, and check it survives a restart
- Turn on flight mode — the numbers still open

## 9. Quick regression list

Run this after any change:

```
□ Opens with no network
□ Ticking updates list, chain, map and percentage together
□ Adding an activity with a place puts a node on the chain
□ Dark mode: nothing unreadable
□ Bengali: nothing clipped or overflowing
□ Export then import restores everything
□ Live shows a real distance with GPS on, and says "GPS off" without it
```
