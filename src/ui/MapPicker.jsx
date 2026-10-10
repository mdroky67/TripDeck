import { useEffect, useRef, useState } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { closeSheet, fix } from '../store/state.js';
import { theme } from '../store/state.js';
import { L as T, NF } from '../i18n.js';
import PlaceSearch from './PlaceSearch.jsx';

/**
 * Drop a pin anywhere by tapping the map.
 *
 * The country and district lists are only ever a rough starting point — a whole
 * country is a terrible "place" for an activity, since the pin lands on its
 * centroid. This is how you say "this temple, here".
 */
export default function MapPicker({ center, onPick }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [point, setPoint] = useState(null);

  useEffect(() => {
    if (!box.current || map.current) return;
    const start = center || fix.value || { lat: 23.8103, lng: 90.4125 };
    const m = L.map(box.current, { zoomControl: true, attributionControl: true });
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, crossOrigin: true, attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    // Open close enough that a finger can actually mark something. A country
    // view is useless for picking a hotel.
    m.setView([start.lat, start.lng], center ? 14 : fix.value ? 16 : 12);
    if (center && typeof center.lat === 'number' && center.name) put(L.latLng(center.lat, center.lng));

    const put = (latlng) => {
      setPoint({ lat: latlng.lat, lng: latlng.lng, picked: 'map' });
      if (marker.current) marker.current.setLatLng(latlng);
      else marker.current = L.marker(latlng, {
        icon: L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11],
          html: '<div class="pin" style="width:22px;height:22px;background:var(--coral)"></div>' }),
      }).addTo(m);
    };
    m.on('click', (e) => put(e.latlng));
    setTimeout(() => m.invalidateSize(), 80);
    return () => { m.remove(); map.current = null; };
  }, []);

  // Redraw after a theme switch so the tile filter applies cleanly
  useEffect(() => { setTimeout(() => map.current?.invalidateSize(), 60); }, [theme.value]);

  const goToMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.current?.setView([ll.lat, ll.lng], 16);
        map.current?.fire('click', { latlng: L.latLng(ll.lat, ll.lng) });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <>
      <h3>{T('ম্যাপে জায়গা বাছো', 'Pick a place on the map')}</h3>
      <p class="muted" style="margin:-6px 0 10px">
        {T('ম্যাপে যেখানে খুশি ট্যাপ করো — ঠিক ঐ বিন্দুটাই বসবে।',
           'Tap anywhere on the map — that exact point is what gets saved.')}
      </p>
      <PlaceSearch near={center || fix.value} onPick={(p) => {
        map.current?.setView([p.lat, p.lng], 16);
        map.current?.fire('click', { latlng: L.latLng(p.lat, p.lng) });
        setPoint({ ...p, picked: 'search' });
        if (marker.current) marker.current.setLatLng([p.lat, p.lng]);
      }} />
      <div class="mapwrap"><div ref={box} class="leafmap" style="height:360px" /></div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn ghost sm" style="flex:1" onClick={goToMe}>
          📍 {T('আমার কাছে নাও', 'Centre on me')}
        </button>
      </div>
      <div class="callout" style="margin-top:10px">
        {point
          ? <>
              <b>{point.name || T('বাছা বিন্দু', 'Selected point')}</b>
              <span class="muted" style="display:block;font-size:12px">
                {point.detail ? point.detail + ' · ' : ''}{NF(point.lat, 5)}, {NF(point.lng, 5)}
              </span>
            </>
          : <span class="muted">{T('ম্যাপে ট্যাপ করো, বা উপরে নাম লিখে খোঁজো', 'Tap the map, or search by name above')}</span>}
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn ghost" style="flex:1" onClick={closeSheet}>{T('বাতিল', 'Cancel')}</button>
        <button class="btn" style="flex:1" disabled={!point}
          onClick={() => { onPick(point); closeSheet(); }}>
          {T('এটাই নাও', 'Use this point')}
        </button>
      </div>
    </>
  );
}
