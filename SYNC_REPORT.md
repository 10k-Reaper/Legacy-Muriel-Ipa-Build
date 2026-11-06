# Upstream sync report — 1.3.5 → 1.3.10

Date: 2026-11-05
Branch: `sync/upstream-2df82f5`
Sync commit: `9f83b35`

## Baseline and source

| Item | Value |
| --- | --- |
| Last local `main` commit | `4407cd7` |
| Local baseline tag | `ios15-baseline-1.3.5` |
| Upstream repository | `https://github.com/cloverscripts/riff-muriel` |
| Upstream base of the original port | `00e221d` (package `1.3.5`) |
| Upstream sync target | `2df82f5` (`upstream/main`, package `1.3.10`, 2026-11-01) |

The local `main` branch was not rewritten or merged. All sync work lives on
`sync/upstream-2df82f5`, which is based directly on `upstream/main`.

## Upstream delta

`00e221d..2df82f5` contains 69 commits and touches 56 files (+4,922 / −524,
excluding the lockfile). The notable runtime changes are:

- New native audio-interruption plugin (`MurielAudioSessionPlugin`) in
  `ios/App/App/AppDelegate.swift`, plus `mobile/audio-interruption.js`.
- New `now-playing.js`, `track-match.js`, `download-batch.js`,
  `recommend-core.js`, `stream-source.js`, `yt-fast.js`, `ytdlp-queue.js`.
- Large `app.js`, `server.js`, `index.html`, `styles.css` and settings updates.
- Song radio, crossfade, album downloads, download retries/backoff, local stream
  proxy, search filters, artist/song blocking, output-device selection and
  library sorting.
- Upstream raised the app and widget deployment targets to iOS 16.2 and switched
  the mobile bundle to `safari16`.

## iOS 15 audit

### Native

- `MurielAudioSessionPlugin` uses `AVAudioSession.interruptionNotification`,
  `UIApplication.beginBackgroundTask` and `DispatchWorkItem`. These APIs predate
  iOS 15, so the new plugin is safe on the lowered app target.
- The app target and project defaults are pinned to iOS 15.0.
- `MurielWidgets` remains at iOS 16.2. Live Activities are unavailable on iOS 15
  and the extension simply is not loaded there.
- `CapApp-SPM` remains at `.iOS(.v15)`, matching `@capacitor/ios` 8.5.3's own
  `deployment_target = '15.0'`.
- `UIBackgroundModes = audio` and the `muriel://` URL scheme are still present.

### JavaScript / web APIs

Checked the upstream delta for APIs introduced after Safari 15.0:

- `AbortSignal.timeout` is feature-checked in `google-library.js`, `server.js`,
  `share-link.js` and `bridge.js`.
- `AbortSignal.any` is feature-checked in `bridge.js`.
- `navigator.mediaSession.setPositionState` (Safari 15.4+) is guarded in
  `app.js`; `now-playing.js` only computes the position object.
- `requestIdleCallback` falls back to `setTimeout`.
- No unguarded `structuredClone`, `Object.hasOwn`, `toSorted`, `toReversed`,
  `findLast`, `Promise.withResolvers`, `Object.groupBy`, `URL.canParse` or
  `Array.fromAsync` calls were found in the app or mobile scripts.

### CSS

Progressive-enhancement warnings only; no fatal checks:

- `styles.css` and `mobile/mobile.css` use `:has()` (Safari 15.4+).
- `styles.css` uses `@property` (Safari 16.4+).
- `color-mix()` already has an `@supports not (...)` fallback.

On iOS 15.0–15.3 those rules are dropped or ignored, so a few layouts/effects
may look different. This is visual degradation, not a crash path.

## Downstream changes

Eight patches were generated from `2df82f5` to the sync branch and committed
under `patches/ios15/`:

1. `0001-pin-ios15-deployment-target.patch`
2. `0002-use-safari15-web-target.patch`
3. `0003-guard-abortsignal-timeout.patch`
4. `0004-preserve-allowscripts-and-check-script.patch`
5. `0005-add-ios15-compat-checker.patch`
6. `0006-gate-ios-workflows.patch`
7. `0007-document-ios15-port.patch`
8. `0008-pin-patch-line-endings.patch`

`tools/check-ios15-compat.mjs` is a cross-platform gate that verifies the Xcode
deployment targets, SPM platform, Safari target, mobile script copy list,
background audio, URL scheme, known newer web APIs, ActivityKit guards, and the
workflows' binary minimum checks. It runs before and after `npx cap sync ios`.

## Verification status

### Passed on this machine (Windows)

- `npm run check:ios15` — pass with 4 expected warnings.
- `node mobile/build.mjs` — `www/` built, including `download-batch.js`,
  `now-playing.js` and `track-match.js`.
- Patch series — all eight patches apply cleanly to a fresh `2df82f5` worktree;
  every source, workflow and documentation file then matches the sync branch
  (the patch files and this report are intentionally outside the series).

### Test suite

`npm test`: **311 tests, 305 passed, 1 skipped, 5 failed.** The failures were
classified as environment/network issues, not sync regressions:

| Test | Cause |
| --- | --- |
| `test/library-import.test.js:109` | Electron binary is not installed in this environment. |
| `test/play-retry.test.js:94` | Fake `yt-dlp` is a POSIX shell script; it cannot execute on Windows (expected 200, got 500). |
| `test/play-retry.test.js:105` | Same Windows shell-script issue. |
| `test/play-retry.test.js:115` | Same Windows shell-script issue. |
| `test/soundcloud-fallback.test.js:129` | Live network-dependent test; the fallback resolved to a YouTube URL instead of a SoundCloud URL. |

These should be confirmed once on macOS or Linux CI before merging to `main`.

### Not yet verified

This environment has no Xcode or Apple iOS SDK. The following remain open:

- `npx cap sync ios` against the updated `www/`.
- `xcodebuild` compilation for the iOS 15.0 app target and iOS 16.2 widget.
- Built app/widget `MinimumOSVersion` and `LC_BUILD_VERSION minos` assertions.
- Device smoke test on iOS 15.0–15.3: background audio, lock-screen controls,
  interruption resume, downloads, deep links, and settings layouts affected by
  `:has()`.

## Gate for merging

Merge `sync/upstream-2df82f5` into `main` only after:

1. The GitHub Actions **Build iOS 15 IPA** workflow succeeds on macOS.
2. The artifact reports app minimum `15.0`, widget minimum `16.2`, and binary
   `minos 15.0`.
3. An iOS 15 device smoke test passes.
4. `npm test` is re-run on a non-Windows environment (or the five failures are
   confirmed as pre-existing environment issues).
