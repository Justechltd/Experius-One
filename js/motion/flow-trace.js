/* Flow trace (pages batch). One component for every `.flow-trace` list (a `flow-inline` <ol>):
   a tracer travels the list once when it scrolls into view, and each step it passes lights up.
   - data-trace="dot"  : a small dot rides the bottom edge of each step. Steps get a tick stamp (data-stamp="none" turns the tick off).
   - data-trace="card" : a small idea card travels and changes its icon and label (data-stages maps each step to a stage).
   Also runs the hero visuals ([data-hero-visual]) on Business Operating Systems and Content pages.
   The list itself is always the accessible content; the tracer and stamps are decorative. With reduced motion
   (or no GSAP) the final state shows at once: every step lit, no travel. */
(function () {
  'use strict';
  if (!window.Motion) return;
  var M = window.Motion;
  var g = M.gsap;

  function qsa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

  /* ---------- flow trace ---------- */
  var STAGES = ['Idea', 'Post', 'Trust', 'Message', 'Conversation'];

  function wrapped(spans) {
    var t0 = spans[0].getBoundingClientRect().top;
    return spans.some(function (s) { return Math.abs(s.getBoundingClientRect().top - t0) > 4; });
  }

  function canCard(ol, spans) {
    return ol.getAttribute('data-trace') === 'card' && window.matchMedia('(min-width: 640px)').matches && !wrapped(spans);
  }

  function initTrace(ol) {
    var items = qsa(ol, 'li');
    var spans = items.map(function (li) { return li.querySelector('span'); }).filter(Boolean);
    if (!items.length || spans.length !== items.length) return;
    var host = ol.parentNode;
    var last = items.length - 1;

    M.enhance(ol);
    if (M.reduced()) {
      items.forEach(function (li) { li.classList.add('is-passed'); });
      items[last].classList.add('is-current');
      return;
    }
    var cardMode = canCard(ol, spans);
    if (cardMode) ol.classList.add('has-card');
    host.classList.add('trace-host');

    M.onceVisible(ol, function () { play(cardMode && canCard(ol, spans)); }, '0px 0px -20% 0px');

    function play(useCard) {
      var stages = (ol.getAttribute('data-stages') || '').split(',').map(Number);
      var dot = document.createElement('span');
      dot.className = useCard ? 'trace-card' : 'trace-dot';
      dot.setAttribute('aria-hidden', 'true');
      var icon = null, label = null;
      if (useCard) {
        icon = document.createElement('span'); icon.className = 'trace-card__icon';
        label = document.createElement('span'); label.className = 'trace-card__label';
        dot.appendChild(icon); dot.appendChild(label);
      }
      host.appendChild(dot);

      var hostRect = host.getBoundingClientRect();
      var offX = hostRect.left + host.clientLeft, offY = hostRect.top + host.clientTop;
      var pad = 6;

      function stageOf(i) { var s = stages[i]; return isNaN(s) ? Math.min(i, STAGES.length - 1) : s; }
      function setStage(i) {
        var s = stageOf(i);
        label.textContent = STAGES[s];
        var src = document.querySelector('[data-stage-icon="' + s + '"] svg');
        icon.innerHTML = src ? src.outerHTML : '';
      }

      // Targets are measured up front, so the timeline is a simple chain of short moves.
      var targets = spans.map(function (sp, i) {
        var r = sp.getBoundingClientRect();
        var x = r.left + r.width / 2 - offX;
        var y = r.bottom - offY;
        if (useCard) {
          setStage(i);
          var half = dot.offsetWidth / 2;
          x = Math.max(half, Math.min(hostRect.width - half, x));
          y += 10;
        }
        return { x: x, y: y };
      });

      g.set(dot, { xPercent: -50, yPercent: useCard ? 0 : -50, x: Math.max(0, targets[0].x - 28), y: targets[0].y, opacity: 0 });
      if (useCard) setStage(0);

      var tl = g.timeline();
      tl.to(dot, { opacity: 1, duration: 0.25 });
      items.forEach(function (li, i) {
        if (useCard) tl.call(function () { setStage(i); if (i) g.fromTo(icon.parentNode, { scale: 0.92 }, { scale: 1, duration: 0.25 }); });
        tl.to(dot, { x: targets[i].x, y: targets[i].y, duration: 0.4 });
        tl.call(function () {
          items.forEach(function (o) { o.classList.remove('is-current'); });
          li.classList.add('is-passed', 'is-current');
        });
        tl.to({}, { duration: 0.12 });
      });
      if (!useCard) tl.to(dot, { opacity: 0, duration: 0.3 });
    }
  }

  qsa(document, '.flow-trace').forEach(initTrace);

  /* ---------- hero visuals ---------- */
  function initHero(card) {
    if (M.reduced()) return; // the markup is already the final state
    var rows = qsa(card, '[data-row]');
    var icons = qsa(card, '[data-stage-icon]');
    M.enhance(card);

    if (rows.length) {
      rows.forEach(function (r, i) { r.style.setProperty('--i', i); });
      M.onceVisible(card, function () { card.classList.add('is-in'); }, '0px');
    }

    if (icons.length) {
      var labels = qsa(card, '[data-stage-label]');
      var dots = qsa(card, '[data-stage-dot]');
      var show = function (n) {
        [icons, labels].forEach(function (list) {
          list.forEach(function (el, i) { el.classList.toggle('is-on', i === n); });
        });
        dots.forEach(function (d, i) { d.classList.toggle('is-on', i === n); d.classList.toggle('is-done', i < n); });
      };
      show(0);
      M.onceVisible(card, function () {
        var n = 0;
        (function next() {
          if (++n >= icons.length) return;
          g.delayedCall(0.9, function () { show(n); next(); });
        })();
      }, '0px');
    }
  }
  qsa(document, '[data-hero-visual]').forEach(initHero);
})();
