import { useEffect, useState } from 'preact/hooks';
import { doc, ui, setUI, setTrip, openSheet, closeSheet, toast, syncState, online } from '../store/state.js';
import { addTrip, addPastTrip, loadDemo, setTripStatus, deleteTrip, updateTrip } from '../store/actions.js';
import { chainOf } from '../geo/chain.js';
import { tripKm } from '../geo/distance.js';
import { districts as loadDistricts, countries as loadCountries } from '../geo/data.js';
import { L, N, NF, tx, dname, fmtDate } from '../i18n.js';
import { localDate } from '../store/schema.js';
import { Card, Empty, Bar } from '../ui/bits.jsx';
import Picker from '../ui/Picker.jsx';
import { pickAndImport } from '../ui/importFile.jsx';

const progress = (t) => {
  const req = (t.days || []).flatMap((d) => (d.activities || []).filter((a) => !a.optional));
  return { done: req.filter((a) => a.done).length, total: req.length,
           pct: req.length ? req.filter((a) => a.done).length / req.length : 0 };
};

const ScopeChip = ({ t }) => t.scope === 'local'
  ? <span class="chip vio">🇧🇩 {L('লোকাল', 'Local')}</span>
  : <span class="chip">🌏 {L('বিদেশ', 'Abroad')}</span>;

function SyncChip() {
  const s = syncState.value;
  if (!online.value) return <span class="chip amber">{L('অফলাইন — পরে সেভ হবে', 'Offline — will save later')}</span>;
  if (s.state === 'saving') return <span class="chip">{L('সেভ হচ্ছে…', 'Saving…')}</span>;
  if (s.state === 'error') return <span class="chip danger">{L('সেভ হয়নি', 'Not saved')}</span>;
  if (s.state === 'saved') return <span class="chip ok">✓ {L('সেভ হয়েছে', 'Saved')}</span>;
  return <span class="chip">{L('শুধু এই ফোনে', 'On this phone only')}</span>;
}

export default function Trips() {
  const d = doc.value;
  const trips = d.trips;
  const active = trips.find((t) => t.id === ui.value.tripId) || trips.find((t) => t.status === 'active') || trips[0];

  return (
    <div class="stack">
      <div class="between" style="margin:8px 2px 0">
        <div>
          <div class="label">{fmtDate(localDate(), true)}</div>
          <div style="font-family:var(--display);font-weight:700;font-size:21px">
            {d.profile.name
              ? L(`হ্যালো, ${d.profile.name.split(' ')[0]}`, `Hello, ${d.profile.name.split(' ')[0]}`)
              : L('হ্যালো', 'Hello')}
          </div>
        </div>
        <SyncChip />
      </div>

      {!trips.length ? (
        <Empty emoji="🧳"
          title={L('এখনো কোনো ট্রিপ নেই', 'No trips yet')}
          body={L('খালি ট্রিপ বানাও, নয়তো ডেমো দিয়ে শুরু করো।', 'Create an empty trip, or start from the demo.')}>
          <div class="row" style="gap:8px;justify-content:center;flex-wrap:wrap">
            <button class="btn" onClick={() => openSheet(() => <NewTripSheet />)}>
              + {L('নতুন ট্রিপ', 'New trip')}
            </button>
            <button class="btn ghost" onClick={() => loadDemo().catch(() => toast(L('ডেমো আনা যায়নি', 'Could not load demo')))}>
              {L('ডেমো ঢোকাও', 'Load demo')}
            </button>
            <button class="btn ghost" onClick={pickAndImport}>
              ⬆ {L('ফাইল থেকে আনো', 'Import a file')}
            </button>
          </div>
        </Empty>
      ) : (
        <ActiveHero trip={active} />
      )}

      {trips.length > 0 && (
        <>
          <div class="eyebrow" style="margin:6px 2px 0">{L('সব ট্রিপ', 'All trips')}</div>
          {trips.map((t) => {
            const p = progress(t);
            return (
              <button key={t.id} class="tripmini" aria-current={t.id === active?.id}
                onClick={() => setTrip(t.id)}>
                <span class="em">{t.coverEmoji}</span>
                <span class="mid">
                  <b>{tx(t, 'title')}</b>
                  <span class="muted">{tx(t, 'subtitle')} · {NF(tripKm(t), 0)} km · {NF(p.pct * 100, 0)}%</span>
                </span>
                <ScopeChip t={t} />
              </button>
            );
          })}
        </>
      )}

      {d.past.length > 0 && (
        <>
          <div class="eyebrow" style="margin:6px 2px 0">{L('আগের ট্রিপ', 'Past trips')}</div>
          {d.past.map((p) => (
            <div key={p.id} class="tripmini" style="cursor:default">
              <span class="em">{p.emoji}</span>
              <span class="mid"><b>{tx(p, 'title')}</b><span class="muted">{tx(p, 'date')}</span></span>
              <span class={`chip ${p.scope === 'local' ? 'vio' : 'teal'}`}>{p.flag}</span>
            </div>
          ))}
        </>
      )}

      <div class="row" style="gap:8px;margin-top:6px">
        <button class="btn" style="flex:1" onClick={() => openSheet(() => <NewTripSheet />)}>
          + {L('নতুন ট্রিপ', 'New trip')}
        </button>
        <button class="btn ghost" style="flex:1" onClick={() => openSheet(() => <PastTripSheet />)}>
          + {L('আগের ট্রিপ', 'Past trip')}
        </button>
      </div>

      {trips.length > 0 && (
        <button class="btn ghost sm" onClick={() => openSheet(() => <TripMenu tripId={active.id} />)}>
          ⚙︎ {L('এই ট্রিপের সেটিংস', 'Trip settings')}
        </button>
      )}
    </div>
  );
}

