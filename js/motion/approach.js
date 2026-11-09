/* Our Approach: switch the scene to whichever stage is in the middle of the screen, keep the rail in step,
   and fill the rail as the visitor scrolls. Stage changes are CSS transitions (approach.css);
   with reduced motion the tokens zero every duration, so the scene simply shows each final state. */
(function () {
  'use strict';
  var section = document.querySelector('.approach');
  if (!section || !window.Motion) return;
  var scene = section.querySelector('.approach-scene');
  var stages = Array.prototype.slice.call(section.querySelectorAll('.stage'));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('[data-rail]'));
  var caption = section.querySelector('[data-caption]');
  var NAMES = ['Understand', 'Demonstrate', 'Solve', 'Document', 'Repeat'];

  // Chip positions come from data-pos="x,y,rotation" (no inline styles in the markup).
  Array.prototype.forEach.call(scene.querySelectorAll('[data-pos]'), function (el) {
    var p = el.getAttribute('data-pos').split(',');
    el.style.setProperty('--x', p[0]); el.style.setProperty('--y', p[1]); el.style.setProperty('--r', (p[2] || 0) + 'deg');
  });

  Motion.enhance(section);

  function setStage(n) {
    if (scene.getAttribute('data-stage') === String(n)) return;
    scene.setAttribute('data-stage', n);
    stages.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-stage') === String(n)); });
    railLinks.forEach(function (a) {
      var on = a.getAttribute('data-rail') === String(n);
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    if (caption) caption.textContent = 'Step ' + n + ' of 5 · ' + NAMES[n - 1];
  }
  scene.setAttribute('data-stage', '0');
  setStage(1);

  // The stage crossing the middle band of the viewport is the active one.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setStage(+e.target.getAttribute('data-stage')); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    stages.forEach(function (s) { io.observe(s); });
  }

  // Rail fill follows scroll progress through the stages (scrubbed, so it never runs ahead of the reader).
  var fill = document.querySelector('.rail__fill');
  if (fill && Motion.gsap && window.ScrollTrigger) {
    Motion.gsap.to(fill, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: section.querySelector('.stages'), start: 'top center', end: 'bottom center', scrub: true } });
  } else if (fill) {
    fill.style.transform = 'scaleX(1)';
  }

  // Months vs weeks bars grow once, when they come into view.
  var bars = document.querySelector('.timebars');
  if (bars) {
    Motion.enhance(bars);
    Motion.onceVisible(bars, function () { bars.classList.add('is-in'); });
  }
})();
