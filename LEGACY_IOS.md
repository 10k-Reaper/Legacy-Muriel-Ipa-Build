# iOS 15 compatibility port

This working copy combines the supplied newer Muriel source with the iOS 15 app minimum used by the supplied 1.2.44 IPA. The original IPA and both source archive extractions remain untouched.

## Verified upstream points

- The `v1.2.0` release and iOS workflow run `40186058608` both point to `14d04ff9bf41d8d1f02f7e9a897ccb49da576601`.
- The baseline IPA identifies itself as app version `1.2.44`, build `44`, with app minimum iOS `15.0`. Its embedded lyrics widget has minimum iOS `16.2`.
- The supplied newer source is package version `1.3.5`; its matching IPA is version `1.3.73`, build `73`. The newer app and widget both declare iOS `16.2`.
- The supplied newer source points to upstream commit `00e221d28d20e49123fd5067b5ed8efed9ff91cc`. Commit `59088e78f5c6c39edaa64c5ac55d446ef9056b17` raised the app minimum for newer Live Activity player controls. Activity handling in the app is already guarded at runtime, and the widget can remain an iOS 16.2-only extension while the host app supports iOS 15.

## Compatibility changes in this copy

- The app target and project defaults use iOS `15.0`.
- The `MurielWidgets` extension remains at iOS `16.2`; iOS 15 users keep the music app and its existing lock-screen media controls, while the newer Live Activity remains unavailable there.
- The mobile bridge is built for Safari `15`.
- The Google library fetch uses a timeout signal only when WebKit provides `AbortSignal.timeout`.

## Building an IPA with GitHub Actions

`.github/workflows/build-ios15-ipa.yml` is a manual GitHub-hosted macOS build. Add this project copy to a GitHub repository, ensure the workflow file is present on its default branch, then use **Actions → Build iOS 15 IPA → Run workflow** and select the branch containing this source. The workflow builds without Apple signing, checks that the app minimum is iOS 15.0, and uploads `Muriel-iOS15.ipa` as the `Muriel-iOS15-IPA` artifact for 14 days. It does not publish a GitHub release.

The baseline IPA's readable `Payload/App.app/public` files are preserved separately in `iOS 1.2.44 Web Reference` for comparison. This directory is not part of the app project or its build inputs.

## Source and fork lineage

This is a compatibility working copy of the supplied latest source export, not a Git checkout based on the `v1.2.0` tag. The source export has no `.git` history. The exact 1.2.0 base commit is recorded above so a future GitHub fork can start from that upstream commit and carry these compatibility changes as a downstream branch or patch series. The baseline IPA supplies the original web assets, but not the original Swift project source.

## Remaining validation

This environment does not include Xcode or an Apple iOS SDK, so an iOS build and device-side check must be done on a Mac. No test suite has been run as part of this preparation.
