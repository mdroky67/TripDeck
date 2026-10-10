import { useEffect, useState } from 'preact/hooks';
import { doc, ui, setUI, openSheet, closeSheet, toast, activeTrip, fix } from '../store/state.js';
import {
  addDay, addActivity, updateActivity, deleteActivity, toggleActivity, moveActivity,
  updateDay, deleteDay, addContact, updateContact, deleteContact,
} from '../store/actions.js';
import { chainOf, liveOf } from '../geo/chain.js';
import { legKm, tripKm, roadDistance, haversine } from '../geo/distance.js';
import { districts as loadDistricts, countries as loadCountries } from '../geo/data.js';
import { KIND_META } from '../data/emergency.js';
import { L, N, NF, tx, dname, fmtDate, fmtTime } from '../i18n.js';
import { Card, Empty, Bar, Seg, copyText } from '../ui/bits.jsx';
import Chain, { NodeDetail, TRANSPORT_ICON } from '../ui/Chain.jsx';
import MapView from '../ui/MapView.jsx';
import MapPicker from '../ui/MapPicker.jsx';

const req = (d) => (d.activities || []).filter((a) => !a.optional);
const dayPct = (d) => { const r = req(d); return r.length ? r.filter((a) => a.done).length / r.length : 0; };
const tripPct = (t) => {
  const all = (t.days || []).flatMap(req);
  return all.length ? all.filter((a) => a.done).length / all.length : 0;
};

export default function Plan() {
  // Reading doc directly is deliberate: activeTrip returns the same object,
  // so watching only that would not re-render after a checkbox is ticked.
  const u = ui.value;
  const t = activeTrip.value;
  if (!t) {
    return (
      <Empty emoji="🗓️" title={L('আগে একটা ট্রিপ বানাও', 'Create a trip first')}
        body={L('Trips ট্যাবে গিয়ে নতুন ট্রিপ বা ডেমো ঢোকাও।', 'Go to the Trips tab and add one.')}>
        <button class="btn" onClick={() => setUI({ tab: 'trips' })}>{L('Trips-এ যাও', 'Go to Trips')}</button>
      </Empty>
    );
  }
  const chain = chainOf(t);
  const live = liveOf(t, fix.value);

  return (
    <>
      <div class="between" style="margin:6px 2px 0">
        <div style="min-width:0">
          <div class="eyebrow">
            {t.scope === 'local' ? L('লোকাল ট্রিপ', 'Local trip') : L('আন্তর্জাতিক ট্রিপ', 'International trip')}
          </div>
          <div style="font-family:var(--display);font-weight:700;font-size:18px">{tx(t, 'title')}</div>
        </div>
        <span class="chip teal">{NF(tripPct(t) * 100, 0)}%</span>
      </div>

      <Seg style="margin:8px 0 12px" value={u.planView}
        onChange={(v) => setUI({ planView: v })}
        options={[
          { v: 'list', label: L('তালিকা', 'List') },
          { v: 'chain', label: L('চেইন', 'Chain') },
          { v: 'map', label: L('ম্যাপ', 'Map') },
        ]} />

      {u.planView === 'list' && <ListView trip={t} />}
      {u.planView === 'chain' && <ChainView trip={t} chain={chain} live={live} />}
      {u.planView === 'map' && <MapTab trip={t} chain={chain} live={live} />}

      <ContactsCard trip={t} />
    </>
  );
}

