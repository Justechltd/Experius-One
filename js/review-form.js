/* Business Review form, prototype behaviour.
   Real build: the same validation runs again on the server; this file never sends data anywhere.
   States covered: validation error (inline + summary), submitting, submission failed, success. */
(function () {
  'use strict';
  var form = document.getElementById('review-form');
  if (!form) return;

  var summary = document.getElementById('error-summary');
  var summaryList = summary.querySelector('ul');
  var failAlert = document.getElementById('submit-failed');
  var submitBtn = form.querySelector('[type="submit"]');
  var failToggle = document.getElementById('proto-fail');
  var submitting = false;

  // Arriving from an audience page (?type=solar etc.) pre-selects the business type, so the visitor
  // doesn't have to repeat what the site already knows. The value is a category, never personal data.
  var TYPES = {
    expertise: 'Coach, consultant or independent expert',
    clinic: 'Clinic or wellness practice',
    education: 'Training academy or educator',
    solar: 'Solar or battery installation'
  };
  var preset = TYPES[new URLSearchParams(window.location.search).get('type')];
  if (preset) form.elements.businessType.value = preset;

  // Each rule returns an error message, or '' when the field is fine. Messages say how to fix it.
  var rules = {
    name: function (f) { return f.value.trim() ? '' : 'Enter your name'; },
    email: function (f) {
      if (!f.value.trim()) return 'Enter your work email';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()) ? '' : 'Enter an email address like name@business.com';
    },
    business: function (f) { return f.value.trim() ? '' : 'Enter your business or organisation name'; },
    businessType: function (f) { return f.value ? '' : 'Choose what best describes your business'; },
    improve: function () {
      return form.querySelectorAll('input[name="improve"]:checked').length ? '' : 'Choose at least one area, or "Not sure yet"';
    },
    context: function (f) {
      var v = f.value.trim();
      if (!v) return 'Tell us briefly what is happening';
      return v.length < 20 ? 'Add a little more detail, even a sentence or two helps' : '';
    },
    consent: function (f) { return f.checked ? '' : 'Confirm we can use these details to reply to you'; }
  };

  function fieldWrap(name) { return form.querySelector('[data-field="' + name + '"]'); }

  function setError(name, message) {
    var wrap = fieldWrap(name);
    var control = form.elements[name];
    var errorEl = wrap.querySelector('.field-error span');
    wrap.classList.toggle('has-error', !!message);
    errorEl.textContent = message;
    var targets = control && control.length && !control.tagName ? Array.prototype.slice.call(control) : [control];
    targets.forEach(function (el) {
      if (!el) return;
      if (message) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
  }

  function validate(name) {
    var control = form.elements[name];
    var message = rules[name](control);
    setError(name, message);
    return message;
  }

  // Validate a field when the visitor leaves it, then live once it has shown an error. Never while first typing.
  Object.keys(rules).forEach(function (name) {
    var wrap = fieldWrap(name);
    wrap.addEventListener('focusout', function (e) {
      if (wrap.contains(e.relatedTarget)) return;
      if (name === 'improve' || name === 'consent') return; // group-level: checked on submit
      var control = form.elements[name];
      if (control.value && control.value.trim && control.value.trim()) validate(name);
    });
    wrap.addEventListener('input', function () { if (wrap.classList.contains('has-error')) validate(name); });
    wrap.addEventListener('change', function () { if (wrap.classList.contains('has-error')) validate(name); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) return; // prevents duplicate submissions
    failAlert.hidden = true;

    var errors = [];
    Object.keys(rules).forEach(function (name) {
      var message = validate(name);
      if (message) errors.push({ name: name, message: message });
    });

    summaryList.innerHTML = '';
    if (errors.length) {
      errors.forEach(function (err) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + fieldWrap(err.name).querySelector('input, select, textarea').id;
        a.textContent = err.message;
        li.appendChild(a);
        summaryList.appendChild(li);
      });
      summary.hidden = false;
      summary.querySelector('h2 span').textContent = errors.length === 1 ? 'There is 1 thing to fix' : 'There are ' + errors.length + ' things to fix';
      summary.focus();
      return;
    }
    summary.hidden = true;

    // Submitting state: button locked with spinner; live region announces progress.
    submitting = true;
    submitBtn.classList.add('is-loading');
    submitBtn.setAttribute('aria-disabled', 'true');
    submitBtn.querySelector('span').textContent = 'Sending your request…';

    window.setTimeout(function () {
      submitting = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.removeAttribute('aria-disabled');
      submitBtn.querySelector('span').textContent = 'Send my request';

      if (failToggle && failToggle.checked) {
        // Failed state: every value stays in the form; nothing is lost.
        failAlert.hidden = false;
        failAlert.focus();
        return;
      }
      try { sessionStorage.setItem('experius-review-name', form.elements.name.value.trim().split(' ')[0]); } catch (err) { /* storage blocked: thank-you page falls back to a generic greeting */ }
      window.location.href = 'thank-you.html';
    }, 1400);
  });

  summary.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    var target = document.querySelector(link.getAttribute('href'));
    if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
  });
})();
