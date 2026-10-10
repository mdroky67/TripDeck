import { L, N } from '../i18n.js';

export const Card = ({ children, ...p }) => <div class="card" {...p}>{children}</div>;

export const Eyebrow = ({ children }) => <div class="eyebrow">{children}</div>;

export function Bar({ value, color }) {
  return (
    <span class="bar">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, background: color }} />
    </span>
  );
}

export function Seg({ value, options, onChange, style }) {
  return (
    <div class="seg" style={style}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Ring({ size = 188, stroke = 13, value = 0, color = 'var(--teal)', children }) {
  const r = size / 2 - stroke / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <div class="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--field)" stroke-width={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width={stroke}
          stroke-linecap="round" stroke-dasharray={c.toFixed(1)}
          stroke-dashoffset={(c * (1 - Math.max(0, Math.min(1, value)))).toFixed(1)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div class="inner">{children}</div>
    </div>
  );
}

export function Empty({ emoji, title, body, children }) {
  return (
    <div class="card empty">
      <div class="em">{emoji}</div>
      <div style="font-weight:600;margin:6px 0 2px">{title}</div>
      {body && <div class="muted" style="margin-bottom:12px">{body}</div>}
      {children}
    </div>
  );
}

export function Meter({ label, value, total, color }) {
  return (
    <div class="meter" style="margin-bottom:7px">
      <b>{label}</b>
      <Bar value={total ? value / total : 0} color={color} />
      <span class="v">{N(value)}/{N(total)}</span>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div class="legend">
      {items.map((i) => (
        <span key={i.label}>
          {i.color && <i class="sw" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Copy a phone number. `tel:` links cannot be trusted in a browser, so copy it. */
export async function copyText(v, toast) {
  try {
    await navigator.clipboard.writeText(v);
    toast(L('কপি হয়েছে: ', 'Copied: ') + v);
  } catch {
    toast(L('কপি হয়নি — হাতে তুলে নাও', 'Copy failed — select it by hand'));
  }
}
