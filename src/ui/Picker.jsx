import { useState, useMemo } from 'preact/hooks';
import { L, N } from '../i18n.js';

/**
 * Search box plus chips, for picking among 64 districts or 177 countries.
 * items: [{ key, name, had }] where `had` means already visited.
 */
export default function Picker({ items, picked, onToggle, multi = true }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.name.toLowerCase().includes(s) || String(x.key).toLowerCase().includes(s));
  }, [q, items]);
  return (
    <>
      <div class="eyebrow" style="margin-bottom:7px">
        {L('বেছে নাও', 'Select')} ({N(picked.size)})
      </div>
      <input class="srch" value={q} onInput={(e) => setQ(e.currentTarget.value)}
        placeholder={L('খুঁজে নাও…', 'Search…')} aria-label={L('খোঁজো', 'Search')} />
      <div class="pick">
        {list.length === 0 && <span class="muted">{L('কিছু পাওয়া যায়নি', 'Nothing found')}</span>}
        {list.map((x) => (
          <button key={x.key} type="button" aria-pressed={picked.has(x.key)}
            style={x.had ? 'opacity:.5' : undefined}
            onClick={() => onToggle(x.key, multi)}>
            {x.name}{x.had ? ' ✓' : ''}
          </button>
        ))}
      </div>
    </>
  );
}
