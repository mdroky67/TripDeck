/**
 * Google Identity Services — token flow, no server and no secret.
 * The token lives in memory only, never in localStorage (XSS risk).
 * docs/GOOGLE_SETUP.md
 */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'openid', 'email', 'profile',
].join(' ');

let token = null, expiresAt = 0, client = null;

export const isConfigured = () => !!CLIENT_ID;

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

export async function signIn({ silent = false } = {}) {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID বসানো হয়নি');
  await gsiReady();
  return new Promise((resolve, reject) => {
    client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
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
