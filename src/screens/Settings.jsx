import { useEffect, useRef, useState } from 'preact/hooks';
import { doc, user, edit, setLang, setTheme, theme, toast, syncState, setUI, openSheet, closeSheet } from '../store/state.js';
import { exportDoc, previewImport, applyImport, resetAll } from '../store/actions.js';
import { mergeDocs, syncNow, canSync } from '../store/sync.js';
import * as auth from '../google/auth.js';
import * as drive from '../google/drive.js';
import { prefetchAll } from '../geo/data.js';
import { lang, L, N } from '../i18n.js';
import { Card, Seg } from '../ui/bits.jsx';

export default function Settings() {
  const d = doc.value;
  const p = d.profile;
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);
  const file = useRef(null);

  useEffect(() => {
    if (!auth.hasToken()) return;
    drive.usage().then(setUsage).catch(() => {});
  }, [syncState.value.at]);

  const signIn = async () => {
    setBusy(true);
    try {
      await auth.signIn();
      const prof = await auth.fetchProfile();
      user.value = prof;
      edit((dd) => { dd.profile.name = prof.name; dd.profile.email = prof.email; dd.profile.picture = prof.picture; });
      await syncNow();
      toast(L('লগইন হয়েছে — ডেটা Drive-এ সেভ হচ্ছে', 'Signed in — your data now saves to Drive'));
    } catch (e) {
      toast(L('লগইন হয়নি: ', 'Sign-in failed: ') + (e?.message || e?.type || ''));
    } finally { setBusy(false); }
  };

  const doImport = async (f) => {
    try {
      const raw = JSON.parse(await f.text());
      const pv = previewImport(raw);
      if (!pv) { toast(L('এটা TripDeck ফাইল নয়', 'Not a TripDeck file')); return; }
      openSheet(() => (
        <>
          <h3>{L('আমদানি করবো?', 'Import this file?')}</h3>
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
              applyImport(pv.incoming, mergeDocs); closeSheet();
              toast(L('আমদানি হয়েছে', 'Imported'));
            }}>{L('হ্যাঁ, আনো', 'Yes, import')}</button>
          </div>
        </>
      ));
    } catch {
      toast(L('ফাইলটা পড়া যায়নি', 'Could not read that file'));
    }
  };

  return (
    <div class="stack" style="margin-top:8px">
      <button class="btn ghost sm" style="align-self:flex-start" onClick={() => setUI({ tab: 'trips' })}>
        ← {L('ফিরে যাও', 'Back')}
      </button>

      {/* অ্যাকাউন্ট */}
      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('গুগল অ্যাকাউন্ট', 'Google account')}</div>
        {user.value ? (
          <>
            <div class="row" style="gap:12px">
              {user.value.picture && (
                <img src={user.value.picture} alt="" width="44" height="44" style="border-radius:50%" />
              )}
              <div style="flex:1;min-width:0">
                <div style="font-weight:600">{user.value.name}</div>
                <div class="muted" style="overflow:hidden;text-overflow:ellipsis">{user.value.email}</div>
              </div>
            </div>
            <div class="row" style="gap:8px;margin-top:12px">
              <button class="btn ghost sm" style="flex:1" disabled={!canSync()}
                onClick={() => { syncNow(); toast(L('sync চলছে…', 'Syncing…')); }}>
                {L('এখনই sync', 'Sync now')}
              </button>
              <button class="btn ghost sm" style="flex:1" onClick={() => {
                auth.signOut(); user.value = null; toast(L('সাইন আউট হয়েছে', 'Signed out'));
              }}>{L('সাইন আউট', 'Sign out')}</button>
            </div>
            {usage && (
              <div class="muted" style="margin-top:10px">
                {L('Drive-এ', 'On Drive')}: {N(Math.round((usage.bytes || 0) / 1024))} KB · {N(usage.backups)} {L('ব্যাকআপ', 'backups')}
              </div>
            )}
          </>
        ) : !auth.isConfigured() ? (
          <>
            <div class="muted" style="margin-bottom:10px">
              {L('গুগল লগইন এখনো চালু হয়নি। docs/GOOGLE_SETUP.md দেখে Client ID বানিয়ে .env ফাইলে বসাও — ১৫ মিনিটের কাজ, খরচ নেই।',
                 'Google sign-in is not set up yet. Follow docs/GOOGLE_SETUP.md to create a Client ID and put it in .env — 15 minutes, no cost.')}
            </div>
            <div class="chip amber">VITE_GOOGLE_CLIENT_ID {L('বসানো হয়নি', 'not set')}</div>
          </>
        ) : (
          <>
            <div class="muted" style="margin-bottom:12px">
              {L('লগইন করলে ডেটা তোমার নিজের Drive-এ সেভ হবে। অ্যাপ মুছে আবার ইনস্টল করলেও সব ফিরে আসবে।',
                 'Sign in and your data saves to your own Drive. Reinstall the app and everything comes back.')}
            </div>
            <button class="btn block" disabled={busy} onClick={signIn}>
              {busy ? L('অপেক্ষা করো…', 'Working…') : L('Google দিয়ে লগইন', 'Sign in with Google')}
            </button>
          </>
        )}
      </Card>

      {/* ভাষা ও চেহারা */}
      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('ভাষা ও চেহারা', 'Language & look')}</div>
        <Seg value={lang.value} onChange={setLang} options={[
          { v: 'bn', label: 'বাংলা' }, { v: 'en', label: 'English' },
        ]} />
        <div class="muted" style="margin:8px 0 12px">
          {L('অ্যাপের লেখা বদলাবে। তোমার নিজের লেখা — ট্রিপের নাম, কাজের নাম, নোট — যেমন লিখেছো তেমনই থাকবে।',
             'The app’s own text switches. What you wrote — trip names, activities, notes — stays exactly as you typed it.')}
        </div>
        <Seg value={theme.value} onChange={setTheme} options={[
          { v: 'system', label: L('সিস্টেম', 'System') },
          { v: 'light', label: L('দিন', 'Light') },
          { v: 'dark', label: L('রাত', 'Dark') },
        ]} />
        <div style="margin-top:12px">
          <Seg value={p.units} onChange={(v) => edit((dd) => { dd.profile.units = v; })} options={[
            { v: 'km', label: L('কিলোমিটার', 'Kilometres') },
            { v: 'mi', label: L('মাইল', 'Miles') },
          ]} />
        </div>
      </Card>

      {/* ডেটা */}
      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('ডেটা', 'Data')}</div>
        <div class="row" style="gap:8px">
          <button class="btn ghost sm" style="flex:1" onClick={() => { exportDoc(); toast(L('ফাইল নামছে', 'Downloading')); }}>
            ⬇ Export .json
          </button>
          <button class="btn ghost sm" style="flex:1" onClick={() => file.current?.click()}>
            ⬆ Import
          </button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) doImport(f); e.currentTarget.value = ''; }} />
        <button class="btn ghost sm block" style="margin-top:8px" onClick={async () => {
          toast(L('ম্যাপের ডেটা নামছে…', 'Downloading map data…'));
          try { await prefetchAll(); toast(L('অফলাইনের জন্য তৈরি', 'Ready for offline')); }
          catch { toast(L('নামানো যায়নি', 'Download failed')); }
        }}>📥 {L('অফলাইনের জন্য প্রস্তুত করো', 'Prepare for offline')}</button>
      </Card>

      {/* বিপজ্জনক */}
      <Card>
        <div class="eyebrow" style="margin-bottom:10px">{L('সাবধান', 'Careful')}</div>
        <button class="btn ghost sm block" onClick={() => openSheet(() => <WipeSheet />)}>
          🗑 {L('সব ডেটা মুছে ফেলো', 'Erase all data')}
        </button>
      </Card>

      <div class="muted" style="text-align:center;padding:8px 0 24px">
        TripDeck · {L('সার্ভার নেই, হোস্টিং খরচ নেই', 'No server, no hosting cost')}
      </div>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div class="between" style="padding:3px 0"><span class="muted">{k}</span><span class="num">{v}</span></div>
);