function ActiveHero({ trip }) {
  if (!trip) return null;
  const p = progress(trip);
  const c = chainOf(trip);
  const next = c.nodes[c.target];
  return (
    <button class="hero" onClick={() => { setTrip(trip.id); setUI({ tab: 'plan' }); }}>
      <span class="glow" />
      <span class="row" style="justify-content:space-between">
        <ScopeChip t={trip} />
        <span class="chip pill">
          {trip.status === 'active' ? L('চলছে', 'Active')
            : trip.status === 'completed' ? L('শেষ', 'Done') : L('পরিকল্পনা', 'Planned')}
        </span>
      </span>
      <span class="big" style="display:block">{tx(trip, 'title')}</span>
      <span class="sub" style="display:block">{tx(trip, 'subtitle')}</span>
      <span style="display:block;margin:14px 0 6px"><Bar value={p.pct} /></span>
      <span class="between sub">
        <span>{N(p.done)}/{N(p.total)} {L('কাজ শেষ', 'done')}</span>
        <span>{NF(p.pct * 100, 0)}%</span>
      </span>
      {next && (
        <span class="inset" style="display:block">
          <b>{L('পরের গন্তব্য', 'Next stop')}</b> · {tx(next, 'label')}<br />
          📏 {L('মোট', 'Total')} {NF(tripKm(trip), 0)} km · {N(trip.days.length)} {L('দিন', 'days')}
        </span>
      )}
    </button>
  );
}

/* ---------------- sheets ---------------- */

