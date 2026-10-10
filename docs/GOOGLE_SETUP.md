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

## Step 3 — OAuth client IDs

Two different clients are needed, because Google treats a browser and a phone
app as different things and will not accept one in place of the other.

### 3a — Web application (the browser build)

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
  https://<your-user>.github.io/TripDeck/oauth.html
  ```
  In a browser the sign-in happens in a popup and needs no redirect URI. The
  phone cannot be a redirect target at all, so Google returns to that one-page
  site, which forwards the answer into the app through its own URL scheme.
  `oauth.html` ships with the site; publishing the Pages site is enough.
- Create, then copy the **client ID** (`…apps.googleusercontent.com`).

### 3b — the APK uses the same Web client

There is nothing more to create. The phone and the browser share one Web
client ID, and the redirect URI added above is what makes the APK work.

> **Do not create an "Android" client for this.** That client type is wired to
> Play Services and the authorization endpoint refuses it outright — every
> redirect form (package-name scheme, reversed client id, loopback) comes back
> as *"Access blocked: TripDeck's request is invalid"*, with no hint as to why,
> while the Web client answers the identical request with a sign-in page.

The phone asks Google for a token directly rather than for a code, because
exchanging a code needs the Web client's secret and an installed app has
nowhere safe to keep one. The cost of that choice: **no refresh token**, so a
session lasts about an hour and then asks for a tap. The data itself is
unaffected — it sits in Drive and comes back on the next sign-in.

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

---

## Why the phone app signs in differently

Three approaches were tried, and only the third works:

| Approach | What happened |
|---|---|
| Google's popup (the GIS library) | A WebView has no way to hand a popup's result back to its opener. The login succeeded and the popup sat there blank. |
| Redirecting the WebView itself | Capacitor sends external URLs to the system browser, so Google came back to `https://localhost` in Chrome, which cannot reach it. Google also blocks OAuth inside embedded WebViews outright. |
| System browser + PKCE + an Android client | Google refuses the Android client type at the authorization endpoint, whatever the redirect. |
| **System browser + Web client + bounce page** | Works. |

The flow:

```
app → Chrome Custom Tab → accounts.google.com
    → https://<user>.github.io/TripDeck/oauth.html#access_token=…
    → app.tripdeck.mobile:/oauth2redirect#access_token=…
    → app reads the token out of the fragment
```

The token rides in the **fragment**, which a browser never puts in a request,
so it reaches the bounce page only inside the phone's own memory — the server
hosting that page never sees it. A `state` value generated before the browser
opens is checked on the way back, so a link someone else crafts is ignored.
