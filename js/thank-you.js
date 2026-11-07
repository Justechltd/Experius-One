/* Personalise the thank-you heading with the first name from the form, if available.
   Read from sessionStorage, never the URL, so no personal data lands in links or analytics. */
(function () {
  'use strict';
  var slot = document.querySelector('[data-greeting]');
  if (!slot) return;
  try {
    var name = sessionStorage.getItem('experius-review-name');
    if (name) {
      slot.textContent = ', ' + name;
      sessionStorage.removeItem('experius-review-name');
    }
  } catch (err) { /* storage unavailable: generic heading is already correct */ }
})();
