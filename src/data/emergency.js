/**
 * Verified official emergency short codes.
 *
 * ⚠️ Rule: the app never invents an embassy, agent or hotel number. Only
 * numbers published by a government belong here. Everything else is left for
 * the user to fill in (verified: false → an amber "add it" chip in the UI).
 * Check a country's official site before adding it.
 */
import { toA2 } from './iso.js';

export const EMERGENCY = {
  BD: [
    { role: 'জাতীয় জরুরি সেবা', role_en: 'National emergency', name: 'পুলিশ · ফায়ার · অ্যাম্বুলেন্স', name_en: 'Police · Fire · Ambulance', phone: '999', kind: 'emergency' },
    { role: 'নারী ও শিশু হেল্পলাইন', role_en: 'Women & children helpline', name: 'সরকারি সেবা', name_en: 'Government service', phone: '109', kind: 'emergency' },
    { role: 'স্বাস্থ্য বাতায়ন', role_en: 'Health hotline', name: 'সরকারি স্বাস্থ্যসেবা', name_en: 'Government health service', phone: '16263', kind: 'emergency' },
    { role: 'সরকারি তথ্যসেবা', role_en: 'Government info', name: 'জাতীয় তথ্য বাতায়ন', name_en: 'National info line', phone: '333', kind: 'emergency' },
  ],
  MV: [
    { role: 'মালদ্বীপ · পুলিশ', role_en: 'Maldives · Police', name: 'Maldives Police Service', name_en: 'Maldives Police Service', phone: '119', kind: 'emergency' },
    { role: 'মালদ্বীপ · অ্যাম্বুলেন্স', role_en: 'Maldives · Ambulance', name: 'Ambulance', name_en: 'Ambulance', phone: '102', kind: 'emergency' },
    { role: 'মালদ্বীপ · ফায়ার', role_en: 'Maldives · Fire', name: 'Fire & Rescue', name_en: 'Fire & Rescue', phone: '118', kind: 'emergency' },
  ],
  LK: [
    { role: 'শ্রীলঙ্কা · পুলিশ', role_en: 'Sri Lanka · Police', name: 'Sri Lanka Police', name_en: 'Sri Lanka Police', phone: '119', kind: 'emergency' },
    { role: 'শ্রীলঙ্কা · অ্যাম্বুলেন্স ও ফায়ার', role_en: 'Sri Lanka · Ambulance & Fire', name: 'Suwa Seriya', name_en: 'Suwa Seriya', phone: '110', kind: 'emergency' },
    { role: 'শ্রীলঙ্কা · ট্যুরিস্ট পুলিশ', role_en: 'Sri Lanka · Tourist Police', name: 'Tourist Police', name_en: 'Tourist Police', phone: '1912', kind: 'emergency' },
  ],
  IN: [
    { role: 'ভারত · জরুরি সেবা', role_en: 'India · Emergency', name: 'সমন্বিত হেল্পলাইন', name_en: 'Unified helpline', phone: '112', kind: 'emergency' },
  ],
  NP: [
    { role: 'নেপাল · পুলিশ', role_en: 'Nepal · Police', name: 'Nepal Police', name_en: 'Nepal Police', phone: '100', kind: 'emergency' },
  ],
  TH: [
    { role: 'থাইল্যান্ড · ট্যুরিস্ট পুলিশ', role_en: 'Thailand · Tourist Police', name: 'Tourist Police', name_en: 'Tourist Police', phone: '1155', kind: 'emergency' },
    { role: 'থাইল্যান্ড · জরুরি সেবা', role_en: 'Thailand · Emergency', name: 'Emergency', name_en: 'Emergency', phone: '191', kind: 'emergency' },
  ],
  MY: [{ role: 'মালয়েশিয়া · জরুরি সেবা', role_en: 'Malaysia · Emergency', name: 'Emergency', name_en: 'Emergency', phone: '999', kind: 'emergency' }],
  AE: [{ role: 'আমিরাত · পুলিশ', role_en: 'UAE · Police', name: 'Police', name_en: 'Police', phone: '999', kind: 'emergency' }],
  SA: [{ role: 'সৌদি আরব · জরুরি সেবা', role_en: 'Saudi Arabia · Emergency', name: 'Unified emergency', name_en: 'Unified emergency', phone: '911', kind: 'emergency' }],
  TR: [{ role: 'তুরস্ক · জরুরি সেবা', role_en: 'Türkiye · Emergency', name: 'Emergency', name_en: 'Emergency', phone: '112', kind: 'emergency' }],
  EG: [{ role: 'মিশর · ট্যুরিস্ট পুলিশ', role_en: 'Egypt · Tourist Police', name: 'Tourist Police', name_en: 'Tourist Police', phone: '126', kind: 'emergency' }],
  SG: [{ role: 'সিঙ্গাপুর · পুলিশ', role_en: 'Singapore · Police', name: 'Police', name_en: 'Police', phone: '999', kind: 'emergency' }],
  EU: [{ role: 'ইউরোপ · জরুরি সেবা', role_en: 'Europe · Emergency', name: '112 সব EU দেশে', name_en: '112 across the EU', phone: '112', kind: 'emergency' }],
};

/** Left for the user to fill in — empty slots, never invented numbers */
export const BLANK_CONTACTS = [
  { role: 'ট্রাভেল এজেন্ট', role_en: 'Travel agent', name: 'এজেন্সির নাম লেখো', name_en: 'Write the agency name', kind: 'agent' },
  { role: 'ড্রাইভার', role_en: 'Driver', name: 'ড্রাইভারের নাম', name_en: "Driver's name", kind: 'driver' },
  { role: 'হোটেল', role_en: 'Hotel', name: 'হোটেলের নাম', name_en: 'Hotel name', kind: 'hotel' },
];

export const BLANK_INTL = [
  { role: 'দূতাবাস / হাইকমিশন', role_en: 'Embassy / High Commission', name: 'ট্রিপের আগে নম্বর যাচাই করে বসাও', name_en: 'Verify and enter the number before the trip', kind: 'embassy' },
  { role: 'ট্রাভেল ইনস্যুরেন্স', role_en: 'Travel insurance', name: 'পলিসি নম্বর এখানে', name_en: 'Policy number goes here', kind: 'insurance' },
];

/**
 * Country code (numeric or alpha-2) → that country's verified numbers.
 * Nothing in the table means an empty list; the app never guesses.
 */
export const emergencyFor = (codes = []) => {
  const out = [];
  const seen = new Set();
  for (const raw of codes) {
    const c = toA2(raw);
    for (const e of EMERGENCY[c] || []) {
      const k = c + e.phone;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
};

export const KIND_META = {
  emergency: ['🚨', 'var(--coral-100)'],
  police:    ['👮', 'var(--coral-100)'],
  ambulance: ['🚑', 'var(--coral-100)'],
  driver:    ['🚗', 'var(--teal-100)'],
  agent:     ['🧑‍💼', 'var(--violet-100)'],
  hotel:     ['🏨', 'var(--amber-100)'],
  embassy:   ['🏛️', 'var(--violet-100)'],
  insurance: ['📄', 'var(--surface-2)'],
  family:    ['👨‍👩‍👧', 'var(--surface-2)'],
  other:     ['📞', 'var(--surface-2)'],
};