function NewTripSheet() {
  const [scope, setScope] = useState('local');
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(2);
  const [date, setDate] = useState(localDate());
  const [list, setList] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let alive = true;
    (scope === 'local' ? loadDistricts() : loadCountries()).then((raw) => {
      if (!alive) return;
      const l = [...raw].sort((a, b) => dname(a).localeCompare(dname(b), 'bn'));
      setList(l);
      const key = (x) => (scope === 'local' ? x.en : x.id);
      const def = scope === 'local'
        ? [l.find((x) => x.en === 'Dhaka'), l.find((x) => x.en === 'Rajshahi')]
        : [l.find((x) => x.en === 'Bangladesh'), l.find((x) => x.en === 'Thailand')];
      setFrom(key(def[0] || l[0]));
      setTo(key(def[1] || l[1] || l[0]));
    });
    return () => { alive = false; };
  }, [scope]);

  const key = (x) => (scope === 'local' ? x.en : x.id);
  const find = (k) => list.find((x) => key(x) === k);

  const save = () => {
    const a = find(from), z = find(to);
    if (!a || !z) { toast(L('জায়গা বাছো', 'Pick both places')); return; }
    addTrip({
      title: title.trim(), scope, from: a, to: z, startDate: date,
      days: Math.max(1, Math.min(60, Number(days) || 1)),
      countryCodes: scope === 'local' ? ['BD'] : [...new Set([z.id])],
    });
    closeSheet();
    toast(L('ট্রিপ তৈরি — এখন দিন ও কাজ যোগ করো', 'Trip created — now add days and activities'));
  };

  return (
    <>
      <h3>{L('নতুন ট্রিপ', 'New trip')}</h3>
      <label class="fld">
        <span>{L('ট্রিপের নাম', 'Trip name')}</span>
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)}
          placeholder={scope === 'local'
            ? L('যেমন: ঢাকা → রাজশাহী', 'e.g. Dhaka → Rajshahi')
            : L('যেমন: থাইল্যান্ড ট্রিপ', 'e.g. Thailand trip')} />
      </label>
      <label class="fld">
        <span>{L('ধরন', 'Trip type')}</span>
        <select value={scope} onChange={(e) => setScope(e.currentTarget.value)}>
          <option value="local">{L('লোকাল — বাংলাদেশের ভেতরে', 'Local — inside Bangladesh')}</option>
          <option value="international">{L('বিদেশ', 'International')}</option>
        </select>
      </label>
      <label class="fld">
        <span>{scope === 'local' ? L('কোথা থেকে (জেলা)', 'From (district)') : L('কোথা থেকে (দেশ)', 'From (country)')}</span>
        <select value={from} onChange={(e) => setFrom(e.currentTarget.value)}>
          {list.map((x) => <option key={key(x)} value={key(x)}>{dname(x)}</option>)}
        </select>
      </label>
      <label class="fld">
        <span>{scope === 'local' ? L('কোথায় (জেলা)', 'To (district)') : L('কোথায় (দেশ)', 'To (country)')}</span>
        <select value={to} onChange={(e) => setTo(e.currentTarget.value)}>
          {list.map((x) => <option key={key(x)} value={key(x)}>{dname(x)}</option>)}
        </select>
      </label>
      <label class="fld">
        <span>{L('শুরুর তারিখ', 'Start date')}</span>
        <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
      </label>
      <label class="fld">
        <span>{L('কয় দিন', 'How many days')}</span>
        <input type="number" min="1" max="60" value={days} onInput={(e) => setDays(e.currentTarget.value)} />
      </label>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="btn ghost" style="flex:1" onClick={closeSheet}>{L('বাতিল', 'Cancel')}</button>
        <button class="btn" style="flex:1" onClick={save}>{L('বানাও', 'Create')}</button>
      </div>
    </>
  );
}

function PastTripSheet() {
  const d = doc.value;
  const [scope, setScope] = useState('local');
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [picked, setPicked] = useState(new Set());
  const [list, setList] = useState([]);

  useEffect(() => {
    setPicked(new Set());
    (scope === 'local' ? loadDistricts() : loadCountries()).then(setList);
  }, [scope]);

  const had = (x) => scope === 'local'
    ? d.districts.includes(x.en)
    : d.visits.some((v) => v.countryCode === x.id);
  const items = list.map((x) => ({
    key: scope === 'local' ? x.en : x.id, name: dname(x), had: had(x), raw: x,
  }));

  const toggle = (k) => {
    const s = new Set(picked);
    s.has(k) ? s.delete(k) : s.add(k);
    setPicked(s);
  };

  const save = () => {
    if (!picked.size) { toast(L('অন্তত একটা বেছে নাও', 'Pick at least one')); return; }
    const chosen = items.filter((i) => picked.has(i.key)).map((i) => i.raw);
    addPastTrip({
      scope, year: Number(year) || new Date().getFullYear(),
      keys: [...picked],
      names: { bn: chosen.map((c) => c.bn).join(', '), en: chosen.map((c) => c.en).join(', ') },
    });
    closeSheet();
    toast(L(`${N(picked.size)}টা যোগ হলো — World ট্যাবে দেখো`, `${picked.size} added — see the World tab`));
  };

  return (
    <>
      <h3>{L('আগের ট্রিপ যোগ করো', 'Add a past trip')}</h3>
      <p class="muted" style="margin:-4px 0 12px">
        {L('যেখানে আগে গেছো বেছে নাও — বিশ্ব ও জেলার হিসাব সাথে সাথে বাড়বে।',
           'Pick where you have already been — world and district coverage update at once.')}
      </p>
      <div class="seg" style="margin-bottom:12px">
        <button type="button" aria-pressed={scope === 'local'} onClick={() => setScope('local')}>
          🇧🇩 {L('জেলা', 'Districts')}
        </button>
        <button type="button" aria-pressed={scope === 'international'} onClick={() => setScope('international')}>
          🌏 {L('দেশ', 'Countries')}
        </button>
      </div>
      <label class="fld">
        <span>{L('কোন বছর', 'Which year')}</span>
        <input type="number" min="1950" max="2100" value={year} onInput={(e) => setYear(e.currentTarget.value)} />
      </label>
      <Picker items={items} picked={picked} onToggle={toggle} />
      <div class="row" style="gap:8px;margin-top:14px">
        <button class="btn ghost" style="flex:1" onClick={closeSheet}>{L('বাতিল', 'Cancel')}</button>
        <button class="btn" style="flex:1" onClick={save}>{L('যোগ করো', 'Add')}</button>
      </div>
    </>
  );
}

