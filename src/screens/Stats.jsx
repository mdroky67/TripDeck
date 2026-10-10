import { useMemo } from 'preact/hooks';
import { doc, activeTrip, syncState, online, user, toast, setUI } from '../store/state.js';
import { exportDoc } from '../store/actions.js';
import { tripKm, legKm } from '../geo/distance.js';
import { WORLD_COUNTRIES, BD_DISTRICTS, areaOf, WORLD_LAND_KM2 } from '../geo/places.js';
import { L, N, NF, tx, fmtDate } from '../i18n.js';
import { Card, Ring, Legend, Empty, Bar } from '../ui/bits.jsx';
import { tripMoney, money } from '../store/money.js';
import { Donut, Bars, Columns } from '../ui/Charts.jsx';

const TYPES = [
  [['দর্শনীয় স্থান', 'Sightseeing'], 'sightseeing', 'var(--teal)'],
  [['যাতায়াত', 'Transport'], 'transfer', 'var(--amber)'],
  [['কার্যকলাপ', 'Activities'], 'activity', 'var(--coral)'],
  [['খাবার', 'Meals'], 'meal', 'var(--violet)'],
];

export default function Stats() {
  const d = doc.value;
  const t = activeTrip.value;
  const nights = d.trips.reduce((s, x) => s + Math.max(0, (x.days?.length || 1) - 1), 0);
  const visitedArea = d.visits.reduce((s, v) => s + areaOf(v.countryCode), 0);

  const years = useMemo(() => {
    const m = {};
    d.visits.forEach((v) => {
      const y = Number((v.firstVisit || '').slice(0, 4));
      if (y) m[y] = (m[y] || 0) + 1;
    });
    return Object.keys(m).map(Number).sort().map((y) => ({ label: `’${N(String(y).slice(2))}`, value: m[y] }));
  }, [d.visits]);

  return (
    <div class="stack" style="margin-top:8px">
      <div class="tiles">
        <Tile n={t ? NF(tripKm(t), 0) : N(0)} l={L('এই ট্রিপের km', 'km this trip')} />
        <Tile n={N(d.visits.length)} l={`${L('দেশ', 'countries')} · ${NF((d.visits.length / WORLD_COUNTRIES) * 100)}%`} />
        <Tile n={N(d.districts.length)} l={`${L('জেলা', 'districts')} · ${NF((d.districts.length / BD_DISTRICTS) * 100, 0)}%`} />
        <Tile n={N(d.trips.length + d.past.length)} l={L('মোট ট্রিপ', 'trips in all')} />
      </div>

      {t ? <TripCharts trip={t} /> : (
        <Empty emoji="📊" title={L('চার্ট দেখতে একটা ট্রিপ লাগবে', 'Charts need a trip')}>
          <button class="btn" onClick={() => setUI({ tab: 'trips' })}>{L('Trips-এ যাও', 'Go to Trips')}</button>
        </Empty>
      )}

      {t && <MoneyCard trip={t} />}

      {years.length > 0 && (
        <Card>
          <div class="eyebrow" style="margin-bottom:10px">{L('বছরে নতুন দেশ', 'New countries per year')}</div>
          <Columns cols={years} />
        </Card>
      )}

      <Card>
        <div class="eyebrow" style="margin-bottom:8px">{L('ভূখণ্ড', 'Land covered')}</div>
        <div class="between">
          <span class="muted">{L('মোট আয়তন', 'Total area')}</span>
          <span class="num">{N(Math.round(visitedArea).toLocaleString('en-US'))} km²</span>
        </div>
        <div class="between">
          <span class="muted">{L('পৃথিবীর', 'of the world')}</span>
          <span class="num">{NF((visitedArea / WORLD_LAND_KM2) * 100, 2)}%</span>
        </div>
      </Card>

      <SyncPanel />
    </div>
  );
}

