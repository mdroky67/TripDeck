import { useRef, useState } from 'preact/hooks';

/**
 * Drag-to-reorder for a vertical list, on pointer events so one code path
 * covers finger, mouse and stylus. HTML5 drag-and-drop is not an option —
 * it never fires on touch.
 *
 * Dragging starts from a handle, never the row, so scrolling the list with a
 * finger cannot pick rows up by accident.
 *
 * The live state lives in a ref, not in useState: the pointermove handler has
 * to see the drag that pointerdown just started, and waiting for a re-render
 * to hand it a fresh closure loses the first moves.
 */
export function useReorder({ count, onDrop }) {
  const [view, setView] = useState(null);     // mirror of the ref, for rendering
  const drag = useRef(null);
  const rows = useRef([]);

  const setRow = (i) => (el) => { rows.current[i] = el; };
  const publish = () => setView(drag.current ? { ...drag.current } : null);

  const down = (i) => (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
    drag.current = {
      from: i, to: i, dy: 0, startY: e.clientY,
      boxes: rows.current.slice(0, count).map((el) => el?.getBoundingClientRect()),
    };
    publish();
    if (navigator.vibrate) navigator.vibrate(8);
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    d.dy = e.clientY - d.startY;
    d.to = indexAt(d.boxes, e.clientY, d.from);
    publish();
  };

  const up = (e) => {
    const d = drag.current;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* synthetic pointer */ }
    drag.current = null;
    publish();
    if (d && d.to !== d.from) onDrop(d.from, d.to);
  };

  const rowProps = (i) => ({
    ref: setRow(i),
    'data-drag': view?.from === i ? 'on' : shifts(view, i) ? 'shift' : undefined,
    style: view?.from === i ? `transform:translateY(${view.dy}px)` : undefined,
  });

  const handleProps = (i) => ({
    onPointerDown: down(i), onPointerMove: move,
    onPointerUp: up, onPointerCancel: up,
  });

  return { dragging: !!view, rowProps, handleProps };
}

function indexAt(boxes, y, fallback) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b && y >= b.top && y <= b.bottom) return i;
  }
  const first = boxes.find(Boolean), last = [...boxes].reverse().find(Boolean);
  if (first && y < first.top) return 0;
  if (last && y > last.bottom) return boxes.length - 1;
  return fallback;
}

/** Rows between the grab point and the drop point slide out of the way */
function shifts(d, i) {
  if (!d || d.to === d.from) return false;
  return d.to > d.from ? i > d.from && i <= d.to : i < d.from && i >= d.to;
}
