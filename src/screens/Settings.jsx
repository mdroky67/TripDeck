import { useEffect, useState } from 'preact/hooks';
import { doc, user, edit, setLang, setTheme, theme, toast, syncState, setUI, openSheet, closeSheet } from '../store/state.js';
import { exportDoc, resetAll } from '../store/actions.js';
import { syncNow, canSync } from '../store/sync.js';
import * as auth from '../google/auth.js';
import * as drive from '../google/drive.js';
import { prefetchAll } from '../geo/data.js';
import { lang, L, N } from '../i18n.js';
import { Card, Seg } from '../ui/bits.jsx';
import { pickAndImport } from '../ui/importFile.jsx';

export default function Settings() {
  const d = doc.value;
  const p = d.profile;
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState(null);

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
          <ClientIdForm />
        ) : (
          <>
            <div class="muted" style="margin-bottom:12px">
              {L('লগইন করলে ডেটা তোমার নিজের Drive-এ সেভ হবে। অ্যাপ মুছে আবার ইনস্টল করলেও সব ফিরে আসবে।',
                 'Sign in and your data saves to your own Drive. Reinstall the app and everything comes back.')}
            </div>
            <button class="btn block" disabled={busy} onClick={signIn}>
              {busy ? L('অপেক্ষা করো…', 'Working…') : L('Google দিয়ে লগইন', 'Sign in with Google')}
            </button>
            <button class="copy" style="margin-top:10px"
              onClick={() => openSheet(() => <ClientIdSheet />)}>
              {L('Client ID বদলাও', 'Change client ID')}
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
          <button class="btn ghost sm" style="flex:1" onClick={async () => {
            try {
              const r = await exportDoc();
              toast(L(`সেভ হয়েছে: ${r.where}`, `Saved: ${r.where}`));
            } catch (e) {
              toast(L('ফাইল সেভ করা যায়নি', 'Could not save the file'));
            }
          }}>
            ⬇ Export .json
          </button>
          <button class="btn ghost sm" style="flex:1" onClick={pickAndImport}>
            ⬆ Import
          </button>
        </div>

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

      <OfflineCard />
      <AboutCard />
    </div>
  );
}


/** What keeps working with no connection, and what does not. */
function OfflineCard() {
  const rows = [
    ['✅', L('ট্রিপ, দিন, কাজ — দেখা, লেখা, টিক দেওয়া', 'Trips, days, activities — read, write, tick')],
    ['✅', L('চেইন, দূরত্ব, অগ্রগতি, হিসাব', 'Chain, distances, progress, stats')],
    ['✅', L('বিশ্ব ও জেলার ম্যাপ', 'World and district maps')],
    ['✅', L('জরুরি নম্বর', 'Emergency numbers')],
    ['✅', L('GPS ও পৌঁছানোর অ্যালার্ম', 'GPS and the arrival alarm')],
    ['◐', L('ট্রিপের ম্যাপ — আগে যেটুকু দেখেছো, সেটুকু', 'Trip map — only the parts you already viewed')],
    ['✕', L('সড়কপথের দূরত্ব (তখন সরলরেখার মাপ দেখায়)', 'Road distance (straight-line is shown instead)')],
    ['✕', L('Drive-এ সেভ — ইন্টারনেট ফিরলে নিজে থেকেই হয়ে যায়', 'Saving to Drive — it catches up by itself')],
  ];
  return (
    <Card>
      <div class="eyebrow" style="margin-bottom:10px">📴 {L('অফলাইনে কী চলে', 'What works offline')}</div>
      {rows.map(([m, t]) => (
        <div key={t} class="row" style="gap:10px;align-items:flex-start;padding:4px 0">
          <span style={{ width: '16px', flex: '0 0 auto', color:
            m === '✅' ? 'var(--ok)' : m === '◐' ? 'var(--amber)' : 'var(--ink-3)' }}>{m}</span>
          <span class="muted" style="flex:1;min-width:0">{t}</span>
        </div>
      ))}
      <div class="muted" style="margin-top:10px">
        {L('সব লেখা আগে ফোনে জমা হয়, তারপর সুযোগ পেলে Drive-এ যায়। তাই ইন্টারনেট না থাকলেও কিছু আটকায় না।',
           'Every change is written to the phone first and only then sent to Drive, so nothing ever waits on a connection.')}
      </div>
    </Card>
  );
}

