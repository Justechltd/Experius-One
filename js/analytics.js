/* First-party analytics. No cookies, no third parties, no form content.
   A random anonymous id lives in localStorage (experius_vid) and a session id in sessionStorage.
   Sends nothing when: Do Not Track or Global Privacy Control is on, the browser is automated or a crawler,
   the browser has signed in to the admin, the page is /admin/, the backend isn't configured,
   or on localhost unless ?track=1 was used earlier in this session.
   Public API: window.experiusTrack(event, label). It is a no-op whenever tracking is off. */
(function () {
  'use strict';
  window.experiusTrack = function () {};

  var cfg = window.EXPERIUS_BACKEND || {};
  if (!cfg.url || !cfg.anonKey) return;

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  var ls = store('localStorage');
  var ss = store('sessionStorage');
  var params = new URLSearchParams(location.search);

  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  if (local && params.get('track') === '1' && ss) ss.setItem('experius_track', '1');
  if (local && !(ss && ss.getItem('experius_track') === '1')) return;

  var nav = navigator;
  if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.globalPrivacyControl === true) return;
  if (nav.webdriver || /bot|crawl|spider|slurp|preview|headless|lighthouse/i.test(nav.userAgent)) return;
  if (ls && ls.getItem('experius_admin') === '1') return;
  if (/^\/admin(\/|$)/.test(location.pathname)) return;

  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function id(s, key) {
    var v = s && s.getItem(key);
    if (!v || !UUID.test(v)) { v = uuid(); if (s) s.setItem(key, v); }
    return v;
  }
  var visitor = id(ls, 'experius_vid');
  var session = id(ss, 'experius_sid');

  // UTM tags from this URL, else the first ones seen this session (so later pages keep the campaign).
  var utm = {};
  ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) {
    var v = params.get('utm_' + k);
    if (v) utm[k] = v.slice(0, 100);
  });
  if (ss) {
    if (Object.keys(utm).length) ss.setItem('experius_utm', JSON.stringify(utm));
    else { try { utm = JSON.parse(ss.getItem('experius_utm')) || {}; } catch (e) { utm = {}; } }
  }
  window.experiusVisitor = { id: visitor, utm: utm };

  var ref = '';
  try { if (document.referrer) { var r = new URL(document.referrer); if (r.host !== location.host) ref = r.host.slice(0, 100); } } catch (e) { /* bad referrer */ }
  var w = window.innerWidth;
  var device = w < 768 ? 'mobile' : (w < 1024 ? 'tablet' : 'desktop');
  var path = (location.pathname || '/').slice(0, 200);

  var headers = { apikey: cfg.anonKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  if (/^eyJ/.test(cfg.anonKey)) headers.Authorization = 'Bearer ' + cfg.anonKey; // legacy JWT anon key

  function send(event, label) {
    try {
      fetch(cfg.url + '/rest/v1/analytics_events', {
        method: 'POST', keepalive: true, headers: headers,
        body: JSON.stringify({
          visitor_id: visitor, session_id: session, event: event, path: path,
          referrer_host: ref || null, utm_source: utm.source || null, utm_medium: utm.medium || null,
          utm_campaign: utm.campaign || null, device: device,
          label: label ? String(label).replace(/\s+/g, ' ').trim().slice(0, 80) : null
        })
      }).catch(function () { /* analytics must never break the page */ });
    } catch (e) { /* ditto */ }
  }
  window.experiusTrack = send;

  send('pageview');

  // CTA clicks: anything marked data-event, plus every link to the Business Review page.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-event], a[href*="business-review"]');
    if (!el || el.closest('form#review-form')) return;
    send('cta_click', el.getAttribute('data-event-label') || el.innerText || el.textContent);
  }, true);
})();
