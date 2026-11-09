/* Demo step player. Used on both demonstration pages (solar pipeline, clinic inquiry).
   The page markup is already the finished state of the demo. The player only acts it out:
   - [data-demo] is the frame; [data-demo-list] is the "How the team would use it" list (one <li> per step).
   - Any element with data-demo-step="N" belongs to step N. It is "applied" once the player has reached N.
     data-demo-action says how: enter | stamp | chip | count (CSS-only, via .is-applied),
     swap (text changes; the earlier text is in data-demo-before), flag (also toggles .is-overdue),
     toast (shown only while its own step is current).
   - data-demo-pulse adds a short highlight when the element becomes applied on a forward step.
   Without JS, or on first load, every element shows its final state. Nothing plays until Play is pressed.
   With reduced motion there is no autoplay; the visitor steps through with Previous / Next.
   While a step is current, the cards/rows it changes get .is-active (and the frame .is-focusing, which dims the rest);
   the step panel shows the step dots, its title and the matching explanation from the list. */
(function () {
  'use strict';
  var frame = document.querySelector('[data-demo]');
  var host = frame && frame.querySelector('[data-demo-player]');
  var list = document.querySelector('[data-demo-list]');
  if (!frame || !host || !list || !window.Motion) return;

  var items = Array.prototype.slice.call(list.children);
  var N = items.length;
  var titles = items.map(function (li) { var h = li.querySelector('h3'); return h ? h.textContent.trim() : ''; });
  var explains = items.map(function (li) { var p = li.querySelector('p'); return p ? p.textContent.trim() : ''; });
  var targets = Array.prototype.slice.call(frame.querySelectorAll('[data-demo-step]')).map(function (el) {
    return {
      el: el,
      step: +el.getAttribute('data-demo-step'),
      action: el.getAttribute('data-demo-action') || 'enter',
      finalText: el.textContent,
      before: el.getAttribute('data-demo-before'),
      applied: true
    };
  });

  // Stagger index for siblings that enter together (table rows arriving one by one).
  var seen = {};
  targets.forEach(function (t) {
    var key = t.step + ':' + t.action;
    var i = seen[key] || 0; seen[key] = i + 1;
    t.el.style.setProperty('--demo-i', i);
  });

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var at = N;          // how many steps have been reached
  var touched = false; // false = still showing the whole finished screen
  var playing = false;
  var timer = 0;
  var DELAY = 2800;

  // Units that can be "in focus" while a step is current, and the container that may scroll sideways.
  var units = Array.prototype.slice.call(frame.querySelectorAll('.board__card, .records tbody tr, .demo-summary'));
  var body = frame.querySelector('.demo-frame__body');
  var scrolledFor = 0; // step we last scrolled the change into view for

  /* ---------- controls (built here: without JS they would do nothing) ---------- */
  var dotsHtml = '';
  for (var d = 1; d <= N; d++) dotsHtml += '<span class="demo-player__dot">' + d + '</span>';
  host.innerHTML =
    '<div class="demo-player__controls">' +
      '<button type="button" class="btn btn--primary btn--sm" data-act="play"><span aria-hidden="true" data-glyph>▶</span> <span data-label>Play the walkthrough</span></button>' +
      '<button type="button" class="btn btn--secondary btn--sm" data-act="prev">Previous step</button>' +
      '<button type="button" class="btn btn--secondary btn--sm" data-act="next">Next step</button>' +
      '<button type="button" class="btn btn--secondary btn--sm" data-act="restart">Restart</button>' +
    '</div>' +
    '<div class="demo-player__panel">' +
      '<div class="demo-player__dots" aria-hidden="true">' + dotsHtml + '</div>' +
      '<div class="demo-player__text" aria-live="polite" aria-atomic="true">' +
        '<p class="demo-player__caption" data-caption></p>' +
        '<p class="demo-player__explain" data-explain></p>' +
      '</div>' +
    '</div>';
  var bPlay = host.querySelector('[data-act="play"]');
  var bPrev = host.querySelector('[data-act="prev"]');
  var bNext = host.querySelector('[data-act="next"]');
  var bRestart = host.querySelector('[data-act="restart"]');
  var glyph = bPlay.querySelector('[data-glyph]');
  var label = bPlay.querySelector('[data-label]');
  var caption = host.querySelector('[data-caption]');
  var explain = host.querySelector('[data-explain]');
  var dots = Array.prototype.slice.call(host.querySelectorAll('.demo-player__dot'));

  function setText(t, text) {
    if (t.el.textContent === text) return;
    t.el.textContent = text;
  }

  /* ---------- state -> DOM ---------- */
  function render(forward) {
    targets.forEach(function (t) {
      var on = t.action === 'toast' ? (touched && at === t.step) : t.step <= at;
      var was = t.applied;
      t.applied = on;
      t.el.classList.toggle('is-applied', on);
      if (t.action === 'flag') t.el.classList.toggle('is-overdue', on);
      if (t.action === 'swap' && t.before !== null && on !== was) {
        var el = t.el;
        // Fade the old words out, swap, fade the new ones in (opacity only).
        if (mq.matches) { setText(t, on ? t.finalText : t.before); }
        else {
          el.classList.add('is-swapping');
          window.setTimeout(function () { setText(t, t.applied ? t.finalText : t.before); el.classList.remove('is-swapping'); }, 160);
        }
      }
      if (t.action === 'count' && t.before !== null && on !== was) setText(t, on ? t.finalText : t.before);
      if (on && !was && forward && t.el.hasAttribute('data-demo-pulse') && !mq.matches) pulse(t.el);
    });
    items.forEach(function (li, i) {
      var cur = touched && at === i + 1;
      li.classList.toggle('is-current', cur);
      if (cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    var title = '', why = '';
    if (!touched) title = mq.matches ? 'Use Next step to walk through the week.' : 'Press Play to watch a week in this business, one step at a time.';
    else if (at === 0) title = 'The week starts here. Press Play or Next step.';
    else { title = 'Step ' + at + ' of ' + N + ': ' + titles[at - 1]; why = explains[at - 1]; }
    if (caption.textContent !== title) caption.textContent = title;
    if (explain.textContent !== why) explain.textContent = why;
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-reached', i + 1 <= at);
      dot.classList.toggle('is-current', touched && at === i + 1);
    });
    updateFocus();
    bPrev.setAttribute('aria-disabled', (!touched || at <= 1) ? 'true' : 'false');
    bNext.setAttribute('aria-disabled', (touched && at >= N) ? 'true' : 'false');
    glyph.textContent = playing ? '❚❚' : '▶';
    label.textContent = playing ? 'Pause' : (touched && at >= N ? 'Play again' : (touched && at > 0 ? 'Resume' : 'Play the walkthrough'));
  }

  /* ---------- focus: dim everything except what the current step changed ---------- */
  function updateFocus() {
    var active = [];
    if (touched && at >= 1) {
      units.forEach(function (u) {
        var hit = targets.some(function (t) { return t.step === at && t.action !== 'toast' && u.contains(t.el); });
        if (hit) active.push(u);
      });
    }
    units.forEach(function (u) { u.classList.toggle('is-active', active.indexOf(u) !== -1); });
    frame.classList.toggle('is-focusing', active.length > 0);
    if (!active.length) scrolledFor = 0;
    else if (at !== scrolledFor) { scrolledFor = at; reveal(active[0]); }
  }

  // Bring the changed unit into view by scrolling the board container only (never the page).
  function reveal(u) {
    if (!body || !body.contains(u) || body.scrollWidth <= body.clientWidth) return;
    var b = body.getBoundingClientRect(), r = u.getBoundingClientRect();
    if (r.left >= b.left && r.right <= b.right) return; // already fully visible
    var left = r.left - b.left + body.scrollLeft; // unit's left edge inside the scrolled content
    var x = Math.max(0, Math.min(body.scrollWidth - body.clientWidth, left - (body.clientWidth - r.width) / 2));
    if (body.scrollTo) body.scrollTo({ left: x, behavior: mq.matches ? 'auto' : 'smooth' });
    else body.scrollLeft = x;
  }

  function pulse(el) {
    var host2 = el.classList.contains('board__card') ? el : (el.closest('.board__card') || el);
    host2.classList.remove('is-pulse'); void host2.offsetWidth; host2.classList.add('is-pulse');
    window.setTimeout(function () { host2.classList.remove('is-pulse'); }, 700);
  }

  function reset() { // everything back to "before step 1", without announcing
    touched = true; at = 0; render(false); void frame.offsetWidth;
  }
  function go(n, forward) { touched = true; at = Math.max(0, Math.min(N, n)); render(forward); }

  /* ---------- actions ---------- */
  function stop() { playing = false; window.clearTimeout(timer); }
  function tick() {
    if (!playing) return;
    if (at >= N) { stop(); render(false); return; }
    go(at + 1, true);
    if (at >= N) { // let the last step breathe, then settle on "Play again"
      timer = window.setTimeout(function () { stop(); render(false); }, DELAY);
    } else timer = window.setTimeout(tick, DELAY);
  }
  function play() {
    if (mq.matches) return;
    if (!touched || at >= N) reset();
    playing = true; render(false); tick();
    if (window.experiusTrack) window.experiusTrack('demo_play', location.pathname.replace(/^.*\//, '').replace(/\.html$/, ''));
  }
  function step(dir) {
    stop();
    if (dir > 0) {
      if (!touched) reset();
      if (at >= N) { render(false); return; }
      go(at + 1, true);
    } else {
      if (!touched || at <= 1) return;
      go(at - 1, false);
    }
  }
  function restart() { stop(); reset(); if (!mq.matches) play(); else render(false); }

  bPlay.addEventListener('click', function () { if (playing) { stop(); render(false); } else play(); });
  bPrev.addEventListener('click', function () { step(-1); });
  bNext.addEventListener('click', function () { step(1); });
  bRestart.addEventListener('click', restart);

  // Clicking a step in the list jumps to it (mouse nice-to-have; keyboard uses Next / Previous).
  items.forEach(function (li, i) {
    li.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return;
      stop(); if (!touched) reset(); go(i + 1, i + 1 > at);
    });
  });

  function syncReduced() {
    bPlay.hidden = mq.matches;
    if (mq.matches && playing) stop();
    render(false);
  }
  if (mq.addEventListener) mq.addEventListener('change', syncReduced);
  else if (mq.addListener) mq.addListener(syncReduced);

  // First paint is the finished screen; only then does the frame switch to its animated look.
  items.forEach(function (li) { li.setAttribute('data-demo-item', ''); });
  render(false);
  bPlay.hidden = mq.matches;
  Motion.enhance(frame);
  Motion.enhance(list);
  host.classList.add('is-ready');
})();
