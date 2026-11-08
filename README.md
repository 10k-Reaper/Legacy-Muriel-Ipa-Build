# Muriel Legacy iOS

An iOS 15 build of [Muriel](https://github.com/cloverscripts/riff-muriel), the lightweight
music player by cloverscripts. Upstream Muriel now targets iOS 16.2; this fork keeps the
same player working on **iPhone and iPad with iOS 15.0 and later**. The shared desktop
Muriel app still builds from this source for Windows, Linux and macOS.

This is an independent, non-commercial fork. It is not affiliated with, endorsed by, or
supported by the upstream Muriel project.

## Download the IPA (no build needed)

Ready-to-install IPAs are published under
[**Releases**](https://github.com/10k-Reaper/Legacy-Muriel-Ipa-Build/releases), so you do
not need a Mac, Xcode or a GitHub account to use the app.

- **Versioned releases** (`v1.3.10`, `v1.3.11`, ...) are the stable builds. Each one
  contains `Muriel.ipa`, `Muriel.ipa.sha256` and `sidestore.json`.
- **`ios-latest`** is a rolling pre-release that follows the `main` branch.
- All builds are unsigned and support **iOS 15.0 or later**.

## Install on iPhone or iPad

Choose the method that matches your device:

- **TrollStore** — no Apple ID and no 7-day expiry. On iOS versions and devices supported
  by TrollStore, install TrollStore first, then open `Muriel.ipa` with it. TrollStore
  installs the unsigned IPA permanently. Support depends on your iOS version, so check the
  [TrollStore compatibility chart](https://github.com/opa334/TrollStore#installation)
  before trying.
- **Sideloadly** — connect the device to a computer, drag `Muriel.ipa` into Sideloadly and
  sign it with your Apple ID.
- **AltStore / SideStore** — add the release's `sidestore.json` asset as a source, or open
  the IPA in AltStore/SideStore.

Sideloadly, AltStore and SideStore sign the app with your Apple ID. Free Apple IDs need the
app re-signed every 7 days; paid developer accounts last longer. TrollStore does not use an
Apple ID and does not expire.

To check a download, compare it with the published checksum:

```bash
shasum -a 256 Muriel.ipa                 # macOS / Linux
certutil -hashfile Muriel.ipa SHA256     # Windows
```

The current build has been device-tested on an **iPhone XR running iOS 15.4.1**. See
[`SYNC_REPORT.md`](SYNC_REPORT.md) for the build and device-test history.

## What this fork changes

- The iOS app and Xcode project target **iOS 15.0**. The `MurielWidgets` Live Activity
  extension stays on **iOS 16.2** because Live Activities do not exist on iOS 15; iOS 15
  devices keep the normal lock-screen media controls instead.
- The mobile web bundle is built for **Safari 15**, with fallbacks for newer APIs
  (`roundRect`, `color-mix()`, `AbortSignal.timeout`, and others).
- The phone UI has iOS-specific fixes for safe areas, the karaoke visualizer, system
  volume, sliders, the Queue, Now Playing, Favorites, playlists, and smooth cover art
  while scrolling.
- A reusable patch series in [`patches/ios15`](patches/ios15/README.md) carries the delta
  over upstream, so future upstream releases can be synced again. See
  [`LEGACY_IOS.md`](LEGACY_IOS.md) for the full compatibility policy and sync procedure.

The player itself is still Muriel: streaming from YouTube, YouTube Music and SoundCloud,
offline downloads, a local library, synced lyrics and karaoke, EQ and playback effects,
playlists, favorites, queue management, themes, and the desktop interface.

## Building the IPA yourself (maintainers)

The download builds are produced by GitHub Actions on macOS:

- [`.github/workflows/build-ios15-ipa.yml`](.github/workflows/build-ios15-ipa.yml) builds a
  branch by hand and uploads the `Muriel-iOS15-IPA` workflow artifact.
- [`.github/workflows/ios.yml`](.github/workflows/ios.yml) publishes the rolling
  `ios-latest` release from `main`.
- [`.github/workflows/release.yml`](.github/workflows/release.yml) builds a versioned
  release when a `v*` tag is pushed (or started manually with a version) and uploads
  `Muriel.ipa`, `Muriel.ipa.sha256` and `sidestore.json`.

Every path verifies that the app reports minimum iOS `15.0`, the widget extension reports
`16.2`, and the app binary's `LC_BUILD_VERSION minos` is `15.0` before publishing. The IPA
is unsigned, so install it with TrollStore, Sideloadly, AltStore/SideStore, or another tool
that signs apps with your own Apple ID/developer certificate.

## Building locally

Requires Node.js 18 or newer. Building the IPA additionally requires macOS with Xcode.

```bash
npm ci
npm run check:ios15
node mobile/build.mjs
npm test
```

For the native app:

```bash
npx cap sync ios
npx cap open ios      # or build with xcodebuild
```

The desktop app is unaffected by the iOS port: `npm start` runs it and `npm run dist`
builds installers. Upstream publishes the desktop downloads. The static compatibility
gate, web bundle and Node test suite also run on Windows and Linux. The five test failures
currently seen on Windows are environment/network issues (Electron is not installed and
several tests use POSIX shell scripts). They are documented in
[`SYNC_REPORT.md`](SYNC_REPORT.md).

## Known iOS 15 limitations

- `:has()` and `@property` CSS features are not available on iOS 15.0–15.3; affected
  styling degrades gracefully.
- Live Activities and Dynamic Island are unavailable on iOS 15.
- The lock-screen elapsed/duration display follows the upstream Now Playing behaviour
  tracked in [upstream issue #26](https://github.com/cloverscripts/riff-muriel/issues/26).
- iOS 15.0–15.3 receive the compatibility build, but the main device validation was done
  on iOS 15.4.1.

## Syncing a new upstream release

The iOS 15 changes live as a patch series rather than as unrelated commits. The short
version:

```bash
git fetch upstream --tags
git archive HEAD patches/ios15 | tar -x -C "$TEMP"
git switch -c sync/upstream-<commit> upstream/main
for patch in "$TEMP"/patches/ios15/[0-9]*.patch; do
  git apply --3way "$patch"
done
npm ci
npm run check:ios15
node mobile/build.mjs
npm test
```

Then run the **Build iOS 15 IPA** workflow and test the result on an iOS 15 device before
merging. [`LEGACY_IOS.md`](LEGACY_IOS.md) and
[`patches/ios15/README.md`](patches/ios15/README.md) contain the full procedure and the
description of every patch.

## Credits

Muriel is by [cloverscripts](https://github.com/cloverscripts) and is based on
[Riff](https://github.com/rootscripts/riff) by rootscripts. Both are MIT-licensed. This
fork keeps their copyright notices and adds the iOS 15 compatibility work.

Muriel is a player: it does not host, upload or sell music, has no ads, accounts or
tracking, and nobody earns money from it. You are responsible for using it in line with
copyright law and the terms of the services you use. See [`LEGAL.md`](LEGAL.md), including
the rights-holder contact path.

## License

MIT. See [`LICENSE`](LICENSE).
