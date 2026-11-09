/* Business Review form.
   Validates here, then POSTs to the submit_review_request RPC (supabase/migrations/0001_site_admin.sql),
   which runs the same checks again and is the only way into the database.
   States covered: validation error (inline + summary), submitting, submission failed, success. */
(function () {
  'use strict';
  var form = document.getElementById('review-form');
  if (!form) return;

  var summary = document.getElementById('error-summary');
  var summaryList = summary.querySelector('ul');
  var failAlert = document.getElementById('submit-failed');
  var submitBtn = form.querySelector('[type="submit"]');
  var submitting = false;
  var openedAt = Date.now();
  var started = false;

  function track(event) { if (window.experiusTrack) window.experiusTrack(event); }
  // form_start fires once, on the first thing the visitor types or ticks. No values are sent.
  form.addEventListener('input', function () { if (!started) { started = true; track('form_start'); } });

  // Arriving from an audience page (?type=solar etc.) pre-selects the business type, so the visitor
  // doesn't have to repeat what the site already knows. The value is a category, never personal data.
  var TYPES = {
    expertise: 'Coach, consultant or independent expert',
    special: 'Special education or therapy centre',
    clinic: 'Clinic or wellness practice',
    education: 'Training academy or educator',
    solar: 'Solar or battery installation',
    agency: 'Agency looking for an implementation partner'
  };
  var params = new URLSearchParams(window.location.search);
  var typeParam = params.get('type');
  // hasOwnProperty, so ?type=constructor can't reach Object.prototype and blank the select.
  if (typeParam && Object.prototype.hasOwnProperty.call(TYPES, typeParam)) form.elements.businessType.value = TYPES[typeParam];

  // Arriving from the homepage self-check (?improve=leads,booking) ticks the areas the visitor already chose.
  params.getAll('improve').join(',').split(',').forEach(function (v) {
    var box = form.querySelector('input[name="improve"][value="' + v.replace(/[^a-z]/g, '') + '"]');
    if (box && v) box.checked = true;
  });

  // The phone field appears only when the visitor picks WhatsApp or a phone call.
  var contactSelect = form.elements.contactMethod;
  var phoneField = document.getElementById('phone-field');
  function syncPhone() {
    var show = /WhatsApp|Phone/.test(contactSelect.value);
    phoneField.hidden = !show;
    if (!show) { form.elements.phone.value = ''; setError('phone', ''); }
  }
  var status = document.getElementById('form-status');

  // Each rule returns an error message, or '' when the field is fine. Messages say how to fix it.
  var rules = {
    name: function (f) { return f.value.trim() ? '' : 'Enter your name'; },
    email: function (f) {
      if (!f.value.trim()) return 'Enter your work email';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()) ? '' : 'Enter an email address like name@business.com';
    },
    business: function (f) { return f.value.trim() ? '' : 'Enter your business or organization name'; },
    businessType: function (f) { return f.value ? '' : 'Choose what best describes your business'; },
    improve: function () {
      return form.querySelectorAll('input[name="improve"]:checked').length ? '' : 'Choose at least one area, or "Not sure yet"';
    },
    context: function (f) {
      var v = f.value.trim();
      if (!v) return 'Tell us briefly what is happening';
      return v.length < 10 ? 'Add a few more words, a sentence is enough' : '';
    },
    phone: function (f) {
      var v = f.value.replace(/[^0-9]/g, '');
      if (!f.value.trim()) return '';
      return v.length >= 7 ? '' : 'Enter a number with its country code, like +61 400 000 000';
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
    if (!summary.hidden) refreshSummary();
    return message;
  }

  // Keep the error summary honest: a fixed field drops out of it straight away.
  function refreshSummary() {
    var open = Array.prototype.filter.call(summaryList.querySelectorAll('li'), function (li) {
      var wrap = fieldWrap(li.getAttribute('data-name'));
      if (!wrap.classList.contains('has-error')) { li.remove(); return false; }
      return true;
    });
    if (!open.length) summary.hidden = true;
    else summary.querySelector('h3 span').textContent = open.length === 1 ? 'There is 1 thing to fix' : 'There are ' + open.length + ' things to fix';
  }

  contactSelect.addEventListener('change', syncPhone);
  syncPhone();

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
        li.setAttribute('data-name', err.name);
        var a = document.createElement('a');
        a.href = '#' + fieldWrap(err.name).querySelector('input, select, textarea').id;
        a.textContent = err.message;
        li.appendChild(a);
        summaryList.appendChild(li);
      });
      summary.hidden = false;
      summary.querySelector('h3 span').textContent = errors.length === 1 ? 'There is 1 thing to fix' : 'There are ' + errors.length + ' things to fix';
      summary.focus();
      return;
    }
    summary.hidden = true;

    // Submitting state: button locked with spinner; live region announces progress.
    submitting = true;
    submitBtn.classList.add('is-loading');
    submitBtn.setAttribute('aria-disabled', 'true');
    submitBtn.querySelector('span').textContent = 'Sending your request…';
    status.textContent = 'Sending your request…';

    function failed() {
      submitting = false;
      submitBtn.classList.remove('is-loading');
      submitBtn.removeAttribute('aria-disabled');
      submitBtn.querySelector('span').textContent = 'Send my request';
      status.textContent = '';
      // Failed state: every value stays in the form; nothing is lost.
      failAlert.hidden = false;
      failAlert.focus();
    }

    function succeeded() {
      track('form_submit');
      // First name for the thank-you greeting, skipping honorifics ("Dr. Rahman" becomes "Rahman"). The button stays locked until we leave.
      var parts = form.elements.name.value.trim().split(/\s+/);
      var first = /^(dr|mr|mrs|ms|miss|prof|eng|md)\.?$/i.test(parts[0]) && parts[1] ? parts[1] : parts[0];
      try { sessionStorage.setItem('experius-review-name', first); } catch (err) { /* storage blocked: thank-you page falls back to a generic greeting */ }
      window.location.href = 'thank-you.html';
    }

    var cfg = window.EXPERIUS_BACKEND || {};
    if (!cfg.url || !cfg.anonKey) { window.setTimeout(failed, 600); return; } // backend not connected yet

    var el = form.elements;
    var visitor = window.experiusVisitor || {};
    var utm = visitor.utm || {};
    if (!Object.keys(utm).length) {
      var q = new URLSearchParams(window.location.search);
      ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) { if (q.get('utm_' + k)) utm[k] = q.get('utm_' + k); });
    }
    var payload = {
      name: el.name.value, email: el.email.value, business: el.business.value, website: el.website.value,
      businessType: el.businessType.value, context: el.context.value, country: el.country.value,
      contactMethod: el.contactMethod.value, phone: el.phone.value, source: el.source.value,
      improve: Array.prototype.map.call(form.querySelectorAll('input[name="improve"]:checked'), function (b) { return b.value; }),
      consent: el.consent.checked, company_url: el.company_url.value,
      elapsed_ms: Date.now() - openedAt, page_path: window.location.pathname,
      utm: utm, visitor_id: visitor.id || null
    };
    var headers = { apikey: cfg.anonKey, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(cfg.anonKey)) headers.Authorization = 'Bearer ' + cfg.anonKey; // legacy JWT anon key

    fetch(cfg.url + '/rest/v1/rpc/submit_review_request', {
      method: 'POST', headers: headers, body: JSON.stringify({ payload: payload })
    }).then(function (res) {
      if (res.ok) return succeeded();
      return res.text().then(function (body) {
        if (window.console) console.warn('Business Review request rejected', res.status, body);
        failed();
      });
    }).catch(function (err) {
      if (window.console) console.warn('Business Review request could not be sent', err);
      failed();
    });
  });

  summary.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    var target = document.querySelector(link.getAttribute('href'));
    if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
  });
})();
