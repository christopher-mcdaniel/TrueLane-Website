/* Phone helpers (mobile.css). Same-origin, no libraries, nothing is sent anywhere except what a visitor submits themselves.
   1. Fold toggles: every .m-fold block gets a button in front of it. On a phone the block stays hidden until the button is tapped;
      above 640px the buttons are hidden by mobile.css and the blocks are always shown. Without this script nothing is hidden (the html.js class that hides them is set below).
   2. "Send this page to my computer": the phone's share sheet, or an email with the page's address when there is none.
   3. The app page's invite form in the hero: posts the same fields as the form at the bottom of the page. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  // ---- 1. folds
  var folds = document.querySelectorAll('.m-fold');
  Array.prototype.forEach.call(folds, function (fold, i) {
    var more = fold.getAttribute('data-more') || 'More';
    var less = fold.getAttribute('data-less') || 'Show less';
    if (!fold.id) fold.id = 'm-fold-' + i;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-toggle';
    btn.setAttribute('aria-controls', fold.id);
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = more;
    btn.addEventListener('click', function () {
      var open = fold.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? less : more;
    });
    fold.parentNode.insertBefore(btn, fold);
  });
  // a link to something inside a folded block (for example #start) opens the block first
  function openFoldFor(hash) {
    if (!hash || hash.length < 2) return;
    var target = document.getElementById(hash.slice(1));
    var fold = target && target.closest ? target.closest('.m-fold') : null;
    if (fold && !fold.classList.contains('is-open')) {
      var btn = fold.previousElementSibling;
      if (btn && btn.classList.contains('m-toggle')) btn.click();
    }
  }
  window.addEventListener('hashchange', function () {
    openFoldFor(location.hash);
  });
  openFoldFor(location.hash);

  // ---- 2. share
  Array.prototype.forEach.call(document.querySelectorAll('.m-share'), function (btn) {
    btn.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {
          /* closed without sharing: nothing to do */
        });
      } else {
        location.href = 'mailto:?subject=' + encodeURIComponent(document.title) + '&body=' + encodeURIComponent(url);
      }
    });
  });

  // ---- 3. the hero invite form
  Array.prototype.forEach.call(document.querySelectorAll('.m-beta'), function (form) {
    var status = form.querySelector('.form-status');
    var btn = form.querySelector('button[type=submit]');
    function show(msg, cls) {
      status.hidden = false;
      status.textContent = msg;
      status.className = 'form-status ' + cls;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (r.ok) {
            form.reset();
            show('Got it. You’re on the list. We’ll send a TestFlight invite shortly.', 'ok');
          } else {
            show('That didn’t send. Email hello@usetruelane.com and we’ll add you.', 'err');
          }
        })
        .catch(function () {
          show('Network hiccup. Email hello@usetruelane.com and we’ll add you.', 'err');
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  });
})();
