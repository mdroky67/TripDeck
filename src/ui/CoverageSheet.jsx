import { useEffect, useMemo, useState } from 'preact/hooks';
import { doc, closeSheet, toast } from '../store/state.js';
import { toggleCountry, toggleDistrict } from '../store/actions.js';
import { countries as loadCountries, districts as loadDistricts } from '../geo/data.js';
import { toNum } from '../data/iso.js';
import { L, N, dname } from '../i18n.js';

/**
 * Mark where you have been by searching for it.
 *
 * Tapping a country on a world map that fits on a phone means hitting a target
 * a few pixels wide, and several of them are smaller than a fingertip. Typing
 * three letters is faster and always works, so that is the main way in; the map
 * stays as the picture, not the control.
 */
export default function CoverageSheet({ kind }) {
  const isCountry = kind === 'country';
  const d = doc.value;
  const [all, setAll] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => { (isCountry ? loadCountries() : loadDistricts()).then(setAll); }, [kind]);

  const marked = useMemo(() => new Set(
    isCountry ? d.visits.map((v) => v.countryCode) : d.districts,
  ), [d.visits, d.districts, kind]);

  const key = (x) => (isCountry ? x.id : x.en);
  const toggle = (x) => {
    if (isCountry) toggleCountry(key(x)); else toggleDistrict(key(x));
    toast(dname(x) + (marked.has(key(x)) ? L(' বাদ গেলো', ' removed') : L(' যোগ হলো', ' added')));
  };

  /** Everything a trip already names, so it is one tap rather than twenty */
  const fromTrips = useMemo(() => {
    const want = new Set();
    d.trips.forEach((t) => {
      (isCountry ? t.countries || [] : t.districts || []).forEach((c) => {
        const k = isCountry ? toNum(c) : c;
        if (isCountry && k === '050') return;        // home country isn't a visit
        if (!marked.has(k)) want.add(k);
      });
    });
    d.past.forEach((p) => {
      (isCountry ? p.countries || [] : p.districts || []).forEach((c) => {
        const k = isCountry ? toNum(c) : c;
        if (!marked.has(k)) want.add(k);
      });
    });
    return [...want];
  }, [d.trips, d.past, marked, kind]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = s
      ? all.filter((x) => dname(x).toLowerCase().includes(s)
          || x.en.toLowerCase().includes(s) || String(key(x)).toLowerCase() === s)
      : all;
    // Marked ones first when nothing is typed, so the list reads as a record
    return s ? hit.slice(0, 60)
      : [...hit].sort((a, b) => (marked.has(key(b)) ? 1 : 0) - (marked.has(key(a)) ? 1 : 0)
          || dname(a).localeCompare(dname(b), 'bn')).slice(0, 80);
  }, [all, q, marked]);

  return (
    <>
      <h3>{isCountry ? L('দেশ যোগ বা বাদ দাও', 'Add or remove countries')
                     : L('জেলা যোগ বা বাদ দাও', 'Add or remove districts')}</h3>
      <p class="muted" style="margin:-6px 0 10px">
        {L('নাম লিখে খুঁজে ট্যাপ করো — যোগ হবে, আবার ট্যাপ করলে বাদ যাবে।',
           'Search, then tap to add. Tap again to remove.')}
      </p>

      {fromTrips.length > 0 && (
        <button class="btn block" style="margin-bottom:12px" onClick={() => {
          fromTrips.forEach((k) => (isCountry ? toggleCountry(k) : toggleDistrict(k)));
          toast(L(`${N(fromTrips.length)}টা যোগ হলো`, `${fromTrips.length} added`));
        }}>
          ✨ {isCountry
            ? L(`আমার ট্রিপ থেকে ${N(fromTrips.length)}টা দেশ যোগ করো`,
                `Add ${fromTrips.length} countries from my trips`)
            : L(`আমার ট্রিপ থেকে ${N(fromTrips.length)}টা জেলা যোগ করো`,
                `Add ${fromTrips.length} districts from my trips`)}
        </button>
      )}

      <input class="srch" value={q} onInput={(e) => setQ(e.currentTarget.value)}
        placeholder={L('খুঁজে নাও…', 'Search…')} spellcheck={false} />

      <div class="card" style="padding:4px 14px;max-height:46vh;overflow-y:auto">
        {shown.length === 0 && <div class="muted" style="padding:10px 0">{L('কিছু পাওয়া যায়নি', 'Nothing found')}</div>}
        {shown.map((x) => {
          const on = marked.has(key(x));
          return (
            <button key={key(x)} class="searchrow" onClick={() => toggle(x)}>
              <span class="mid">
                <b>{dname(x)}</b>
                {!isCountry && <span class="muted">{x.div}</span>}
              </span>
              <span class={`chip ${on ? (isCountry ? 'teal' : 'vio') : ''}`}>
                {on ? '✓ ' + L('গেছি', 'been') : '+ ' + L('যোগ', 'add')}
              </span>
            </button>
          );
        })}
      </div>

      <div class="between" style="margin-top:10px">
        <span class="muted">
          {N(marked.size)} {isCountry ? L('দেশ', 'countries') : L('জেলা', 'districts')}
        </span>
        <button class="btn sm" onClick={closeSheet}>{L('হয়ে গেছে', 'Done')}</button>
      </div>
    </>
  );
}
