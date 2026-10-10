import { useEffect } from 'preact/hooks';
import { ready, ui, setUI, online, syncState, boot } from './store/state.js';
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
        {!isSettings && (
          <div class="topbar" style="padding:0 0 6px">
            <span class="brand">TripDeck</span>
            <div class="row" style="gap:6px">
              <button class="copy" onClick={() => { lang.value = lang.value === 'bn' ? 'en' : 'bn'; }}>
                {L('English', 'বাংলা')}
              </button>
              <button class="copy" aria-label={L('সেটিংস', 'Settings')}
                onClick={() => setUI({ tab: 'settings' })}>⚙︎</button>
            </div>
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
