# iOS 15 compatibility port

This repository keeps Muriel playable on **iOS 15.0+** while tracking the upstream
[`cloverscripts/riff-muriel`](https://github.com/cloverscripts/riff-muriel) source.

## Upstream lineage

- The original working copy was based on upstream commit `00e221d` (package `1.3.5`).
- The current sync branch tracks upstream `main` at `2df82f5` (package `1.3.10`, 2026-11-01).
- The native iOS delta between those two upstream commits is small: `AppDelegate.swift`
  gained the audio-interruption plugin, and the app/widget deployment targets were raised
  to iOS 16.2. Everything else in the delta is shared web/desktop code.

## Compatibility policy

- The **app target and project defaults stay at iOS 15.0**.
- The **`MurielWidgets` Live Activity extension stays at iOS 16.2**. iOS 15 users keep
  normal lock-screen media controls; the Dynamic Island / Live Activity is unavailable.
- The mobile bundle is built for **Safari 15**, not Safari 16.
- Web APIs newer than iOS 15.0 are feature-checked or replaced with fallbacks. iOS 15.0,
  15.1, 15.2 and 15.3 are all in scope, so Safari 15.4 additions count as incompatible.
- `NSSupportsLiveActivities` remains in the app plist; it is ignored by iOS 15.

### Known iOS 15 visual caveats

These features are progressively enhanced and do not crash, but may render differently on
iOS 15.0-15.3:

- `:has()` selectors are dropped before Safari 15.4.
- `@property` rules are ignored before Safari 16.4.
- `color-mix()` needs the existing `@supports not (...)` fallback before Safari 16.2.
- `CompressionStream` / `DecompressionStream` fall back to uncompressed data before 16.4.
- `structuredClone`, `Object.hasOwn`, `Array.prototype.at` and similar 15.4 APIs must not
  be introduced without a guard.

## Downstream changes in this fork

The reusable patch series is in [`patches/ios15`](patches/ios15/README.md):

1. Pin the app/project deployment target to 15.0 while leaving the widget at 16.2.
2. Build the mobile web bundle for Safari 15.
3. Guard `AbortSignal.timeout` in the Google library import.
4. Preserve the local `allowScripts` npm policy and add the `check:ios15` script.
5. Add `tools/check-ios15-compat.mjs`, a cross-platform static compatibility gate.
6. Add and harden the iOS 15 IPA workflows.
7. Document the port and the sync procedure.

## Building an IPA with GitHub Actions

`.github/workflows/build-ios15-ipa.yml` is a manual GitHub-hosted macOS build:

1. Install dependencies and run the iOS 15 static gate.
2. Build `www/` with `node mobile/build.mjs`.
3. Run `npx cap sync ios`.
4. Re-run the static gate to catch a Capacitor rewrite.
5. Compile unsigned with `xcodebuild`.
6. Verify the app's `MinimumOSVersion` is `15.0`, the widget's is `16.2`, and the app
   binary's `LC_BUILD_VERSION minos` is `15.0`.
7. Upload `Muriel-iOS15.ipa` as the `Muriel-iOS15-IPA` artifact.

The upstream-style `.github/workflows/ios.yml` release workflow runs the same checks, so a
future sync cannot silently publish an iOS 16.2-only build.

## Verifying locally

```bash
npm ci
npm run check:ios15
node mobile/build.mjs
npm test
```

`npx cap sync ios` and `xcodebuild` require macOS with Xcode. The static gate, web bundle
and Node test suite run on Windows/Linux.

## Syncing a new upstream release

```bash
git fetch upstream --tags

# the patch series lives on the iOS 15 branch, so copy it out before switching
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

Then run the GitHub Actions **Build iOS 15 IPA** workflow. Only merge the sync branch into
`main` after the macOS build and an iOS 15 device smoke test pass.

## Remaining validation

This working environment has no Xcode or Apple iOS SDK. The following still require a Mac:

- `xcodebuild` compilation against the iOS SDK.
- Verification of the built app/widget plists and `LC_BUILD_VERSION`.
- Device testing on iOS 15.0-15.3: background audio, lock-screen controls, interruption
  resume, downloads, deep links, and settings layout around `:has()` rules.
