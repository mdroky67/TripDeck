import { useEffect } from 'preact/hooks';
import { ready, ui, setUI, online, syncState, boot, user, setLang } from './store/state.js';
import './store/sync.js';               // registers the sync hook
import { lang, L } from './i18n.js';
import Trips from './screens/Trips.jsx';
import Plan from './screens/Plan.jsx';
import Live from './screens/Live.jsx';
import World from './screens/World.jsx';
import Stats from './screens/Stats.jsx';
import Settings from './screens/Settings.jsx';
import Sheet from './ui/Sheet.jsx';
import Toast from './ui/Toast.jsx';

const TABS = [
  ['trips', '🧳', 'ট্রিপ', 'Trips'],
  ['plan', '🗓️', 'প্ল্যান', 'Plan'],
  ['live', '🧭', 'লাইভ', 'Live'],
  ['world', '🌍', 'বিশ্ব', 'World'],
  ['stats', '📊', 'হিসাব', 'Stats'],
];

const SCREEN = { trips: Trips, plan: Plan, live: Live, world: World, stats: Stats, settings: Settings };

/** A real gear, not the ⚙︎ text glyph — that renders tiny and differently everywhere. */
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function App() {
  useEffect(() => { boot(); }, []);

  // Hash routing — the back button works, with no router library
  useEffect(() => {
    const read = () => {
      const h = location.hash.replace('#', '');
      if (h && SCREEN[h] && h !== ui.value.tab) setUI({ tab: h });
    };
    read();
    addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (location.hash.replace('#', '') !== ui.value.tab) location.hash = ui.value.tab;
  }, [ui.value.tab]);

  if (!ready.value) {
    return (
      <div class="shell">
        <div class="view stack" style="padding-top:24px">
          <div class="skel" style="height:34px;width:56%" />
          <div class="skel" style="height:170px" />
          <div class="skel" style="height:64px" />
          <div class="skel" style="height:64px" />
        </div>
      </div>
    );
  }

  const Screen = SCREEN[ui.value.tab] || Trips;
  const isSettings = ui.value.tab === 'settings';

  return (
    <div class="shell">
      <header class="topbar">
        <span class="brand">TripDeck</span>
        <div class="row" style="gap:8px">
          <button class="langbtn" onClick={() => setLang(lang.value === 'bn' ? 'en' : 'bn')}
            aria-label={L('ভাষা বদলাও', 'Change language')}>
            {L('EN', 'বাং')}
          </button>
          <button class={`iconbtn ${isSettings ? 'on' : ''}`}
            aria-label={L('সেটিংস', 'Settings')}
            onClick={() => setUI({ tab: isSettings ? 'trips' : 'settings' })}>
            {user.value?.picture
              ? <img src={user.value.picture} alt="" />
              : <GearIcon />}
          </button>
        </div>
      </header>

      <div class="view">
        {!online.value && (
          <div class="banner off">
            📴 {L('ইন্টারনেট নেই — কাজ চালিয়ে যাও, পরে নিজে থেকেই সেভ হবে।',
                  'No internet — keep going, it saves itself later.')}
          </div>
        )}
        {syncState.value.state === 'error' && online.value && (
          <div class="banner err">
            ⚠️ {L('Drive-এ সেভ হয়নি। সেটিংসে গিয়ে আবার লগইন করো।',
                  'Could not save to Drive. Sign in again from Settings.')}
          </div>
        )}
        <Screen />
      </div>

      <nav class="tabs" role="tablist" aria-label={L('প্রধান মেনু', 'Main menu')}>
        {TABS.map(([id, icon, bn, en]) => (
          <button key={id} type="button" role="tab" aria-selected={ui.value.tab === id}
            onClick={() => setUI({ tab: id })}>
            <i aria-hidden="true">{icon}</i>{L(bn, en)}
          </button>
        ))}
      </nav>

      <Sheet />
      <Toast />
    </div>
  );
}