function AboutCard() {
  return (
    <Card style="text-align:center">
      <div style="font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.02em">TripDeck</div>
      <div class="muted" style="margin-top:2px">
        {L('সংস্করণ', 'Version')} {N(__APP_VERSION__)}
      </div>
      <div style="margin:12px 0 2px;font-weight:600">
        {L('তৈরি করেছেন Roky', 'Developed by Roky')}
      </div>
      <div class="muted">{L('ফুল স্ট্যাক ডেভেলপার', 'Full stack developer')}</div>
      <div class="muted" style="margin-top:12px">
        {L('সার্ভার নেই, হোস্টিং খরচ নেই — ডেটা তোমার নিজের Google Drive-এ।',
           'No server, no hosting cost — your data lives in your own Google Drive.')}
      </div>
    </Card>
  );
}

/**
 * Paste a Google OAuth client ID. Stored in the user's own document, so a
 * downloaded APK can point at their project without a rebuild.
 */
function ClientIdField({ onDone }) {
  const p = doc.value.profile;
  const [web, setWeb] = useState(p.googleClientId || '');
  const okId = (v) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(v.trim());
  const valid = okId(web);

  const Field = ({ label, hint, value, set }) => (
    <>
      <label class="fld" style="margin-bottom:4px">
        <span>{label}</span>
        <input value={value} onInput={(e) => set(e.currentTarget.value)} spellcheck={false}
          placeholder="1234567890-abcdef.apps.googleusercontent.com" />
      </label>
      <div class="muted" style="margin:0 0 11px">{hint}</div>
    </>
  );

  return (
    <>
      <Field label={L('Web client ID', 'Web client ID')}
        hint={L('Google Console → Credentials → OAuth client ID → Web application',
                'Google Console → Credentials → OAuth client ID → Web application')}
        value={web} set={setWeb} />
      {web.trim() && !valid && (
        <div class="muted" style="margin:-6px 0 11px;color:var(--danger)">
          {L('শেষে .apps.googleusercontent.com থাকতে হবে', 'It must end in .apps.googleusercontent.com')}
        </div>
      )}
      <button class="btn block" disabled={!valid} onClick={() => {
        const w = web.trim();
        auth.setClientId(w);
        edit((d) => { d.profile.googleClientId = w; });
        toast(L('সেভ হয়েছে — এবার লগইন করো', 'Saved — now sign in'));
        onDone?.();
      }}>{L('সেভ করো', 'Save')}</button>
    </>
  );
}

function ClientIdForm() {
  return (
    <>
      <div class="muted" style="margin-bottom:12px">
        {L('লগইন চালু করতে তোমার নিজের Google প্রজেক্টের Web Client ID লাগবে — ফোন আর ব্রাউজার, দুটোতেই একই ID। docs/GOOGLE_SETUP.md দেখো।',
           'Sign-in needs the Web client ID from your own Google project — the same one on the phone and in a browser. See docs/GOOGLE_SETUP.md.')}
      </div>
      <ClientIdField />
      <div class="muted" style="margin-top:10px">
        {L('অ্যাপ লগইন ছাড়াও পুরোপুরি চলে — তখন ডেটা শুধু এই ফোনেই থাকে।',
           'The app works fully without signing in; the data just stays on this phone.')}
      </div>
    </>
  );
}

function ClientIdSheet() {
  return (
    <>
      <h3>{L('Google Client ID', 'Google client ID')}</h3>
      <ClientIdField onDone={closeSheet} />
      <button class="btn ghost block" style="margin-top:8px" onClick={closeSheet}>
        {L('বন্ধ করো', 'Close')}
      </button>
    </>
  );
}

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
