# Android APK

The app is wrapped with **Capacitor**: the same web build, inside a real Android
app. Everything ships inside the APK, so it **works offline from the moment it
is installed** — no first online visit required.

## Where the APK comes from

Building locally needs a JDK and the Android SDK (a few GB). Instead, CI builds
it — free on a public repository, and 2,000 minutes a month on a private one.

```bash
git push        # that's it; the build starts on push
```

Five to eight minutes later:
**Actions → the latest run → Artifacts → `TripDeck-apk`**

A zip downloads; inside is `TripDeck-<sha>.apk`. Send it to the phone and open it.

> Android will object the first time: *"can't install from unknown sources"* →
> **Settings → allow**, and it goes through.

### A version that sticks around

```bash
git tag v1.0.0 && git push --tags
```
The APK is then attached to **Releases**, which does not expire after 90 days
the way build artifacts do.

## What differs from the web version

| | Web (PWA) | APK |
|---|---|---|
| Install | browser → Add to Home screen | open the file |
| Offline on day one | no (needs one online visit first) | **yes** |
| Map tiles | cached as you use them | same |
| GPS | browser permission | Android permission |
| Notifications | limited | full |
| Updates | automatic | install a new APK |

**Permissions requested** (`android/app/src/main/AndroidManifest.xml`): location
(live tracking), notifications (arrival alarm), wake lock, internet. Nothing
else — no camera, no contacts, no file access.

## Google sign-in inside the APK

A Capacitor WebView needs an origin that Google will accept. The config sets
`androidScheme: https` with `hostname: localhost`, so the WebView identifies
itself as `https://localhost`. Add that to **Authorized JavaScript origins**
next to the others.

⚠️ **This needs to be tested on a device.** If sign-in fails inside the APK, the
app is not broken — it runs perfectly without an account, keeping data on the
phone. Two ways round it:
1. Sign in once in the browser version and let Drive sync carry the data, or
2. Set `hostname` to the GitHub Pages domain instead and authorise that origin.

## Later: real background GPS

Today, GPS stops when the screen sleeps — a WebView limit. For tracking with the
phone in a pocket, add `@capacitor-community/background-geolocation`, which runs
a foreground service. The APK scaffolding is already in place for it.

## Signed release build

The CI produces a **debug** APK: fine to install on your own phone, not
publishable. For a Play Store build, generate a keystore, put it in GitHub
Secrets, and run `assembleRelease` instead.

## Building locally (optional)

```bash
brew install --cask temurin android-studio   # ~3 GB
npx cap open android                         # opens the native project
```
Then press Run in Android Studio with a phone plugged in over USB.
