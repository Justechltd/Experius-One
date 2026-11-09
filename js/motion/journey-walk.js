/* Journey walk (audience pages).
   1. The <ol class="journey"> gets a progress line beside the step numbers and a small customer dot that rides it as the
      visitor scrolls. When the dot reaches a "Can break here" row, that note pops in and a faded ghost dot drops away
      with the words "lost here". Position is read from scroll (ScrollTrigger), so it never runs ahead of the reader.
   2. The "better flow" check-list plays a clean run once when it comes into view: items tick in one by one while a dot
      passes down the list without stopping on any friction.
   Markup stays the plain list without JS. With reduced motion the line is simply drawn full and every note is shown. */
(function () {
  'use strict';
  var M = window.Motion;
  if (!M) return;
  var reduced = M.reduced();
  var live = !reduced && !!(M.gsap && window.ScrollTrigger);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function hide(n) { n.setAttribute('aria-hidden', 'true'); return n; }

  /* ---------- 1. The journey ---------- */
  function initJourney(ol) {
    var items = Array.prototype.slice.call(ol.children).filter(function (n) { return n.tagName === 'LI'; });
    if (items.length < 2) return;

    var wrap = el('div', 'journey-walk');
    var rail = hide(el('div', 'journey-walk__rail'));
    rail.appendChild(el('span', 'journey-walk__fill'));
    var dot = hide(el('span', 'journey-walk__dot'));
    ol.parentNode.insertBefore(wrap, ol);
    wrap.appendChild(rail);
    wrap.appendChild(dot);
    wrap.appendChild(ol);
    M.enhance(wrap);

    if (!live) {                       // reduced motion (or no GSAP): the line is drawn in full, nothing travels
      wrap.classList.add('is-done');
      return;
    }
    wrap.classList.add('is-live');

    items.forEach(function (li) {
      if (!li.classList.contains('is-friction')) return;
      var ghost = hide(el('span', 'journey__ghost'));
      ghost.appendChild(el('i'));
      ghost.appendChild(el('b', '', 'lost here'));
      li.appendChild(ghost);
    });

    var top = 0, height = 0, marks = [], hit = [], passed = [], lastY = -1;

    function measure() {
      var sy = window.pageYOffset;
      var wr = wrap.getBoundingClientRect();
      var centres = items.map(function (li) {
        var step = li.querySelector('.journey__step') || li;
        var r = step.getBoundingClientRect();
        var c = r.top + r.height / 2;
        return { abs: c + sy, inLi: c - li.getBoundingClientRect().top };
      });
      top = centres[0].abs;
      height = Math.max(1, centres[centres.length - 1].abs - top);
      marks = centres.map(function (c) { return c.abs - top; });
      wrap.style.setProperty('--jw-top', (top - (wr.top + sy)) + 'px');
      wrap.style.setProperty('--jw-h', height + 'px');
      items.forEach(function (li, i) { li.style.setProperty('--cy', centres[i].inLi + 'px'); });
      lastY = -1;
    }

    function update() {
      // The dot sits where the reader is looking: a line 60% down the viewport.
      var raw = window.pageYOffset + window.innerHeight * 0.6 - top;
      var y = Math.max(0, Math.min(height, raw));
      if (y !== lastY) {
        lastY = y;
        wrap.style.setProperty('--jw-y', y + 'px');
        wrap.style.setProperty('--jw-p', (y / height).toFixed(4));
      }
      items.forEach(function (li, i) {
        var reached = marks[i] <= raw;
        if (reached !== !!passed[i]) { passed[i] = reached; li.classList.toggle('is-passed', reached); }
        if (reached && !hit[i]) { hit[i] = true; li.classList.add('is-hit'); }   // notes and ghosts play once
      });
    }

    window.ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onUpdate: update,
      onRefresh: function () { measure(); update(); }
    });
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { measure(); update(); });
      ro.observe(wrap);
    }
    measure();
    update();
  }

  /* ---------- 2. The "better flow" list ---------- */
  function initBetter(ul) {
    var lis = Array.prototype.slice.call(ul.children).filter(function (n) { return n.tagName === 'LI'; });
    if (reduced || !lis.length || !M.gsap) return;        // reduced motion: the list stays as written
    var dot = hide(el('span', 'check-walk__dot'));
    ul.appendChild(dot);
    ul.classList.add('check-walk');
    M.enhance(ul);

    M.onceVisible(ul, function () {
      var ys = lis.map(function (li) {
        var fs = parseFloat(window.getComputedStyle(li).fontSize) || 16;
        return li.offsetTop + fs * 0.7 + 1;              // centre of the li's dash marker
      });
      var g = M.gsap;
      var tl = g.timeline({ defaults: { ease: 'none' } });
      tl.set(dot, { y: ys[0] }).to(dot, { opacity: 1, duration: 0.15 });
      tl.call(function () { lis[0].classList.add('is-on'); });
      for (var i = 1; i < lis.length; i++) {
        (function (k) {
          var d = Math.max(0.18, Math.min(0.45, (ys[k] - ys[k - 1]) / 300));
          tl.to(dot, { y: ys[k], duration: d });
          tl.call(function () { lis[k].classList.add('is-on'); });
        })(i);
      }
      tl.to(dot, { opacity: 0, duration: 0.25 });
    }, '0px 0px -20% 0px');
  }

  var ol = document.querySelector('ol.journey');
  if (ol) initJourney(ol);
  var title = document.getElementById('better-title');
  var section = title && title.closest('section');
  var list = section && section.querySelector('ul.check-list');
  if (list) initBetter(list);
})();
