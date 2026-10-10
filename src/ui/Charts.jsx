import { N } from '../i18n.js';

/** Donut — hand-drawn SVG; no charting library, to keep the bundle small */
export function Donut({ slices, size = 120, stroke = 17 }) {
  const r = size / 2 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style="flex:0 0 auto" aria-hidden="true">
      {slices.map((s) => {
        const dash = (s.value / total) * c;
        const el = (
          <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
            stroke-width={stroke} stroke-dasharray={`${dash.toFixed(1)} ${c.toFixed(1)}`}
            stroke-dashoffset={(-off).toFixed(1)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
        off += dash;
        return el;
      })}
    </svg>
  );
}

/** Horizontal bars — distance per day */
export function Bars({ rows }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} class="meter" style="grid-template-columns:38px 1fr 68px;margin-bottom:6px">
          <b>{r.label}</b>
          <div class="bar" style="height:9px">
            <span style={{ width: `${(r.value / max) * 100}%`, background: r.color || 'var(--teal)' }} />
          </div>
          <span class="v">{r.text}</span>
        </div>
      ))}
    </>
  );
}

/** Vertical columns — new countries per year */
export function Columns({ cols, height = 76 }) {
  const max = Math.max(...cols.map((c) => c.value), 1);
  return (
    <div class="row" style={{ alignItems: 'flex-end', gap: '7px', height: height + 36 + 'px' }}>
      {cols.map((c) => (
        <div key={c.label} style="display:flex;flex-direction:column;align-items:center;gap:5px;flex:1;min-width:0">
          <span style="font-size:11px;font-weight:600;color:var(--ink-2);font-variant-numeric:tabular-nums">
            {N(c.value)}
          </span>
          <span style={{ width: '100%', maxWidth: '24px', height: `${(c.value / max) * height}px`,
            background: c.color || 'var(--teal)', borderRadius: '6px 6px 2px 2px' }} />
          <span style="font-size:10px;color:var(--ink-3);font-variant-numeric:tabular-nums">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
