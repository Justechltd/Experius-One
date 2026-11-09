/* Hero inbox (audience pages). A small decorative "live inbox": requests arrive scattered from their channels, then
   slide into one tidy list where each gets an owner and a next action. Plays once when it comes into view and ends
   static. The figure is aria-hidden and hidden entirely without JS. States run on data-stage (CSS transitions):
   0 hidden · 1 arrived, scattered · 2 tidy list · 3 owner and next action shown. */
(function () {
  'use strict';
  var M = window.Motion;
  var fig = document.querySelector('[data-hero-inbox]');
  if (!M || !fig) return;

  Array.prototype.forEach.call(fig.querySelectorAll('li'), function (li, i) {
    var p = (li.getAttribute('data-scatter') || '0,0,0').split(',');
    li.style.setProperty('--sx', p[0]);
    li.style.setProperty('--sy', p[1]);
    li.style.setProperty('--sr', (p[2] || 0) + 'deg');
    li.style.setProperty('--i', i);
  });

  M.enhance(fig);
  function stage(n) { fig.setAttribute('data-stage', n); }

  if (M.reduced()) { stage(3); return; }          // final state straight away, nothing travels

  stage(0);
  M.onceVisible(fig, function () {
    stage(1);
    window.setTimeout(function () { stage(2); }, 1200);
    window.setTimeout(function () { stage(3); }, 1900);
  }, '0px');
})();
