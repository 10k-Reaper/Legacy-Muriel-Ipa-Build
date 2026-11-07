// iOS layout behaviour on top of app.js: mini player <-> now-playing sheet, swipe to dismiss,
// and the progress line on the mini player.

// Background playback: iOS suspends Web Audio when the app is backgrounded or the screen locks,
// but keeps a plain <audio> element playing (and on the lock screen). So on iPhone the engine never
// routes the audible element through an AudioContext. Speed/pitch still work (they're element properties);
// EQ, reverb and distortion need the graph and stay off. The visualizer gets its data from a second,
// silent element instead (see the module below). app.js builds the engine on DOMContentLoaded, which
// hasn't fired yet when this script runs.
(() => {
  // desktop's default text scale (1.25x) is sized for a monitor; phones start at 1.0x unless the user picked one
  if (!localStorage.getItem('muriel_font_scale')) localStorage.setItem('muriel_font_scale', '80');
  // the phone can draw a visualizer now, so show it with lyrics too unless the user turned it off
  if (!localStorage.getItem('muriel_tvk_visualizer_lyrics')) localStorage.setItem('muriel_tvk_visualizer_lyrics', 'true');
  const Engine = window.MurielAudioEngine;
  if (!Engine) return;
  Engine.prototype.init = function (audioElement) { this.__element = audioElement || this.__element; };
  // iOS ignores element.volume (hardware buttons own it); mute still works
  Engine.prototype._applyMasterVolume = function () {
    if (this.__element) this.__element.muted = !!this.isMuted || this.volume === 0;
  };
})();

// iPhone: an <audio> element's volume is read-only (the hardware buttons own it), so the volume bars in the
// player and in fullscreen karaoke move the system volume through MurielVolume (MPVolumeView;
// MurielVolumePlugin in ios/App/App/AppDelegate.swift). Changes made with the hardware buttons come back
// as 'volumeChange' and move Muriel's bars with them.
(() => {
  const Cap = window.Capacitor;
  if (!Cap || Cap.getPlatform() !== 'ios' || typeof Cap.registerPlugin !== 'function') return;
  const plugin = Cap.registerPlugin('MurielVolume');
  let lastSet = -1;
  let lastSetAt = 0;
  let dragging = false;
  window.MurielSystemVolume = {
    begin() { dragging = true; },
    end() { dragging = false; },
    set(value) {
      const v = Math.max(0, Math.min(1, Number(value)));
      if (!Number.isFinite(v)) return;
      lastSet = v;
      lastSetAt = Date.now();
      const at = lastSetAt;
      // only ignore the echo of our own write, not a later hardware change to the same level
      setTimeout(() => { if (lastSetAt === at) lastSet = -1; }, 800);
      Promise.resolve(plugin.setVolume({ volume: v })).catch(() => {});
    },
  };
  const adopt = (value, initial) => {
    const v = Number(value);
    if (!Number.isFinite(v) || dragging) return;
    if (lastSet >= 0 && Math.abs(v - lastSet) < 0.02) return;
    // an inactive audio session can report 0 at launch; don't lose the saved level to that
    if (initial && v === 0 && window.MurielCore && Number(window.MurielCore.state.volume) > 0) return;
    if (window.MurielCore && window.MurielCore.setVolume) window.MurielCore.setVolume(v, { keepMute: !!initial });
  };
  Promise.resolve(plugin.addListener('volumeChange', (data) => adopt(data && data.volume, false))).catch(() => {});
  const start = () => {
    lastSet = -1;
    Promise.resolve(plugin.getVolume()).then((r) => adopt(r && r.volume, true)).catch(() => {});
  };
  if (window.MurielCore) start(); else window.addEventListener('muriel:ready', start, { once: true });
})();

