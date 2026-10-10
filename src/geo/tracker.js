import { fix, doc, toast } from '../store/state.js';
import { haversine } from './distance.js';
import { saveTrack, loadTrack } from '../store/db.js';
import { L } from '../i18n.js';

let watchId = null, bgWatcher = null, wakeLock = null;
let points = [], lastSaved = 0, armedNodeKey = null;

export const isTracking = () => watchId !== null || bgWatcher !== null;
export const isBackground = () => bgWatcher !== null;

const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

/**
 * Android keeps location alive for an app in the background only while a
 * foreground service is running, and a foreground service must show a
 * notification. That notification is not noise — it is the permission, and it
 * is also how you see where you are headed without opening the app.
 */
async function startNative(tripId, { onArrive, label, minM } = {}) {
  const { registerPlugin } = await import('@capacitor/core');
  const BG = registerPlugin('BackgroundGeolocation');
  bgWatcher = await BG.addWatcher(
    {
      backgroundTitle: label
        ? L(`TripDeck · ${label}-এর পথে`, `TripDeck · heading to ${label}`)
        : L('TripDeck · যাত্রা চলছে', 'TripDeck · trip in progress'),
      backgroundMessage: L('দূরত্ব হিসাব করছে। থামাতে ট্যাপ করো।',
                           'Measuring the distance. Tap to stop.'),
      requestPermissions: true,
      stale: false,
      distanceFilter: minM,
    },
    (location, error) => {
      if (error || !location) {
        if (error?.code === 'NOT_AUTHORIZED') {
          toast(L('লোকেশনের অনুমতি দাওনি', 'Location permission denied'));
          stop(tripId);
        }
        return;
      }
      record({
        lat: location.latitude, lng: location.longitude,
        accuracy: location.accuracy, speed: location.speed,
        at: location.time || Date.now(),
      }, tripId, onArrive);
    },
  );
  return true;
}

/** One place where a fix is thinned, stored and handed on */
function record(p, tripId, onArrive) {
  fix.value = p;
  const s = doc.value?.settings?.tracking || {};
  const prev = points[points.length - 1];
  const far = !prev || haversine(prev, p) * 1000 >= (s.minDistanceM ?? 25);
  const old = !prev || p.at - prev.at >= (s.minIntervalSec ?? 30) * 1000;
  if (far || old) {
    points.push(p);
    if (p.at - lastSaved > 15000) { lastSaved = p.at; saveTrack(tripId, points).catch(() => {}); }
  }
  if (onArrive) onArrive(p);
}

/**
 * Start GPS tracking.
 * ⚠️ Browsers stop location updates when the screen sleeps, and a PWA cannot
 * work around that. A wake lock is requested; tracking still runs without one,
 * it just needs the screen awake.
 */
export async function start(tripId, { onArrive, label } = {}) {
  if (isTracking()) return true;
  points = (await loadTrack(tripId)) || [];
  const s = doc.value?.settings?.tracking || {};
  const minM = s.minDistanceM ?? 25;

  if (isNative()) {
    try {
      return await startNative(tripId, { onArrive, label, minM });
    } catch (e) {
      // Fall through to the browser API rather than leaving tracking dead
      bgWatcher = null;
    }
  }

  if (!('geolocation' in navigator)) {
    toast(L('এই ডিভাইসে GPS নেই', 'No GPS on this device'));
    return false;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => record({
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy, speed: pos.coords.speed, at: Date.now(),
    }, tripId, onArrive),
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
  if (bgWatcher !== null) {
    try {
      const { registerPlugin } = await import('@capacitor/core');
      await registerPlugin('BackgroundGeolocation').removeWatcher({ id: bgWatcher });
    } catch {}
    bgWatcher = null;
  }
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
