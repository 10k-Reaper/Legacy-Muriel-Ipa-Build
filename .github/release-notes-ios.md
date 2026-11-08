Unsigned iOS 15 build of Muriel __VERSION__.

### Download

- **`Muriel.ipa`** — iPhone and iPad, iOS 15.0 or later
- **`Muriel.ipa.sha256`** — SHA-256 checksum
- **`sidestore.json`** — AltStore / SideStore source

### Install

- **TrollStore** — open `Muriel.ipa` in TrollStore on supported firmware/devices. No Apple ID, no 7-day expiry.
- **Sideloadly** — drag `Muriel.ipa` into Sideloadly and sign it with your Apple ID.
- **AltStore / SideStore** — add `sidestore.json` as a source, or open the IPA directly.

Sideloadly, AltStore and SideStore sign the app with your Apple ID. Free Apple IDs need re-signing every 7 days. TrollStore does not use an Apple ID and does not expire.

### What's in this build

- Muriel __VERSION__ with the app and Xcode project targeting **iOS 15.0+**; the widget extension stays at iOS 16.2.
- Mobile bundle built for **Safari 15**, with fallbacks for newer APIs.
- Karaoke fixes: notch-safe layout, bottom seek bar, iOS system volume, sliders draggable from anywhere, Word-lyrics fallback and a `roundRect` polyfill for the visualizer.
- Queue, Now Playing and Favorites fixes: no sideways scrolling, sticky Favorites toolbar, compact playlist header and an add/remove **Like all** toggle.
- Virtualised track lists reuse their rows, so covers no longer blink while scrolling.
- Muriel-styled ghost rows fill the viewport during fast flings until the real rows load.
- Ready-made IPAs are published here, so users no longer need to build the app.

### Verify the download

```bash
shasum -a 256 Muriel.ipa                 # macOS / Linux
certutil -hashfile Muriel.ipa SHA256     # Windows
```

Compare the result with `Muriel.ipa.sha256`.

### Known limitations

- `:has()` and `@property` CSS are unavailable on iOS 15.0–15.3; affected styling degrades gracefully.
- Live Activities and Dynamic Island are unavailable on iOS 15.
- Lock-screen elapsed/duration follows the upstream Now Playing behaviour tracked in cloverscripts/riff-muriel#26.
- This IPA is unsigned. Device testing was done on an iPhone XR running iOS 15.4.1.

### Credits

Muriel is by [cloverscripts](https://github.com/cloverscripts), based on [Riff](https://github.com/rootscripts/riff) by rootscripts. Both are MIT-licensed. This is an independent, non-commercial iOS 15 fork and is not affiliated with or supported by the upstream project.
