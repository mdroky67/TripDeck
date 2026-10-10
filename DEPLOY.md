# Publishing

## Web — GitHub Pages

```bash
npm run deploy        # builds, then pushes dist/ to the gh-pages branch
```

Once, afterwards: **Settings → Pages → Source: Deploy from a branch → `gh-pages`
/ root**. The site appears at `https://<user>.github.io/<repo>/` a couple of
minutes later.

`vite.config.js` sets `base` to the repository name for production builds.
If the repository is renamed, change it there. For any other host:

```bash
BASE=/ npm run build
```

There is also a workflow (`.github/workflows/pages.yml`) that deploys on every
push to `main`. It skips itself on a private repository, because Pages is not
available there on the free plan.

After the first deploy, add the new origin to the Google console —
**Credentials → Authorized JavaScript origins** — or sign-in returns
`origin_mismatch`.

## Phone — APK

See [APK.md](APK.md). Short version: push, then collect the APK from the
Actions artifacts.

## Pushing for the first time

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

GitHub wants a **personal access token**, not your password:
https://github.com/settings/tokens/new → tick **`repo`** *and* **`workflow`**.

Without `workflow` the push is rejected with:
```
refusing to allow a Personal Access Token to create or update workflow
```
The fix is to tick that box on the existing token (the token string does not
change, so nothing else needs updating) and push again.

On macOS the token is remembered in the Keychain. To replace it:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase
```

Or avoid the whole question with `brew install gh && gh auth login`.

## Public or private?

| | Public | Private |
|---|---|---|
| APK builds in Actions | free, unlimited | free, 2,000 min/month (~250 builds) |
| GitHub Pages | ✅ | ❌ not on the free plan |
| Who can read the code | anyone | you |

Nothing in this repository is sensitive — `.env` is ignored, no secret is
committed, and demo data is fictional. Either choice is safe; private simply
costs you the web link.

## Routine, once it is set up

```bash
git add -A && git commit -m "what changed"
git push              # APK builds, and Pages redeploys if public
```
