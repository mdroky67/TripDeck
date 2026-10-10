import { useEffect, useRef, useState } from 'preact/hooks';
import { districts, outlines } from '../geo/data.js';
import { dname } from '../i18n.js';

const BBOX = [88.0, 20.5, 92.7, 26.7];

function project(bbox, w, h) {
  const dx = bbox[2] - bbox[0], dy = bbox[3] - bbox[1];
  const s = Math.min(w / dx, h / dy) * 0.9;
  const ox = (w - dx * s) / 2, oy = (h - dy * s) / 2;
  return (p) => [ox + (p.lng - bbox[0]) * s, oy + (bbox[3] - p.lat) * s];
}

/** Bangladesh outline plus 64 district dots — the scoreboard for domestic trips. */
export default function DistrictCanvas({ visited, onToggle }) {
  const ref = useRef(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([districts(), outlines()])
      .then(([d, o]) => setData({ d, ring: o.Bangladesh })).catch(() => {});
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !data) return;
    const cs = getComputedStyle(document.documentElement);
    const C = (k) => cs.getPropertyValue(k).trim();
    const ctx = cv.getContext('2d');
    const P = project(BBOX, cv.width, cv.height);
    ctx.fillStyle = C('--sea'); ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = C('--land'); ctx.strokeStyle = C('--line'); ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.ring.forEach((p, i) => {
      const q = P({ lng: p[0], lat: p[1] });
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = '600 13px ' + C('--body');
    data.d.forEach((d) => {
      const q = P(d), on = visited.has(d.en);
      ctx.beginPath(); ctx.arc(q[0], q[1], on ? 8 : 5, 0, 6.2832);
      ctx.fillStyle = on ? C('--violet') : C('--ink-3');
      ctx.globalAlpha = on ? 1 : 0.45; ctx.fill(); ctx.globalAlpha = 1;
      if (on) {
        ctx.fillStyle = C('--ink'); ctx.globalAlpha = 0.9;
        ctx.fillText(dname(d), q[0] + 10, q[1] + 4); ctx.globalAlpha = 1;
      }
    });
  }, [data, visited]);

  const click = (e) => {
    const cv = ref.current;
    if (!cv || !data) return;
    const b = cv.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * cv.width;
    const y = ((e.clientY - b.top) / b.height) * cv.height;
    const P = project(BBOX, cv.width, cv.height);
    let best = null, bd = Infinity;
    data.d.forEach((d) => {
      const q = P(d), dd = (q[0] - x) ** 2 + (q[1] - y) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    });
    if (best && bd <= 2400) onToggle(best);
  };

  if (!data) return <div class="skel" style="height:380px" />;
  return (
    <div class="canvasmap">
      <canvas ref={ref} width={700} height={800} onClick={click} role="img"
        aria-label="district map of Bangladesh" />
    </div>
  );
}
