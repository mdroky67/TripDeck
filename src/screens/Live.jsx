import { useEffect, useState } from 'preact/hooks';
import { activeTrip, fix, doc, setUI, ui, edit } from '../store/state.js';
import { toggleActivity } from '../store/actions.js';
import { liveOf } from '../geo/chain.js';
import { etaMins } from '../geo/distance.js';
import * as tracker from '../geo/tracker.js';
import { L, N, NF, tx, fmtMins } from '../i18n.js';
import { Card, Empty, Ring } from '../ui/bits.jsx';
import MapView from '../ui/MapView.jsx';
import { TRANSPORT_ICON } from '../ui/Chain.jsx';

export default function Live() {
  const d = doc.value;
  const t = activeTrip.value;
  const [on, setOn] = useState(tracker.isTracking());
  const [awake, setAwake] = useState(tracker.hasWakeLock());
  const [arrived, setArrived] = useState(null);
  const f = fix.value;

  if (!t) {
    return (
      <Empty emoji="🧭" title={L('আগে একটা ট্রিপ বানাও', 'Create a trip first')}>
        <button class="btn" onClick={() => setUI({ tab: 'trips' })}>{L('Trips-এ যাও', 'Go to Trips')}</button>
      </Empty>
    );
  }

  const live = liveOf(t, f);
  const { chain } = live;
  const settings = d.settings;
  const mode = live.chain.nodes[Math.max(0, live.chain.target - 1)]?.legMode || 'car';
  const speed = f?.speed ? f.speed * 3.6 : null;
  const eta = etaMins(live.remaining, mode);

  useEffect(() => () => { /* leaving the screen does not stop tracking — deliberate */ }, []);

  const toggle = async () => {
    if (on) { await tracker.stop(t.id); setOn(false); setAwake(false); return; }
    await tracker.askNotify();
    const ok = await tracker.start(t.id, {
      onArrive: (pos) => {
        const target = chain.nodes[chain.target];
        if (!target || !settings.alarms.enabled) return;
        if (tracker.checkArrival(pos, target, settings.alarms.arrivalRadiusM)) {
          tracker.fireArrival(tx(target, 'label'), settings.alarms);
          setArrived(target);
        }
      },
    });
    setOn(ok);
    setAwake(tracker.hasWakeLock());
  };

  const next3 = chain.nodes.slice(chain.target, chain.target + 3);

  return (
    <div class="stack" style="margin-top:8px">
      {!live.hasFix && (
        <div class="alarm">
          📍 <span>{L('GPS বন্ধ — নিচের বাটনে চেপে যাত্রা শুরু করো, তবেই আসল দূরত্ব দেখাবে।',
                     'GPS is off — press start below to see the real distance.')}</span>
        </div>
      )}

      <Card style="text-align:center;padding-bottom:18px">
        <div class="label">
          {tx(live.from, 'label')} → {tx(live.to, 'label')}
        </div>
        <Ring value={live.frac}>
          <div class="bignum">{NF(live.remaining)}</div>
          <div class="label" style="margin-top:2px">km {L('বাকি', 'to go')}</div>
          <div class="muted" style="margin-top:6px">
            {L(`${tx(live.to, 'label')} পর্যন্ত`, `to ${tx(live.to, 'label')}`)}
          </div>
        </Ring>
        <div class="row wrap-row" style="justify-content:center;gap:8px;margin-top:12px">
          <span class="chip teal">⏱ ~{fmtMins(eta)}</span>
          {speed != null && <span class="chip">{TRANSPORT_ICON[mode]} {NF(speed, 0)} km/h</span>}
          <span class="chip">✅ {NF(live.frac * 100, 0)}%</span>
          {f?.accuracy != null && (
            <span class="chip">{L('নির্ভুলতা', 'Accuracy')} ±{NF(f.accuracy, 0)} m</span>
          )}
        </div>
      </Card>

      <div class="mapwrap">
        <MapView chain={chain} live={live} selNode={ui.value.selNode}
          onSelect={(i) => setUI({ selNode: i })} />
      </div>

      <div class="row" style="gap:8px">
        <button class="btn" style="flex:1" onClick={toggle}>
          {on ? '⏸ ' + L('থামাও', 'Pause') : '▶ ' + L('যাত্রা শুরু', 'Start trip')}
        </button>
        <button class={`btn ${awake ? '' : 'ghost'}`} style="flex:1"
          onClick={async () => {
            if (awake) { tracker.releaseWakeLock(); setAwake(false); }
            else setAwake(await tracker.requestWakeLock());
          }}>
          🔋 {L('স্ক্রিন জাগানো', 'Keep awake')}
        </button>
      </div>
      <div class="muted" style="margin-top:-4px">
        {L('ফোনের স্ক্রিন বন্ধ হলে ব্রাউজার GPS থামিয়ে দেয় — PWA-তে এটা এড়ানো যায় না। লম্বা পথে স্ক্রিন জাগিয়ে রাখো।',
           'Browsers cut GPS when the screen sleeps; a PWA cannot avoid that. On long legs, keep the screen awake.')}
      </div>

      {arrived && (
        <Card style="background:var(--teal-100)">
          <div style="font-weight:700;font-family:var(--display);color:var(--teal-700);font-size:17px">
            🎉 {tx(arrived, 'label')} {L('পৌঁছে গেছো!', '— you made it!')}
          </div>
          <div class="muted" style="margin:4px 0 10px">
            {L('এই কাজগুলো টিক দিয়ে দেবো?', 'Tick these off for you?')}
          </div>
          {arrived.acts.filter((a) => !a.done).map((a) => (
            <button key={a.id} class="chip teal" style="margin:0 6px 6px 0"
              onClick={() => { toggleActivity(t.id, arrived.dayId, a.id, true, 'geofence'); }}>
              {a.icon} {tx(a, 'title')} ✓
            </button>
          ))}
          <button class="btn ghost sm block" style="margin-top:6px" onClick={() => setArrived(null)}>
            {L('বন্ধ করো', 'Dismiss')}
          </button>
        </Card>
      )}

      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('চেইনে পরের ধাপ', 'Next on the chain')}</div>
        <div class="chain">
          {next3.map((n, i) => (
            <div key={n.label + i} class={`node ${i === 0 ? 'now' : 'next'}`}>
              <span class="rail"><span class="dot" />{i < next3.length - 1 && <span class="wire" />}</span>
              <span class="body">
                <span class="ttl">{n.icon ? n.icon + ' ' : ''}{tx(n, 'label')}</span>
                <span class="muted" style="display:block;font-size:11.5px">
                  {L('দিন', 'Day')} {N(n.day)}
                  {i === 0
                    ? ` · ${NF(live.remaining)} km ${L('বাকি', 'to go')}`
                    : n.kmNext ? ` · +${NF(n.kmNext)} km` : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div class="eyebrow" style="margin-bottom:8px">{L('অ্যালার্ম', 'Alarms')}</div>
        <label class="fld" style="margin:0">
          <span class="inline">
            <input type="checkbox" checked={d.settings.alarms.enabled}
              onChange={(e) => edit((d) => { d.settings.alarms.enabled = e.currentTarget.checked; })} />
            {L('পৌঁছালে নোটিফিকেশন ও শব্দ', 'Notify and beep on arrival')}
          </span>
        </label>
        <div class="between" style="margin-top:10px">
          <span class="muted">{L('কত দূর থেকে', 'Arrival radius')}</span>
          <span class="num">{N(d.settings.alarms.arrivalRadiusM)} m</span>
        </div>
        <input type="range" min="50" max="2000" step="50" style="width:100%"
          value={d.settings.alarms.arrivalRadiusM}
          onInput={(e) => edit((d) => { d.settings.alarms.arrivalRadiusM = Number(e.currentTarget.value); })} />
      </Card>
    </div>
  );
}
