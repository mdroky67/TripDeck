import { signal } from '@preact/signals';

/** 'bn' or 'en'. The whole app watches this one signal. */
export const lang = signal('bn');

/** UI text: L(bengali, english) */
export const L = (bn, en) => (lang.value === 'bn' ? bn : en);

/** Numbers: Bengali digits in Bengali, Latin in English */
export const N = (n) =>
  lang.value === 'bn' ? String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : String(n);

/** Number with decimals */
export const NF = (v, d = 1) => N(Number(v || 0).toFixed(d));

/**
 * Text that comes from data. In English, prefer `${key}_en` if present.
 * What the user typed is never translated — that is the rule, not a bug.
 */
export const tx = (o, k) => {
  if (!o) return '';
  if (lang.value === 'en' && o[k + '_en']) return o[k + '_en'];
  return o[k] || o[k + '_en'] || '';
};

/** District or country name — the data carries both */
export const dname = (d) => (d ? (lang.value === 'bn' ? d.bn || d.en : d.en || d.bn) : '');

const MONTHS_BN = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_BN = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function fmtDate(iso, withDay = false) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  const m = lang.value === 'bn' ? MONTHS_BN : MONTHS_EN;
  const base = lang.value === 'bn'
    ? `${N(d.getDate())} ${m[d.getMonth()]} ${N(d.getFullYear())}`
    : `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
  if (!withDay) return base;
  const w = lang.value === 'bn' ? DAYS_BN : DAYS_EN;
  return `${base}, ${w[d.getDay()]}`;
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  return lang.value === 'bn' ? N(hhmm) : hhmm;
}

/** "2h 15m", localised */
export function fmtMins(mins) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (h <= 0) return `${N(m)}${L(' মি', 'm')}`;
  return `${N(h)}${L(' ঘ ', 'h ')}${N(m)}${L(' মি', 'm')}`;
}

/** km or mi — the unit comes from the profile */
export function fmtKm(km, units = 'km', digits = 1) {
  if (units === 'mi') return `${NF(km * 0.621371, digits)} ${L('মাইল', 'mi')}`;
  return `${NF(km, digits)} km`;
}
