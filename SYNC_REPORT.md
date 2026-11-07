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

Nine patches were generated from `2df82f5` to the sync branch and committed
under `patches/ios15/`:

1. `0001-pin-ios15-deployment-target.patch`
2. `0002-use-safari15-web-target.patch`
3. `0003-guard-abortsignal-timeout.patch`
4. `0004-preserve-allowscripts-and-check-script.patch`
5. `0005-add-ios15-compat-checker.patch`
6. `0006-gate-ios-workflows.patch`
7. `0007-document-ios15-port.patch`
8. `0008-pin-patch-line-endings.patch`
9. `0009-fix-karaoke-notch-volume-and-slider-drag.patch` (post-device-test)

`tools/check-ios15-compat.mjs` is a cross-platform gate that verifies the Xcode
deployment targets, SPM platform, Safari target, mobile script copy list,
background audio, URL scheme, known newer web APIs, ActivityKit guards, and the
workflows' binary minimum checks. It runs before and after `npx cap sync ios`.

## Verification status

### Passed on this machine (Windows)

- `npm run check:ios15` — pass with 4 expected warnings.
- `node mobile/build.mjs` — `www/` built, including `download-batch.js`,
  `now-playing.js` and `track-match.js`.
- Patch series — all nine patches apply cleanly to a fresh `2df82f5` worktree;
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

### macOS build and device test

- The GitHub Actions **Build iOS 15 IPA** workflow passed on macOS. The artifact
  reported app minimum `15.0`, widget minimum `16.2`, and binary `minos 15.0`.
- The iPhone XR / iOS 15.4.1 smoke test passed: playback, lock-screen controls,
  interruption resume, downloads, deep links, and the settings UI.
- The fullscreen karaoke fixes in patch 9 (notch spacing, bottom seek bar, iOS
  system volume, drag-anywhere bars, off-bar dragging, Word-lyrics fallback) were
  made after that test. The follow-up iPhone pass confirmed those worked; the four
  findings it raised are now in the same cumulative patch and still need a fresh
  CI build and an iPhone check.

## Gate for merging

Merge `sync/upstream-2df82f5` into `main` only after:

1. ~~The GitHub Actions **Build iOS 15 IPA** workflow succeeds on macOS.~~ Passed.
2. ~~The artifact reports app minimum `15.0`, widget minimum `16.2`, and binary
   `minos 15.0`.~~ Passed.
3. ~~An iOS 15 device smoke test passes.~~ Passed on iPhone XR / iOS 15.4.1.
4. The karaoke follow-up build (patch 9) succeeds on macOS and the fixes in all
   three patch-9 tables pass on the iPhone.
5. `npm test` is re-run on a non-Windows environment (or the five failures are
   confirmed as pre-existing environment issues).

## Karaoke follow-up (patch 9)

Three issues were reported on the iPhone XR / iOS 15.4.1 after the sync smoke
test; moving the seek row was part of the layout fix:

| Symptom | Cause | Fix |
| --- | --- | --- |
| The cover art sat under the notch. | `.tv-side` was top-aligned with a fixed `24px` mobile padding; the safe-area inset was not used. | `mobile/mobile.css` now pads the karaoke layout by `--safe-top`, and the close/settings controls use the same inset. |
| The seek bar took space in the control column. | `.tvk-progress-row` was the last item in `.tv-side`. | On phones it is absolutely positioned at `--safe-bottom`; the freed space lets the cover and controls sit lower. |
| The karaoke volume bar did not change the music. | iOS ignores `HTMLMediaElement.volume`; `mobile-ui.js` only muted. | `MurielVolumePlugin` (`MPVolumeView` + `AVAudioSession.outputVolume` KVO) moves the system volume and reports hardware-button changes back to the page. |
| Sliders only dragged by the knob. | iOS starts a range drag only on the thumb. | `enableRangeDragAnywhere()` maps touches anywhere on the enhanced range inputs to values and dispatches `input`/`change`; `touch-action: none` keeps the gesture on the bar. EQ and theme-hue sliders stay excluded. |

