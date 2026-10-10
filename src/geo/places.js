import { districts, countries, worldGrid } from './data.js';
import { toNum, toA2 } from '../data/iso.js';
import { haversine } from './distance.js';

export const WORLD_COUNTRIES = 195;          // 193 UN members + Vatican + Palestine
export const WORLD_LAND_KM2 = 148940000;
export const BD_DISTRICTS = 64;

/** Nearest district, or null beyond 50 km so nothing is marked by accident. */
export async function nearestDistrict(lat, lng, maxKm = 50) {
  const list = await districts();
  let best = null, bd = Infinity;
  for (const d of list) {
    const km = haversine({ lat, lng }, d);
    if (km < bd) { bd = km; best = d; }
  }
  return bd <= maxKm ? best : null;
}

/**
 * Which country a point falls in, from the dot grid. Cells are about 1.5°, so
 * it can be wrong near a border — the trip's own `countries` list is
 * authoritative and this is only a hint.
 */
export async function countryAt(lat, lng) {
  const g = await worldGrid();
  const j = Math.floor(((g.lat0 - lat) / (g.lat0 - g.lat1)) * g.h);
  const i = Math.floor(((lng + 180) / 360) * g.w);
  const ch = (g.cells[j] || '')[i];
  if (!ch || ch === ' ') return null;
  const idx = g.charset.indexOf(ch);
  return idx >= 0 ? g.ids[idx][0] : null;
}

/** Micro-states missing from the 110m data: counted fully, drawn as dots */
export const TINY_STATES = [
  { id: '462', en: 'Maldives', bn: 'মালদ্বীপ', lat: 3.202, lng: 73.221, area: 300 },
  { id: '702', en: 'Singapore', bn: 'সিঙ্গাপুর', lat: 1.352, lng: 103.82, area: 719 },
  { id: '048', en: 'Bahrain', bn: 'বাহরাইন', lat: 26.067, lng: 50.557, area: 786 },
  { id: '470', en: 'Malta', bn: 'মাল্টা', lat: 35.9, lng: 14.44, area: 316 },
];

/** Approximate area in km², for the share-of-land figure */
export const AREA = {
  '050':147570,'356':3287263,'524':147181,'064':38394,'764':513120,'458':330803,'784':83600,
  '682':2149690,'792':783562,'818':1001450,'144':65610,'462':300,'586':881913,'104':676578,
  '156':9596961,'392':377930,'410':100210,'360':1904569,'704':331212,'116':181035,'608':300000,
  '702':719,'634':11586,'512':309500,'414':17818,'048':786,'400':89342,'422':10452,'376':20770,
  '364':1648195,'368':438317,'504':446550,'788':163610,'434':1759540,'012':2381741,'404':580367,
  '834':947303,'231':1104300,'710':1219090,'566':923768,'288':238533,'826':243610,'372':70273,
  '250':551695,'276':357022,'380':301340,'724':505992,'620':92090,'528':41850,'056':30528,
  '756':41277,'040':83871,'300':131957,'578':385207,'752':450295,'246':338424,'208':43094,
  '352':103000,'616':312696,'203':78867,'348':93028,'643':17098242,'804':603500,'840':9833517,
  '124':9984670,'484':1964375,'076':8515767,'032':2780400,'152':756102,'604':1285216,'170':1141748,
  '036':7692024,'554':268838,'242':18274,'496':1564110,'398':2724900,'860':447400,'031':86600,
  '268':69700,'051':29743,'191':56594,'688':88361,'642':238391,'470':316,
};
export const areaOf = (id) => AREA[id] || 200000;

/** Continent guessed from the centroid — rough, but far better than "everything is Asia" */
export function continentOf(lat, lng) {
  if (lng >= 130 && lat <= -10) return 'oc';
  if (lng >= -170 && lng <= -30) return lat >= 13 ? 'na' : 'sa';
  if (lat >= 35) return lng >= -30 && lng <= 60 ? 'eu' : 'as';
  if (lng >= -20 && lng <= 55) return 'af';
  return 'as';
}

export const CONTINENTS = [
  ['as', ['এশিয়া', 'Asia'], 49],
  ['af', ['আফ্রিকা', 'Africa'], 54],
  ['eu', ['ইউরোপ', 'Europe'], 44],
  ['na', ['উত্তর আমেরিকা', 'North America'], 23],
  ['sa', ['দক্ষিণ আমেরিকা', 'South America'], 12],
  ['oc', ['ওশেনিয়া', 'Oceania'], 14],
];

export async function countryById(id) {
  const n = toNum(id);
  const list = await countries();
  return list.find((c) => c.id === n) || TINY_STATES.find((t) => t.id === n) || null;
}

export { toNum, toA2 };
