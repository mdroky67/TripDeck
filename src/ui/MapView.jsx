import { useEffect, useRef, useState } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tx } from '../i18n.js';
import { theme } from '../store/state.js';

/**
 * Leaflet puts a line's colour in the `stroke` attribute, where `var(--teal)`
 * does not resolve. So read the token's real value — and redraw on theme change.
 */
const resolve = (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim();

function pinIcon(i, state, selected) {
  const size = selected ? 30 : 24;
  const bg = state === 'done' ? 'var(--teal)' : state === 'now' ? 'var(--coral)' : 'var(--surface)';
  const fg = state === 'next' ? 'var(--ink)' : 'var(--on-teal)';
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="width:${size}px;height:${size}px;background:${bg};color:${fg};
      ${selected ? 'outline:3px solid var(--ink);outline-offset:1px;' : ''}">${i}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  });
}

/**
 * The trip route map — Leaflet with OpenStreetMap tiles.
 * Offline, tiles come from the service worker cache; without them the
 * background is blank but the route, pins and distances still show.
 */
export default function MapView({ chain, live, selNode, onSelect, tall, fit = true }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [sysDark, setSysDark] = useState(false);

  // Keep line colours correct when the OS theme changes too
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark((v) => !v);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true, tap: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, crossOrigin: true,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.setView([23.8, 90.4], 6);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const nodes = chain?.nodes || [];
    if (!nodes.length) return;
    const COLOR = {
      done: resolve('--teal') || '#0A6B61',
      now: resolve('--coral') || '#C44A31',
      next: resolve('--ink-3') || '#7D938D',
    };

    // Leg lines — colour and dash follow the node state
    for (let i = 0; i < nodes.length - 1; i++) {
      const state = i < chain.target - 1 ? 'done' : i === chain.target - 1 ? 'now' : 'next';
      L.polyline([[nodes[i].lat, nodes[i].lng], [nodes[i + 1].lat, nodes[i + 1].lng]], {
        color: COLOR[state], weight: 5, opacity: state === 'next' ? 0.45 : 0.95,
        dashArray: state === 'done' ? null : state === 'now' ? '10 8' : '5 8',
        lineCap: 'round',
      }).addTo(g);
    }

    nodes.forEach((n, i) => {
      L.marker([n.lat, n.lng], { icon: pinIcon(i + 1, n.state, selNode === i), keyboard: true,
        title: tx(n, 'label') })
        .on('click', () => onSelect?.(i))
        .addTo(g);
    });

    if (live?.hasFix && live.pos) {
      L.marker([live.pos.lat, live.pos.lng], {
        icon: L.divIcon({ className: '', html: '<div class="pulse" style="width:18px;height:18px"></div>',
          iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 1000,
      }).addTo(g);
    }

    if (fit) {
      const b = L.latLngBounds(nodes.map((n) => [n.lat, n.lng]));
      if (b.isValid()) m.fitBounds(b, { padding: [34, 34], maxZoom: 13 });
    }
    setTimeout(() => m.invalidateSize(), 60);
  }, [chain, live?.pos?.lat, live?.pos?.lng, selNode, theme.value, sysDark]);

  // Pan smoothly to the selected node
  useEffect(() => {
    if (selNode == null || !map.current) return;
    const n = chain?.nodes?.[selNode];
    if (n) map.current.panTo([n.lat, n.lng], { animate: true });
  }, [selNode]);

  return <div ref={box} class={`leafmap ${tall ? 'tall' : ''}`} role="application" />;
}
