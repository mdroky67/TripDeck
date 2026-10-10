import { openSheet, closeSheet, toast } from '../store/state.js';
import { previewImport, applyImport } from '../store/actions.js';
import { mergeDocs } from '../store/sync.js';
import { L, N } from '../i18n.js';
import { Card } from './bits.jsx';

const Row = ({ k, v }) => (
  <div class="between" style="padding:3px 0"><span class="muted">{k}</span><span class="num">{v}</span></div>
);

/**
 * Pick a .json export and merge it in. Shared by Settings and the empty state
 * on Trips, which is where someone holding a file looks first.
 */
export function pickAndImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const pv = previewImport(JSON.parse(await file.text()));
      if (!pv) { toast(L('এটা TripDeck ফাইল নয়', 'Not a TripDeck file')); return; }
      openSheet(() => (
        <>
          <h3>{L('আমদানি করবো?', 'Import this file?')}</h3>
          <p class="muted" style="margin:-6px 0 12px">{file.name}</p>
          <Card style="margin-bottom:12px">
            <Row k={L('নতুন ট্রিপ', 'New trips')} v={N(pv.newTrips)} />
            <Row k={L('আগের ট্রিপ', 'Past trips')} v={N(pv.newPast)} />
            <Row k={L('নতুন দেশ', 'New countries')} v={N(pv.newCountries)} />
            <Row k={L('নতুন জেলা', 'New districts')} v={N(pv.newDistricts)} />
          </Card>
          <div class="muted" style="margin-bottom:12px">
            {L('তোমার এখনকার কিছু মুছবে না — দুটো মিলিয়ে নেওয়া হবে।',
               'Nothing you have is deleted — the two are merged.')}
          </div>
          <div class="row" style="gap:8px">
            <button class="btn ghost" style="flex:1" onClick={closeSheet}>{L('বাতিল', 'Cancel')}</button>
            <button class="btn" style="flex:1" onClick={() => {
              applyImport(pv.incoming, mergeDocs);
              closeSheet();
              toast(L('আমদানি হয়েছে', 'Imported'));
            }}>{L('হ্যাঁ, আনো', 'Yes, import')}</button>
          </div>
        </>
      ));
    } catch {
      toast(L('ফাইলটা পড়া যায়নি', 'Could not read that file'));
    }
  });
  input.click();
}
