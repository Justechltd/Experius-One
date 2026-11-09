/* Next steps (Business Review, Thank-you): the "what happens next" lists, `process process--stacked`.
   - data-next-steps="reveal"  (Business Review): the three steps fade in one after another when the list scrolls into view.
   - data-next-steps="progress" (Thank-you): step 1 is marked "In progress" with a soft pulse (3 beats) and a dot travels
     down the line toward step 2 a few times, then rests. The label is text, so the state never depends on colour.
   Markup first: the list reads in full without JS. With reduced motion the label shows and nothing moves. */
(function () {
  'use strict';
  var ol = document.querySelector('[data-next-steps]');
  if (!ol || !window.Motion) return;
  var items = Array.prototype.slice.call(ol.children).filter(function (n) { return n.tagName === 'LI'; });
  if (items.length < 2) return;
  var mode = ol.getAttribute('data-next-steps');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (mode === 'reveal') {
    // Only hide the steps when we are sure they will be revealed (observer available, motion allowed).
    if (reduced || !('IntersectionObserver' in window)) return;
    items.forEach(function (li, i) { li.style.setProperty('--i', i); });
    Motion.enhance(ol);
    Motion.onceVisible(ol, function () { ol.classList.add('is-in'); }, '0px 0px -10% 0px');
    return;
  }

  if (mode === 'progress') {
    var first = items[0];
    first.classList.add('is-current');
    first.setAttribute('aria-current', 'step');
    var status = document.createElement('p');
    status.className = 'step-status';
    status.innerHTML = '<i aria-hidden="true"></i><span>In progress</span>';
    var h = first.querySelector('h3');
    first.insertBefore(status, h ? h.nextSibling : first.firstChild);
    Motion.enhance(ol);
    if (reduced || !Motion.gsap) return;

    var g = Motion.gsap;
    var trail = document.createElement('span');
    trail.className = 'step-trail';
    trail.setAttribute('aria-hidden', 'true');
    first.appendChild(trail);

    Motion.onceVisible(ol, function () {
      var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // From the bottom of step 1's marker to just above step 2's marker.
      var dist = items[1].offsetTop - first.offsetTop - 2.75 * rem - 8;
      if (dist <= 0) return;
      var tl = g.timeline({ delay: 0.4 });
      for (var n = 0; n < 3; n++) {
        tl.fromTo(trail, { y: 0, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2 });
        tl.to(trail, { y: dist, duration: 0.45 });
        tl.to(trail, { opacity: 0, duration: 0.2 });
        tl.to({}, { duration: 0.8 });
      }
    });
  }
})();