// ---- visualizer on iPhone ----
// The audible <audio> element cannot go through Web Audio (iOS would stop it when the screen locks), so a
// hidden second element plays the same song into an AnalyserNode. Its output goes through a gain of 0,
// not through element.muted (a muted element also silences the analyser). The mirror only runs while the
// now-playing sheet or the karaoke page is open and the app is in the foreground, and it is never allowed
// to make a sound if the graph could not be built.
(() => {
  const Engine = window.MurielAudioEngine;
  if (!Engine) return;

  let mirror = null;
  let ctx = null;
  let analyser = null;
  let failed = false;
  let wanted = false;
  let lastPlayAttempt = 0;
  let mirrorStartedAt = 0;
  let mirrorBlocked = false;
  let userPauseAt = 0;

  const mainAudio = () => document.getElementById('native-audio') || document.querySelector('audio:not([data-viz-mirror])');

  function build() {
    if (analyser || failed) return analyser;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { failed = true; return null; }
    try {
      mirror = document.createElement('audio');
      mirror.id = 'muriel-viz-audio';
      mirror.dataset.vizMirror = '1';
      mirror.setAttribute('playsinline', '');
      mirror.setAttribute('aria-hidden', 'true');
      mirror.crossOrigin = 'anonymous';
      mirror.preload = 'none';
      mirror.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(mirror);
      ctx = new AC();
      const source = ctx.createMediaElementSource(mirror);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      const silent = ctx.createGain();
      silent.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silent);
      silent.connect(ctx.destination);
    } catch (e) {
      failed = true;
      analyser = null;
      try { if (mirror && mirror.parentNode) mirror.parentNode.removeChild(mirror); } catch (_) {}
      mirror = null;
    }
    return analyser;
  }

  function tryStartMirror() {
    if (!mirror || !mirror.paused || mirrorBlocked) return;
    if (Date.now() - lastPlayAttempt < 500) return;
    lastPlayAttempt = Date.now();
    mirrorStartedAt = lastPlayAttempt;
    mirror.play().catch(() => {});
  }

  function sync(resetTime) {
    if (!wanted || !analyser || !mirror || mirrorBlocked) return;
    const a = mainAudio();
    if (!a) return;
    // app.js hands over the CORS-friendly proxy URL when the audible element plays a direct stream;
    // '' means the source cannot be mirrored (an hls.js MediaSource blob)
    const hint = window.__murielVizSrc;
    const src = hint === undefined ? (a.currentSrc || a.src) : hint;
    if (!src) {
      if (!mirror.paused) mirror.pause();
      return;
    }
    if (mirror.src !== src) {
      mirror.src = src;
      try { mirror.load(); } catch (e) {}
      resetTime = true;
    }
    if (a.paused) {
      if (!mirror.paused) mirror.pause();
      return;
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    mirror.playbackRate = a.playbackRate || 1;
    if (resetTime || Math.abs((mirror.currentTime || 0) - (a.currentTime || 0)) > 1.5) {
      try { mirror.currentTime = Math.max(0, a.currentTime || 0); } catch (e) {}
    }
    if (mirror.paused && Date.now() - lastPlayAttempt > 500) {
      tryStartMirror();
    }
  }

  function setActive(on) {
    wanted = !!on;
    if (!wanted) {
      if (mirror && !mirror.paused) { try { mirror.pause(); } catch (e) {} }
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
      return;
    }
    if (!build()) return;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    sync(true);
  }

  const audio = mainAudio();
  if (audio) {
    // remember when the app itself pauses the song, so a pause caused by the mirror is not mistaken for it
    const nativePause = audio.pause.bind(audio);
    audio.pause = function (...args) {
      userPauseAt = Date.now();
      return nativePause(...args);
    };
    const follow = () => { if (wanted) sync(true); };
    audio.addEventListener('play', follow);
    audio.addEventListener('playing', follow);
    audio.addEventListener('seeking', follow);
    audio.addEventListener('seeked', follow);
    audio.addEventListener('pause', () => {
      const mirrorWasPlaying = !!(mirror && !mirror.paused);
      if (mirror && !mirror.paused) mirror.pause();
      if (!wanted || mirrorBlocked || !mirrorWasPlaying) return;
      const userPaused = Date.now() - userPauseAt < 400;
      const justStarted = Date.now() - mirrorStartedAt < 1500;
      if (!userPaused && justStarted) {
        // iOS refused the second element. Stop mirroring for this session and restart the real song
        // once app.js has finished reacting to the pause.
        mirrorBlocked = true;
        setTimeout(() => { try { audio.play().catch(() => {}); } catch (e) {} }, 250);
      }
    });
    audio.addEventListener('ratechange', () => { if (mirror) mirror.playbackRate = audio.playbackRate || 1; });
  }

  // a gesture is the only moment iOS lets the AudioContext start
  ['touchstart', 'pointerdown', 'click', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, () => {
      // a context built outside a gesture stays suspended; any later tap is allowed to start it
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      if (wanted) sync(false);
    }, { passive: true, capture: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (mirror && !mirror.paused) { try { mirror.pause(); } catch (e) {} }
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    } else if (wanted) {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      sync(true);
    }
  });

  // the sheet and the karaoke page are the phone screens that draw a visualizer
  const update = () => {
    const karaoke = document.getElementById('tv-karaoke');
    const tvOpen = !!(karaoke && !karaoke.classList.contains('hidden'));
    setActive(document.body.classList.contains('np-open') || tvOpen);
  };
  const watch = (node) => {
    if (!node) return;
    new MutationObserver(update).observe(node, { attributes: true, attributeFilter: ['class'] });
  };
  watch(document.getElementById('right-panel'));
  watch(document.getElementById('tv-karaoke'));
  // np-open is set by another observer on the same panel, so this module cannot rely on seeing the
  // panel's class first: also follow the body class directly
  watch(document.body);
  update();

  let silentSince = 0;
  Engine.prototype.getAnalyserNode = function () { return wanted ? build() : null; };
  Engine.prototype.getFrequencyData = function (buffer) {
    const node = wanted ? build() : null;
    if (!node || !buffer) return;
    node.getByteFrequencyData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) { if (buffer[i] > peak) peak = buffer[i]; }
    const a = mainAudio();
    if (peak > 0 || !a || a.paused) { silentSince = 0; return; }
    // Playing, but the analyser returns nothing: iOS refused the mirror, or the graph has not started
    // yet. Draw a gentle synthetic spectrum so the bars are visible instead of a flat line.
    const now = Date.now();
    if (!silentSince) silentSince = now;
    if (now - silentSince < 900) return;
    const t = now / 1000;
    for (let i = 0; i < buffer.length; i++) {
      const f = i / buffer.length;
      const env = Math.exp(-f * 2.4);
      const w = Math.sin(t * 2.1 + i * 0.55) * 0.5 + Math.sin(t * 3.7 - i * 0.31) * 0.3 + Math.sin(t * 1.3 + i * 0.93) * 0.2;
      buffer[i] = Math.max(0, Math.min(255, (0.45 + 0.4 * w) * 210 * env));
    }
  };
})();

