# Google setup — free, about 15 minutes, once

The app stores its data in the user's own Google Drive. That needs an OAuth
client ID. There is **no client secret** involved: the browser uses the implicit
token flow, so nothing has to be kept private.

## Step 1 — project

1. https://console.cloud.google.com → **New Project** → name it → Create
2. **APIs & Services → Library** → find **Google Drive API** → **Enable**

## Step 2 — consent screen

**APIs & Services → OAuth consent screen** (newer console: **Google Auth
Platform**)

- User type: **External** → Create
- Fill in the app name and your email
- **Scopes → Add or Remove Scopes**, added by hand:
  ```
  https://www.googleapis.com/auth/drive.appdata
  openid
  https://www.googleapis.com/auth/userinfo.email
  https://www.googleapis.com/auth/userinfo.profile
  ```
  > `drive.appdata` is **non-sensitive**, so Google does not require a review.
  > Never ask for `drive` or `drive.file` — those trigger verification.
- **Test users** → add your own Gmail address. Testing mode allows 100 of them,
  free, with no review. There is no reason to publish the app.

## Step 3 — OAuth client ID

**Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- **Authorized JavaScript origins**:
  ```
  http://localhost:5173              ← development
  https://localhost                  ← the Android WebView, if you build the APK
  https://<your-user>.github.io      ← once it is published
  ```
- **Authorized redirect URIs** — required for the APK:
  ```
  https://localhost
  ```
  In a browser the sign-in happens in a popup and needs no redirect URI. Inside
  an Android WebView a popup cannot hand its result back, so the app redirects
  itself to Google and comes back to `https://localhost` — which is the
  WebView's own address — with the token in the URL fragment.
- Create, then copy the **client ID** (`…apps.googleusercontent.com`).

## Step 4 — put it in the app

```bash
cp .env.example .env
```
```
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

A client ID is not a secret — every site using Google Sign-In exposes it in
plain sight. What protects it is the origin list above. Even so, `.env` is
git-ignored here so the repository stays free of anything project-specific.

**For CI builds** (GitHub Pages and the APK) set the same value as a repository
secret named `VITE_GOOGLE_CLIENT_ID`:
Settings → Secrets and variables → Actions → New repository secret.
Without it the build still succeeds; the app simply shows "sign-in not
configured" and works as a local-only app.

---

## The code — sign-in (`src/google/auth.js`)

```js
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'openid', 'email', 'profile',
].join(' ');

let token = null, expiresAt = 0;

export async function signIn({ silent = false } = {}) {
  await gsiReady();                       // loads accounts.google.com/gsi/client
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: SCOPES,
      prompt: silent ? '' : 'consent',
      callback: (res) => {
        if (res.error) return reject(res);
        token = res.access_token;
        expiresAt = Date.now() + (res.expires_in - 60) * 1000;
        resolve(token);
      },
      error_callback: reject,
    });
    client.requestAccessToken();
  });
}

export async function getToken() {
  if (token && Date.now() < expiresAt) return token;
  return signIn({ silent: true });        // renews quietly
}
```

> The token is kept **in memory only**, never in localStorage — that would be an
> XSS target. After a reload `signIn({ silent: true })` fetches a new one.

## The code — Drive (`src/google/drive.js`)

```js
const FILE = 'tripdeck.json';
const API  = 'https://www.googleapis.com/drive/v3';
const UP   = 'https://www.googleapis.com/upload/drive/v3';

export async function findFile() {
  const q = encodeURIComponent(`name='${FILE}' and trashed=false`);
  const r = await fetch(
    `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)`,
    { headers: await authHeader() });
  const { files } = await r.json();
  return files?.[0] ?? null;
}

export async function download(id) {
  const r = await fetch(`${API}/files/${id}?alt=media`, { headers: await authHeader() });
  return r.json();
}

export async function upload(doc, id) {
  const meta = id ? {} : { name: FILE, parents: ['appDataFolder'] };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  body.append('file',     new Blob([JSON.stringify(doc)],  { type: 'application/json' }));
  const url = id ? `${UP}/files/${id}?uploadType=multipart`
                 : `${UP}/files?uploadType=multipart`;
  const r = await fetch(url, { method: id ? 'PATCH' : 'POST',
                               headers: await authHeader(), body });
  return r.json();
}
```

**That is the entire "backend".**

`appDataFolder` is a hidden per-app folder inside the user's Drive. They never
see the file, it does not count against anything you own, and uninstalling the
app does not lose it.

---

## When it goes wrong

| What you see | Why | Fix |
|---|---|---|
| `403 … Drive API has not been used in project` | The API was never enabled | Library → Google Drive API → Enable |
| `access_denied` / "App is blocked" | Consent screen is in Testing and you are not a test user | Audience → Test users → add your address |
| `origin_mismatch` | The address you opened the app from is not listed | Credentials → **Authorized JavaScript origins** → add it |
| `redirect_uri_mismatch` | Only bites the APK | Credentials → **Authorized redirect URIs** → add `https://localhost` |
| Login succeeds, then a blank screen | An old build still using the popup flow | Rebuild; native now uses a redirect |
| "Google hasn't verified this app" | Normal in Testing mode | Advanced → Go to … (you are the developer) |
| Signs in, then fails to save | Missing `drive.appdata` scope | Add it on the consent screen and sign in again |

Any red message in Settings is the exact API error — read it; it names the cause.
