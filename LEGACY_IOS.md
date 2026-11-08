# iOS 15 compatibility port

This repository keeps Muriel playable on **iOS 15.0+** while tracking the upstream
[`cloverscripts/riff-muriel`](https://github.com/cloverscripts/riff-muriel) source.

## Downloads and installation

Users do not need to build the app. The
[Releases page](https://github.com/10k-Reaper/Legacy-Muriel-Ipa-Build/releases) contains
ready-to-install builds:

- **Versioned releases** (`ios15-v1.3.10`, `ios15-v1.3.11`, ...) are the stable builds. Each
  one has `Muriel.ipa`, `Muriel.ipa.sha256` and `sidestore.json`.
- **`ios-latest`** is a rolling pre-release that follows `main` between versioned builds.

The IPA is unsigned and supports iOS 15.0 and later. It can be installed with:

- **TrollStore** — installs the unsigned IPA permanently on supported firmware/devices,
  with no Apple ID and no 7-day expiration. TrollStore only runs on the iOS versions listed
  in its compatibility chart, so check that first.
- **Sideloadly** — sign the IPA with your Apple ID from a computer.
- **AltStore / SideStore** — sign with your Apple ID and refresh every 7 days on a free
  account. Add the release's `sidestore.json` as a source, or open the IPA directly.

Verify a download with `shasum -a 256 Muriel.ipa` (macOS/Linux) or
`certutil -hashfile Muriel.ipa SHA256` (Windows) and compare it with the published
checksum.

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
4. Preserve the local `allowScripts` npm policy, add the `check:ios15` script, and drop
   the unused `@capacitor/android` dev dependency.
5. Add `tools/check-ios15-compat.mjs`, a cross-platform static compatibility gate.
6. Add and harden the iOS 15 IPA workflows.
7. Document the port and the sync procedure, and replace the upstream README with this
   fork's README.
8. Pin the patch series to LF line endings so `git apply` works on Windows.
9. Carry the iOS 15 UI and playback fixes: karaoke layout and visualizer, system volume,
   sliders, Queue/Now Playing/Favorites/playlist layout, virtualised row updates, reusable
   row elements, and ghost rows for fast flings.
10. Publish versioned IPA releases with checksums, and remove the unused Android project,
    desktop-only CI workflows and Nix files.

## Building an IPA with GitHub Actions

Three workflows produce the same unsigned IPA:

- `.github/workflows/build-ios15-ipa.yml` is a manual branch build. It uploads
  `Muriel-iOS15.ipa` as the `Muriel-iOS15-IPA` artifact.
- `.github/workflows/ios.yml` builds on every push to `main` and publishes the rolling
  `ios-latest` release (`Muriel.ipa`, `Muriel.ipa.sha256` and `sidestore.json`).
- `.github/workflows/release.yml` builds when an `ios15-v*` tag is pushed (or when
  started manually with a version) and publishes `Muriel.ipa`, `Muriel.ipa.sha256` and
  `sidestore.json` to that versioned release.

Every workflow runs the same checks:

1. Install dependencies and run the iOS 15 static gate.
2. Build `www/` with `node mobile/build.mjs`.
3. Run `npx cap sync ios`.
4. Re-run the static gate to catch a Capacitor rewrite.
5. Compile unsigned with `xcodebuild`.
6. Verify the app's `MinimumOSVersion` is `15.0`, the widget's is `16.2`, and the app
   binary's `LC_BUILD_VERSION minos` is `15.0`.
7. Package the app as `Muriel.ipa` and write its SHA-256 checksum.

The rolling and versioned workflows run the same checks, so a future sync cannot silently
publish an iOS 16.2-only build.

### Publishing a versioned release

1. Set the release version in `package.json` (for example `1.3.10`) and merge the branch
   into `main` after the build and device checks pass.
2. Create and push the matching fork tag:

   ```bash
   git tag ios15-v1.3.10
   git push origin ios15-v1.3.10
   ```

3. The **Release** workflow builds the IPA for that tag and attaches `Muriel.ipa`,
   `Muriel.ipa.sha256` and `sidestore.json` to the `ios15-v1.3.10` release. Its release
   notes come from `.github/release-notes-ios.md`, with `__VERSION__` replaced by the tag
   version.

Use the `ios15-v` prefix rather than plain `v1.3.10`. Upstream Muriel already has a
`v1.3.10` tag, and an upstream tag must not trigger this fork's release workflow. Push only
the fork tag; do not run `git push --tags`.

The same workflow can be started from the Actions tab with a version instead of pushing a
tag; it creates the tag itself.

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
for patch in "$TEMP"/patches/ios15/[0-9]*.patch; do
  git apply --3way "$patch"
done

npm ci
npm run check:ios15
node mobile/build.mjs
npm test
```

Then run the GitHub Actions **Build iOS 15 IPA** workflow. Only merge the sync branch into
`main` after the macOS build and an iOS 15 device smoke test pass.

## Validation status

The macOS IPA build, the iOS 15 version assertions and the iPhone XR / iOS 15.4.1 device
passes are recorded in [`SYNC_REPORT.md`](SYNC_REPORT.md). This working environment has no
Xcode or Apple iOS SDK, so the following still require a Mac:

- `xcodebuild` compilation against the iOS SDK.
- Verification of the built app/widget plists and `LC_BUILD_VERSION`.
- Device testing on iOS 15.0-15.3: background audio, lock-screen controls, interruption
  resume, downloads, deep links, and settings layout around `:has()` rules.