/** Planned against committed, and where the money goes. */
function MoneyCard({ trip }) {
  const m = tripMoney(trip);
  if (!m || (!m.planned && !m.committed)) {
    return (
      <Card>
        <div class="eyebrow" style="margin-bottom:8px">💰 {L('খরচ', 'Money')}</div>
        <div class="muted">
          {L('কাজ ও হোটেলে দাম লিখলে এখানে হিসাব দেখা যাবে। বাজেট বসাতে Trips → ট্রিপের সেটিংস।',
             'Put prices on activities and stays and the totals appear here. Set a budget in Trips → trip settings.')}
        </div>
      </Card>
    );
  }
  const pct = m.planned ? Math.min(1, m.committed / m.planned) : 0;
  const COLORS = { stays: 'var(--violet)', activities: 'var(--teal)' };
  const NAMES = { stays: [L('হোটেল', 'Stays')], activities: [L('কাজ', 'Activities')] };
  return (
    <Card>
      <div class="eyebrow" style="margin-bottom:10px">💰 {L('খরচ', 'Money')}</div>
      <div class="row" style="gap:12px;align-items:baseline">
        <span class="num" style="font-size:30px;font-family:var(--display)">{money(m.committed)}</span>
        <span class="muted">{m.currency}{m.planned ? ` · ${L('বাজেট', 'of')} ${money(m.planned)}` : ''}</span>
      </div>
      {m.planned > 0 && (
        <>
          <div style="margin:10px 0 6px">
            <Bar value={pct} color={m.over ? 'var(--danger)' : 'var(--teal)'} />
          </div>
          <div class="between">
            <span class="muted">
              {m.over
                ? L('বাজেট ছাড়িয়ে গেছে', 'Over budget')
                : L('এখনো বাকি', 'Still unspent')}
            </span>
            <span class="num" style={m.over ? 'color:var(--danger)' : ''}>
              {money(Math.abs(m.left), m.currency)}
            </span>
          </div>
        </>
      )}
      <div class="between" style="margin-top:8px">
        <span class="muted">{L('যা দিয়ে ফেলেছো', 'Paid so far')}</span>
        <span class="num">{money(m.spent, m.currency)}</span>
      </div>
      {m.included > 0 && (
        <div class="between">
          <span class="muted">{L('প্যাকেজে ধরা', 'Already covered')}</span>
          <span class="num">{money(m.included, m.currency)}</span>
        </div>
      )}
      {m.byKind.length > 0 && (
        <div class="row" style="gap:14px;margin-top:12px">
          <Donut slices={m.byKind.map((k) => ({ label: k.key, value: k.value, color: COLORS[k.key] }))} size={100} />
          <div style="min-width:0;display:flex;flex-direction:column;gap:6px">
            {m.byKind.map((k) => (
              <span key={k.key} style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink-2)">
                <i class="sw" style={{ background: COLORS[k.key] }} />
                {NAMES[k.key]}
                <b style="color:var(--ink);font-variant-numeric:tabular-nums">{money(k.value)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const Tile = ({ n, l }) => (
  <div class="tile"><div class="n">{n}</div><div class="l">{l}</div></div>
);

function TripCharts({ trip }) {
  const all = (trip.days || []).flatMap((d) => (d.activities || []).filter((a) => !a.optional));
  const done = all.filter((a) => a.done).length;
  const pct = all.length ? done / all.length : 0;
  const optional = (trip.days || []).flatMap((d) => d.activities || []).filter((a) => a.optional).length;

  const counts = TYPES.map(([, key]) =>
    (trip.days || []).flatMap((d) => d.activities || []).filter((a) => a.type === key).length);

  const dayPct = (d) => {
    const r = (d.activities || []).filter((a) => !a.optional);
    return r.length ? r.filter((a) => a.done).length / r.length : 0;
  };

  return (
    <>
      <Card>
        <div class="label" style="margin-bottom:8px">{tx(trip, 'title')} — {L('অগ্রগতি', 'progress')}</div>
        <div class="row" style="gap:16px">
          <Ring size={132} stroke={16} value={pct}>
            <div class="num" style="font-size:27px;font-family:var(--display)">{NF(pct * 100, 0)}%</div>
          </Ring>
          <div style="min-width:0;flex:1">
            <div class="between" style="gap:14px"><span class="muted">{L('সম্পন্ন', 'Done')}</span><span class="num">{N(done)}</span></div>
            <div class="between" style="gap:14px"><span class="muted">{L('বাকি', 'Left')}</span><span class="num">{N(all.length - done)}</span></div>
            <div class="between" style="gap:14px"><span class="muted">{L('ঐচ্ছিক', 'Optional')}</span><span class="num">{N(optional)}</span></div>
          </div>
        </div>
      </Card>

      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('দিন ধরে দূরত্ব', 'Distance per day')}</div>
        <Bars rows={(trip.days || []).map((d, i) => ({
          label: `D${N(i + 1)}`,
          value: legKm(d),
          text: `${NF(legKm(d), 0)} km`,
          color: dayPct(d) === 1 ? 'var(--teal)' : 'var(--amber)',
        }))} />
        <Legend items={[
          { color: 'var(--teal)', label: L('দিন শেষ', 'Day done') },
          { color: 'var(--amber)', label: L('বাকি', 'Pending') },
        ]} />
      </Card>

      {counts.some((c) => c > 0) && (
        <Card>
          <div class="eyebrow" style="margin-bottom:8px">{L('কাজের ধরন', 'Activity mix')}</div>
          <div class="row" style="gap:14px">
            <Donut slices={TYPES.map(([names, , color], i) => ({ label: names[0], value: counts[i], color }))} />
            <div style="min-width:0;display:flex;flex-direction:column;gap:6px">
              {TYPES.map(([names, , color], i) => (
                <span key={names[1]} style="display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink-2)">
                  <i class="sw" style={{ background: color }} />
                  {L(names[0], names[1])}
                  <b style="color:var(--ink);font-variant-numeric:tabular-nums">{N(counts[i])}</b>
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

function SyncPanel() {
  const s = syncState.value;
  const d = doc.value;
  const bytes = useMemo(() => new Blob([JSON.stringify(d)]).size, [d]);
  return (
    <Card>
      <div class="eyebrow" style="margin-bottom:8px">Google Drive sync</div>
      <div class="between">
        <span class="muted">{L('অ্যাকাউন্ট', 'Account')}</span>
        <span class="chip">{user.value?.email || L('লগইন করা নেই', 'Not signed in')}</span>
      </div>
      <div class="between" style="margin-top:4px">
        <span class="muted">{L('শেষ সেভ', 'Last save')}</span>
        <span class={`chip ${s.state === 'error' ? 'danger' : s.state === 'saved' ? 'ok' : ''}`}>
          {!online.value ? L('অফলাইন', 'Offline')
            : s.state === 'saved' ? '✓ ' + fmtDate(s.at)
            : s.state === 'saving' ? L('সেভ হচ্ছে…', 'Saving…')
            : s.state === 'error' ? L('সমস্যা', 'Error')
            : L('এখনো হয়নি', 'Not yet')}
        </span>
      </div>
      <div class="between" style="margin-top:4px">
        <span class="muted">{L('ডেটার আকার', 'Data size')}</span>
        <span class="num">{N(Math.round(bytes / 1024))} KB</span>
      </div>
      {s.error && <div class="muted" style="margin-top:6px;color:var(--danger)">{s.error}</div>}
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn ghost sm" style="flex:1" onClick={async () => {
          try { const r = await exportDoc(); toast(L(`সেভ হয়েছে: ${r.where}`, `Saved: ${r.where}`)); }
          catch { toast(L('ফাইল সেভ করা যায়নি', 'Could not save the file')); }
        }}>
          ⬇ Export
        </button>
        <button class="btn ghost sm" style="flex:1" onClick={() => setUI({ tab: 'settings' })}>
          ⚙︎ {L('সেটিংস', 'Settings')}
        </button>
      </div>
    </Card>
  );
}
