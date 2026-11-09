/* Motion core. Loaded after js/vendor/gsap.min.js and ScrollTrigger.min.js, before any motion module.
   Rules every module follows:
   - Markup first: each component is readable list markup without JS. Motion only demonstrates it.
   - Reduced motion: modules call Motion.reduced() and jump to the final, fully readable state.
   - Transform and opacity only; each tween <= 0.45s (tokens brief). Longer stories chain short steps.
   - One easing family: expo-style out, matching --ease in tokens.css. */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  if (hasGsap) window.gsap.defaults({ ease: 'expo.out', duration: 0.45 });

  window.Motion = {
    gsap: hasGsap ? window.gsap : null,
    reduced: function () { return mq.matches || !hasGsap; },
    /* Run fn(el) once, when el first comes into view (or immediately if motion is off). */
    onceVisible: function (el, fn, margin) {
      if (!el) return;
      if (!('IntersectionObserver' in window)) { fn(el); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(el); } });
      }, { rootMargin: margin || '0px 0px -15% 0px' });
      io.observe(el);
    },
    /* Mark a component as enhanced, so CSS can switch from its static layout to its animated layout. */
    enhance: function (el) { if (el) el.classList.add('is-motion'); }
  };
})();
