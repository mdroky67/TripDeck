import { useEffect } from 'preact/hooks';
import { sheet, closeSheet } from '../store/state.js';

export default function Sheet() {
  const s = sheet.value;
  useEffect(() => {
    if (!s) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [s]);
  if (!s) return null;
  return (
    <div class="scrim" onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={s.title || ''}>
        <div class="grab" />
        {s.render()}
      </div>
    </div>
  );
}
