/* Site behaviour: dropdown navigation, mobile menu, scroll reveal.
   Every feature is an enhancement; the page works with this file missing. */
(function () {
  'use strict';

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

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
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
  }

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
