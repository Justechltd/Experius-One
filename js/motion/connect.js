/* Bridge flow ("Content carries the first half, the system the second").
   1. When visible, the connector lines between nodes draw left to right (CSS scaleX, staggered via --i).
   2. Then a few decorative "attention" dots travel from Expertise across to Client, three slow passes, then stop.
   3. Where the figure has a "With a system / Without a system" toggle, "without" sends the dots as far as Inquiry,
      where they drift down and fade, and an aria-live caption says so. The toggle works with or without motion.
   Transform and opacity only; every tween is 0.45s or less. */
(function () {
  'use strict';
  var figs = document.querySelectorAll('.bridge-flow');
  if (!figs.length || !window.Motion) return;
  Array.prototype.forEach.call(figs, init);

  var CAPTION = {
    'with': 'With a system, every inquiry gets a record, an owner and a next step.',
    'without': 'Without a system, interest leaks out after the first inquiry.'
  };

  function init(fig) {
    var g = Motion.gsap;
    var animate = !Motion.reduced();
    var nodes = Array.prototype.slice.call(fig.querySelectorAll('.bridge-flow__half li'));
    var controls = fig.querySelector('[data-bridge-controls]');
    var live = fig.querySelector('[data-bridge-live]');
    var buttons = controls ? Array.prototype.slice.call(controls.querySelectorAll('[data-bridge-mode]')) : [];
    var mode = 'with';
    var dots = [];
    var timelines = [];
    var started = false;

    if (animate) {
      Motion.enhance(fig);
      nodes.forEach(function (li, i) { li.style.setProperty('--i', i); });
      for (var d = 0; d < 3; d++) {
        var dot = document.createElement('span');
        dot.className = 'bridge-flow__dot';
        dot.setAttribute('aria-hidden', 'true');
        fig.appendChild(dot);
        dots.push(dot);
      }
    }

    if (controls) {
      controls.hidden = false;
      buttons.forEach(function (b) {
        b.addEventListener('click', function () { setMode(b.getAttribute('data-bridge-mode')); });
      });
    }

    function setMode(next) {
      if (next === mode) return;
      mode = next;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bridge-mode') === mode ? 'true' : 'false'); });
      fig.classList.toggle('is-leaking', mode === 'without');
      if (live) live.textContent = CAPTION[mode];
      if (animate && started) runDots();
    }

    // Centre of every node's marker, in the figure's own coordinates.
    function points() {
      var fr = fig.getBoundingClientRect();
      return nodes.map(function (li) {
        var r = li.getBoundingClientRect();
        var cs = window.getComputedStyle(li);
        var m = window.getComputedStyle(li, '::before');
        var w = parseFloat(m.width) || 10;
        var padL = parseFloat(cs.paddingLeft) || 0;
        return { x: r.left - fr.left + padL + w / 2, y: r.top - fr.top + r.height / 2 };
      });
    }

    function stopDots() {
      timelines.forEach(function (t) { t.kill(); });
      timelines = [];
      dots.forEach(function (dot) { g.set(dot, { opacity: 0 }); });
    }

    function runDots() {
      stopDots();
      var pts = points();
      var last = mode === 'without' ? 3 : pts.length - 1; // index 3 = Inquiry
      dots.forEach(function (dot, d) {
        var t = g.timeline({ delay: d * 1.0, repeat: 2, repeatDelay: 0.8 });
        t.set(dot, { x: pts[0].x, y: pts[0].y, xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });
        t.to(dot, { opacity: 1, scale: 1, duration: 0.3 });
        for (var i = 1; i <= last; i++) {
          if (Math.abs(pts[i].y - pts[i - 1].y) < 6) {
            t.to(dot, { x: pts[i].x, y: pts[i].y, duration: 0.45 }, '+=0.2');
          } else { // the flow wraps to a new row: fade out, jump, fade in
            t.to(dot, { opacity: 0, duration: 0.2 }, '+=0.2');
            t.set(dot, { x: pts[i].x, y: pts[i].y });
            t.to(dot, { opacity: 1, duration: 0.2 });
          }
        }
        if (mode === 'without') {
          t.to(dot, { y: '+=30', opacity: 0, duration: 0.45 }, '+=0.15'); // the leak
        } else {
          t.to(dot, { opacity: 0, scale: 0.6, duration: 0.3 }, '+=0.15');
        }
        timelines.push(t);
      });
    }

    if (!animate) return;
    Motion.onceVisible(fig, function () {
      fig.classList.add('is-drawn');
      var wait = (nodes.length * 0.1) + 0.5;
      g.delayedCall(wait, function () {
        var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        ready.then(function () { started = true; runDots(); });
      });
    });
  }
})();
