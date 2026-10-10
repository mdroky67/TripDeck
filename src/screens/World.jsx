import { useEffect, useMemo, useState } from 'preact/hooks';
import { doc, ui, setUI, toast, openSheet } from '../store/state.js';
import { toggleCountry, toggleDistrict } from '../store/actions.js';
import { countries as loadCountries, districts as loadDistricts } from '../geo/data.js';
import { WORLD_COUNTRIES, WORLD_LAND_KM2, BD_DISTRICTS, CONTINENTS, areaOf, continentOf, TINY_STATES } from '../geo/places.js';
import { L, N, NF, dname } from '../i18n.js';
import { Card, Seg, Meter, Legend } from '../ui/bits.jsx';
import WorldCanvas from '../ui/WorldCanvas.jsx';
import DistrictCanvas from '../ui/DistrictCanvas.jsx';
import CoverageSheet from '../ui/CoverageSheet.jsx';

export default function World() {
  const view = ui.value.worldView;
  return (
    <>
      <Seg style="margin:8px 0 12px" value={view} onChange={(v) => setUI({ worldView: v })}
        options={[
          { v: 'globe', label: '🌍 ' + L('বিশ্ব', 'World') },
          { v: 'dist', label: '🇧🇩 ' + L('জেলা', 'Districts') },
        ]} />
      {view === 'globe' ? <Globe /> : <Districts />}
    </>
  );
}

