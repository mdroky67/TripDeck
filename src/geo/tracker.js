import { fix, doc, toast } from '../store/state.js';
import { haversine } from './distance.js';
import { saveTrack, loadTrack } from '../store/db.js';
import { L } from '../i18n.js';

let watchId = null, wakeLock = null, points = [], lastSaved = 0, armedNodeKey = null;

export const isTracking = () => watchId !== null;

/**
 * Start GPS tracking.
 * ⚠️ Browsers stop location updates when the screen sleeps, and a PWA cannot
 * work around that. A wake lock is requested; tracking still runs without one,
 * it just needs the screen awake.
 */
export async function start(tripId, { onArrive } = {}) {
  if (watchId !== null) return true;
  if (!('geolocation' in navigator)) {
    toast(L('এই ডিভাইসে GPS নেই', 'No GPS on this device'));
    return false;
  }
  points = (await loadTrack(tripId)) || [];
  const s = doc.value?.settings?.tracking || {};
  const minM = s.minDistanceM ?? 25;
  const minS = s.minIntervalSec ?? 30;

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const p = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, speed: pos.coords.speed,
        at: Date.now(),
      };
      fix.value = p;
      const prev = points[points.length - 1];
      const far = !prev || haversine(prev, p) * 1000 >= minM;
      const old = !prev || p.at - prev.at >= minS * 1000;
      if (far || old) {
        points.push(p);
        if (p.at - lastSaved > 15000) { lastSaved = p.at; saveTrack(tripId, points).catch(() => {}); }
      }
      if (onArrive) onArrive(p);
    },
    (err) => {
      toast(err.code === 1
        ? L('লোকেশনের অনুমতি দাওনি', 'Location permission denied')
        : L('GPS পাওয়া যাচ্ছে না', 'No GPS signal'));
      stop(tripId);
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
  );
  if (s.keepAwake) requestWakeLock();
  return true;
}

export async function stop(tripId) {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  releaseWakeLock();
  if (tripId) await saveTrack(tripId, points).catch(() => {});
}

export async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  return !!wakeLock;
}
export function releaseWakeLock() { try { wakeLock?.release(); } catch {} wakeLock = null; }
export const hasWakeLock = () => !!wakeLock;

addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && watchId !== null && !wakeLock) requestWakeLock();
});

/** Distance covered and top speed so far */
export function trackSummary() {
  if (points.length < 2) return { km: 0, maxSpeed: 0, n: points.length };
  let km = 0, max = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversine(points[i - 1], points[i]);
    if (points[i].speed) max = Math.max(max, points[i].speed * 3.6);
  }
  return { km, maxSpeed: max, n: points.length };
}

/* ---------- geofence + notification ---------- */
export async function askNotify() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 420);
  } catch {}
}

/** Don't fire the same arrival alarm twice for one stop */
export function checkArrival(pos, node, radiusM) {
  if (!pos || !node) return false;
  const key = `${node.label}@${node.day}`;
  const within = haversine(pos, node) * 1000 <= radiusM;
  if (!within) { if (armedNodeKey === key) armedNodeKey = null; return false; }
  if (armedNodeKey === key) return false;
  armedNodeKey = key;
  return true;
}

export function fireArrival(label, settings = {}) {
  const title = L(`${label} পৌঁছে গেছো! 🎉`, `You reached ${label}! 🎉`);
  const body = L('এই জায়গার কাজগুলো টিক দিয়ে দাও।', 'Tick off the activities for this stop.');
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: 'tripdeck-arrival', badge: '/icons/icon-192.png', icon: '/icons/icon-192.png' });
    }
  } catch {}
  if (settings.sound !== false) beep();
  if (settings.vibrate !== false && navigator.vibrate) navigator.vibrate([120, 60, 120]);
}
