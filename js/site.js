/* Site behaviour: dropdown navigation, mobile menu, scroll reveal.
   Every feature is an enhancement; the page works with this file missing. */
(function () {
  'use strict';
  // Signals that behaviour is live: CSS fallbacks (hover dropdowns, reveal safety net) switch off.
  document.documentElement.classList.add('js-ready');

  /* Desktop dropdowns: open on click or tap (never hover-only), close on Escape,
     outside click or when focus leaves. Escape returns focus to the toggle. */
  var toggles = Array.prototype.slice.call(document.querySelectorAll('.nav-toggle'));

  function closeAll(except) {
    toggles.forEach(function (t) {
      if (t === except) return;
      t.setAttribute('aria-expanded', 'false');
      document.getElementById(t.getAttribute('aria-controls')).hidden = true;
    });
  }

  toggles.forEach(function (toggle) {
    var panel = document.getElementById(toggle.getAttribute('aria-controls'));
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      closeAll(toggle);
      toggle.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
    toggle.parentElement.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeAll();
        toggle.focus();
      }
    });
    toggle.parentElement.addEventListener('focusout', function (e) {
      if (!toggle.parentElement.contains(e.relatedTarget)) {
        toggle.setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      }
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) closeAll();
  });

  /* Mobile menu: a modal panel. Focus moves in, Tab stays inside header + panel, Escape closes,
     focus returns to the Menu button. Page scroll locks while open. */
  var menuBtn = document.querySelector('.menu-toggle');
  var menu = document.getElementById('mobile-menu');
  var header = document.querySelector('.site-header');

  var behind = [document.getElementById('main'), document.querySelector('.site-footer')];

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    // The page behind the open menu is inert, so screen readers and Tab stay inside the menu.
    behind.forEach(function (el) { if (el) el.inert = open; });
    if (open) {
      var first = menu.querySelector('a, summary');
      if (first) first.focus();
    }
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    header.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') {
        setMenu(false);
        menuBtn.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = Array.prototype.filter.call(
        header.querySelectorAll('a[href], button, summary'),
        function (el) { return el.offsetParent !== null; }
      );
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1100 && !menu.hidden) setMenu(false);
    });
    // Back/forward cache can restore the page with the menu still open; always come back closed.
    window.addEventListener('pageshow', function (e) { if (e.persisted && !menu.hidden) setMenu(false); });
  }

  /* Header swap (below 1100px). The page opens with the wordmark and no header CTA, so the hero's
     own buttons carry the first screen. Once the visitor scrolls past them, the wordmark gives way
     to "Book a Review" in the sticky bar; scrolling back up restores the wordmark.
     Without JS the CTA simply stays visible (the swap class is never added). */
  var root = document.documentElement;
  // Only a CTA in the page's own hero counts; pages without one swap after a short scroll.
  var heroCta = document.querySelector('main .hero .btn-row, main .page-hero .btn-row');
  if (heroCta && !heroCta.offsetParent) heroCta = null;
  if (header) {
    root.classList.add('header-swap');
    var ticking = false;
    var passed = null;
    function checkCta() {
      ticking = false;
      var hb = header.getBoundingClientRect().bottom;
      var now = heroCta
        ? heroCta.getBoundingClientRect().bottom < hb
        : window.scrollY > window.innerHeight * 0.6;
      if (now !== passed) { passed = now; root.classList.toggle('cta-passed', now); }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(checkCta); }
    }, { passive: true });
    window.addEventListener('resize', checkCta);
    checkCta();
  }

  /* Print buttons (Fix the Flow worksheet). */
  Array.prototype.forEach.call(document.querySelectorAll('[data-print]'), function (b) {
    b.addEventListener('click', function () { window.print(); });
  });

  /* Scroll reveal. Children that animate in sequence get --i for their stagger delay.
     Without IntersectionObserver, or with reduced motion, everything is shown at once. */
  var reveals = document.querySelectorAll('.reveal');
  Array.prototype.forEach.call(document.querySelectorAll('.hero-map__flow, .chain'), function (list) {
    Array.prototype.forEach.call(list.children, function (li, i) { li.style.setProperty('--i', i); });
  });
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }
})();
