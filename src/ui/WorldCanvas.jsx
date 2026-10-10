import { useEffect, useRef, useState } from 'preact/hooks';
import { worldGrid } from '../geo/data.js';
import { TINY_STATES } from '../geo/places.js';

/**
 * Dot-grid world map, drawn from a file inside the app, so it works offline
 * with no API. Canvas rather than SVG: 7,000 SVG dots stall a phone.
 */
export default function WorldCanvas({ visited, onToggle }) {
  const ref = useRef(null);
  const [grid, setGrid] = useState(null);
  const idIdx = useRef({});

  useEffect(() => { worldGrid().then(setGrid).catch(() => {}); }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !grid) return;
    const cs = getComputedStyle(document.documentElement);
    const C = (k) => cs.getPropertyValue(k).trim();
    const ctx = cv.getContext('2d');
    if (!Object.keys(idIdx.current).length) {
      grid.ids.forEach((p, i) => { idIdx.current[grid.charset[i]] = p[0]; });
    }
    const cw = cv.width / grid.w, ch = cv.height / grid.h, r = Math.min(cw, ch) * 0.42;
    const teal = C('--teal'), land = C('--land');
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let j = 0; j < grid.h; j++) {
      const row = grid.cells[j];
      for (let i = 0; i < grid.w; i++) {
        const c = row[i];
        if (c === ' ') continue;
        ctx.fillStyle = visited.has(idIdx.current[c]) ? teal : land;
        ctx.beginPath(); ctx.arc((i + 0.5) * cw, (j + 0.5) * ch, r, 0, 6.2832); ctx.fill();
      }
    }
    // Micro-states absent from the 110m data, drawn as larger dots
    TINY_STATES.forEach((t) => {
      const x = ((t.lng + 180) / 360) * cv.width;
      const y = ((grid.lat0 - t.lat) / (grid.lat0 - grid.lat1)) * cv.height;
      ctx.fillStyle = visited.has(t.id) ? teal : land;
      ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, 6.2832); ctx.fill();
    });
  }, [grid, visited]);

  const click = (e) => {
    const cv = ref.current;
    if (!cv || !grid) return;
    const b = cv.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
    // Check the micro-states first; they are not in the grid
    for (const t of TINY_STATES) {
      const tx2 = (t.lng + 180) / 360, ty = (grid.lat0 - t.lat) / (grid.lat0 - grid.lat1);
      if (Math.hypot((px - tx2) * grid.w, (py - ty) * grid.h) < 2.2) return onToggle(t.id);
    }
    const i = Math.floor(px * grid.w), j = Math.floor(py * grid.h);
    const ch = (grid.cells[j] || '')[i];
    if (!ch || ch === ' ') return;
    onToggle(idIdx.current[ch]);
  };

  if (!grid) return <div class="skel" style="height:190px" />;
  return (
    <div class="canvasmap">
      <canvas ref={ref} width={920} height={416} onClick={click} role="img"
        aria-label="world map" />
    </div>
  );
}