function WipeSheet() {
  const [typed, setTyped] = useState('');
  const word = L('মুছে ফেলো', 'ERASE');
  return (
    <>
      <h3>{L('সব ডেটা মুছে ফেলবে?', 'Erase everything?')}</h3>
      <div class="muted" style="margin-bottom:12px">
        {L('সব ট্রিপ, আগের ট্রিপ, দেশ ও জেলা মুছে যাবে। Drive-এর ব্যাকআপ থাকলে সেখান থেকে ফেরানো যাবে, নাহলে নয়।',
           'All trips, past trips, countries and districts go. Only a Drive backup can bring them back.')}
      </div>
      <label class="fld">
        <span>{L(`নিশ্চিত হতে লেখো: ${word}`, `Type ${word} to confirm`)}</span>
        <input value={typed} onInput={(e) => setTyped(e.currentTarget.value)} />
      </label>
      <div class="row" style="gap:8px">
        <button class="btn ghost" style="flex:1" onClick={closeSheet}>{L('বাতিল', 'Cancel')}</button>
        <button class="btn danger" style="flex:1" disabled={typed.trim() !== word}
          onClick={() => { resetAll(); closeSheet(); toast(L('সব মুছে ফেলা হয়েছে', 'Everything erased')); }}>
          {L('মুছে ফেলো', 'Erase')}
        </button>
      </div>
    </>
  );
}
