/**
 * Google Identity Services — token flow, no server and no secret.
 * The token lives in memory only, never in localStorage (XSS risk).
 * docs/GOOGLE_SETUP.md
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'openid', 'email', 'profile',
].join(' ');

let token = null, expiresAt = 0, client = null;
let runtimeClientId = '';

/**
 * The client ID can come from two places, in this order:
 *   1. whatever the user pasted into Settings (stored in their document)
 *   2. VITE_GOOGLE_CLIENT_ID baked in at build time
 *
 * Keeping (1) means a downloaded APK can be pointed at the user's own Google
 * project without rebuilding anything, and the repository never has to carry
 * a project-specific value.
 */
export const setClientId = (id) => { runtimeClientId = (id || '').trim(); };
export const clientId = () => runtimeClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * The phone uses the same **Web** client as the browser does.
 *
 * Google's "Android" client type cannot be used here at all: it is wired to
 * Play Services, and the authorization endpoint rejects it whatever redirect
 * is sent — package-name scheme, reversed client id and loopback all come back
 * as "Access blocked: TripDeck's request is invalid", while the Web client
 * answers the identical request with a normal sign-in page.
 */
export const ANDROID_PACKAGE = 'app.tripdeck.mobile';

/**
 * Where Google sends its answer on the phone.
 *
 * An installed app cannot be a redirect target, so Google returns to a one-page
 * site that forwards the fragment on through the app's own URL scheme. The
 * token travels in the fragment, which a browser never sends to a server, so
 * that page sees it only in the phone's own memory.
 */
const BOUNCE = import.meta.env.VITE_OAUTH_BOUNCE
  || 'https://mdroky67.github.io/TripDeck/oauth.html';

const looksLikeId = (v) => /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(String(v || '').trim());
export const isConfigured = () => looksLikeId(clientId());

function gsiReady() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google স্ক্রিপ্ট লোড হয়নি'));
    document.head.appendChild(s);
  });
}

const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

/* ---------------- redirect flow (native) ----------------
 * Google's own library signs in through a popup and hands the result back with
 * postMessage. Inside an Android WebView that return path does not work: the
 * login succeeds and the popup is left sitting there, blank.
 *
 * So on native we drive the WebView itself to Google and let it come back to
 * https://localhost — which is the WebView's own origin — with the token in the
 * URL fragment. No popup, no plugin, no second window to get lost in.
 * The redirect URI must be registered in the Google console.
 */
const STATE_KEY = 'tripdeck.oauth.state';

function redirectUri() {
  return location.origin;                 // https://localhost in the APK
}

export function startRedirectSignIn() {
  const id = clientId();
  if (!id) throw new Error('No Google client ID configured');
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem(STATE_KEY, state); } catch {}
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  location.assign(url);
}

let redirectResult, redirectRead = false;

/**
 * Take the token out of the fragment after coming back from Google and clean
 * the URL, so a reload cannot replay it.
 *
 * This has to run before anything else touches location.hash — the router
 * writes the current tab there on mount and would wipe the token first. It is
 * therefore called at the top of main.jsx, and the answer is cached so the
 * sign-in code can read it later.
 */
export function consumeRedirectResult() {
  if (redirectRead) return redirectResult;
  redirectRead = true;
  redirectResult = readRedirect();
  return redirectResult;
}

function readRedirect() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!hash || !/access_token=|error=/.test(hash)) return null;
  const p = new URLSearchParams(hash);
  const expected = (() => { try { return sessionStorage.getItem(STATE_KEY); } catch { return null; } })();
  try { sessionStorage.removeItem(STATE_KEY); } catch {}
  history.replaceState(null, '', location.pathname + location.search);

  if (p.get('error')) return { error: p.get('error') };
  const returned = p.get('state');
  if (expected && returned && expected !== returned) return { error: 'state_mismatch' };

  const t = p.get('access_token');
  if (!t) return null;
  token = t;
  expiresAt = Date.now() + (Number(p.get('expires_in') || 3600) - 60) * 1000;
  return { ok: true };
}

/* ---------------- system browser + bounce page (native) ----------------
 * Google refuses OAuth inside an embedded WebView, and a popup cannot hand its
 * result back from one, so the real browser does the signing in.
 *
 * The code flow is not open to us: exchanging a code needs the Web client's
 * secret, which an installed app cannot keep. So the browser is asked for the
 * token directly and hands it back through the bounce page. There is no
 * refresh token with this flow — an expired session asks for a tap again.
 */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let pending = null;                        // { state, resolve, reject }

async function signInNative() {
  const id = clientId();
  if (!looksLikeId(id)) throw new Error('No Google client ID configured');
  const { Browser } = await import('@capacitor/browser');
  const { App } = await import('@capacitor/app');
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));

  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id,
    redirect_uri: BOUNCE,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return new Promise(async (resolve, reject) => {
    pending = { state, resolve, reject };
    let handle;
    const done = async (fn) => {
      try { await handle?.remove(); } catch {}
      try { await Browser.close(); } catch {}
      pending = null;
      fn();
    };
    handle = await App.addListener('appUrlOpen', ({ url: back }) => {
      if (!back || !back.startsWith(`${ANDROID_PACKAGE}:`)) return;
      try {
        done(() => resolve(takeToken(back)));
      } catch (e) {
        done(() => reject(e));
      }
    });
    // Closing the tab without finishing should not leave the caller hanging
    const closed = await App.addListener('resume', () => {
      setTimeout(() => {
        if (pending) done(() => reject(new Error('cancelled')));
      }, 1200);
    });
    const cleanup = handle;
    handle = { remove: async () => { await cleanup.remove(); await closed.remove(); } };
    Browser.open({ url }).catch((e) => done(() => reject(e)));
  });
}

/** Read the token out of the URL the bounce page sent back. */
function takeToken(backUrl) {
  const frag = backUrl.split('#')[1] || backUrl.split('?')[1] || '';
  const p = new URLSearchParams(frag);
  if (p.get('error')) throw new Error(p.get('error'));
  if (pending?.state && p.get('state') && p.get('state') !== pending.state) {
    throw new Error('state_mismatch');
  }
  const t = p.get('access_token');
  if (!t) throw new Error('no_token');
  token = t;
  expiresAt = Date.now() + (Number(p.get('expires_in') || 3600) - 60) * 1000;
  return token;
}

/** No refresh token in this flow, so a quiet renewal is not on offer. */
async function renewNative() { throw new Error('silent_unavailable'); }

export async function signIn({ silent = false } = {}) {
  if (isNative()) {
    if (silent) return renewNative();
    return signInNative();
  }
  const id = clientId();
  if (!id) throw new Error('No Google client ID configured');
  await gsiReady();
  return new Promise((resolve, reject) => {
    client = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPES,
      prompt: silent ? '' : 'consent',
      callback: (res) => {
        if (res.error) return reject(res);
        token = res.access_token;
        expiresAt = Date.now() + (res.expires_in - 60) * 1000;
        resolve(token);
      },
      error_callback: (err) => reject(err),
    });
    client.requestAccessToken();
  });
}

export async function getToken() {
  if (token && Date.now() < expiresAt) return token;
  return signIn({ silent: true });              // renew quietly
}

export const hasToken = () => !!token && Date.now() < expiresAt;

export function signOut() {
  if (token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token, () => {}); } catch {}
  }
  token = null; expiresAt = 0;
}

/** Name, email, picture — not needed for Drive, only for display */
export async function fetchProfile() {
  const t = await getToken();
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) throw new Error('প্রোফাইল আনা যায়নি');
  const j = await r.json();
  return { name: j.name || '', email: j.email || '', picture: j.picture || '' };
}
