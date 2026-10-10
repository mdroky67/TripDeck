# TripDeck — Design Specification

**Design language: warm sand meets deep ocean.** Deep teal and sunset coral on
a cool sea-glass ground. Large rounded cards, heavy numerals, few borders, a lot
of air. Nothing depends on photography, which keeps it small and fast.

The whole thing is built so a fifteen-year-old can use it without being taught:
**one main job per screen.**

---

## 1. Colour tokens

```css
:root{
  /* ground and surfaces */
  --bg:#E9EFEC;  --surface:#FFFFFF;  --surface-2:#F1F5F3;
  --line:#D5E0DB; --field:#DCE6E2;
  /* ink */
  --ink:#0C1C19;  --ink-2:#4C625D;  --ink-3:#556963;
  /* brand */
  --teal:#0A6B61; --teal-700:#07504A; --teal-100:#D3E9E4; --teal-ink:#064540;
  --coral:#C44A31; --coral-100:#F8DED6;
  --amber:#8F5C08; --amber-100:#F6E9CF;
  --violet:#5246BC; --violet-100:#E3E0F7;
  /* status */
  --ok:#1F7A4D; --danger:#C0392B;
  /* text that sits on a coloured fill — flips in dark mode */
  --on-teal:#FFFFFF; --on-warm:#FFFFFF; --pin-ring:#FFFFFF;
  /* translucent layers inside the hero gradient */
  --veil-1:rgba(255,255,255,.28); --veil-2:rgba(255,255,255,.20);
  --veil-3:rgba(255,255,255,.14); --glow:rgba(255,255,255,.22);
  /* maps */
  --sea:#CFDEDA; --land:#C2D4CE;
}
```

Dark mode redefines the same tokens in **two** blocks — one for
`@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`,
one for `:root[data-theme="dark"]`. Both are required: the app's default theme
is *system*, so a rule written only for `[data-theme="dark"]` never fires for
most users. That exact mistake made the first build unreadable in dark mode.

### Contrast is measured, not eyeballed

Every string on every screen was measured in a headless browser against its
painted background. The result that matters:

| | Before | After | Needed |
|---|---|---|---|
| `--ink-3` on a card, dark | 3.63 | 5.54 | 4.5 |
| `--ink-3` on the ground, light | 2.80 | 5.02 | 4.5 |
| `--amber` on its tint, light | 3.58 | 4.72 | 4.5 |
| teal chip text | 4.32 | 8.32 | 4.5 |

**Never hard-code `#fff` on a coloured fill.** In dark mode the accent becomes
the *light* colour and white text vanishes. Use `--on-teal` / `--on-warm`.

Colour is never the only signal — an icon or a word always comes with it, for
colour-blind readers and for bright sunlight.

## 2. Type

```css
--display: "Bricolage Grotesque", "Noto Sans Bengali", system-ui, sans-serif;
--body:    "Instrument Sans",     "Noto Sans Bengali", system-ui, sans-serif;

display  : 34px/1.1  800  -0.03em   /* "12 countries", "42 km" */
h1       : 24px/1.25 700
h2       : 19px/1.3  650
body     : 15px/1.5  450            /* 1.55 in Bengali — it needs the room */
label    : 13px/1.4  600
caption  : 12px/1.4  500  (--ink-3)
```

All digits get `font-variant-numeric: tabular-nums`.

`.eyebrow` is uppercase and only ever holds fixed words. Anything containing a
name — a place, a trip title — uses `.label`, which is not uppercased. Uppercase
mangles proper nouns, especially transliterated ones.

## 3. Spacing, shape, motion

```css
--s1:4 --s2:8 --s3:12 --s4:16 --s5:24 --s6:32 --s7:48   (px)
--r-sm:10 --r:16 --r-lg:22 --r-pill:999
--shadow: 0 1px 2px rgba(12,28,25,.05), 0 14px 34px -18px rgba(12,28,25,.35);
--t: 220ms cubic-bezier(.2,.7,.3,1);
@media (prefers-reduced-motion:reduce){ *{animation:none!important;transition:none!important} }
```

One column on a phone, 16px side gutter. From 900px the tab bar becomes a left
rail and the shell widens to 1120px.

**Touch targets are at least 44×44px.** Checkboxes get the full 44px, because
they are tapped on a moving bus.

## 4. Navigation

Five tabs at the bottom (a rail on desktop):

| | Tab | Job |
|---|---|---|
| 🧳 | **Trips** | The list, and making new ones |
| 🗓️ | **Plan** | The current trip, three ways |
| 🧭 | **Live** | Tracking and alarms |
| 🌍 | **World** | Coverage |
| 📊 | **Stats** | The report |

No floating "+" button in the middle. Each screen carries its own add button
where it belongs, which is less to explain.

Settings sits behind the ⚙︎ in the header, not in the tab bar — it is visited
rarely and would dilute five clear choices.

---

## 5. Screen by screen

### 5.1 Trips
- Greeting, date, and a Drive sync chip (`✓ Saved`, `Offline — saves later`)
- **Active trip** in a large teal card: emoji, title, progress bar, next stop,
  total km, days
- Every trip below with a **Local** (violet) or **Abroad** (grey) chip. Domestic
  and international live in one list — to the person using it, both are "a trip"
- Past trips in a quieter list
- Two buttons: **+ New trip** and **+ Past trip**
- Empty state: a big 🧳, one line, and two buttons — *New trip* and *Load demo*