/* ---------------- list ---------------- */
function ListView({ trip }) {
  const u = ui.value;
  const idx = Math.min(u.dayIdx, trip.days.length - 1);
  const day = trip.days[idx];
  const [road, setRoad] = useState(null);

  useEffect(() => {
    setRoad(null);
    if (!day?.from || !day?.to) return;
    let alive = true;
    roadDistance(day.from, day.to, day.transport).then((r) => { if (alive) setRoad(r); });
    return () => { alive = false; };
  }, [day?.id, day?.from?.lat, day?.to?.lat]);

  if (!day) {
    return (
      <Empty emoji="📅" title={L('এই ট্রিপে কোনো দিন নেই', 'This trip has no days')}>
        <button class="btn" onClick={() => addDay(trip.id)}>+ {L('দিন যোগ করো', 'Add day')}</button>
      </Empty>
    );
  }
  const stay = (trip.stays || []).find((s) => s.id === day.stayId);
  const p = dayPct(day);

  return (
    <>
      <div class="strip">
        {trip.days.map((x, i) => {
          const done = dayPct(x) === 1;
          return (
            <button key={x.id} type="button" aria-pressed={i === idx} class={done ? 'done' : ''}
              onClick={() => setUI({ dayIdx: i })}>
              <span>D{N(i + 1)}</span>
              <span style="font-size:9px;opacity:.8">{done ? '✓' : NF(dayPct(x) * 100, 0) + '%'}</span>
            </button>
          );
        })}
        <button type="button" style="border-style:dashed" onClick={() => addDay(trip.id)}
          aria-label={L('দিন যোগ করো', 'Add day')}>+</button>
      </div>

      <div class="stack">
        <button style="margin:2px 2px 0;background:none;border:0;text-align:left;padding:0;cursor:pointer"
          onClick={() => openSheet(() => <DaySheet trip={trip} day={day} />)}>
          <div class="label">{L('দিন', 'Day')} {N(String(idx + 1).padStart(2, '0'))} · {fmtDate(day.date)}</div>
          <div style="font-family:var(--display);font-weight:700;font-size:17px;line-height:1.25">
            {tx(day, 'title') || L('নাম দাও', 'Name this day')} ✎
          </div>
        </button>

        <Card>
          <div class="between" style="margin-bottom:10px">
            <span class="chip">
              {TRANSPORT_ICON[day.transport] || '🚗'} {NF(legKm(day))} km {L('কাকের উড়ান', 'direct')}
            </span>
            <span class="muted">
              {N(req(day).filter((a) => a.done).length)}/{N(req(day).length)} {L('সম্পন্ন', 'done')}
            </span>
          </div>
          {road && (
            <div class="muted" style="margin:-6px 0 8px">
              🛣 {L('সড়কপথে', 'By road')} {NF(road.km)} km · {N(road.mins)} {L('মিনিট', 'min')}
            </div>
          )}
          <Bar value={p} />
          <div style="margin-top:6px">
            {day.activities.length === 0 && (
              <div class="muted" style="padding:10px 4px">
                {L('এই দিনে এখনো কিছু নেই। নিচের বাটন দিয়ে কাজ যোগ করো।',
                   'Nothing here yet. Add an activity with the button below.')}
              </div>
            )}
            {day.activities.map((a) => (
              <div key={a.id} class={`act ${a.done ? 'on' : ''}`}>
                <input type="checkbox" checked={a.done}
                  aria-label={tx(a, 'title')}
                  onChange={(e) => toggleActivity(trip.id, day.id, a.id, e.currentTarget.checked)} />
                <span class="em" aria-hidden="true">{a.icon || '📍'}</span>
                <button class="t" onClick={() => openSheet(() => <ActivitySheet trip={trip} day={day} act={a} />)}>
                  {tx(a, 'title')}
                  {a.time && <span class="muted" style="font-size:11.5px"> · {fmtTime(a.time)}</span>}
                  {a.place && (
                    <><br /><span class="muted" style="font-size:11.5px">📍 {tx(a.place, 'label')}</span></>
                  )}
                </button>
                {a.optional
                  ? <span class="chip amber">{L('নিজ খরচ', 'Own cost')}</span>
                  : a.cost?.included ? <span class="chip teal">{L('টিকিট ✓', 'Ticket ✓')}</span> : null}
              </div>
            ))}
          </div>
          <button class="btn ghost sm block" style="margin-top:10px"
            onClick={() => openSheet(() => <ActivitySheet trip={trip} day={day} />)}>
            + {L('কাজ যোগ করো', 'Add activity')}
          </button>
        </Card>

        {stay && (
          <Card>
            <div class="row" style="gap:12px">
              <span style="font-size:22px">🏨</span>
              <div style="flex:1;min-width:0">
                <div class="eyebrow">{L('রাত্রিযাপন', 'Overnight')}</div>
                <div style="font-weight:600">{stay.name}</div>
                <div class="muted">
                  {tx(stay.place, 'label')} · {'★'.repeat(stay.stars || 3)}
                  {stay.breakfast ? ' · ' + L('নাস্তা আছে', 'breakfast included') : ''}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/* ---------------- chain ---------------- */
function ChainView({ trip, chain, live }) {
  const u = ui.value;
  return (
    <>
      <Card>
        <div class="between" style="margin-bottom:10px">
          <div class="eyebrow">{L('যাত্রার চেইন', 'Journey chain')}</div>
          {live.hasFix
            ? <span class="chip coral">{L('আর', 'Left')} {NF(live.remaining)} km</span>
            : <span class="chip">{L('পরের ধাপ', 'Next leg')} {NF(live.legKm)} km</span>}
        </div>
        <Chain chain={chain} live={live}
          selNode={u.selNode} onSelect={(i) => setUI({ selNode: i })} />
      </Card>
      <div style="margin-top:12px">
        <NodeDetail chain={chain} live={live} selNode={u.selNode}
          onClear={() => setUI({ selNode: null })}
          onShowMap={() => setUI({ planView: 'map' })} />
      </div>
    </>
  );
}

/* ---------------- map ---------------- */
function MapTab({ trip, chain, live }) {
  const u = ui.value;
  return (
    <>
      <div class="mapwrap">
        <div class="mapbadge">
          <span class="chip teal">📏 {NF(tripKm(trip), 0)} km</span>
          {live.hasFix
            ? <span class="chip coral">{L('আর', 'Left')} {NF(live.remaining)} km</span>
            : <span class="chip amber">{L('GPS বন্ধ', 'GPS off')}</span>}
        </div>
        <MapView chain={chain} live={live} selNode={u.selNode}
          onSelect={(i) => setUI({ selNode: i })} />
      </div>
      <div class="legend">
        <span><i class="sw" style="background:var(--teal)" />{L('হয়ে গেছে', 'Done')}</span>
        <span><i class="sw" style="background:var(--coral)" />{L('এখন চলছি', 'Now')}</span>
        <span><i class="sw" style="background:var(--ink-3)" />{L('বাকি', 'Ahead')}</span>
      </div>
      <NodeDetail chain={chain} live={live} selNode={u.selNode}
        onClear={() => setUI({ selNode: null })} />
    </>
  );
}

/* ---------------- contacts ---------------- */
function ContactRow({ trip, c, editable }) {
  const [ic, bg] = KIND_META[c.kind] || KIND_META.other;
  return (
    <div class="contact">
      <span class="ic" style={{ background: bg }}>{ic}</span>
      <button class="mid" style="background:none;border:0;text-align:left;padding:0;cursor:pointer"
        onClick={() => editable && openSheet(() => <ContactSheet trip={trip} c={c} />)}>
        <b>{tx(c, 'role')}</b>
        <span class="muted" style="font-size:12px">{tx(c, 'name')}</span>
      </button>
      {c.phone ? (
        <span style="text-align:right">
          <span class="ph">{c.phone}</span><br />
          <button class="copy" style="margin-top:3px" onClick={() => copyText(c.phone, toast)}>
            {L('কপি', 'Copy')}
          </button>
        </span>
      ) : (
        <span class="chip amber">{L('বসাও', 'Add it')}</span>
      )}
    </div>
  );
}

function ContactsCard({ trip }) {
  const list = trip.contacts || [];
  return (
    <Card style="margin-top:12px">
      <div class="between" style="margin-bottom:6px">
        <div class="eyebrow">🆘 {L('জরুরি নম্বর', 'Emergency numbers')}</div>
        <button class="copy" onClick={() => openSheet(() => <ContactsSheet trip={trip} />)}>
          {L('সব দেখো', 'See all')} ({N(list.length)})
        </button>
      </div>
      {list.slice(0, 3).map((c) => <ContactRow key={c.id} trip={trip} c={c} />)}
      <div class="muted" style="margin-top:8px">
        {L('এজেন্ট, ড্রাইভার, হোটেল আর দূতাবাসের নম্বর ট্রিপের ভেতরেই থাকে — নেটওয়ার্ক না থাকলেও খোলা যায়।',
           'Agent, driver, hotel and embassy numbers live inside the trip, so they open with no network.')}
      </div>
    </Card>
  );
}

function ContactsSheet({ trip }) {
  const t = doc.value.trips.find((x) => x.id === trip.id) || trip;
  return (
    <>
      <h3>🆘 {L('জরুরি নম্বর', 'Emergency numbers')}</h3>
      <p class="muted" style="margin:0 0 12px">{tx(t, 'title')} — {L('অফলাইনেও খোলা যায়।', 'opens offline too.')}</p>
      <Card style="padding:4px 14px">
        {t.contacts.map((c) => <ContactRow key={c.id} trip={t} c={c} editable />)}
      </Card>
      <div class="muted" style="margin:10px 0 12px">
        {L('✓ ছাড়া নম্বরগুলো তোমাকে বসাতে হবে। সরকারি শর্ট কোড (৯৯৯, ১১৯) যাচাই করা — অ্যাপ কোনো নম্বর বানায় না।',
           'Numbers without a ✓ are yours to fill in. The official short codes (999, 119) are verified — the app never invents a number.')}
      </div>
      <button class="btn ghost sm block"
        onClick={() => openSheet(() => <ContactSheet trip={t} />)}>
        + {L('নম্বর যোগ করো', 'Add a number')}
      </button>
      <button class="btn block" style="margin-top:8px" onClick={closeSheet}>{L('বন্ধ করো', 'Close')}</button>
    </>
  );
}

function ContactSheet({ trip, c }) {
  const [role, setRole] = useState(c ? tx(c, 'role') : '');
  const [name, setName] = useState(c ? tx(c, 'name') : '');
  const [phone, setPhone] = useState(c?.phone || '');
  const [kind, setKind] = useState(c?.kind || 'agent');
  const save = () => {
    if (c) updateContact(trip.id, c.id, { role, role_en: role, name, name_en: name, phone, kind });
    else addContact(trip.id, { role, role_en: role, name, name_en: name, phone, kind, verified: false });
    closeSheet();
    toast(L('সেভ হয়েছে', 'Saved'));
  };
  return (
    <>
      <h3>{c ? L('নম্বর বদলাও', 'Edit contact') : L('নতুন নম্বর', 'New contact')}</h3>
      <label class="fld"><span>{L('কী হিসেবে', 'Role')}</span>
        <input value={role} onInput={(e) => setRole(e.currentTarget.value)}
          placeholder={L('যেমন: হোটেলের রিসেপশন', 'e.g. Hotel reception')} /></label>
      <label class="fld"><span>{L('নাম', 'Name')}</span>
        <input value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <label class="fld"><span>{L('নম্বর', 'Phone')}</span>
        <input value={phone} inputMode="tel" onInput={(e) => setPhone(e.currentTarget.value)}
          placeholder="+880 1XXX-XXXXXX" /></label>
      <label class="fld"><span>{L('ধরন', 'Kind')}</span>
        <select value={kind} onChange={(e) => setKind(e.currentTarget.value)}>
          {Object.keys(KIND_META).map((k) => <option key={k} value={k}>{KIND_META[k][0]} {k}</option>)}
        </select></label>
      <div class="row" style="gap:8px">
        {c && !c.verified && (
          <button class="btn ghost" onClick={() => { deleteContact(trip.id, c.id); closeSheet(); }}>🗑</button>
        )}
        <button class="btn ghost" style="flex:1" onClick={closeSheet}>{L('বাতিল', 'Cancel')}</button>
        <button class="btn" style="flex:1" onClick={save}>{L('সেভ', 'Save')}</button>
      </div>
    </>
  );
}

/* ---------------- day & activity sheets ---------------- */
const EMOJI = ['📍','🍳','🍛','☕','🚗','🚂','✈️','🚤','🏨','🏛️','🌳','🏖️','🛶','🛍️','🎟️','⛰️','🌉','🐘','🕌','🎒'];

/**
 * Pick a place: either from the list, or the phone's current position.
 * "Use my location" is what makes the whole thing testable without travelling —
 * mark two points a few hundred metres apart and the chain, the map, the
 * distance and the arrival alarm all become real.
 */
function PlacePicker({ scope, value, onChange, here, onHere, center }) {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const f = fix.value;
  useEffect(() => {
    (scope === 'local' ? loadDistricts() : loadCountries()).then((raw) => {
      // With a known position, put the nearest first — that is almost always
      // what someone wants, and alphabetical order buries it.
      const sorted = f
        ? [...raw].sort((a, b) => haversine(f, a) - haversine(f, b))
        : [...raw].sort((a, b) => dname(a).localeCompare(dname(b), 'bn'));
      setList(sorted);
    });
  }, [scope, !!f]);
  const key = (x) => (scope === 'local' ? x.en : x.id);

  const useHere = () => {
    if (!navigator.geolocation) { toast(L('এই ডিভাইসে GPS নেই', 'No GPS on this device')); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        onHere({ lat, lng, accuracy });
        toast(L(`অবস্থান নেওয়া হয়েছে (±${Math.round(accuracy)} মি)`,
                `Location captured (±${Math.round(accuracy)} m)`));
      },
      (err) => {
        setBusy(false);
        toast(err.code === 1
          ? L('লোকেশনের অনুমতি দাওনি', 'Location permission denied')
          : L('অবস্থান পাওয়া গেল না', 'Could not get a location'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <>
      <div class="eyebrow" style="margin-bottom:7px">
        {L('জায়গা — চেইন ও ম্যাপে এটাই বসবে', 'Place — this is what lands on the chain and map')}
      </div>
      <div class="row" style="gap:8px;margin-bottom:8px">
        <button class="btn ghost sm" type="button" style="flex:1" disabled={busy} onClick={useHere}>
          {busy ? L('খুঁজছে…', 'Locating…') : '📍 ' + L('আমি এখানে', 'I am here')}
        </button>
        <button class="btn ghost sm" type="button" style="flex:1"
          onClick={() => openSheet(() => (
            <MapPicker center={center || f}
              onPick={(p) => onHere({ lat: p.lat, lng: p.lng, accuracy: 0, picked: true })} />
          ))}>
          🗺️ {L('ম্যাপে বাছো', 'Pick on map')}
        </button>
      </div>
      <label class="fld">
        <span>
          {scope === 'local' ? L('অথবা একটা জেলা', 'Or a district') : L('অথবা একটা দেশ', 'Or a country')}
          {f ? ' · ' + L('কাছের আগে', 'nearest first') : ''}
        </span>
        <select value={value} onChange={(e) => onChange(e.currentTarget.value, list)}>
          <option value="">— {L('জায়গা নেই', 'No place')} —</option>
          {list.map((x) => (
            <option key={key(x)} value={key(x)}>
              {dname(x)}{f ? ` · ${Math.round(haversine(f, x))} km` : ''}
            </option>
          ))}
        </select>
      </label>
      <div class="muted" style="margin:-6px 0 11px">
        {scope === 'local'
          ? L('জেলা বাছলে পিনটা জেলা সদরে বসে — নির্দিষ্ট জায়গা চাইলে ম্যাপে বাছো।',
              'A district puts the pin on its headquarters — use the map for an exact spot.')
          : L('দেশ বাছলে পিনটা দেশের মাঝখানে বসে — নির্দিষ্ট জায়গা চাইলে ম্যাপে বাছো।',
              'A country puts the pin at its centre — use the map for an exact spot.')}
      </div>
      {here && (
        <div class="muted" style="margin:-6px 0 11px">
          📍 {NF(here.lat, 4)}, {NF(here.lng, 4)}
          {here.picked ? ` · ${L('ম্যাপ থেকে', 'from the map')}` : ` · ±${N(Math.round(here.accuracy))} m`}
          {' · '}<button class="copy" type="button" onClick={() => onHere(null)}>{L('বাদ', 'Clear')}</button>
        </div>
      )}
    </>
  );
}

function ActivitySheet({ trip, day, act }) {
  const [title, setTitle] = useState(act ? tx(act, 'title') : '');
  const [time, setTime] = useState(act?.time || '');
  const [icon, setIcon] = useState(act?.icon || '📍');
  const [optional, setOptional] = useState(!!act?.optional);
  const [note, setNote] = useState(act?.note || '');
  const [placeKey, setPlaceKey] = useState('');
  const [placeList, setPlaceList] = useState([]);
  const [here, setHere] = useState(null);

  const save = () => {
    if (!title.trim()) { toast(L('কী করবে সেটা লেখো', 'Write what you will do')); return; }
    const o = placeKey ? placeList.find((x) => (trip.scope === 'local' ? x.en : x.id) === placeKey) : null;
    const label = title.trim();
    const place = here
      ? { lat: here.lat, lng: here.lng, label, label_en: label,
          countryCode: trip.scope === 'local' ? 'BD' : (trip.countries?.[0] || '050') }
      : o
        ? { lat: o.lat, lng: o.lng, label: o.bn, label_en: o.en,
            countryCode: trip.scope === 'local' ? 'BD' : o.id }
        : (act?.place || null);
    const data = { title: title.trim(), title_en: title.trim(), time, icon, optional, note, place };
    if (act) updateActivity(trip.id, day.id, act.id, data);
    else addActivity(trip.id, day.id, { ...data, type: 'activity' });
    closeSheet();
    toast(act ? L('বদলানো হয়েছে', 'Updated') : L('কাজ যোগ হয়েছে', 'Activity added'));
  };

  return (
    <>
      <h3>{act ? L('কাজ বদলাও', 'Edit activity') : L('নতুন কাজ', 'New activity')}</h3>
      <label class="fld"><span>{L('কী করবে', 'What will you do')}</span>
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)}
          placeholder={L('যেমন: ভৈরব নদীর পাড়ে হাঁটা', 'e.g. Walk along the Bhairab river')} /></label>
      <label class="fld"><span>{L('সময় (ঐচ্ছিক)', 'Time (optional)')}</span>
        <input type="time" value={time} onInput={(e) => setTime(e.currentTarget.value)} /></label>
      <div class="eyebrow" style="margin-bottom:7px">{L('আইকন', 'Icon')}</div>
      <div class="pick">
        {EMOJI.map((e) => (
          <button key={e} type="button" aria-pressed={e === icon} style="font-size:17px"
            onClick={() => setIcon(e)}>{e}</button>
        ))}
      </div>
      <div style="margin-top:12px">
        <PlacePicker scope={trip.scope} value={placeKey} here={here} onHere={setHere}
          center={act?.place || day.to || day.from || trip.origin}
          onChange={(v, list) => { setPlaceKey(v); setPlaceList(list); setHere(null); }} />
      </div>
      {act?.place && !placeKey && !here && (
        <div class="muted" style="margin:-6px 0 11px">📍 {tx(act.place, 'label')}</div>
      )}
      <label class="fld"><span>{L('নোট', 'Note')}</span>
        <textarea value={note} onInput={(e) => setNote(e.currentTarget.value)} /></label>
      <label class="fld">
        <span class="inline">
          <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.currentTarget.checked)} />
          {L('নিজ খরচ (অগ্রগতিতে ধরবে না)', 'Own cost (not counted in progress)')}
        </span>
      </label>
      <div class="row" style="gap:8px">
        {act && (
          <button class="btn ghost" onClick={() => {
            deleteActivity(trip.id, day.id, act.id); closeSheet(); toast(L('মুছে ফেলা হয়েছে', 'Deleted'));
          }}>🗑</button>
        )}
        {act && (
          <>
            <button class="btn ghost" aria-label={L('উপরে', 'Up')}
              onClick={() => { moveActivity(trip.id, day.id, act.id, -1); closeSheet(); }}>↑</button>
            <button class="btn ghost" aria-label={L('নিচে', 'Down')}
              onClick={() => { moveActivity(trip.id, day.id, act.id, 1); closeSheet(); }}>↓</button>
          </>
        )}
        <button class="btn" style="flex:1" onClick={save}>{L('সেভ', 'Save')}</button>
      </div>
    </>
  );
}

function DaySheet({ trip, day }) {
  const [title, setTitle] = useState(tx(day, 'title'));
  const [date, setDate] = useState(day.date || '');
  const [transport, setTransport] = useState(day.transport || 'car');
  const [note, setNote] = useState(day.transportNote || '');
  const [journal, setJournal] = useState(day.journal || '');
  return (
    <>
      <h3>{L('দিনের তথ্য', 'Day details')}</h3>
      <label class="fld"><span>{L('শিরোনাম', 'Title')}</span>
        <input value={title} onInput={(e) => setTitle(e.currentTarget.value)} /></label>
      <label class="fld"><span>{L('তারিখ', 'Date')}</span>
        <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} /></label>
      <label class="fld"><span>{L('বাহন', 'Transport')}</span>
        <select value={transport} onChange={(e) => setTransport(e.currentTarget.value)}>
          {Object.keys(TRANSPORT_ICON).map((k) => (
            <option key={k} value={k}>{TRANSPORT_ICON[k]} {k}</option>
          ))}
        </select></label>
      <label class="fld"><span>{L('বাহনের নোট', 'Transport note')}</span>
        <input value={note} onInput={(e) => setNote(e.currentTarget.value)} /></label>
      <label class="fld"><span>{L('দিনের ডায়েরি', 'Journal')}</span>
        <textarea value={journal} onInput={(e) => setJournal(e.currentTarget.value)} /></label>
      <div class="row" style="gap:8px">
        {trip.days.length > 1 && (
          <button class="btn ghost" onClick={() => {
            deleteDay(trip.id, day.id); closeSheet(); toast(L('দিন মুছে ফেলা হয়েছে', 'Day deleted'));
          }}>🗑</button>
        )}
        <button class="btn" style="flex:1" onClick={() => {
          updateDay(trip.id, day.id, {
            title, title_en: title, date, transport, transportNote: note, journal,
          });
          closeSheet(); toast(L('সেভ হয়েছে', 'Saved'));
        }}>{L('সেভ', 'Save')}</button>
      </div>
    </>
  );
}
