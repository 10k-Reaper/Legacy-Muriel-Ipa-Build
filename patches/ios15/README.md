# iOS 15 patch series

These patches are generated against upstream `cloverscripts/riff-muriel` commit
`2df82f5` (package `1.3.10`, 2026-11-01). They carry only the downstream iOS 15
compatibility work; every other file comes straight from upstream.

## Apply order

Apply with `git apply --3way` from the repository root, in this order:

1. `0001-pin-ios15-deployment-target.patch` — app/project deployment target 15.0;
   `MurielWidgets` stays at 16.2.
2. `0002-use-safari15-web-target.patch` — esbuild target `safari15`.
3. `0003-guard-abortsignal-timeout.patch` — feature-check `AbortSignal.timeout`
   in the Google library import.
4. `0004-preserve-allowscripts-and-check-script.patch` — keep the local
   `allowScripts` policy, add `npm run check:ios15`, and drop the unused
   `@capacitor/android` dev dependency.
5. `0005-add-ios15-compat-checker.patch` — add
   `tools/check-ios15-compat.mjs`.
6. `0006-gate-ios-workflows.patch` — add the manual iOS 15 IPA workflow and add
   the iOS 15 compatibility/version checks to the rolling iOS workflow.
7. `0007-document-ios15-port.patch` — add `LEGACY_IOS.md` and replace the
   upstream README with the fork's iOS 15 README (downloads, TrollStore and
   Sideloadly/AltStore/SideStore instructions, and release details).
8. `0008-pin-patch-line-endings.patch` — add `.gitattributes` so the series
   stays LF-only on Windows.
9. `0009-fix-karaoke-notch-volume-and-slider-drag.patch` — keep the fullscreen
   karaoke page clear of the notch, put its seek bar at the bottom, make the
   volume bars drive the iOS system volume (`MurielVolumePlugin`), let every
   range slider be dragged from anywhere on (or off) the bar, keep Word lyrics
   visible on iOS 15 without `color-mix()`, keep the karaoke seek row on screen
   while it is being held, give the phone a real analyser through a silent
   mirror element (with a synthetic wave if iOS refuses it), stop home-page
   rows from scrolling vertically (PR #44's CSS), and apply the laggy
   appearance sliders once per frame (storage on release). The fourth device
   pass adds a `CanvasRenderingContext2D.roundRect()` polyfill (Safari 16.4+)
   so the visualizer actually draws on iOS 15, keeps Now Playing lyrics from
   panning sideways, and makes "Your genres" a horizontal row. The fifth device
   pass restores the karaoke visualizer settings (no forced wave), makes the
   with-lyrics wave a full-width band at the bottom, stops the Queue scrolling
   sideways, and replaces the sheet's reuse of the reorder-row `is-dragging`
   class (which could leave the whole sheet untappable) with `np-dragging`.
   The sixth device pass stops Queue/Favorites covers from replaying their fade
   on every virtualised row rebuild, lets a touch scroll the Favorites list
   instead of being captured by the reorder/menu long-press, turns the Favorites
   header into a sticky auto-hiding toolbar (search, sort-arrow dropdown, `...`
   menu for Select/Download all), and reduces the playlist header to Play,
   Shuffle, Share (with Export JSON), icon-only Download all, Like all, a `...`
   menu (Select, duplicates, manual/sort order) and Delete, with rename moved to
   a tap on the playlist name. This patch now includes `index.html`. The seventh
   device pass makes the virtualised lists reuse their row elements while
   scrolling (covers are no longer rebuilt and reloaded) and turns the playlist
   "Like all" heart into an add/remove toggle with a confirmation dialog. The
   eighth device pass fills the gap left by a fast fling with Muriel-styled ghost
   song rows until the real rows render.
10. `0010-publish-ios15-releases-and-remove-unused-platforms.patch` — turn the
    tag-triggered release workflow into a versioned iOS 15 IPA release (with a
    SHA-256 checksum, SideStore source and notes rendered from
    `.github/release-notes-ios.md`), publish checksums in the rolling iOS
    release, and remove the Android project, the Android/Windows/Rust CI
    workflows and the Nix files. The shared desktop source and Electron dev
    dependencies stay so tests and upstream syncs keep working.

The patch files live on the iOS 15 branch, not on `upstream/main`, so copy them
out of the repository **before** switching branches:

```bash
# 1. copy the series somewhere outside the work tree
git archive HEAD patches/ios15 | tar -x -C "$TEMP"

# 2. start the sync branch from upstream
git switch -c sync/upstream-<commit> upstream/main

# 3. apply the copied series
for patch in "$TEMP"/patches/ios15/[0-9]*.patch; do
  git apply --3way "$patch"
done

npm ci
npm run check:ios15
node mobile/build.mjs
npm test
```

On Windows, use `git apply --3way --ignore-whitespace` if the patch files were
checked out with CRLF endings. The `.gitattributes` entry keeps them LF in this
repository.

## Notes

- Patches 1–3 may need a refresh if upstream changes the same lines. `--3way`
  usually resolves that; re-run `npm run check:ios15` afterwards.
- Patch 5 is the source of truth for the compatibility rules. Extend it when a
  new iOS 16+ API or Safari 15.4+ CSS feature enters the upstream code.
- Patch 9 adds a native plugin, so `npx cap sync ios` must run after the patches
  are applied and before the Xcode build.
- Patch 10 removes files (including binary Android assets), so use the
  `git apply --3way` loop above. The loop matches `[0-9]*.patch`, which includes
  `0010` and any later patch.
- Do not merge the sync branch into `main` until the macOS GitHub Actions build
  and an iOS 15 device smoke test pass.