A second iPhone pass on that build found four more problems (the first three are
fixed in the same cumulative patch 9):

| Symptom | Cause | Fix |
| --- | --- | --- |
| The karaoke seek stopped following the finger as soon as it moved above or below the bar. | `enableRangeDragAnywhere()` listened for `pointermove`/`pointerup` on the input and used `setPointerCapture`; iOS stopped reporting once the touch left the control. | Finger drags now use `touchstart` on the input plus `touchmove`/`touchend`/`touchcancel` on `window`; pen drags use the equivalent pointer events on `window`. The value is clamped to `min`/`max`, so dragging past either end reaches the exact end value. |
| Settings bars could not reliably reach `0`, `20`, or `30`. | Same input-scoped tracking: the value froze when the finger slid off the bar instead of continuing to the minimum. | Covered by the window-level drag controller above. |
| "Word" was the default lyrics mode but no words appeared; only "Line" showed text. | The default word style is the gradient fill, whose "unsung" colour is a `color-mix()` fallback. iOS 15.4 has no `color-mix()`, so `background-image` became invalid while the text stayed transparent. | The existing `@supports not (color: color-mix(...))` block in `styles.css` now gives `.lyric-fill` a solid `--lyric-unsung` (`--md-sys-color-outline`), so Word lyrics render on iOS 15. |

The lock-screen elapsed/duration display (`0:01` / `0:00`, full bar, seeking only
after tapping the bar or pause/play) is the iOS Now Playing behaviour tracked
upstream in `cloverscripts/riff-muriel#26`; no further change was made in this
pass and it remains a known limitation.

## Third iPhone pass (patch 9, cumulative)

The next iPhone XR / iOS 15.4.1 pass confirmed the off-bar dragging, slider
minimums and Word lyrics. It raised four more issues, all fixed in the same
cumulative patch 9:

| Symptom | Cause | Fix |
| --- | --- | --- |
| The karaoke seek bar faded out while a finger was still holding it (seeking itself worked). | `.tv-karaoke.tv-idle .tvk-progress-row` fades to `opacity: 0`, and the idle timer was only reset by `mousemove`, which touch devices do not fire. | The karaoke overlay resets the timer on `touchstart`/`touchmove`/`pointerdown`/`pointermove`, the seek slider resets it on `pointerdown`/`input`, and the idle timeout is deferred while `tvkSeekDragging` is true. |
| The visualizer never appeared in karaoke or any other phone view. | The audible element deliberately stays outside Web Audio for background playback, so there was no analyser; phone CSS also hid every visualizer container. | `mobile/mobile-ui.js` now runs a hidden mirror `<audio>` into an `AnalyserNode` (gain 0, never audible) using the CORS-friendly proxy/local URL, only while the now-playing sheet or karaoke is open and the app is foreground. A guard detects iOS pausing the real element, stops the mirror and restarts the song; when the analyser has no signal it draws a gentle synthetic spectrum so the bars are never a flat line. The compact visualizer is shown in the now-playing sheet, and karaoke shows its wave with lyrics by default on phones. |
| Some home-page rows scrolled vertically. | `overflow-x: auto` also makes the row a vertical scroll container, so it could catch the page scroll. | `overflow-y: hidden` on `.fy-row`, `.home-pl-row`, `.sp-row` and `.search-albums-row`; `.sp-row` also gets `2px` top padding so its hover lift is not clipped (the CSS half of upstream PR #44). |
| The cover-brightness, text-opacity, interface-opacity, font-scale and corner-radius settings lagged while dragging. | Every `input` wrote a `:root` custom property (a whole-document style invalidation) and called `localStorage`, `refreshCachedThemeColors()` (forced `getComputedStyle`) or `updateEngineWidthVar()` (forced layout). | Values are applied at most once per animation frame, the label stays live, and storage plus the expensive layout/theme refresh run on `change` (finger release). |

The native plugin is registered in `capacitorDidLoad`, so `npx cap sync ios` must
run before the Xcode build. All of these changes are covered by
`0009-fix-karaoke-notch-volume-and-slider-drag.patch`.
