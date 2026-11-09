/* Experius admin. One IIFE, no build step. Data contract: docs/admin-contract.md.
   Every database value is rendered with textContent / DOM nodes, never as markup. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- constants */

  var STATUSES = ['new', 'contacted', 'booked', 'won', 'closed', 'spam'];
  var STATUS_LABEL = { new: 'New', contacted: 'Contacted', booked: 'Booked', won: 'Won', closed: 'Closed', spam: 'Spam' };
  var IMPROVE_LABEL = {
    website: 'Website or digital presence',
    leads: 'Inquiries and lead management',
    booking: 'Booking or registration',
    crm: 'CRM and customer information',
    followup: 'Follow-up and communication',
    workflows: 'Internal workflows',
    content: 'Content strategy or production',
    reporting: 'Reporting and visibility',
    unsure: 'Not sure yet'
  };
  var TABS = ['overview', 'requests', 'analytics', 'settings'];
  var RANGES = [7, 30, 90];
  var REQUEST_LIMIT = 1000;
  var CSV_COLUMNS = ['id', 'created_at', 'updated_at', 'name', 'email', 'business', 'business_type', 'improve', 'context', 'country', 'website', 'contact_method', 'phone', 'source', 'page_path', 'utm', 'visitor_id', 'consented_at', 'status', 'notes', 'notified_at'];
  var TOP_LISTS = [
    { dim: 'page', title: 'Top pages' },
    { dim: 'referrer', title: 'Top referrers' },
    { dim: 'utm_source', title: 'UTM sources' },
    { dim: 'cta', title: 'CTA clicks' },
    { dim: 'case', title: 'Case studies opened' },
    { dim: 'device', title: 'Devices' }
  ];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var RANGE_KEY = 'experius_admin_range';

  var cfg = window.EXPERIUS_BACKEND || {};
  var MOCK = /(^|[?&])mock=1(&|$)/.test(location.search) && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  /* ---------------------------------------------------------------- small helpers */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* el('div', {class:'x', text:'hi', attrs:{role:'status'}, on:{click:fn}}, child, 'text') */
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      if (props.class) node.className = props.class;
      if (props.text != null) node.textContent = props.text;
      if (props.attrs) Object.keys(props.attrs).forEach(function (k) { if (props.attrs[k] != null) node.setAttribute(k, props.attrs[k]); });
      if (props.on) Object.keys(props.on).forEach(function (k) { node.addEventListener(k, props.on[k]); });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  function svgEl(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  var numFmt = new Intl.NumberFormat('en-US');
  function num(n) { return numFmt.format(Number(n) || 0); }
  function pct(v) { return v == null ? '—' : (Math.round(Number(v) * 10) / 10) + '%'; }

  var dhakaFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  function parts(fmt, iso) {
    var map = {};
    fmt.formatToParts(new Date(iso)).forEach(function (p) { map[p.type] = p.value; });
    return map;
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    var p = parts(dhakaFmt, iso);
    return p.day + ' ' + p.month + ' ' + p.year + ', ' + p.hour + ':' + p.minute;
  }
  function dhakaToday() {
    var p = parts(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }), new Date().toISOString());
    return p.year + '-' + p.month + '-' + p.day;
  }
  function fmtDay(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || '');
    return m ? (Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1]) : String(ymd);
  }
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Supabase errors carry message, code, details, hint. Plain Errors and network TypeErrors are handled too. */
  function describeError(err) {
    if (!err) return 'Something went wrong.';
    if (typeof err === 'string') return err;
    var msg = err.message ? String(err.message) : '';
    var out = [];
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
      out.push("Can't reach the server. Check your connection and try again." + (msg ? ' (' + msg + ')' : ''));
    } else {
      out.push(msg || 'Something went wrong.');
    }
    if (err.code) out.push('Code: ' + err.code);
    if (err.details) out.push('Details: ' + (typeof err.details === 'string' ? err.details : JSON.stringify(err.details)));
    if (err.hint) out.push('Hint: ' + err.hint);
    return out.join('\n');
  }

  /* Session gone: HTTP 401, 42501 / not_admin, JWT expired. */
  function isAuthError(err) {
    if (!err) return false;
    var msg = String(err.message || '');
    return err.status === 401 || err.code === '42501' || err.code === 'PGRST301' || err.code === 'PGRST303' ||
      /not_admin|JWT expired|invalid JWT|session_not_found|refresh_token_not_found/i.test(msg) ||
      err.code === 'bad_jwt' || err.code === 'session_not_found';
  }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: fine */ } }

  /* ---------------------------------------------------------------- state */

  var sb = null;
  var state = {
    view: null,
    tab: 'overview',
    range: 30,
    signingOut: false,
    requests: null,          // loaded rows, newest first
    rq: { status: 'all', search: '' },
    rendered: { overview: null, requests: null, analytics: null },
    tok: { overview: 0, requests: 0, analytics: 0 },
    chart: null,
    drawer: { id: null, openerId: null }
  };
  var cache = new Map();
  var summaries = {};        // resolved admin_analytics_summary objects by days

  var dom = {};

  /* ---------------------------------------------------------------- data layer */

  function unwrap(res) {
    if (res && res.error) {
      var e = res.error;
      if (res.status && !e.status) e.status = res.status;
      throw e;
    }
    return res ? res.data : null;
  }
  function rpc(name, args) { return sb.rpc(name, args).then(unwrap); }

  function cached(key, fn, force) {
    if (force || !cache.has(key)) {
      var p = Promise.resolve().then(fn);
      cache.set(key, p);
      p.catch(function () { if (cache.get(key) === p) cache.delete(key); });
    }
    return cache.get(key);
  }
  function invalidate() { cache.clear(); summaries = {}; state.requests = null; state.rendered = { overview: null, requests: null, analytics: null }; }

  function getRequests() {
    return cached('requests', function () {
      return sb.from('review_requests').select('*').order('created_at', { ascending: false }).limit(REQUEST_LIMIT).then(unwrap).then(function (rows) {
        state.requests = rows || [];
        return state.requests;
      });
    });
  }
  function getSummary(days) {
    return cached('summary:' + days, function () {
      return rpc('admin_analytics_summary', { days: days }).then(function (s) { summaries[days] = s || {}; return summaries[days]; });
    });
  }
  function getDaily(days) { return cached('daily:' + days, function () { return rpc('admin_analytics_daily', { days: days }).then(function (r) { return r || []; }); }); }
  function getTop(dim, days) { return cached('top:' + dim + ':' + days, function () { return rpc('admin_top', { dim: dim, days: days }).then(function (r) { return r || []; }); }); }

  /* ---------------------------------------------------------------- views + auth */

  function showView(name) {
    state.view = name;
    dom.nobackend.hidden = name !== 'nobackend';
    dom.login.hidden = name !== 'login';
    dom.app.hidden = name !== 'app';
  }

  function setLoginNotice(text) {
    dom.loginNotice.hidden = !text;
    dom.loginNotice.textContent = text || '';
  }
  function setLoginError(text) {
    dom.loginError.hidden = !text;
    dom.loginError.textContent = text || '';
  }
  function setBusy(btn, busy, label) {
    btn.classList.toggle('is-loading', busy);
    btn.disabled = busy;
    if (label) btn.textContent = label;
  }

  function toLogin(notice) {
    closeDrawer(true);
    showView('login');
    setLoginNotice(notice || '');
    setLoginError('');
    setBusy(dom.loginSubmit, false, 'Sign in');
    dom.loginPassword.value = '';
    dom.loginEmail.focus();
  }

  function endSession(message) {
    invalidate();
    toLogin(message || '');
    if (sb) sb.auth.signOut({ scope: 'local' }).catch(function () { /* already gone */ });
  }

  function enterApp(email) {
    lsSet('experius_admin', '1');
    dom.userEmail.textContent = email || '';
    dom.userEmail.title = email || '';
    dom.pwUsername.value = email || '';
    showView('app');
    var hash = location.hash.replace('#', '');
    if (TABS.indexOf(hash) === -1) history.replaceState(null, '', '#overview');
    activate(readHash());
  }

  function onLoginSubmit(ev) {
    ev.preventDefault();
    var email = dom.loginEmail.value.trim();
    var password = dom.loginPassword.value;
    setLoginNotice('');
    if (!email || !password) { setLoginError('Enter your email and password.'); return; }
    setLoginError('');
    setBusy(dom.loginSubmit, true);
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      return rpc('is_admin').then(function (isAdmin) {
        if (isAdmin !== true) {
          return sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () {
            setLoginError("This account doesn't have admin access.");
          });
        }
        invalidate();
        enterApp(email);
      }, function (err) {
        return sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () { throw err; });
      });
    }).catch(function (err) {
      setLoginError(describeError(err));
    }).then(function () {
      setBusy(dom.loginSubmit, false);
      dom.loginPassword.value = '';
    });
  }

  function onSignOut() {
    state.signingOut = true;
    dom.signout.disabled = true;
    sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () {
      state.signingOut = false;
      dom.signout.disabled = false;
      invalidate();
      toLogin('');
    });
  }

  function boot() {
    if (!MOCK && !cfg.url) { showView('nobackend'); return; }
    if (MOCK) {
      sb = createMockClient();
    } else {
      sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'experius-admin-auth' } });
    }
    sb.auth.onAuthStateChange(function (event) {
      // UI work only here: calling Supabase from inside this callback can deadlock.
      if (event === 'SIGNED_OUT' && state.view === 'app' && !state.signingOut) {
        invalidate();
        toLogin('Your session ended. Sign in again.');
      }
    });
    showView('login');
    dom.loginSubmit.disabled = true;
    setLoginNotice('Checking your session…');
    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (res && res.error) throw res.error;
      if (!session) { setLoginNotice(''); return; }
      return rpc('is_admin').then(function (isAdmin) {
        if (isAdmin === true) { setLoginNotice(''); enterApp(session.user && session.user.email); return; }
        return sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () {
          setLoginNotice('');
          setLoginError("This account doesn't have admin access.");
        });
      });
    }).catch(function (err) {
      if (isAuthError(err)) { endSession('Your session ended. Sign in again.'); return; }
      setLoginNotice('');
      setLoginError(describeError(err));
    }).then(function () { dom.loginSubmit.disabled = false; });
  }

  /* ---------------------------------------------------------------- shared UI bits */

  function skeleton(cls, n) {
    var wrap = el('div', { class: 'a-skel-wrap ' + (cls || ''), attrs: { 'aria-hidden': 'true' } });
    for (var i = 0; i < (n || 1); i++) wrap.appendChild(el('div', { class: 'a-skel' }));
    return wrap;
  }
  function loadingNote(host, node) {
    clear(host);
    host.setAttribute('aria-busy', 'true');
    host.appendChild(node);
    host.appendChild(el('p', { class: 'visually-hidden', text: 'Loading…', attrs: { role: 'status' } }));
  }
  function done(host) { host.removeAttribute('aria-busy'); }

  function showError(host, err, retry) {
    done(host);
    if (isAuthError(err)) { endSession('Your session ended. Sign in again.'); return; }
    clear(host).appendChild(el('div', { class: 'a-error', attrs: { role: 'alert' } },
      el('p', { class: 'a-error__title', text: "Couldn't load this" }),
      el('p', { class: 'a-error__msg', text: describeError(err) }),
      el('button', { class: 'btn btn--secondary btn--sm', text: 'Retry', attrs: { type: 'button' }, on: { click: retry } })
    ));
  }
  function emptyState(title, text, action) {
    return el('div', { class: 'a-empty' },
      el('p', { class: 'a-empty__title', text: title }),
      text ? el('p', { class: 'a-muted', text: text }) : null,
      action || null);
  }

  function pill(status) {
    var s = STATUSES.indexOf(status) === -1 ? 'closed' : status;
    return el('span', { class: 'a-pill a-pill--' + s },
      el('span', { class: 'a-pill__dot', attrs: { 'aria-hidden': 'true' } }),
      STATUS_LABEL[status] || String(status == null ? '' : status));
  }

  function tile(label, value, sub, extra) {
    var node = el(extra && extra.href ? 'a' : 'div', { class: 'a-tile' + (extra && extra.href ? ' a-tile--link' : '') });
    if (extra && extra.href) node.setAttribute('href', extra.href);
    node.appendChild(el('p', { class: 'a-tile__label', text: label }));
    node.appendChild(el('p', { class: 'a-tile__value', text: value }));
    node.appendChild(el('p', { class: 'a-tile__sub', text: sub || ' ' }));
    return node;
  }

  /* ---------------------------------------------------------------- tabs + range */

  function readHash() {
    var h = location.hash.replace('#', '');
    return TABS.indexOf(h) === -1 ? 'overview' : h;
  }

  function activate(tab) {
    if (state.view !== 'app') return;
    var focusTab = dom.tabs.indexOf(document.activeElement) !== -1;
    state.tab = tab;
    dom.tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focusTab) t.focus();
    });
    TABS.forEach(function (name) { dom.panels[name].hidden = name !== tab; });
    dom.rangeSeg.hidden = tab === 'requests';   // range applies to Overview and Analytics only
    dom.rangeWrap.hidden = tab === 'settings';  // nothing to refresh or filter on Settings
    load(tab);
  }

  function load(tab, force) {
    if (force) state.rendered[tab] = null;
    if (tab === 'settings') return;
    if (tab === 'overview') loadOverview();
    else if (tab === 'requests') loadRequestsTab();
    else loadAnalytics();
    if (tab === 'analytics' && state.chart) redrawChart();
  }

  function onTabKey(ev) {
    var i = dom.tabs.indexOf(document.activeElement);
    if (i === -1) return;
    var next = null;
    if (ev.key === 'ArrowRight') next = (i + 1) % dom.tabs.length;
    else if (ev.key === 'ArrowLeft') next = (i - 1 + dom.tabs.length) % dom.tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = dom.tabs.length - 1;
    if (next == null) return;
    ev.preventDefault();
    location.hash = '#' + dom.tabs[next].getAttribute('data-tab');
  }

  function setRange(days) {
    if (RANGES.indexOf(days) === -1) days = 30;
    state.range = days;
    lsSet(RANGE_KEY, String(days));
    $$('input[name="range"]', dom.rangeSeg).forEach(function (r) { r.checked = Number(r.value) === days; });
  }
  function onRangeChange(ev) {
    if (!ev.target || ev.target.name !== 'range') return;
    setRange(Number(ev.target.value));
    state.rendered.overview = null;
    state.rendered.analytics = null;
    if (state.tab !== 'requests') load(state.tab);
  }
  function onRefresh() {
    invalidate();
    load(state.tab);
  }

  /* ---------------------------------------------------------------- requests table (shared by Overview + Requests) */

  function buildTable(rows, compact, caption) {
    var cols = compact ? ['Received', 'Name', 'Business', 'Status'] : ['Received', 'Name', 'Business', 'Type', 'Status'];
    var table = el('table', { class: 'a-table' });
    table.appendChild(el('caption', { class: 'visually-hidden', text: caption }));
    var tr = el('tr');
    cols.forEach(function (c) { tr.appendChild(el('th', { text: c, attrs: { scope: 'col' } })); });
    table.appendChild(el('thead', null, tr));
    var body = el('tbody');
    rows.forEach(function (r) { body.appendChild(buildRow(r, compact)); });
    table.appendChild(body);
    return el('div', { class: 'a-tablewrap' }, table);
  }

  function buildRow(r, compact) {
    var tr = el('tr', { class: 'a-row', attrs: { tabindex: '0', 'data-id': r.id } });
    tr.appendChild(el('td', { class: 'a-cell a-cell--date', text: fmtDate(r.created_at), attrs: { 'data-label': 'Received' } }));
    tr.appendChild(el('td', { class: 'a-cell a-cell--name', text: r.name || '—', attrs: { 'data-label': 'Name' } }));
    tr.appendChild(el('td', { class: 'a-cell', text: r.business || '—', attrs: { 'data-label': 'Business' } }));
    if (!compact) tr.appendChild(el('td', { class: 'a-cell', text: r.business_type || '—', attrs: { 'data-label': 'Type' } }));
    tr.appendChild(el('td', { class: 'a-cell a-cell--status', attrs: { 'data-label': 'Status' } }, pill(r.status)));
    tr.addEventListener('click', function () { openDrawer(r.id); });
    tr.addEventListener('keydown', function (ev) {
      if (ev.target !== tr) return;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDrawer(r.id); }
    });
    return tr;
  }

  /* ---------------------------------------------------------------- Overview */

  function loadOverview() {
    var days = state.range;
    var key = 'ov:' + days;
    if (state.rendered.overview === key) return;
    state.rendered.overview = key;
    var token = ++state.tok.overview;
    var fail = function () { if (token === state.tok.overview) state.rendered.overview = null; };

    loadingNote(dom.ovTiles, skeleton('a-tiles', 4));
    loadingNote(dom.ovLatest, skeleton('a-skel-list', 5));

    getSummary(days).then(function (s) {
      if (token !== state.tok.overview) return;
      renderOverviewTiles(s);
    }, function (err) {
      if (token !== state.tok.overview) return;
      fail();
      showError(dom.ovTiles, err, function () { invalidateKey('summary:' + days); load('overview', true); });
    });
    getRequests().then(function () {
      if (token !== state.tok.overview) return;
      renderOverviewLatest();
    }, function (err) {
      if (token !== state.tok.overview) return;
      fail();
      showError(dom.ovLatest, err, function () { invalidateKey('requests'); load('overview', true); });
    });
  }
  function invalidateKey(k) { cache.delete(k); }

  function renderOverviewTiles(s) {
    done(dom.ovTiles);
    clear(dom.ovTiles);
    var tiles = [
      tile('New requests', num(s.new_requests), 'All time, waiting for a reply', { href: '#requests' }),
      tile('Visitors', num(s.visitors), num(s.pageviews) + ' pageviews'),
      tile('Form starts → submits', num(s.form_starts) + ' → ' + num(s.form_submits), s.start_to_submit_pct == null ? '— start to submit' : pct(s.start_to_submit_pct) + ' start to submit'),
      tile('Requests in range', num(s.requests), 'Last ' + state.range + ' days, spam excluded')
    ];
    tiles[0].addEventListener('click', function () {
      state.rq.status = 'new';
      state.rq.search = '';
      state.rendered.requests = null;
    });
    tiles.forEach(function (t) { dom.ovTiles.appendChild(t); });
  }

  function renderOverviewLatest() {
    done(dom.ovLatest);
    var rows = (state.requests || []).slice(0, 5);
    clear(dom.ovLatest);
    if (!rows.length) { dom.ovLatest.appendChild(emptyState('No requests yet', 'New Business Review requests will show up here.')); return; }
    dom.ovLatest.appendChild(buildTable(rows, true, 'Five newest requests'));
  }

  /* ---------------------------------------------------------------- Requests */

  function filteredRequests() {
    var q = state.rq.search.trim().toLowerCase();
    return (state.requests || []).filter(function (r) {
      if (state.rq.status !== 'all' && r.status !== state.rq.status) return false;
      if (!q) return true;
      return [r.name, r.email, r.business].some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
    });
  }

  function loadRequestsTab() {
    if (state.rendered.requests === 'rq') { renderRequests(); return; }
    state.rendered.requests = 'rq';
    var token = ++state.tok.requests;
    dom.rqSearch.value = state.rq.search;
    loadingNote(dom.rqBody, skeleton('a-skel-list', 8));
    dom.rqCount.textContent = '';
    getRequests().then(function () {
      if (token !== state.tok.requests) return;
      renderRequests();
    }, function (err) {
      if (token !== state.tok.requests) return;
      state.rendered.requests = null;
      showError(dom.rqBody, err, function () { invalidateKey('requests'); load('requests', true); });
    });
  }

  function renderStatusFilter() {
    var counts = { all: (state.requests || []).length };
    STATUSES.forEach(function (s) { counts[s] = 0; });
    (state.requests || []).forEach(function (r) { if (counts[r.status] != null) counts[r.status]++; });
    var opts = [['all', 'All']].concat(STATUSES.map(function (s) { return [s, STATUS_LABEL[s]]; }));
    if (dom.rqStatus.options.length !== opts.length) {
      clear(dom.rqStatus);
      opts.forEach(function (o) { dom.rqStatus.appendChild(el('option', { attrs: { value: o[0] } })); });
    }
    opts.forEach(function (o, i) { dom.rqStatus.options[i].textContent = o[1] + ' (' + counts[o[0]] + ')'; });
    dom.rqStatus.value = state.rq.status;
  }

  function renderRequests() {
    if (!state.requests) return;
    done(dom.rqBody);
    renderStatusFilter();
    dom.rqSearch.value = state.rq.search;
    var rows = filteredRequests();
    var total = state.requests.length;
    clear(dom.rqBody);
    if (!total) {
      dom.rqCount.textContent = '';
      dom.rqExport.disabled = true;
      dom.rqBody.appendChild(emptyState('No requests yet', 'Business Review requests from the website will appear here.'));
      return;
    }
    dom.rqExport.disabled = !rows.length;
    var msg = 'Showing ' + num(rows.length) + ' of ' + num(total) + ' requests';
    if (total >= REQUEST_LIMIT) msg += ' (the ' + num(REQUEST_LIMIT) + ' newest)';
    dom.rqCount.textContent = msg;
    if (!rows.length) {
      dom.rqBody.appendChild(emptyState('No requests match', 'Try a different status or search.', el('button', {
        class: 'btn btn--secondary btn--sm', text: 'Clear filters', attrs: { type: 'button' },
        on: { click: function () { state.rq.status = 'all'; state.rq.search = ''; renderRequests(); dom.rqSearch.focus(); } }
      })));
      return;
    }
    dom.rqBody.appendChild(buildTable(rows, false, 'Review requests, newest first'));
  }

  /* CSV: every field quoted, formula-looking cells neutralised. */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    var rows = filteredRequests();
    if (!rows.length) return;
    var lines = [CSV_COLUMNS.map(csvCell).join(',')];
    rows.forEach(function (r) {
      lines.push(CSV_COLUMNS.map(function (c) {
        var v = r[c];
        if (c === 'improve') v = Array.isArray(v) ? v.join('; ') : v;
        else if (c === 'utm') v = v == null ? '' : JSON.stringify(v);
        return csvCell(v);
      }).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { attrs: { href: url, download: 'experius-requests-' + dhakaToday() + '.csv' } });
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------------- Drawer */

  function findRequest(id) {
    var rows = state.requests || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function dlRow(dl, label, content, wide) {
    var dd = el('dd');
    if (content == null || content === '') dd.appendChild(el('span', { class: 'a-muted', text: '—' }));
    else append(dd, content);
    dl.appendChild(el('div', { class: 'a-dl__row' + (wide ? ' a-dl__row--wide' : '') }, el('dt', { text: label }), dd));
  }

  function safeHref(url) {
    try {
      var u = new URL(String(url).trim());
      return (u.protocol === 'http:' || u.protocol === 'https:') && /^https?:\/\//i.test(String(url).trim()) ? u.href : null;
    } catch (e) { return null; }
  }
  function waNumber(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    else if (/^01\d{9}$/.test(d)) d = '880' + d.slice(1);   // Bangladesh mobile written locally
    return d.length >= 7 ? d : '';
  }

  function openDrawer(id) {
    var r = findRequest(id);
    if (!r) return;
    state.drawer.id = id;
    dom.drawerDate.textContent = 'Received ' + fmtDate(r.created_at) + ' (Dhaka)';
    dom.drawerTitle.textContent = r.name || 'Request';
    renderDrawerBody(r);
    if (!dom.drawer.open) dom.drawer.showModal();
    dom.drawer.scrollTop = 0;
    dom.drawerBody.scrollTop = 0;
  }

  function renderDrawerBody(r) {
    var body = clear(dom.drawerBody);

    // quick links
    var links = el('div', { class: 'a-quick' });
    if (r.email) links.appendChild(el('a', { class: 'btn btn--secondary btn--sm', text: 'Email', attrs: { href: 'mailto:' + encodeURIComponent(r.email).replace(/%40/g, '@') } }));
    var wa = waNumber(r.phone);
    if (wa) links.appendChild(el('a', { class: 'btn btn--secondary btn--sm', text: 'WhatsApp', attrs: { href: 'https://wa.me/' + wa, target: '_blank', rel: 'noopener noreferrer' } }));
    if (links.childNodes.length) body.appendChild(links);

    var dl = el('dl', { class: 'a-dl' });
    dlRow(dl, 'Status', pill(r.status));
    dlRow(dl, 'Name', r.name);
    dlRow(dl, 'Email', r.email ? el('a', { text: r.email, attrs: { href: 'mailto:' + encodeURIComponent(r.email).replace(/%40/g, '@') } }) : null);
    dlRow(dl, 'Phone', r.phone);
    dlRow(dl, 'Business', r.business);
    dlRow(dl, 'Business type', r.business_type);
    dlRow(dl, 'Country', r.country);
    var site = r.website ? safeHref(r.website) : null;
    dlRow(dl, 'Website', !r.website ? null : (site ? el('a', { text: r.website, attrs: { href: site, target: '_blank', rel: 'noopener noreferrer' } }) : r.website));
    dlRow(dl, 'Preferred contact', r.contact_method);
    var improve = Array.isArray(r.improve) && r.improve.length
      ? el('ul', { class: 'a-tags' }, r.improve.map(function (k) { return el('li', { class: 'a-tag', text: IMPROVE_LABEL[k] || k }); }))
      : null;
    dlRow(dl, 'Wants to improve', improve, true);
    dlRow(dl, 'Context', r.context ? el('p', { class: 'a-context', text: r.context }) : null, true);
    dlRow(dl, 'Heard about us', r.source);
    dlRow(dl, 'Form page', r.page_path);
    var utm = r.utm && typeof r.utm === 'object' ? Object.keys(r.utm).filter(function (k) { return r.utm[k]; }) : [];
    dlRow(dl, 'UTM', utm.length ? el('ul', { class: 'a-kv' }, utm.map(function (k) { return el('li', null, el('span', { class: 'a-muted', text: k + ': ' }), String(r.utm[k])); })) : null);
    dlRow(dl, 'Consented', r.consented_at ? fmtDate(r.consented_at) : null);
    dlRow(dl, 'Alert sent', r.notified_at ? fmtDate(r.notified_at) : el('span', { class: 'a-muted', text: 'Not sent' }));
    dlRow(dl, 'Last updated', r.updated_at ? fmtDate(r.updated_at) : null);
    body.appendChild(dl);

    // actions
    var statusSel = el('select', { class: 'select', attrs: { id: 'dr-status' } },
      STATUSES.map(function (s) { return el('option', { text: STATUS_LABEL[s], attrs: { value: s } }); }));
    statusSel.value = STATUSES.indexOf(r.status) === -1 ? 'new' : r.status;
    var notes = el('textarea', { class: 'textarea', attrs: { id: 'dr-notes', maxlength: '5000', rows: '5' } });
    notes.value = r.notes || '';
    var saveBtn = el('button', { class: 'btn btn--primary', text: 'Save', attrs: { type: 'submit' } });
    var msg = el('p', { class: 'a-savemsg', attrs: { role: 'status', 'aria-live': 'polite' } });
    var err = el('div', { class: 'a-alert', attrs: { role: 'alert' } });
    err.hidden = true;

    var form = el('form', { class: 'form a-actions', attrs: { novalidate: '' } },
      el('h3', { class: 'a-h3', text: 'Follow-up' }),
      el('div', { class: 'field' }, el('label', { text: 'Status', attrs: { for: 'dr-status' } }), el('div', { class: 'select-wrap' }, statusSel)),
      el('div', { class: 'field' }, el('label', { text: 'Notes', attrs: { for: 'dr-notes' } }), el('p', { class: 'hint', text: 'Only admins see these.' }), notes),
      err,
      el('div', { class: 'a-actions__row' }, saveBtn, msg));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      saveRequest(r.id, statusSel.value, notes.value, saveBtn, msg, err);
    });
    [statusSel, notes].forEach(function (c) { c.addEventListener('input', function () { msg.textContent = ''; msg.classList.remove('is-ok'); }); });
    body.appendChild(form);
  }

  function saveRequest(id, status, notes, btn, msg, errBox) {
    var r = findRequest(id);
    if (!r) return;
    errBox.hidden = true;
    msg.classList.remove('is-ok');
    msg.textContent = 'Saving…';
    setBusy(btn, true);
    var trimmed = notes.trim();
    sb.from('review_requests').update({ status: status, notes: trimmed === '' ? null : notes }).eq('id', id)
      .select('id,status,notes,updated_at').single().then(unwrap).then(function (row) {
        var was = r.status;
        r.status = row.status;
        r.notes = row.notes;
        r.updated_at = row.updated_at;
        if (was !== r.status && (was === 'new' || r.status === 'new')) {
          var delta = r.status === 'new' ? 1 : -1;
          Object.keys(summaries).forEach(function (k) { summaries[k].new_requests = Math.max(0, (Number(summaries[k].new_requests) || 0) + delta); });
        }
        msg.classList.add('is-ok');
        msg.textContent = 'Saved';
        refreshAfterSave(id);
      }).catch(function (err) {
        if (isAuthError(err)) { endSession('Your session ended. Sign in again.'); return; }
        msg.textContent = '';
        errBox.textContent = 'Not saved. ' + describeError(err);
        errBox.hidden = false;
      }).then(function () { setBusy(btn, false); });
  }

  /* Update the table, overview and drawer date line without a reload. */
  function refreshAfterSave(id) {
    if (state.rendered.requests === 'rq' && state.requests) renderRequests();
    if (summaries[state.range] && state.rendered.overview === 'ov:' + state.range) {
      renderOverviewTiles(summaries[state.range]);
      renderOverviewLatest();
    }
    var r = findRequest(id);
    if (r) {
      var rows = $$('.a-dl__row', dom.drawerBody);
      // refresh the status pill and updated stamp inside the drawer
      rows.forEach(function (row) {
        var label = $('dt', row).textContent;
        var dd = $('dd', row);
        if (label === 'Status') clear(dd).appendChild(pill(r.status));
        if (label === 'Last updated') dd.textContent = fmtDate(r.updated_at);
      });
    }
  }

  function closeDrawer(silent) {
    if (silent) state.drawer.id = null;
    if (dom.drawer.open) dom.drawer.close();
  }

  function onDrawerClosed() {
    var id = state.drawer.id;
    state.drawer.id = null;
    if (state.view !== 'app' || !id) return;
    var row = $('.a-row[data-id="' + String(id).replace(/"/g, '') + '"]', dom.panels[state.tab]);
    if (row) row.focus();
    else dom.panels[state.tab].focus();
  }

  /* ---------------------------------------------------------------- Analytics */

  function loadAnalytics() {
    var days = state.range;
    var key = 'an:' + days;
    if (state.rendered.analytics === key) return;
    state.rendered.analytics = key;
    var token = ++state.tok.analytics;
    state.chart = null;
    loadingNote(dom.anBody, el('div', null, skeleton('a-tiles', 5), skeleton('a-skel-chart', 1)));
    Promise.all([getSummary(days), getDaily(days)].concat(TOP_LISTS.map(function (t) { return getTop(t.dim, days); }))).then(function (res) {
      if (token !== state.tok.analytics) return;
      renderAnalytics(res[0], res[1], res.slice(2));
    }, function (err) {
      if (token !== state.tok.analytics) return;
      state.rendered.analytics = null;
      showError(dom.anBody, err, function () {
        invalidateKey('summary:' + days); invalidateKey('daily:' + days);
        TOP_LISTS.forEach(function (t) { invalidateKey('top:' + t.dim + ':' + days); });
        load('analytics', true);
      });
    });
  }

  function renderAnalytics(s, daily, tops) {
    done(dom.anBody);
    clear(dom.anBody);
    var tiles = el('div', { class: 'a-tiles a-tiles--5' },
      tile('Visitors', num(s.visitors), num(s.sessions) + ' sessions'),
      tile('Pageviews', num(s.pageviews), s.visitors ? (Math.round(s.pageviews / s.visitors * 10) / 10) + ' per visitor' : ''),
      tile('Form starts', num(s.form_starts), num(s.cta_clicks) + ' CTA clicks'),
      tile('Submits', num(s.form_submits), pct(s.start_to_submit_pct) + ' of starts'),
      tile('Conversion', pct(s.visitor_to_request_pct), 'Visitors to requests'));
    dom.anBody.appendChild(tiles);

    if (!(Number(s.visitors) || Number(s.pageviews))) {
      dom.anBody.appendChild(emptyState('No visits recorded in this range yet', 'Visits appear here once people browse the public site. Your own browser is skipped once you have signed in here.'));
      return;
    }

    // chart
    var capId = 'chart-cap';
    var host = el('div', { class: 'a-chart__host' });
    var caption = el('figcaption', { class: 'a-chart__cap', attrs: { id: capId } });
    var fig = el('figure', { class: 'a-card a-chart' }, el('h2', { class: 'a-h2', text: 'Visitors per day' }), host, caption);
    dom.anBody.appendChild(fig);
    state.chart = { host: host, rows: daily, capId: capId, width: 0 };
    caption.textContent = chartSummary(daily);
    drawChart();
    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (state.chart && state.chart.host === host) redrawChart(); }).observe(host);
    }

    // ranked lists
    var grid = el('div', { class: 'a-ranks' });
    TOP_LISTS.forEach(function (t, i) { grid.appendChild(rankList(t.title, tops[i], t.dim)); });
    dom.anBody.appendChild(grid);
  }

  function chartSummary(rows) {
    if (!rows.length) return 'No data.';
    var total = 0, peak = rows[0], pv = 0;
    rows.forEach(function (r) { total += Number(r.visitors) || 0; pv += Number(r.pageviews) || 0; if (r.visitors > peak.visitors) peak = r; });
    return 'Unique visitors per day, ' + fmtDay(rows[0].day) + ' to ' + fmtDay(rows[rows.length - 1].day) + ': ' + num(total) + ' in total, ' +
      (Math.round(total / rows.length * 10) / 10) + ' on average, busiest day ' + fmtDay(peak.day) + ' with ' + num(peak.visitors) + '. Hover a bar for the day’s numbers.';
  }

  function niceStep(max) {
    var k = 1;
    for (;;) {
      var base = [1, 2, 5];
      for (var i = 0; i < base.length; i++) { var s = base[i] * k; if (max / s <= 4) return s; }
      k *= 10;
    }
  }

  function redrawChart() {
    if (!state.chart) return;
    var w = Math.floor(state.chart.host.clientWidth);
    if (w > 0 && w !== state.chart.width) drawChart();
  }

  function drawChart() {
    var c = state.chart;
    if (!c) return;
    var rows = c.rows;
    var host = clear(c.host);
    var W = Math.floor(host.clientWidth);
    c.width = W;
    if (W <= 0) return;
    W = Math.max(W, 260);
    var H = 260, m = { t: 12, r: 8, b: 30, l: 44 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max(1, rows.reduce(function (a, r) { return Math.max(a, Number(r.visitors) || 0); }, 0));
    var step = niceStep(max);
    var top = step * Math.ceil(max / step);

    var svg = svgEl('svg', { class: 'a-chart__svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-labelledby': c.capId });
    for (var v = 0; v <= top; v += step) {
      var y = m.t + ih * (1 - v / top);
      svg.appendChild(svgEl('line', { class: v === 0 ? 'a-chart__axis' : 'a-chart__grid', x1: m.l, x2: W - m.r, y1: y, y2: y }));
      var tick = svgEl('text', { class: 'a-chart__tick', x: m.l - 8, y: y, dy: '0.32em', 'text-anchor': 'end' });
      tick.textContent = String(v);
      svg.appendChild(tick);
    }
    var n = rows.length, slot = iw / n, barW = Math.min(28, Math.max(1.5, slot * 0.72));
    var every = Math.max(1, Math.ceil(64 / slot));
    rows.forEach(function (r, i) {
      var val = Number(r.visitors) || 0;
      var x = m.l + i * slot + (slot - barW) / 2;
      var h = ih * val / top;
      var g = svgEl('g', { class: 'a-chart__col' });
      var t = svgEl('title');
      t.textContent = fmtDay(r.day) + ': ' + num(val) + ' visitor' + (val === 1 ? '' : 's') + ', ' + num(r.pageviews) + ' pageview' + (Number(r.pageviews) === 1 ? '' : 's');
      g.appendChild(t);
      g.appendChild(svgEl('rect', { class: 'a-chart__hit', x: m.l + i * slot, y: m.t, width: slot, height: ih }));
      if (h > 0) g.appendChild(svgEl('rect', { class: 'a-chart__bar', x: x, y: m.t + ih - h, width: barW, height: h, rx: Math.min(2, barW / 2) }));
      svg.appendChild(g);
      if (i % every === 0) {
        var lab = svgEl('text', { class: 'a-chart__tick', x: m.l + i * slot + slot / 2, y: H - 8, 'text-anchor': 'middle' });
        lab.textContent = fmtDay(r.day);
        svg.appendChild(lab);
      }
    });
    host.appendChild(svg);
  }

  function rankList(title, items, dim) {
    var max = items.reduce(function (a, i) { return Math.max(a, Number(i.count) || 0); }, 0);
    var sec = el('section', { class: 'a-card a-rank' }, el('h3', { class: 'a-h3', text: title }));
    if (!items.length) { sec.appendChild(el('p', { class: 'a-muted', text: 'Nothing recorded yet.' })); return sec; }
    var ol = el('ol', { class: 'a-rank__list' });
    items.forEach(function (it) {
      var label = dim === 'device' ? cap(it.key) : (it.key == null || it.key === '' ? '(none)' : String(it.key));
      var count = Number(it.count) || 0;
      var bar = el('span', { class: 'a-rank__bar' });
      bar.style.width = (max ? Math.max(2, count / max * 100) : 0) + '%';
      ol.appendChild(el('li', { class: 'a-rank__item' },
        el('span', { class: 'a-rank__label', text: label, attrs: { title: label } }),
        el('span', { class: 'a-rank__count', text: num(count) }),
        el('span', { class: 'a-rank__track', attrs: { 'aria-hidden': 'true' } }, bar)));
    });
    sec.appendChild(ol);
    return sec;
  }

  /* ---------------------------------------------------------------- settings: change password */

  var MIN_PASSWORD = 12;

  function setPasswordMessage(kind, text) {
    dom.pwError.hidden = kind !== 'error';
    dom.pwError.textContent = kind === 'error' ? text : '';
    dom.pwOk.hidden = kind !== 'ok';
    dom.pwOk.textContent = kind === 'ok' ? text : '';
  }

  function onPasswordSubmit(ev) {
    ev.preventDefault();
    var current = dom.pwCurrent.value;
    var next = dom.pwNew.value;
    var repeat = dom.pwConfirm.value;
    var email = dom.userEmail.textContent;
    if (!current || !next || !repeat) { setPasswordMessage('error', 'Fill in all three fields.'); return; }
    if (next.length < MIN_PASSWORD) { setPasswordMessage('error', 'Use at least ' + MIN_PASSWORD + ' characters for the new password.'); return; }
    if (next !== repeat) { setPasswordMessage('error', "The two new passwords don't match."); return; }
    if (next === current) { setPasswordMessage('error', 'The new password must be different from the current one.'); return; }
    setPasswordMessage('', '');
    setBusy(dom.pwSubmit, true);
    // Check the current password first, so an unattended signed-in screen can't be used to take over the account.
    sb.auth.signInWithPassword({ email: email, password: current }).then(function (res) {
      if (res.error) {
        var wrong = res.error.code === 'invalid_credentials' || /invalid login/i.test(res.error.message || '');
        if (wrong) { var e = new Error('Your current password is not correct.'); e.plain = true; throw e; }
        throw res.error;
      }
      return sb.auth.updateUser({ password: next });
    }).then(function (res) {
      if (res && res.error) throw res.error;
      dom.pwForm.reset();
      dom.pwUsername.value = email;
      setPasswordMessage('ok', 'Password changed. Use the new password next time you sign in.');
    }).catch(function (err) {
      setPasswordMessage('error', err && err.plain ? err.message : describeError(err));
    }).then(function () {
      setBusy(dom.pwSubmit, false);
      dom.pwCurrent.value = '';
    });
  }

  /* ---------------------------------------------------------------- dev-only mock client (localhost + ?mock=1) */

  function createMockClient() {
    if (!(location.hostname === 'localhost' || location.hostname === '127.0.0.1')) throw new Error('Mock backend is local-only.');
    var now = Date.now();
    var HOUR = 3600e3;
    function iso(hoursAgo) { return new Date(now - hoursAgo * HOUR).toISOString(); }
    var rows = [
      { name: '<img src=x onerror=alert(1)>', business: 'Rahim Solar Ltd', business_type: 'Solar and battery installer', email: 'rahim@example.com', status: 'new', h: 2, improve: ['leads', 'followup'], context: 'We install solar for homes.\nOur quotes go out by WhatsApp and we lose track of who replied.\n\nWould like a simple pipeline.', country: 'Bangladesh', website: 'https://rahimsolar.example', contact_method: 'WhatsApp', phone: '01717 192730', source: 'LinkedIn', page_path: '/business-review.html', utm: { source: 'linkedin', medium: 'social', campaign: 'nov-launch' } },
      { name: 'Nadia Karim', business: '=1+1', business_type: 'Clinic or wellness', email: 'nadia@example.com', status: 'new', h: 20, improve: ['booking', 'crm', 'reporting'], context: 'Appointments by phone only. Need online booking and reminders.', country: 'Bangladesh', website: 'javascript:alert(1)', contact_method: 'Video call', phone: '+880 1711-000111', source: 'Referral', page_path: '/clinics-wellness.html', utm: null },
      { name: 'Tom Okafor', business: 'Okafor Training', business_type: 'Education or training', email: 'tom@example.com', status: 'contacted', h: 52, improve: ['website', 'content'], context: 'Small training school, wants a clearer website and a content plan.', country: 'Nigeria', website: 'okafortraining.example', contact_method: 'Email', phone: null, source: 'Google', page_path: '/', utm: { source: 'google', medium: 'organic' }, notes: 'Replied with two time slots.' },
      { name: 'Sara Ahmed', business: 'Ahmed Studio', business_type: 'Personal brand', email: 'sara@example.com', status: 'booked', h: 80, improve: ['content'], context: 'Personal brand for a designer.', country: 'UAE', website: 'https://ahmed.example', contact_method: 'Phone call', phone: '+971 50 123 4567', source: 'Instagram', page_path: '/expertise-personal-brands.html', utm: null, notes: 'Call booked Thursday 15:00.' },
      { name: 'Imran Hossain', business: 'Hossain Traders', business_type: 'Other', email: 'imran@example.com', status: 'won', h: 120, improve: ['workflows', 'reporting'], context: 'Inventory and sales reporting.', country: 'Bangladesh', website: null, contact_method: 'Video call', phone: '01819 555 666', source: 'Referral', page_path: '/business-operating-systems.html', utm: null, notes: 'Signed. Kick-off next week.' },
      { name: 'Lena Fischer', business: 'Fischer GmbH', business_type: 'Other', email: 'lena@example.com', status: 'closed', h: 200, improve: ['unsure'], context: 'Just exploring options for now.', country: 'Germany', website: 'https://fischer.example', contact_method: 'Email', phone: null, source: null, page_path: '/', utm: null },
      { name: 'Buy Cheap Links', business: 'SEO Kings', business_type: 'Other', email: 'spam@example.com', status: 'spam', h: 260, improve: ['website'], context: 'Great offer for your website rankings, click here now.', country: null, website: 'https://spam.example', contact_method: null, phone: null, source: null, page_path: '/', utm: null }
    ];
    for (var i = 0; i < 9; i++) {
      rows.push({ name: 'Sample Person ' + (i + 1), business: 'Sample Business ' + (i + 1), business_type: 'Clinic or wellness', email: 'sample' + (i + 1) + '@example.com', status: ['new', 'contacted', 'closed'][i % 3], h: 300 + i * 30, improve: ['website', 'leads'], context: 'Sample request number ' + (i + 1) + ' for layout testing.', country: 'Bangladesh', website: null, contact_method: 'WhatsApp', phone: '01700 000 00' + i, source: 'Google', page_path: '/', utm: null });
    }
    rows = rows.map(function (r, idx) {
      return Object.assign({ id: '00000000-0000-4000-8000-0000000000' + (10 + idx), created_at: iso(r.h), updated_at: iso(r.h), visitor_id: null, consented_at: iso(r.h), notified_at: idx % 4 === 3 ? null : iso(r.h - 0.01), notes: null }, r);
    });
    function delay(v) { return new Promise(function (res) { setTimeout(function () { res(v); }, 220); }); }

    function from() {
      var q = { mode: 'select' };
      var b = {
        select: function () { return b; }, order: function () { return b; }, limit: function () { return b; }, single: function () { q.single = true; return b; },
        update: function (patch) { q.mode = 'update'; q.patch = patch; return b; },
        eq: function (c, v) { q.id = v; return b; },
        then: function (ok, bad) {
          var p = delay(null).then(function () {
            if (q.mode === 'update') {
              var r = rows.filter(function (x) { return x.id === q.id; })[0];
              if (/fail=1/.test(location.search)) return { data: null, error: { message: 'new row violates row-level security policy', code: '42P17', details: 'Mock failure', hint: 'Remove fail=1 to succeed.' }, status: 400 };
              Object.assign(r, q.patch, { updated_at: new Date().toISOString() });
              return { data: { id: r.id, status: r.status, notes: r.notes, updated_at: r.updated_at }, error: null, status: 200 };
            }
            return { data: rows.slice().sort(function (a, b2) { return b2.created_at < a.created_at ? -1 : 1; }), error: null, status: 200 };
          });
          return p.then(ok, bad);
        }
      };
      return b;
    }

    function dayRows(days) {
      var out = [];
      for (var d = days - 1; d >= 0; d--) {
        var dt = new Date(now - d * 24 * HOUR + 6 * HOUR);
        var ymd = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
        var v = Math.round(6 + 10 * Math.abs(Math.sin(d * 1.7)) + (d % 7 === 0 ? 14 : 0));
        out.push({ day: ymd, visitors: v, pageviews: Math.round(v * 2.4) });
      }
      return out;
    }
    var topData = {
      page: [['/', 214], ['/business-review.html', 96], ['/work.html', 71], ['/solutions.html', 44], ['/about.html', 31], ['/who-we-help.html', 22]],
      referrer: [['(direct)', 190], ['linkedin.com', 88], ['google.com', 61], ['instagram.com', 23], ['l.facebook.com', 9]],
      utm_source: [['linkedin', 54], ['newsletter', 18], ['whatsapp', 7]],
      cta: [['Book a Business Review', 63], ['See our work', 29], ['Explore this journey', 14], ['Contact us', 8]],
      case: [['Xen Developments', 17], ['Noholi Library', 9], ['Angel Foundation', 4]],
      device: [['mobile', 301], ['desktop', 182], ['tablet', 12]]
    };
    var newCount = function () { return rows.filter(function (r) { return r.status === 'new'; }).length; };

    var user = { email: 'admin@experius.xyz' };
    var signedIn = !/login=1/.test(location.search);
    var listeners = [];
    return {
      auth: {
        getSession: function () { return delay({ data: { session: signedIn ? { user: user } : null }, error: null }); },
        signInWithPassword: function (c) {
          return delay(c.password === 'wrong' ? { data: null, error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 } } : (signedIn = true, { data: { session: { user: { email: c.email } } }, error: null }));
        },
        updateUser: function (u) {
          return delay(u.password === 'failfailfail' ? { data: null, error: { message: 'New password should be different from the old password.', code: 'same_password', status: 422 } } : { data: { user: user }, error: null });
        },
        signOut: function () { signedIn = false; listeners.forEach(function (f) { f('SIGNED_OUT'); }); return Promise.resolve({ error: null }); },
        onAuthStateChange: function (f) { listeners.push(f); return { data: { subscription: { unsubscribe: function () {} } } }; }
      },
      from: from,
      rpc: function (name, args) {
        return delay(null).then(function () {
          var days = args && args.days;
          if (name === 'is_admin') return { data: true, error: null, status: 200 };
          if (name === 'admin_analytics_daily') return { data: dayRows(days), error: null, status: 200 };
          if (name === 'admin_top') return { data: (topData[args.dim] || []).map(function (t) { return { key: t[0], count: Math.round(t[1] * days / 30) }; }), error: null, status: 200 };
          if (name === 'admin_analytics_summary') {
            var f = days / 30;
            return { data: { days: days, since: iso(days * 24), visitors: Math.round(495 * f), sessions: Math.round(610 * f), pageviews: Math.round(1180 * f), cta_clicks: Math.round(114 * f), form_starts: Math.round(40 * f), form_submits: Math.round(17 * f), requests: Math.round(15 * f), new_requests: newCount(), start_to_submit_pct: 42.5, visitor_to_request_pct: 3.4 }, error: null, status: 200 };
          }
          return { data: null, error: { message: 'Unknown rpc ' + name }, status: 404 };
        });
      }
    };
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    dom = {
      nobackend: $('#view-nobackend'), login: $('#view-login'), app: $('#view-app'),
      loginForm: $('#login-form'), loginEmail: $('#login-email'), loginPassword: $('#login-password'),
      loginSubmit: $('#login-submit'), loginError: $('#login-error'), loginNotice: $('#login-notice'),
      userEmail: $('#user-email'), signout: $('#signout'),
      tabs: $$('.a-tab'), panels: { overview: $('#panel-overview'), requests: $('#panel-requests'), analytics: $('#panel-analytics'), settings: $('#panel-settings') },
      pwForm: $('#pw-form'), pwUsername: $('#pw-username'), pwCurrent: $('#pw-current'), pwNew: $('#pw-new'), pwConfirm: $('#pw-confirm'),
      pwError: $('#pw-error'), pwOk: $('#pw-ok'), pwSubmit: $('#pw-submit'),
      rangeWrap: $('#range-wrap'), rangeSeg: $('#range'), refresh: $('#refresh'),
      ovTiles: $('#ov-tiles'), ovLatest: $('#ov-latest'), ovAll: $('#ov-all'),
      rqStatus: $('#rq-status'), rqSearch: $('#rq-search'), rqExport: $('#rq-export'), rqCount: $('#rq-count'), rqBody: $('#rq-body'),
      anBody: $('#an-body'),
      drawer: $('#drawer'), drawerTitle: $('#drawer-title'), drawerDate: $('#drawer-date'), drawerBody: $('#drawer-body'), drawerClose: $('#drawer-close')
    };

    var saved = Number(lsGet(RANGE_KEY));
    setRange(RANGES.indexOf(saved) === -1 ? 30 : saved);

    dom.loginForm.addEventListener('submit', onLoginSubmit);
    dom.signout.addEventListener('click', onSignOut);
    dom.tabs.forEach(function (t) { t.addEventListener('click', function () { var name = t.getAttribute('data-tab'); if (location.hash !== '#' + name) location.hash = '#' + name; }); });
    $('.a-tabs').addEventListener('keydown', onTabKey);
    window.addEventListener('hashchange', function () { activate(readHash()); });
    dom.rangeSeg.addEventListener('change', onRangeChange);
    dom.refresh.addEventListener('click', onRefresh);

    dom.rqStatus.addEventListener('change', function () { state.rq.status = dom.rqStatus.value; renderRequests(); });
    var searchTimer = null;
    dom.rqSearch.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.rq.search = dom.rqSearch.value; renderRequests(); }, 120);
    });
    dom.rqExport.addEventListener('click', exportCsv);
    dom.pwForm.addEventListener('submit', onPasswordSubmit);

    dom.drawerClose.addEventListener('click', function () { dom.drawer.close(); });
    dom.drawer.addEventListener('click', function (ev) { if (ev.target === dom.drawer) dom.drawer.close(); });
    dom.drawer.addEventListener('close', onDrawerClosed);

    window.addEventListener('resize', function () { if (state.tab === 'analytics') redrawChart(); });

    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