(() => {
  const panel = document.getElementById('right-panel');
  const playbar = document.getElementById('playbar');
  const lyricsBtn = document.getElementById('btn-toggle-lyrics-panel');
  const audio = document.querySelector('audio');
  if (!panel || !playbar || !lyricsBtn) return;

  // app.js owns the drawer state; mirror it onto <body> so the player bar can restyle itself
  const sync = () => document.body.classList.toggle('np-open', !panel.classList.contains('hidden'));
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
  sync();

  const openSheet = () => { if (panel.classList.contains('hidden')) lyricsBtn.click(); };
  const closeSheet = () => { if (!panel.classList.contains('hidden')) document.getElementById('btn-close-right-panel').click(); };

  // tapping the mini player (but not its buttons) opens the sheet
  playbar.addEventListener('click', (e) => {
    if (document.body.classList.contains('np-open')) return;
    if (e.target.closest('button, input, .scrubber-track-container')) return;
    openSheet();
  });

  // swipe down on the sheet's top area to close it
  let startY = null;
  panel.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const lyrics = document.getElementById('lyrics-container');
    // a finger on a seek bar or slider is seeking, not closing the sheet (#21)
    if (e.target.closest('input[type="range"], .scrubber-track-container, [role="slider"]')) { startY = null; return; }
    startY = (lyrics && lyrics.contains(e.target) && lyrics.scrollTop > 0) ? null : t.clientY;
  }, { passive: true });
  // one transform write per frame, and no CSS transition while the finger drags (it lagged behind)
  let dragY = 0, dragRaf = 0;
  panel.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dragY = Math.max(0, e.touches[0].clientY - startY);
    if (dragY > 0 && !panel.classList.contains('is-dragging')) panel.classList.add('is-dragging');
    if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; if (startY !== null) panel.style.transform = dragY > 0 ? `translateY(${dragY}px)` : ''; });
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (startY === null) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
    panel.classList.remove('is-dragging');
    panel.style.transform = '';
    startY = null;
    if (dy > 110) closeSheet();
  });

  // Picked images and videos (background, banner, song covers) are saved as file URLs, and those change when
  // iOS moves the app container (every update or reinstall). Rebuild each saved one from its file name, then
  // delete picks nothing uses any more (every pick is a new copy). Only the background was repaired before,
  // and picking a song cover made even that repair forget the background.
  const fixPickedMedia = async () => {
    const api = window.electronAPI;
    if (!api.fileUrl) return;
    const nameOf = (u) => { const m = typeof u === 'string' && !u.startsWith('blob:') && u.match(/\/backgrounds\/(bg_[\w.-]+)$/); return m ? m[1] : null; };
    const keep = new Set();
    const fresh = async (u) => {
      const name = nameOf(u);
      if (!name) return u;
      const url = await api.fileUrl(`/data/backgrounds/${name}`);
      if (url) keep.add(name);
      return url || u;
    };
    let bgChanged = false;
    for (const key of ['muriel_bg_url', 'muriel_banner_media', 'muriel_app_icon']) {
      const cur = localStorage.getItem(key);
      if (!cur) continue;
      const next = await fresh(cur);
      if (next !== cur) { localStorage.setItem(key, next); if (key === 'muriel_bg_url') bgChanged = true; }
    }
    let artOk = true;
    try {
      const art = JSON.parse(localStorage.getItem('muriel_track_art') || '{}');
      let dirty = false;
      for (const v of Object.values(art)) {
        for (const f of ['cover', 'banner']) {
          if (!v || !v[f]) continue;
          const next = await fresh(v[f]);
          if (next !== v[f]) { v[f] = next; dirty = true; }
        }
      }
      if (dirty) localStorage.setItem('muriel_track_art', JSON.stringify(art));
    } catch (e) { artOk = false; }
    localStorage.removeItem('muriel_bg_vpath');
    if (bgChanged) window.MurielCore.refreshBackground();
    if (artOk && api.pruneMedia) api.pruneMedia(keep);
  };
  if (window.MurielCore) fixPickedMedia(); else window.addEventListener('muriel:ready', fixPickedMedia, { once: true });

  // phones default to word-by-word karaoke (the Line/Word button still switches)
  const preferWordLyrics = () => {
    const st = window.MurielCore && window.MurielCore.state;
    const btn = document.getElementById('btn-lyrics-mode');
    if (st && btn && st.lyricsMode === 'line' && localStorage.getItem('muriel_adv_karaoke_words') !== 'false') btn.click();
  };
  if (window.MurielCore) preferWordLyrics(); else window.addEventListener('muriel:ready', preferWordLyrics, { once: true });

  // lyrics tools (edit / sync / translate / fullscreen) move up next to the Line/Word button,
  // so the lyrics get that row back; same buttons, so their handlers keep working
  const tools = panel.querySelector('.lyrics-header-actions');
  const topRow = panel.querySelector('.right-panel-header-actions');
  if (tools && topRow) { topRow.prepend(tools); tools.classList.add('np-tools-moved'); }

  // like button next to the title in Now Playing (the player bar's heart is hidden on phones);
  // it presses the real one and mirrors its state
  const realFav = document.getElementById('btn-toggle-fav');
  const favIcon = document.getElementById('fav-icon');
  const titleRow = panel.querySelector('.right-panel-title-row');
  if (realFav && favIcon && titleRow) {
    const like = document.createElement('button');
    like.id = 'np-like';
    like.type = 'button';
    like.setAttribute('data-i18n-attr', 'aria-label');
    like.setAttribute('aria-label', 'Like');
    like.innerHTML = favIcon.outerHTML.replace('id="fav-icon"', '');
    const mirror = () => { const on = favIcon.getAttribute('fill') === 'currentColor'; like.classList.toggle('on', on); like.querySelector('svg').setAttribute('fill', on ? 'currentColor' : 'none'); };
    like.addEventListener('click', () => {
      realFav.click();
      like.classList.remove('pop'); void like.offsetWidth; like.classList.add('pop');
      if (navigator.vibrate) navigator.vibrate(12);
    });
    new MutationObserver(mirror).observe(favIcon, { attributes: true, attributeFilter: ['fill'] });
    titleRow.appendChild(like);
    mirror();
  }

  // slowly drifting colour glow behind Now Playing (cover colours, plain gradients: cheap to draw)
  const ambient = document.createElement('div');
  ambient.className = 'np-ambient';
  ambient.innerHTML = '<i></i><i></i><i></i>';
  panel.prepend(ambient);

  // swipe the cover left/right to skip, with the cover following your finger
  const cover = document.getElementById('cover-container');
  if (cover) {
    let x0 = null, y0 = null, dx = 0, horizontal = null;
    cover.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; horizontal = null; cover.style.transition = 'none'; }, { passive: true });
    cover.addEventListener('touchmove', (e) => {
      if (x0 === null) return;
      dx = e.touches[0].clientX - x0;
      const dy = e.touches[0].clientY - y0;
      if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) cover.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    }, { passive: true });
    cover.addEventListener('touchend', () => {
      if (x0 === null) return;
      x0 = null;
      cover.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1), opacity .32s';
      if (horizontal && Math.abs(dx) > 70) {
        const dir = dx < 0 ? -1 : 1;
        cover.style.transform = `translateX(${dir * window.innerWidth}px) rotate(${dir * 12}deg)`;
        cover.style.opacity = '0';
        if (navigator.vibrate) navigator.vibrate(10);
        setTimeout(() => {
          if (dir < 0) document.getElementById('btn-next').click(); else document.getElementById('btn-prev').click();
          cover.style.transition = 'none';
          cover.style.transform = `translateX(${-dir * 60}px)`;
          requestAnimationFrame(() => { cover.style.transition = 'transform .38s cubic-bezier(.2,.8,.2,1), opacity .38s'; cover.style.transform = ''; cover.style.opacity = ''; });
        }, 220);
      } else {
        cover.style.transform = '';
      }
    });
  }

  // mini player progress line
  if (audio) {
    const tick = () => {
      if (document.hidden) return;
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      playbar.style.setProperty('--mini-progress', String(Math.max(0, Math.min(1, p))));
    };
    audio.addEventListener('timeupdate', tick);
    audio.addEventListener('emptied', tick);
    document.addEventListener('visibilitychange', tick);
  }

  // phone-only settings: the song storage limit (Storage → Offline songs) and sharing the error log (About)
  const storageGroup = document.querySelector('.settings-section[data-cat="storage"] .m3-group[data-group="offline"]') || document.querySelector('.settings-section[data-cat="storage"] .m3-group');
  const aboutGroup = document.querySelector('.settings-section[data-cat="about"] .m3-group');
  if (storageGroup) {
    const limits = [['1024', '1 GB'], ['2048', '2 GB'], ['5120', '5 GB'], ['10240', '10 GB']];
    const current = localStorage.getItem('muriel_cache_limit_mb') || '2048';
    const limitRow = document.createElement('div');
    limitRow.className = 'setting-item';
    limitRow.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="setting-name" data-i18n>Song storage limit</span>
          <span style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);" data-i18n>Songs you play are kept for offline use. Over this limit, the ones played longest ago are removed.</span>
        </div>
      </div>
      <div class="theme-mode-toggle" style="margin-top: 10px;">
        ${limits.map(([v, l]) => `<button class="fps-cap-btn${v === current ? ' active' : ''}" data-limit="${v}">${l}</button>`).join('')}
      </div>`;
    limitRow.querySelectorAll('[data-limit]').forEach((b) => b.addEventListener('click', () => {
      localStorage.setItem('muriel_cache_limit_mb', b.dataset.limit);
      limitRow.querySelectorAll('[data-limit]').forEach((x) => x.classList.toggle('active', x === b));
      // a lower limit applies now, not only after the next download
      if (window.MurielCache) window.MurielCache.enforceLimit();
    }));
    const logRow = document.createElement('div');
    logRow.className = 'setting-item';
    logRow.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="setting-name" data-i18n>Share error log</span>
          <span style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);" data-i18n>If something breaks, send this so it can be fixed.</span>
        </div>
        <button class="btn-pill-primary" type="button" data-i18n>Share</button>
      </div>`;
    logRow.querySelector('button').addEventListener('click', async () => {
      const res = await window.electronAPI.shareText('Muriel error log', window.MurielLog ? window.MurielLog.text() : 'no log');
      if (res === 'copied' && window.MurielCore) window.MurielCore.toast((window.MurielI18n || { T: (x) => x, Tm: (x) => x }).Tm('Log copied to clipboard'), 'info');
    });
    storageGroup.append(limitRow);
    if (aboutGroup) aboutGroup.insertBefore(logRow, aboutGroup.lastElementChild); else storageGroup.append(logRow);
  }

  // the desktop placeholder doesn't fit beside the source buttons on a phone
  const searchInput = document.getElementById('search-input');
  if (searchInput) { searchInput.setAttribute('data-i18n-attr', 'placeholder'); searchInput.placeholder = 'Search songs, artists…'; }

  // iPhone: lyrics on the lock screen and in the Dynamic Island (mobile/live-activity.js)
  const trRow = document.getElementById('btn-tr-enabled') && document.getElementById('btn-tr-enabled').closest('.setting-item');
  // the phone's own playback rows go to Tracks → Playback
  const playbackGroup = document.querySelector('.m3-group[data-group="playback"]');
  const addPlaybackRow = (row) => { if (playbackGroup) playbackGroup.append(row); else trRow.parentElement.insertBefore(row, trRow); };
  if (window.MurielLiveActivity && trRow) {
    const la = window.MurielLiveActivity;
    const row = document.createElement('div');
    row.className = 'setting-item';
    row.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="setting-name" data-i18n>Lock screen &amp; Dynamic Island</span>
          <span class="la-hint" style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);" data-i18n>The song, its progress and the line being sung. Long-press the Dynamic Island for play, skip and shuffle (iOS 17).</span>
        </div>
        <button class="effect-switch-btn${la.enabled() ? ' active' : ''}" type="button" aria-label="Lock screen and Dynamic Island" data-i18n-attr="aria-label"><span class="thumb"></span></button>
      </div>`;
    const sw = row.querySelector('button');
    sw.addEventListener('click', () => {
      const on = !sw.classList.contains('active');
      sw.classList.toggle('active', on);
      la.setEnabled(on);
    });
    la.available().then((ok) => {
      if (!ok) row.querySelector('.la-hint').textContent = 'Turn on Live Activities for Muriel in the iPhone Settings app first (needs iOS 16.2 or newer).';
    });
    addPlaybackRow(row);
  }

  // Android: let Muriel off battery optimization so the phone doesn't stop it in the background (media-controls.js)
  if (window.MurielBackground && trRow) {
    const bg = window.MurielBackground;
    const row = document.createElement('div');
    row.className = 'setting-item';
    row.innerHTML = `
      <div class="setting-item-top" style="align-items: center;">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="setting-name" data-i18n>Play in the background</span>
          <span style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);" data-i18n>Some phones stop apps to save battery, even while music plays. Allow Muriel to keep running.</span>
        </div>
        <button class="btn-pill-primary" type="button" data-i18n>Allow</button>
      </div>`;
    const btn = row.querySelector('button');
    const refresh = () => bg.allowed().then((ok) => { btn.textContent = ok ? 'Allowed' : 'Allow'; btn.disabled = ok; });
    btn.addEventListener('click', () => bg.allow().then(refresh));
    // some phones send you to the battery list in Settings instead of asking
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    refresh();
    addPlaybackRow(row);
  }

  // Android: the song in the island at the top of the screen, as an Android 16 live update (media-controls.js).
  // vivo's Origin Island and OPPO's Fluid Cloud only take music apps on their maker's list; a live update they take
  // from any app. Xiaomi's Super Island and Samsung's Now Bar show the playback notification already: no row there.
  if (window.MurielIsland && trRow) {
    const isl = window.MurielIsland;
    isl.status().then((s) => {
      if (!s.vendor || s.vendor === 'xiaomi' || s.vendor === 'samsung' || (!s.supported && s.vendor !== 'vivo')) return;
      const name = { vivo: 'Origin Island', oplus: 'Fluid Cloud' }[s.vendor] || 'Song in the status bar';
      const about = {
        vivo: 'The song in the Origin Island at the top of the screen. vivo’s music capsule only takes apps on vivo’s list, so Muriel shows there as a live update.',
        oplus: 'The song in Fluid Cloud at the top of the screen, as a live update.',
      }[s.vendor] || 'The song as a live update in the status bar.';
      const row = document.createElement('div');
      row.className = 'setting-item';
      row.innerHTML = `
        <div class="setting-item-top" style="align-items: center;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span class="setting-name">${name}</span>
            <span class="island-hint" style="font-size: calc(12px * var(--font-scale, 1)); color: var(--md-sys-color-outline);"></span>
            <button class="btn-pill-primary island-fix" type="button" style="align-self: flex-start; margin-top: 6px; display: none;"></button>
          </div>
          <button class="effect-switch-btn" type="button" aria-label="${name}"><span class="thumb"></span></button>
        </div>`;
      const hint = row.querySelector('.island-hint');
      const fix = row.querySelector('.island-fix');
      const sw = row.querySelector('.effect-switch-btn');
      const show = (st) => {
        if (!st.supported) {
          // OriginOS 5 and older: no live updates yet
          hint.textContent = 'Needs OriginOS 6 (Android 16). vivo’s own music capsule only takes apps on vivo’s list.';
          sw.style.display = 'none';
          return;
        }
        const on = isl.enabled(st);
        sw.classList.toggle('active', on);
        let need = '';
        if (on && !st.notifications) { need = ' Allow Muriel’s notifications for it.'; fix.textContent = 'Allow'; }
        else if (on && !st.promoted) {
          need = st.vendor === 'oplus' ? ' Turn on “Show Live Updates on Live Alerts” for Muriel in the phone’s settings.'
            : ' Live updates are turned off for Muriel in the phone’s settings.';
          fix.textContent = 'Settings';
        }
        hint.textContent = about + need;
        fix.style.display = need ? '' : 'none';
      };
      const refresh = () => isl.status().then(show);
      sw.addEventListener('click', () => {
        const on = !sw.classList.contains('active');
        isl.setEnabled(on);
        // turning it on asks for what's missing right away
        (on ? isl.allow() : isl.status()).then(show);
      });
      fix.addEventListener('click', () => isl.allow().then(show));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); isl.refresh(); } });
      show(s);
      addPlaybackRow(row);
    });
  }

  // settings that only make sense on desktop
  ['btn-hw-accel', 'btn-tray-on-close', 'btn-media-keys'].forEach((id) => {
    const row = document.getElementById(id) && document.getElementById(id).closest('.setting-item');
    if (row) row.style.display = 'none';
  });
})();

// a write to the phone's storage failed (usually: storage full); say so instead of losing it silently
(() => {
  let last = 0;
  window.addEventListener('muriel:storage-error', () => {
    if (Date.now() - last < 30000 || !window.MurielCore || !window.MurielCore.toast) return;
    last = Date.now();
    window.MurielCore.toast((window.MurielI18n || { T: (x) => x, Tm: (x) => x }).Tm('Could not save to storage. Is your phone full?'), 'error');
  });
})();
