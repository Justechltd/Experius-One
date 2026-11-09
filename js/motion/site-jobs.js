/* Websites: "Six jobs a website can do". Beside the list (1024px and up) a decorative wireframe browser shows the page
   regions. The job being hovered, focused, or crossing the middle of the viewport lights up its region with an outline
   and a text label. The list is the real content and works alone; the wireframe is aria-hidden and hidden below 1024px. */
(function () {
  'use strict';
  var root = document.querySelector('[data-site-jobs]');
  if (!root || !window.Motion) return;
  var items = Array.prototype.slice.call(root.querySelectorAll('.site-jobs__list > li[data-region]'));
  var regions = Array.prototype.slice.call(root.querySelectorAll('.site-jobs__aside [data-region]'));
  if (!items.length || !regions.length) return;

  Motion.enhance(root);

  var hovered = null, scrolled = items[0];
  function paint() {
    var active = hovered || scrolled;
    var key = active ? active.getAttribute('data-region') : '';
    items.forEach(function (li) { li.classList.toggle('is-active', li === active); });
    regions.forEach(function (r) { r.classList.toggle('is-active', r.getAttribute('data-region') === key); });
  }

  items.forEach(function (li) {
    li.addEventListener('mouseenter', function () { hovered = li; paint(); });
    li.addEventListener('mouseleave', function () { hovered = null; paint(); });
    li.addEventListener('focusin', function () { hovered = li; paint(); });
    li.addEventListener('focusout', function () { hovered = null; paint(); });
  });

  // The job crossing the middle band of the viewport is the active one (last one seen stays, so there is no flicker between cards).
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { scrolled = e.target; paint(); } });
    }, { rootMargin: '-45% 0px -45% 0px' });
    items.forEach(function (li) { io.observe(li); });
  }
  paint();
})();
