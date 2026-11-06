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
   `allowScripts` policy and add `npm run check:ios15`.
5. `0005-add-ios15-compat-checker.patch` — add
   `tools/check-ios15-compat.mjs`.
6. `0006-gate-ios-workflows.patch` — add the manual iOS 15 IPA workflow and gate
   the release workflow.
7. `0007-document-ios15-port.patch` — add `LEGACY_IOS.md`.
8. `0008-pin-patch-line-endings.patch` — add `.gitattributes` so the series
   stays LF-only on Windows.
9. `0009-fix-karaoke-notch-volume-and-slider-drag.patch` — keep the fullscreen
   karaoke page clear of the notch, put its seek bar at the bottom, make the
   volume bars drive the iOS system volume (`MurielVolumePlugin`), and let every
   range slider be dragged from anywhere on the bar.

The patch files live on the iOS 15 branch, not on `upstream/main`, so copy them
out of the repository **before** switching branches:

```bash
# 1. copy the series somewhere outside the work tree
git archive HEAD patches/ios15 | tar -x -C "$TEMP"

# 2. start the sync branch from upstream
git switch -c sync/upstream-<commit> upstream/main

# 3. apply the copied series
for patch in "$TEMP"/patches/ios15/000*.patch; do
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
- Do not merge the sync branch into `main` until the macOS GitHub Actions build
  and an iOS 15 device smoke test pass.
