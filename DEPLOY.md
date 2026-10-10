# Publishing

## Phone — the APK

Every push to `main` builds one. Collect it from
**Actions → the latest run → Artifacts → `TripDeck-apk`**, or tag a release:

```bash
git tag v1.0.0 && git push --tags
```

A tagged build is attached to **Releases**, which does not expire the way build
artifacts do. Details in [APK.md](APK.md).

## Web (optional)

There is no Pages workflow: this project ships as an APK. To publish the web
build anyway:

```bash
npm run deploy        # builds, then pushes dist/ to a gh-pages branch
```

Then **Settings → Pages → Deploy from a branch → `gh-pages` / root**, and add
the resulting origin to the Google console under **Authorized JavaScript
origins**, or sign-in returns `origin_mismatch`.

`vite.config.js` sets `base` to the repository name for production builds. For
any other host:

```bash
BASE=/ npm run build
```

## Pushing

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

GitHub wants a **personal access token**, not a password:
https://github.com/settings/tokens/new → tick **`repo`** *and* **`workflow`**.

Without `workflow` the push is rejected with:
```
refusing to allow a Personal Access Token to create or update workflow
```
Ticking that box on the existing token is enough — the token string does not
change, so nothing else needs updating.

Never put the token in the remote URL (`https://TOKEN@github.com/...`): it ends
up in `.git/config` in plain text. Let the credential helper store it instead:

```bash
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase   # forget the old one
git push                                                                          # it will ask once
```

To check what a stored token is allowed to do, without printing it:

```bash
curl -s -D- -o /dev/null -H "Authorization: Bearer $(printf 'protocol=https\nhost=github.com\n\n' \
  | git credential fill | grep ^password= | cut -d= -f2-)" \
  https://api.github.com/user | grep -i x-oauth-scopes
```

## Public or private?

| | Public | Private |
|---|---|---|
| APK builds in Actions | free, unlimited | free, 2,000 min/month (~250 builds) |
| Who can read the code | anyone | you |

Nothing here is sensitive — `.env` is ignored, no secret is committed, and the
demo data is fictional. Either choice is safe.

## Routine

```bash
git add -A && git commit -m "what changed"
git push              # a new APK builds
```
