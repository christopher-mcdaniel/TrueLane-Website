/* The desk video in a desktop monitor (dscreen.css). Click the monitor in the page and its clip grows out of it into a large monitor, then shrinks back on close.
   The same behaviour as the phones on the app page (vslot.js), for landscape footage: the grow is one uniform scale plus a move (the large screen has the clip's own shape, so
   nothing stretches), run on the compositor; the monitor's body and stand fade in as it grows. A second <video> in the large monitor takes over from the page's clip, with sound
   and our own controls (play, seek, time, mute, volume) built from page elements, because the browser's native controls keep Esc and Tab to themselves once focused; the page's
   own clip stays muted and pauses meanwhile. Esc, the Close button or a click outside the monitor closes it. Focus is held inside while open and goes back afterwards.
   The page does not scroll behind it. With prefers-reduced-motion the monitor simply appears. Same-origin only: no network calls, no libraries. */
(function () {
  'use strict';
  var dlg = document.getElementById('dscreen');
  if (!dlg) return;
  var device = dlg.querySelector('.dscreen-device');
  var chrome = dlg.querySelector('.dscreen-chrome');
  var screen = dlg.querySelector('.dscreen-screen');
  var backdrop = dlg.querySelector('.dscreen-backdrop');
  var closeBtn = dlg.querySelector('.dscreen-close');
  var video = dlg.querySelector('video');
  var bar = dlg.querySelector('.dscreen-bar');
  var playBtn = dlg.querySelector('.dscreen-play');
  var seek = dlg.querySelector('.dscreen-seek');
  var timeEl = dlg.querySelector('.dscreen-time');
  var muteBtn = dlg.querySelector('.dscreen-mute');
  var volume = dlg.querySelector('.dscreen-volume');
  var DURATION = 460;
  var EASE = 'cubic-bezier(0.3, 0, 0.15, 1)';
  var state = null;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function canAnimate() {
    return !reduced() && typeof device.animate === 'function';
  }

  // ---- phones: no monitor. The clip opens full screen (a landscape clip needs the phone turned sideways), checked each time it is opened.
  var PHONE_QUERY = '(max-width: 640px), (pointer: coarse) and (max-width: 900px)';
  function isPhone() {
    return !!(window.matchMedia && window.matchMedia(PHONE_QUERY).matches);
  }
  // iPhone Safari cannot make a page element full screen, only a video, and it has its own player for that (it turns with the phone).
  function videoOnlyFullscreen() {
    return typeof video.webkitEnterFullscreen === 'function' && !dlg.requestFullscreen && !dlg.webkitRequestFullscreen;
  }
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function enterPhoneFullscreen() {
    if (videoOnlyFullscreen()) {
      var go = function () {
        try {
          video.webkitEnterFullscreen();
        } catch (e) {
          /* the black player in the page stays, with its own controls */
        }
      };
      video.addEventListener(
        'webkitendfullscreen',
        function () {
          if (state && !state.closing) close();
        },
        { once: true }
      );
      if (video.readyState >= 1) go();
      else video.addEventListener('loadedmetadata', go, { once: true });
      return;
    }
    var request = dlg.requestFullscreen || dlg.webkitRequestFullscreen;
    if (!request) return; // no full screen here: the black player fills the page
    var asked;
    try {
      asked = request.call(dlg);
    } catch (e) {
      return;
    }
    if (asked && asked.then) {
      asked.then(
        function () {
          if (!state) return;
          state.fullscreen = true;
          try {
            var locked = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape');
            if (locked && locked.catch) locked.catch(function () {});
          } catch (e) {
            /* turning is left to the person */
          }
        },
        function () {}
      );
    } else if (state) state.fullscreen = true;
  }
  function leavePhoneFullscreen() {
    try {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
    } catch (e) {
      /* nothing was locked */
    }
    if (fsElement()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        var left = exit.call(document);
        if (left && left.catch) left.catch(function () {});
      }
    }
  }
  // leaving full screen with the phone's own gesture closes the viewer too
  function onFullscreenChange() {
    if (state && state.phone && state.fullscreen && !fsElement() && !state.closing) close();
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ---- the page's own clip plays muted and loops while it is in view
  var slots = Array.prototype.slice.call(document.querySelectorAll('.dslot'));
  var io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              var v = en.target.querySelector('video');
              if (!v || state) return;
              if (en.isIntersecting) {
                var p = v.play();
                if (p && p.catch) p.catch(function () {});
              } else v.pause();
            });
          },
          { threshold: 0.5 }
        )
      : null;
  slots.forEach(function (s) {
    // on a phone the page's clip stays on its poster until it is tapped: it is 8 MB
    if (io && !isPhone()) io.observe(s);
  });

  // ---- the controls (page elements, so Esc and Tab always reach the page)
  var ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  var ICON_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
  var ICON_MUTED = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3z"/><path d="M16.2 9.7l4.6 4.6M20.8 9.7l-4.6 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function clock(t) {
    t = Math.max(0, Math.floor(t || 0));
    return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);
  }
  var seeking = false;
  function paintControls() {
    var playing = !video.paused && !video.ended;
    playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : video.ended ? 'Replay' : 'Play');
    muteBtn.innerHTML = video.muted ? ICON_MUTED : ICON_SOUND;
    muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    volume.value = String(video.muted ? 0 : Math.round(video.volume * 100));
    var d = video.duration;
    if (!seeking && d > 0) seek.value = String(Math.round((video.currentTime / d) * 1000));
    timeEl.textContent = clock(video.currentTime) + (d > 0 ? ' / ' + clock(d) : '');
  }
  function togglePlay() {
    if (video.ended) video.currentTime = 0;
    if (video.paused || video.ended) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    } else video.pause();
  }
  ['timeupdate', 'play', 'pause', 'ended', 'volumechange', 'loadedmetadata', 'durationchange'].forEach(function (name) {
    video.addEventListener(name, paintControls);
  });
  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  muteBtn.addEventListener('click', function () {
    if (video.muted && video.volume === 0) video.volume = 0.5;
    video.muted = !video.muted;
  });
  volume.addEventListener('input', function () {
    var v = Number(volume.value) / 100;
    video.volume = v;
    video.muted = v === 0;
  });
  seek.addEventListener('input', function () {
    seeking = true;
    if (video.duration > 0) video.currentTime = (Number(seek.value) / 1000) * video.duration;
    paintControls();
  });
  seek.addEventListener('change', function () {
    seeking = false;
  });

  // ---- the page behind: no scrolling, no focus, no screen-reader reach
  function lockPage() {
    var html = document.documentElement;
    var gutter = window.innerWidth - html.clientWidth;
    state.htmlOverflow = html.style.overflow;
    state.htmlPadding = html.style.paddingRight;
    html.style.overflow = 'hidden';
    if (gutter > 0) html.style.paddingRight = gutter + 'px';
    state.inerted = [];
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === dlg || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hasAttribute('inert')) return;
      el.setAttribute('inert', '');
      state.inerted.push(el);
    });
  }
  function unlockPage() {
    var html = document.documentElement;
    html.style.overflow = state.htmlOverflow;
    html.style.paddingRight = state.htmlPadding;
    state.inerted.forEach(function (el) {
      el.removeAttribute('inert');
    });
  }

  // ---- the grow
  function animations(slotScreen, reverse) {
    var from = slotScreen.getBoundingClientRect();
    var sr = screen.getBoundingClientRect();
    var dr = device.getBoundingClientRect();
    var scale = from.width / sr.width;
    var dx = from.left + from.width / 2 - (sr.left + sr.width / 2);
    var dy = from.top + from.height / 2 - (sr.top + sr.height / 2);
    device.style.transformOrigin = sr.left + sr.width / 2 - dr.left + 'px ' + (sr.top + sr.height / 2 - dr.top) + 'px';
    var small = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
    function frames(a, b) {
      return reverse ? [b, a] : [a, b];
    }
    var opts = { duration: reverse ? 380 : DURATION, easing: EASE, fill: 'both' };
    return [
      device.animate(frames({ transform: small }, { transform: 'none' }), opts),
      chrome.animate(reverse ? [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], opts),
      backdrop.animate(frames({ opacity: 0 }, { opacity: 1 }), opts),
      closeBtn.animate(frames({ opacity: 0 }, { opacity: 1 }), opts),
      bar.animate(frames({ opacity: 0 }, { opacity: 1 }), opts)
    ];
  }
  function cancelAll(list) {
    list.forEach(function (a) {
      a.cancel();
    });
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    return r.height > 0 && visible >= r.height * 0.5;
  }

  function open(opener) {
    if (state) return;
    var slot = opener.closest('.dslot');
    var slotVideo = slot && slot.querySelector('video');
    var slotScreen = slot && slot.querySelector('.dmon-screen');
    if (!slotVideo || !slotScreen) return;
    state = { opener: opener, slot: slot, slotScreen: slotScreen, slotVideo: slotVideo, anims: [], closing: false, phone: isPhone(), fullscreen: false };
    if (state.phone) dlg.classList.add('is-phone');
    dlg.setAttribute('aria-label', 'Video: ' + (slot.getAttribute('data-title') || 'TrueLane'));
    lockPage();
    dlg.hidden = false;

    // The large monitor's own video picks up where the page's clip is, with sound.
    var source = slotVideo.currentSrc || (slotVideo.querySelector('source') || {}).src || '';
    var at = slotVideo.currentTime || 0;
    video.setAttribute('poster', slotVideo.getAttribute('poster') || '');
    if (video.getAttribute('src') !== source) video.setAttribute('src', source);
    video.muted = false;
    video.volume = 1;
    function seekToSlot() {
      try {
        video.currentTime = at;
      } catch (e) {
        /* not seekable yet: it starts from the beginning */
      }
    }
    if (video.readyState >= 1) seekToSlot();
    else video.addEventListener('loadedmetadata', seekToSlot, { once: true });
    var played = video.play();
    if (played && played.catch) played.catch(function () {});
    slotVideo.pause();
    paintControls();

    closeBtn.focus({ preventScroll: true });
    if (state.phone) enterPhoneFullscreen();
    else if (canAnimate()) state.anims = animations(slotScreen, false);
  }

  function close() {
    if (!state || state.closing) return;
    var st = state;
    st.closing = true;
    var at = video.currentTime || 0;
    function finish() {
      cancelAll(st.anims);
      device.style.transformOrigin = '';
      dlg.hidden = true;
      dlg.classList.remove('is-phone');
      video.pause();
      unlockPage();
      try {
        st.slotVideo.currentTime = at;
      } catch (e) {
        /* leave the page's clip where it was */
      }
      if (inView(st.slot)) {
        var p = st.slotVideo.play();
        if (p && p.catch) p.catch(function () {});
      }
      st.opener.focus({ preventScroll: true });
      state = null;
    }
    cancelAll(st.anims);
    if (st.phone) {
      st.fullscreen = false;
      leavePhoneFullscreen();
      finish();
      return;
    }
    if (!canAnimate()) {
      finish();
      return;
    }
    st.anims = animations(st.slotScreen, true);
    Promise.all(
      st.anims.map(function (a) {
        return a.finished;
      })
    ).then(finish, function () {});
  }

  // ---- how it is asked for and put away
  document.addEventListener('click', function (e) {
    var opener = e.target.closest && e.target.closest('.dslot-open');
    if (opener) {
      e.preventDefault();
      open(opener);
    }
  });
  closeBtn.addEventListener('click', close);
  // Is the click inside the monitor, the Close button or the controls bar? Asked of the path the click took when it was made, not of e.target:
  // pressing mute swaps the icon inside the button, so by the time this runs the icon that was clicked is no longer in the page.
  function insideControls(e) {
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n && n.classList && (n.classList.contains('dscreen-device') || n.classList.contains('dscreen-close') || n.classList.contains('dscreen-bar'))) return true;
    }
    return false;
  }
  dlg.addEventListener('click', function (e) {
    if (!state) return;
    if (insideControls(e)) return;
    close();
  });
  document.addEventListener('keydown', function (e) {
    if (!state) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var stops = Array.prototype.slice.call(dlg.querySelectorAll('button, input')); // in page order
    var i = stops.indexOf(document.activeElement);
    if (i === -1) {
      e.preventDefault();
      stops[0].focus();
    } else if (e.shiftKey && i === 0) {
      e.preventDefault();
      stops[stops.length - 1].focus();
    } else if (!e.shiftKey && i === stops.length - 1) {
      e.preventDefault();
      stops[0].focus();
    }
  });
})();
