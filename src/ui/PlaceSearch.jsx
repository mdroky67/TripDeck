import { useEffect, useRef, useState } from 'preact/hooks';
import { searchPlaces } from '../geo/search.js';
import { haversine } from '../geo/distance.js';
import { online } from '../store/state.js';
import { L, N, NF } from '../i18n.js';

/**
 * Type a name, get real coordinates. Debounced to one request per keystroke
 * pause, which also keeps us inside Nominatim's fair-use policy.
 */
export default function PlaceSearch({ near, onPick }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef(null);
  const ctl = useRef(null);

  useEffect(() => () => { clearTimeout(timer.current); ctl.current?.abort(); }, []);

  const run = (text) => {
    setQ(text);
    setErr('');
    clearTimeout(timer.current);
    ctl.current?.abort();
    if (text.trim().length < 2) { setRows([]); setBusy(false); return; }
    setBusy(true);
    timer.current = setTimeout(async () => {
      ctl.current = new AbortController();
      try {
        setRows(await searchPlaces(text, { near, signal: ctl.current.signal }));
      } catch (e) {
        if (e.name !== 'AbortError') setErr(L('খোঁজা যায়নি', 'Search failed'));
      } finally { setBusy(false); }
    }, 550);
  };

  return (
    <>
      <label class="fld" style="margin-bottom:6px">
        <span>{L('নাম লিখে খোঁজো — হোটেল, মন্দির, স্টেশন, যা খুশি',
                 'Search by name — a hotel, a temple, a station, anything')}</span>
        <input value={q} onInput={(e) => run(e.currentTarget.value)} spellcheck={false}
          placeholder={L('যেমন: Sigiriya Rock', 'e.g. Sigiriya Rock')} />
      </label>
      {!online.value && (
        <div class="muted" style="margin:-2px 0 10px">
          {L('ইন্টারনেট নেই — আগে খোঁজা জায়গাগুলোই পাওয়া যাবে।',
             'No internet — only places you have looked up before.')}
        </div>
      )}
      {busy && <div class="skel" style="height:44px;margin-bottom:8px" />}
      {err && <div class="muted" style="margin-bottom:8px;color:var(--danger)">{err}</div>}
      {!busy && q.trim().length >= 2 && rows.length === 0 && !err && (
        <div class="muted" style="margin-bottom:8px">
          {L('কিছু পাওয়া যায়নি — অন্য নামে চেষ্টা করো', 'Nothing found — try another spelling')}
        </div>
      )}
      {rows.length > 0 && (
        <div class="card" style="padding:4px 14px;margin-bottom:11px">
          {rows.map((r) => (
            <button key={`${r.lat},${r.lng}`} class="searchrow"
              onClick={() => onPick({ ...r, picked: 'search' })}>
              <span class="mid">
                <b>{r.name}</b>
                <span class="muted">{r.detail}</span>
              </span>
              {near && <span class="chip">{N(Math.round(haversine(near, r)))} km</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