function Globe() {
  const d = doc.value;
  const [list, setList] = useState([]);
  useEffect(() => { loadCountries().then(setList); }, []);

  const visited = useMemo(() => new Set(d.visits.map((v) => v.countryCode)), [d.visits]);
  const byId = useMemo(() => {
    const m = {};
    list.forEach((c) => { m[c.id] = c; });
    TINY_STATES.forEach((t) => { m[t.id] ||= t; });
    return m;
  }, [list]);

  const stats = useMemo(() => {
    let area = 0;
    const conts = new Set();
    visited.forEach((id) => {
      area += areaOf(id);
      const c = byId[id];
      if (c) conts.add(continentOf(c.lat, c.lng));
    });
    return {
      n: visited.size,
      pct: (visited.size / WORLD_COUNTRIES) * 100,
      land: (area / WORLD_LAND_KM2) * 100,
      conts,
    };
  }, [visited, byId]);

  const rows = useMemo(() => (
    d.visits
      .map((v) => ({
        id: v.countryCode,
        name: byId[v.countryCode] ? dname(byId[v.countryCode]) : v.countryCode,
        year: Number((v.firstVisit || '').slice(0, 4)) || null,
      }))
      .sort((a, b) => (a.year || 0) - (b.year || 0))
  ), [d.visits, byId]);

  const toggle = (id) => {
    toggleCountry(id);
    const c = byId[id];
    toast((c ? dname(c) : id) + (visited.has(id) ? L(' বাদ গেলো', ' removed') : L(' যোগ হলো', ' added')));
  };

  return (
    <div class="stack">
      <Card>
        <div class="row" style="gap:12px;align-items:baseline">
          <span class="num" style="font-size:38px;color:var(--teal);font-family:var(--display)">
            {NF(stats.pct)}%
          </span>
          <span class="muted">{L('পৃথিবী ঘোরা হয়েছে', 'of the world covered')}</span>
        </div>
        <div class="row wrap-row" style="gap:7px;margin-top:8px">
          <span class="chip teal">{N(stats.n)}/{N(WORLD_COUNTRIES)} {L('দেশ', 'countries')}</span>
          <span class="chip">{N(stats.conts.size)}/{N(6)} {L('মহাদেশ', 'continents')}</span>
          <span class="chip">{NF(stats.land)}% {L('ভূখণ্ড', 'of land')}</span>
        </div>
        <div class="muted" style="margin-top:8px">
          {L('তিনটা আলাদা হিসাব — শুধু দেশের সংখ্যা বিভ্রান্তিকর (ভ্যাটিকান আর রাশিয়া সমান নয়)।',
             'Three separate numbers — counting countries alone misleads (Vatican is not Russia).')}
        </div>
      </Card>

      <button class="btn block" onClick={() => openSheet(() => <CoverageSheet kind="country" />)}>
        🔍 {L('দেশ যোগ বা বাদ দাও', 'Add or remove countries')}
      </button>
      <WorldCanvas visited={visited} onToggle={toggle} />
      <Legend items={[
        { color: 'var(--teal)', label: L('ভিজিট করা', 'Visited') },
        { color: 'var(--land)', label: L('বাকি', 'Not yet') },
        { label: L('ম্যাপে ট্যাপও করা যায়, তবে খোঁজাই সহজ',
                   'The map works too, but searching is easier') },
      ]} />

      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('মহাদেশ ধরে', 'By continent')}</div>
        {CONTINENTS.map(([k, names, total]) => {
          let v = 0;
          visited.forEach((id) => { const c = byId[id]; if (c && continentOf(c.lat, c.lng) === k) v++; });
          return <Meter key={k} label={L(names[0], names[1])} value={v} total={total} />;
        })}
      </Card>

      <Card>
        <div class="eyebrow" style="margin-bottom:8px">{L('যেসব দেশে গেছি', 'Countries visited')}</div>
        {rows.length === 0 && (
          <div class="muted">{L('এখনো কিছু মার্ক করোনি। ম্যাপে ট্যাপ করো, বা Trips-এ “আগের ট্রিপ” যোগ করো।',
                               'Nothing marked yet. Tap the map, or add a past trip from the Trips tab.')}</div>
        )}
        {rows.map((r) => (
          <div key={r.id} class="between" style="padding:6px 0">
            <span>{r.name}</span>
            <span class="chip">{r.year ? N(r.year) : '—'}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Districts() {
  const d = doc.value;
  const [list, setList] = useState([]);
  useEffect(() => { loadDistricts().then(setList); }, []);
  const visited = useMemo(() => new Set(d.districts), [d.districts]);

  const byDiv = useMemo(() => {
    const m = {};
    list.forEach((x) => { (m[x.div] ||= []).push(x); });
    return m;
  }, [list]);
  const divs = Object.keys(byDiv);
  const n = visited.size;

  return (
    <div class="stack">
      <Card>
        <div class="row" style="gap:12px;align-items:baseline">
          <span class="num" style="font-size:38px;color:var(--violet);font-family:var(--display)">
            {NF((n / BD_DISTRICTS) * 100)}%
          </span>
          <span class="muted">{L('বাংলাদেশ ঘোরা হয়েছে', 'of Bangladesh covered')}</span>
        </div>
        <div class="row wrap-row" style="gap:7px;margin-top:8px">
          <span class="chip vio">{N(n)}/{N(BD_DISTRICTS)} {L('জেলা', 'districts')}</span>
          <span class="chip">
            {N(divs.filter((k) => byDiv[k].some((x) => visited.has(x.en))).length)}/{N(divs.length)} {L('বিভাগ', 'divisions')}
          </span>
        </div>
      </Card>

      <button class="btn block" onClick={() => openSheet(() => <CoverageSheet kind="district" />)}>
        🔍 {L('জেলা যোগ বা বাদ দাও', 'Add or remove districts')}
      </button>
      <DistrictCanvas visited={visited} onToggle={(x) => {
        toggleDistrict(x.en);
        toast(dname(x) + (visited.has(x.en) ? L(' বাদ গেলো', ' removed') : L(' যোগ হলো', ' added')));
      }} />
      <Legend items={[
        { color: 'var(--violet)', label: L('ঘোরা হয়েছে', 'Visited') },
        { color: 'var(--ink-3)', label: L('বাকি', 'Not yet') },
        { label: L('ম্যাপে ট্যাপও করা যায়, তবে খোঁজাই সহজ',
                   'The map works too, but searching is easier') },
      ]} />

      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('বিভাগ ধরে', 'By division')}</div>
        {divs.map((k) => (
          <Meter key={k} label={k} color="var(--violet)"
            value={byDiv[k].filter((x) => visited.has(x.en)).length} total={byDiv[k].length} />
        ))}
      </Card>
    </div>
  );
}
