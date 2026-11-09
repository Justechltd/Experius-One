/* Homepage self-check. The visitor ticks what sounds familiar; we say where we'd usually start,
   and the button carries the ticks to the Business Review form (?improve=leads,booking).
   Works without JS too: the form submits as a GET with improve=... params. Nothing is sent anywhere. */
(function () {
  'use strict';
  var form = document.querySelector('[data-selfcheck]');
  if (!form) return;
  var verdict = form.querySelector('[data-verdict]');
  var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="improve"]'));
  var DEFAULT = verdict.textContent;
  var PILLARS = {
    bos: { name: 'Business Operating Systems', href: 'business-operating-systems.html' },
    content: { name: 'Content Creation & Management', href: 'content-creation-management.html' },
    web: { name: 'a website with a clear job', href: 'websites.html' }
  };

  function update() {
    var ticked = boxes.filter(function (b) { return b.checked; });
    form.classList.toggle('has-ticks', ticked.length > 0);
    if (!ticked.length) { verdict.textContent = DEFAULT; return; }
    var count = {};
    ticked.forEach(function (b) { count[b.dataset.pillar] = (count[b.dataset.pillar] || 0) + 1; });
    var top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
    var first = ticked.filter(function (b) { return b.dataset.pillar === top; })[0];
    var pillar = PILLARS[top];
    verdict.innerHTML = '';
    var lead = document.createElement('strong');
    lead.textContent = ticked.length === 1 ? '1 sounds familiar. ' : ticked.length + ' sound familiar. ';
    var text = document.createTextNode('We would usually start with ');
    var link = document.createElement('a');
    link.href = pillar.href; link.textContent = pillar.name;
    var tail = document.createTextNode(': ' + first.dataset.fix + '.');
    verdict.appendChild(lead); verdict.appendChild(text); verdict.appendChild(link); verdict.appendChild(tail);
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', update);
    b.addEventListener('change', function () { if (b.checked && window.experiusTrack) window.experiusTrack('selfcheck_tick', b.value); });
  });

  // One tidy param instead of improve=a&improve=b; the review form reads both shapes.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var values = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
    window.location.href = form.getAttribute('action') + (values.length ? '?improve=' + values.join(',') : '');
  });
  update();
})();