### 5.2 Plan — the screen that gets used most

A segmented control at the top: **List · Chain · Map**. One dataset, three
views; a tick in one moves the other two immediately. Segmented, not tabs,
because these are three faces of one thing.

**List**
```
D1 D2 D3 … +            ← sticky day strip, ✓ when a day is finished
Day 01 · 2 November 2026
Arrival & Bangkok  ✎
┌─────────────────────────────────────────┐
│ ✈️ 1 492 km direct        0/3 done      │
│ ━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ☑ 🚐 Airport transfer to the city      │
│     📍 Suvarnabhumi Airport             │
│  ☐ 🏨 Hotel check-in                    │
│  ☐ 🌆 Evening by the river              │
│                       [+ Add activity]  │
└─────────────────────────────────────────┘
🏨 Overnight · Riverside Guesthouse ★★★
```
Tapping a row opens a sheet: time, place, icon, note, own-cost. Items marked
**own cost** carry an amber chip and are left out of the progress maths.
Ticking gives a 10 ms haptic buzz — enough to feel without looking.

**Chain**
```
 ●───  🚐 Set off in the morning
 │      Day 1 · 08:00
 │ 🚗 46.6 km · ~1h 10m · 12.3 km to go     ← coral, bold
 ◉╌╌╌  ☕ Tea break on the way
 ╎      Day 1 · 09:15 · heading here now
 ○───  🏛️ Old palace grounds
```
Filled teal = done · coral with a halo = now · hollow = ahead. Distance,
transport and a rough time sit between every pair. Tapping a node opens the
detail card.

**Map**
- Leaflet with numbered pins following the same colour rules
- A pulsing coral dot is you
- Chips in the top-left only: total km, km remaining
- **The detail card sits below the map, never over it** (see §7)

Below all three: the emergency numbers card.

### 5.3 Live
- A single very large number: **42.3** `km to go`, and below it the destination
- A progress ring around it, with ETA, speed and accuracy as chips
- **▶ Start trip / ⏸ Pause** and **🔋 Keep awake**
- One honest line about screens and GPS, because the limit is real
- On arrival: a celebratory card offering to tick that stop's activities
- An alarm radius slider, 100 m to 2 km

With no GPS fix the screen says so plainly rather than showing a guessed position.

### 5.4 World
**🌍 World | 🇧🇩 Districts**

| | World | Districts |
|---|---|---|
| Big number | `6.2%` teal | `34.4%` violet |
| Chips | 12/195 countries · 2/6 continents · 5.7% of land | 22/64 districts · 6/8 divisions |
| Map | dot-grid globe | Bangladesh outline + 64 dots |
| Below | continents, then the country list | divisions |

Tapping the map toggles. Two different accents so there is never a doubt about
which scoreboard is on screen.

### 5.5 Stats
Four tiles — km, countries, districts, trips — then one chart per card:
progress donut, distance-per-day bars, new-countries-per-year columns, activity
mix donut. All inline SVG. At the bottom, the Drive sync panel.

### 5.6 Settings
Google account · language · theme · units · export / import · prepare for
offline · erase everything (type the word to confirm).

---

## 6. Components

- **Card** — `--surface`, radius 22, padding 16, soft shadow; a 1px border
  instead of a shadow in dark mode
- **Chip** — pill, 12px; tinted variants for teal, amber, coral, violet
- **Button** — pill, 46px tall; primary is a teal fill, ghost is a 1px border
- **Sheet** — every form. Rises from the bottom, 36px grab handle, tap outside
  to cancel. Never a separate page: that loses the context of the trip.
- **Toast** — one at a time, 2.6s, and it names the next step
  ("2 added — see the World tab")
- **Empty state** — a big emoji, one line, one primary button. Never a blank screen.
- **Loading** — shimmering skeletons shaped like the cards, not a spinner

## 7. What may float over a map

| Floats | Does not float |
|---|---|
| Chips top-left: total km, km remaining | The selected-stop card |
| Zoom buttons | The legend |

The detail card used to float at the bottom of the map and covered the lower
pins, which then could not be tapped. It now sits below the map in normal flow
with a ✕ to dismiss, and scrolls into view when a pin is tapped — without the
map giving up any space.

## 8. Both languages

A single **English ⇄ বাংলা** button in the header, mirrored in Settings. In the
header because someone else may pick the phone up and need it in one tap.

- Switching is instant; nothing reloads
- Numbers change: `42.3 km` ⇄ `৪২.৩ km`, `Day 06` ⇄ `দিন ০৬`
- Place names change: `Natore` ⇄ `নাটোর`
- **What the user wrote never changes.** That is a rule, not a bug; Settings
  explains it in one line.
- Bengali runs about 15% wider. Never give a button a fixed width, and never
  combine `min-width` with `white-space: nowrap`.

## 9. Writing

Plain, friendly, no jargon. Say what happened and what to do next.

- ✅ "Saved" ❌ "Sync successful"
- ✅ "No internet — keep going, it saves itself later" ❌ "Offline: queued"
- ✅ "42 km to Kandy" ❌ "Remaining distance: 42km"
- An error says what went wrong and how to fix it. No apologies, no blame.

## 10. Accessibility

`prefers-reduced-motion` honoured · 2px teal focus rings · `aria-label` on every
icon-only button · real `<input type="checkbox">` elements · `<html lang>` kept
in sync with the language · contrast measured on every screen in both themes.