function TripMenu({ tripId }) {
  // Read from the document every render. A sheet is opened with a closure, so
  // holding the trip object it was opened with means the status buttons never
  // update — they only looked right after a save and a reopen.
  const trip = doc.value.trips.find((t) => t.id === tripId);
  const [confirm, setConfirm] = useState(false);
  const [budget, setBudget] = useState(trip?.budget?.planned || 0);
  const [cur, setCur] = useState(trip?.currency || 'BDT');
  if (!trip) return null;
  return (
    <>
      <h3>{tx(trip, 'title')}</h3>
      <div class="stack">
        <div class="seg">
          {[['planned', L('পরিকল্পনা', 'Planned')], ['active', L('চলছে', 'Active')], ['completed', L('শেষ', 'Done')]]
            .map(([v, lbl]) => (
              <button key={v} type="button" aria-pressed={trip.status === v}
                onClick={() => { setTripStatus(trip.id, v); toast(lbl); }}>{lbl}</button>
            ))}
        </div>
        <div class="muted">
          {L('“শেষ” করলে এই ট্রিপের দেশ ও জেলা নিজে থেকেই স্কোরবোর্ডে যোগ হবে।',
             'Marking it “Done” adds this trip’s countries and districts to the scoreboard.')}
        </div>
        <Card>
          <div class="eyebrow" style="margin-bottom:8px">💰 {L('বাজেট', 'Budget')}</div>
          <div class="row" style="gap:8px">
            <label class="fld" style="flex:1;margin:0"><span>{L('কত খরচ করার ইচ্ছা', 'What you plan to spend')}</span>
              <input type="number" inputMode="decimal" min="0" value={budget}
                onInput={(e) => setBudget(e.currentTarget.value)} /></label>
            <label class="fld" style="width:110px;margin:0"><span>{L('মুদ্রা', 'Currency')}</span>
              <select value={cur} onChange={(e) => setCur(e.currentTarget.value)}>
                {['BDT','USD','EUR','INR','THB','LKR','MVR','GBP','AED','SAR','MYR','NPR'].map((c) =>
                  <option key={c} value={c}>{c}</option>)}
              </select></label>
          </div>
          <button class="btn sm block" style="margin-top:10px" onClick={() => {
            updateTrip(trip.id, { budget: { ...trip.budget, planned: Number(budget) || 0 }, currency: cur });
            toast(L('বাজেট সেভ হয়েছে', 'Budget saved'));
          }}>{L('সেভ', 'Save')}</button>
          <div class="muted" style="margin-top:8px">
            {L('খরচ গোনা হয় তোমার লেখা দাম থেকেই — অ্যাপ কোনো দাম অনুমান করে না।',
               'Spending is only ever what you entered — the app never estimates a price.')}
          </div>
        </Card>
        {!confirm ? (
          <button class="btn ghost" onClick={() => setConfirm(true)}>
            🗑 {L('ট্রিপ মুছে ফেলো', 'Delete trip')}
          </button>
        ) : (
          <div class="card" style="background:var(--coral-100)">
            <div style="font-weight:600;margin-bottom:8px">
              {L('নিশ্চিত? এটা ফেরানো যাবে না।', 'Sure? This cannot be undone.')}
            </div>
            <div class="row" style="gap:8px">
              <button class="btn ghost" style="flex:1" onClick={() => setConfirm(false)}>{L('না', 'No')}</button>
              <button class="btn danger" style="flex:1"
                onClick={() => { deleteTrip(trip.id); closeSheet(); toast(L('মুছে ফেলা হয়েছে', 'Deleted')); }}>
                {L('হ্যাঁ, মুছো', 'Yes, delete')}
              </button>
            </div>
          </div>
        )}
        <button class="btn" onClick={closeSheet}>{L('বন্ধ করো', 'Close')}</button>
      </div>
    </>
  );
}
