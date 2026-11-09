/* Home hero: "One inquiry, two businesses".
   Markup is two plain lists (Today, Connected). This script adds a decorative token that travels both lists at once:
   in Today it hops between scattered boxes and is lost; in Connected it follows a straight connector to "Booked".
   Plays once when visible (~5.5s, chained steps of 0.45s or less), with a Replay button. Transform and opacity only.
   Reduced motion: the script leaves the page in its static, fully readable final state. */
(function () {
  'use strict';
  var fig = document.querySelector('.race');
  if (!fig || !window.Motion) return;
  var g = Motion.gsap;
  var replay = fig.querySelector('.race__replay');
  if (Motion.reduced()) return; // static markup already shows the end state

  var lanes = ['today', 'connected'].map(function (name) {
    var ol = fig.querySelector('.race__lane--' + name + ' .race__steps');
    var token = document.createElement('span');
    token.className = 'race__token';
    token.setAttribute('aria-hidden', 'true');
    ol.appendChild(token);
    return { ol: ol, items: Array.prototype.slice.call(ol.querySelectorAll('li')), token: token, pts: [] };
  });
  var today = lanes[0], conn = lanes[1];
  var lost = today.items[4];
  var tl = null;

  Motion.enhance(fig);

  function px(v, fallback) { var n = parseFloat(v); return isNaN(n) ? fallback : n; }

  // Marker centre of every step, in the list's own coordinates (layout offsets, so transforms never skew them).
  function measure() {
    lanes.forEach(function (lane) {
      lane.pts = lane.items.map(function (li) {
        var cs = window.getComputedStyle(li, '::before');
        var w = px(cs.width, 12), left = px(cs.left, -18), top = px(cs.top, 10);
        return { x: li.offsetLeft + left + w / 2, y: li.offsetTop + top + w / 2 };
      });
    });
  }

  function light(li) { li.classList.add('is-lit'); }

  function reset() {
    if (tl) { tl.kill(); tl = null; }
    fig.classList.remove('is-done');
    lanes.forEach(function (lane) {
      lane.items.forEach(function (li) { li.classList.remove('is-lit', 'is-shown'); li.style.removeProperty('--seg'); });
      g.set(lane.token, { opacity: 0, scale: 0.4, xPercent: -50, yPercent: -50, x: lane.pts[0].x, y: lane.pts[0].y });
    });
    conn.items.slice(0, 4).forEach(function (li) { li.style.setProperty('--seg', 0); });
  }

  var HOP = 0.45, STEP = 1.4, T0 = 0.5;
  var JITTER = [0, -3, 4, -2];

  function play() {
    measure();
    reset();
    if (replay) replay.hidden = true;
    tl = g.timeline({ onComplete: function () { if (replay) replay.hidden = false; } });

    // The message arrives in both lanes at once.
    tl.to([today.token, conn.token], { opacity: 1, scale: 1, duration: 0.3 }, 0.1);
    tl.call(light, [today.items[0]], 0.15).call(light, [conn.items[0]], 0.15);

    // Connected: straight along the connector, lighting each step as it passes.
    for (var k = 1; k <= 4; k++) {
      var t = T0 + (k - 1) * STEP;
      tl.to(conn.token, { x: conn.pts[k].x, y: conn.pts[k].y, duration: HOP }, t);
      tl.to(conn.items[k - 1], { '--seg': 1, duration: HOP, ease: 'none' }, t);
      tl.call(light, [conn.items[k]], t + 0.25);
    }

    // Today: hops between scattered boxes with a slight wobble, then fades with "No reply".
    for (var j = 1; j <= 3; j++) {
      var tj = T0 + (j - 1) * STEP;
      tl.to(today.token, { x: today.pts[j].x + JITTER[j], y: today.pts[j].y, duration: HOP }, tj);
      tl.call(light, [today.items[j]], tj + 0.25);
      tl.to(today.token, { x: '+=5', duration: 0.1, yoyo: true, repeat: 3, ease: 'sine.inOut' }, tj + HOP);
    }
    var tLost = T0 + 3 * STEP;
    tl.to(today.token, { opacity: 0, scale: 0.4, duration: 0.3 }, tLost);
    tl.call(function () {
      today.items.forEach(function (li) { li.classList.remove('is-lit'); });
      lost.classList.add('is-shown');
    }, null, tLost + 0.1);

    // Connected ends: token settles into the Booked step, then only the pulse continues.
    var tEnd = T0 + 3 * STEP + HOP;
    tl.to(conn.token, { opacity: 0, scale: 0.4, duration: 0.3 }, tEnd);
    tl.call(function () { fig.classList.add('is-done'); }, null, tEnd + 0.1);
  }

  if (replay) replay.addEventListener('click', play);

  Motion.onceVisible(fig, function () {
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(play);
  }, '0px 0px -10% 0px');
})();
