# Muriel Legacy iOS

An iOS 15 build of [Muriel](https://github.com/cloverscripts/riff-muriel), the lightweight
music player by cloverscripts. Upstream Muriel now targets iOS 16.2; this fork keeps the
same player working on **iPhone and iPad with iOS 15.0 and later**, and still builds the
original desktop app for Windows, Linux and macOS.

This is an independent, non-commercial fork. It is not affiliated with, endorsed by, or
supported by the upstream Muriel project.

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

## Installing the iOS IPA

The repository builds an **unsigned** IPA on GitHub's macOS runners:

1. Open the [Build iOS 15 IPA workflow](https://github.com/10k-Reaper/Legacy-Muriel-Ipa-Build/actions/workflows/build-ios15-ipa.yml).
2. Choose **Run workflow** for the branch you want to build.
3. Download the `Muriel-iOS15-IPA` artifact when the run finishes.

The workflow verifies that the app reports minimum iOS `15.0`, the widget extension
reports `16.2`, and the app binary's `LC_BUILD_VERSION minos` is `15.0` before uploading
the IPA. The IPA is not signed, so install it with AltStore, Sideloadly, TrollStore, or
another tool that signs apps with your own Apple ID/developer certificate.

The current build has been device-tested on an **iPhone XR running iOS 15.4.1**. See
[`SYNC_REPORT.md`](SYNC_REPORT.md) for the build and device-test history.

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

The static compatibility gate, web bundle and Node test suite also run on Windows and
Linux. The five test failures currently seen on Windows are environment/network issues
(Electron is not installed and several tests use POSIX shell scripts). They are documented
in [`SYNC_REPORT.md`](SYNC_REPORT.md).

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
for patch in "$TEMP"/patches/ios15/000*.patch; do
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
