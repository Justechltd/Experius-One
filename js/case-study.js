/* Case-study pop-ups on the Work page.
   Each client card has a hidden button (data-case="<dialog id>"). With JS and <dialog> support the button is switched on,
   the whole card becomes clickable, and the native dialog gives focus trapping, Esc to close and focus return for free.
   A case is also linkable: work.html#case-noree opens it on load. Without this file the cards keep their summaries. */
(function () {
  'use strict';
  var probe = document.createElement('dialog');
  if (typeof probe.showModal !== 'function') return;

  var buttons = Array.prototype.slice.call(document.querySelectorAll('.case-open[data-case]'));

  function openCase(dialog) {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    if (window.experiusTrack) { var h = dialog.querySelector('h2, h3'); window.experiusTrack('case_open', h && h.firstChild ? h.firstChild.textContent : dialog.id.replace(/^case-/, '')); }
    var body = dialog.querySelector('.case__body');
    if (body) body.scrollTop = 0;
    if (window.history && history.replaceState) history.replaceState(null, '', '#' + dialog.id);
  }

  buttons.forEach(function (btn) {
    var dialog = document.getElementById(btn.getAttribute('data-case'));
    if (!dialog) return;
    var card = btn.closest('.work-card');
    btn.hidden = false;
    if (card) {
      card.classList.add('is-case-ready');
      // Clicking anywhere on the card (not on a link or button inside it) opens the case study.
      card.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        openCase(dialog);
      });
    }
    btn.addEventListener('click', function () { openCase(dialog); });
  });

  Array.prototype.slice.call(document.querySelectorAll('dialog.case')).forEach(function (dialog) {
    var close = dialog.querySelector('[data-case-close]');
    if (close) close.addEventListener('click', function () { dialog.close(); });
    // Clicks on the backdrop land on the dialog element itself, because the content fills the box.
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
      if (window.history && history.replaceState && location.hash === '#' + dialog.id) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  if (location.hash && /^#case-/.test(location.hash)) openCase(document.getElementById(location.hash.slice(1)));
})();
