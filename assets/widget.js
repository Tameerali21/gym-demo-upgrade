/* Kai — "Never Miss a Customer" demo chat engine (gym / fitness coaching edition).
   100% client-side. No network calls, no tracking. Works from file:// .
   Test hooks: ?fast=1 skips delays; window.__maya exposes state + send(). */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var FAST = qs.get('fast') === '1';

  /* ---------- business profile (personalizable via ?biz= etc.) ---------- */
  var BIZ = {
    name:    qs.get('biz')     || 'VoltHaus Performance Coaching',
    tagline: qs.get('tagline') || 'Online Fitness & Performance Coaching',
    city:    qs.get('city')    || 'Raleigh, NC',
    address: qs.get('addr') || qs.get('address') || '214 Fayetteville St, Raleigh, NC 27601',
    phone:   qs.get('phone')   || '(919) 555-0148',
    host: 'Kai'
  };
  // short ref prefix from the name's initials, e.g. "VoltHaus Performance" -> "VP", "Hessey Performance" -> "HP"
  BIZ.refPrefix = (BIZ.name.split(/\s+/).map(function (w) { return w.charAt(0); }).filter(function (c) { return /[A-Za-z]/.test(c); }).join('').slice(0, 2).toUpperCase()) || 'VP';

  /* apply personalization to the page */
  function personalize() {
    document.querySelectorAll('[data-biz="name"]').forEach(function (el) { el.textContent = BIZ.name; });
    document.querySelectorAll('[data-biz="tagline"]').forEach(function (el) { el.textContent = BIZ.tagline; });
    document.querySelectorAll('[data-biz="city"]').forEach(function (el) { el.textContent = BIZ.city; });
    document.querySelectorAll('[data-biz="address"]').forEach(function (el) { el.textContent = BIZ.address; });
    document.querySelectorAll('[data-biz="phone"]').forEach(function (el) { el.textContent = BIZ.phone; });
    /* tap-to-call must dial the personalized number, not the hardcoded default (fleet QA rule).
       digits-and-plus-only in the href so a hostile ?phone= param can't smuggle markup/JS. */
    document.querySelectorAll('#call-cta, a[data-biz="phone"]').forEach(function (el) { el.setAttribute('href', 'tel:' + String(BIZ.phone).replace(/[^+\d]/g, '')); });
    document.querySelectorAll('[data-biz="host"]').forEach(function (el) { el.textContent = BIZ.host; });
    document.querySelectorAll('[data-biz="host-initial"]').forEach(function (el) { el.textContent = BIZ.host.charAt(0); });
    /* addr-card heading (fleet pattern: explicit id binding) */
    var ab = document.getElementById('addr-biz');
    if (ab) ab.textContent = BIZ.name;
    document.title = BIZ.name + ' — ' + BIZ.tagline + ' | ' + BIZ.city;
  }
  /* ---------- deep personalization: ?services= ?hours= ----------
     services: pipe-separated REAL service names -> rendered into the services grid (max 8).
     hours: pipe-separated "Day(s): time" pairs -> rendered into the hours table (max 6).
     Graceful fallback: the page keeps its built-in fictional content when a param is absent. */
  function dpEsc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function deepPersonalize() {
    var svc = qs.get('services');
    if (svc) {
      var items = svc.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 8);
      var grid = document.querySelector('#services .menu-grid, #menu .menu-grid, #rooms .menu-grid, #practice .menu-grid, #services .cards');
      if (grid && items.length) {
        var isCards = grid.classList.contains('cards');
        grid.innerHTML = items.map(function (name) {
          var n = dpEsc(name);
          if (isCards) {
            return '<div class="card"><div class="ico">&#10003;</div><h3>' + n + '</h3>' +
              '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; chat below for details &amp; pricing.</p></div>';
          }
          return '<div class="menu-card"><div class="cat">Programme</div><h3>' + n + '</h3>' +
            '<p>Offered at ' + dpEsc(BIZ.name) + ' &mdash; ask ' + dpEsc(BIZ.host) + ' below for details &amp; pricing.</p></div>';
        }).join('');
      }
    }
    var hrs = qs.get('hours');
    if (hrs) {
      var rows = hrs.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s; }).slice(0, 6);
      var table = document.querySelector('table.hours') || document.querySelector('#visit table');
      if (table && rows.length) {
        var chatCell = null;
        Array.prototype.forEach.call(table.rows, function (r) {
          if (/chat/i.test(r.textContent) && r.cells[1]) chatCell = r.cells[1].innerHTML;
        });
        var html = rows.map(function (r) {
          var i = r.indexOf(':');
          var day = (i > 0 ? r.slice(0, i) : r).trim();
          var time = (i > 0 ? r.slice(i + 1) : '').trim();
          return '<tr><td>' + dpEsc(day) + '</td><td>' + dpEsc(time) + '</td></tr>';
        }).join('');
        if (chatCell) html += '<tr><td>Chat with ' + dpEsc(BIZ.host) + '</td><td>' + chatCell + '</td></tr>';
        table.innerHTML = html;
      }
    }
  }


  /* ---------- leads (localStorage only) ---------- */
  var LEAD_KEY = 'nmc_gym_leads';
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem(LEAD_KEY) || '[]'); } catch (e) { leads = []; }
  function saveLead(l) {
    l.at = new Date().toISOString(); l.biz = BIZ.name;
    leads.push(l);
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(leads)); } catch (e) {}
    renderInbox(); /* keep the prospect-visible inbox panel live */
  }

  /* ---------- captured-leads inbox preview (prospect-visible panel) ---------- */
  var inboxEls = null;
  function inboxDom() {
    if (!inboxEls) {
      var p = document.getElementById('inbox-panel'),
          l = document.getElementById('inbox-list'),
          t = document.getElementById('inbox-toggle'),
          c = document.getElementById('inbox-count');
      if (!p || !l || !t) return null;
      inboxEls = { panel: p, list: l, toggle: t, count: c };
    }
    return inboxEls;
  }
  function fmtLeadTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso || '';
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return iso || ''; }
  }
  function renderInbox() {
    var dom = inboxDom();
    if (!dom) return;
    if (dom.count) dom.count.textContent = String(leads.length);
    if (!leads.length) {
      dom.list.innerHTML = '<div class="inbox-empty"><b>No leads yet</b> &mdash; try the &#127769; 11:42 PM after-hours flow in the chat &mdash; the captured lead will appear right here.</div>';
      return;
    }
    dom.list.innerHTML = leads.slice().reverse().map(function (l) {
      var when = l.at
        ? '<time datetime="' + escapeHtml(l.at) + '">' + escapeHtml(fmtLeadTime(l.at)) + '</time>'
        : '&mdash;';
      var detail = (l.details && l.details !== '\u2014' && l.details !== '-')
        ? '<div class="lead-detail">&ldquo;' + escapeHtml(l.details) + '&rdquo;</div>'
        : '';
      return '<div class="lead-row">' +
        '<span class="lead-name">' + escapeHtml(l.name || '\u2014') + '</span>' +
        '<span class="lead-tag">' + escapeHtml(l.topic || 'Lead') + '</span>' +
        '<span class="lead-phone">' + escapeHtml(l.phone || '\u2014') + '</span>' +
        '<span class="lead-src">' + escapeHtml(l.source || '') + '</span>' +
        '<div class="lead-when">Captured ' + when + '</div>' +
        detail +
        '</div>';
    }).join('');
  }

  /* ---------- dom ---------- */
  var panel, msgs, chipsBox, input, bubble, unread, closeBtn;
  var opened = false, autoOpened = false, greeted = false;

  /* conversation state */
  var S = {
    mode: 'idle',          // idle | booking | afterhours | review
    step: 0,
    booking: {},
    ah: {},
    lastTopic: null
  };

  function $(id) { return document.getElementById(id); }

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, FAST ? 0 : ms); });
  }

  function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  /* ---------- rendering ---------- */
  function addUser(text) {
    var row = el('div', 'mrow user');
    row.appendChild(el('div', 'bubble', escapeHtml(text)));
    msgs.appendChild(row); scrollDown();
  }

  function addBot(html, opts) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble', html);
    row.appendChild(b);
    msgs.appendChild(row);
    if (opts && opts.notice) b.classList.add('notice');
    scrollDown();
    return b;
  }

  function addNotice(html) {
    var row = el('div', 'mrow bot');
    row.appendChild(el('div', 'notice', html));
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function addDashCard(rows) {
    var row = el('div', 'mrow bot');
    var card = el('div', 'dashcard');
    card.appendChild(el('div', 'dl-head', '&#128203; Saved to your dashboard'));
    rows.forEach(function (r) {
      card.appendChild(el('div', 'dl-row', '<span>' + r[0] + ':</span> <b>' + escapeHtml(r[1]) + '</b>'));
    });
    row.appendChild(card);
    row.style.maxWidth = '100%';
    msgs.appendChild(row); scrollDown();
  }

  function showTyping() {
    var row = el('div', 'mrow bot', '');
    row.id = 'maya-typing-row';
    row.appendChild(el('div', 'mavatar', BIZ.host.charAt(0)));
    var b = el('div', 'bubble typing', '<i></i><i></i><i></i>');
    row.appendChild(b);
    msgs.appendChild(row); scrollDown();
  }
  function hideTyping() {
    var t = $('maya-typing-row');
    if (t) t.remove();
  }

  function setChips(list) {
    chipsBox.innerHTML = '';
    (list || []).forEach(function (c) {
      var btn = el('button', 'chip', c.label);
      btn.type = 'button';
      btn.addEventListener('click', function () { userSays(c.value || btn.textContent, c.silent); });
      chipsBox.appendChild(btn);
    });
    scrollDown();
  }

  function showStars() {
    chipsBox.innerHTML = '';
    var wrap = el('div', 'stars-row');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var s = el('button', 'star-btn', '&#11088;');
        s.type = 'button';
        s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        s.addEventListener('click', function () { pickStars(n); });
        wrap.appendChild(s);
      })(i);
    }
    chipsBox.appendChild(wrap);
    scrollDown();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- tap-to-call helper (fleet standard) ----------
     href is digits-and-plus-only (XSS-safe even from a hostile ?phone= param);
     the visible text reuses the normal phone escaping. */
  function callLinkHtml() {
    var href = 'tel:' + String(BIZ.phone).replace(/[^+\d]/g, '');
    return '<a class="call-link" href="' + escapeHtml(href) + '">&#128222; Call ' + escapeHtml(BIZ.phone) + '</a>';
  }

  /* ---------- bot speech ---------- */
  function say(html, chips, opts) {
    showTyping();
    var wait = Math.min(700 + html.length * 6, 1900);
    return delay(wait).then(function () {
      hideTyping();
      addBot(html);
      setChips(chips);
    });
  }

  function sayMany(items) {
    // items: [{html, chips, notice, dash}]
    var p = Promise.resolve();
    items.forEach(function (it) {
      p = p.then(function () {
        showTyping();
        var wait = Math.min(600 + (it.html || '').length * 5, 1700);
        return delay(wait).then(function () {
          hideTyping();
          if (it.dash) { addDashCard(it.dash); }
          else if (it.notice) { addNotice(it.html); }
          else { addBot(it.html); }
          setChips(it.chips);
        });
      });
    });
    return p;
  }

  /* ---------- helpers ---------- */
  function makeRef() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    var r = '';
    for (var i = 0; i < 5; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return BIZ.refPrefix + '-' + r;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* word-start keyword match (proven 2026-10-03 standard): "anywhere" must not
     trigger the "where" branch, "recall" must not trigger the "call you" branch,
     "foreclosure" must not trip the "close" hours keyword, "starving" must not
     trip the "stars" review branch. Prefix keywords like 'schedul'/'nutrit'
     still match 'schedule'/'nutrition'; phrases keep word-start match. */
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function has(t) {
    var words = Array.prototype.slice.call(arguments, 1);
    return words.some(function (w) {
      return new RegExp('(^|[^a-z])' + escRe(w)).test(t);
    });
  }

  /* ---------- intent answers ---------- */
  function hoursHtml() {
    return '<b>Coaching hours:</b><br>Mon&ndash;Fri &middot; 6 AM &ndash; 8 PM<br>' +
      'Saturday &middot; 8 AM &ndash; 12 PM<br>Sunday &middot; rest day<br><br>' +
      'Discovery calls and check-ins run in those hours &mdash; but I answer messages <b>24/7</b>. Want me to book your free discovery call?';
  }

  function pricingHtml() {
    return 'Here&rsquo;s the full menu &mdash; these are the <b>demo prices</b> listed on this page:<br><br>' +
      '&#127947; <b>1:1 Online Coaching</b> &mdash; $249/mo<br>' +
      '&#128293; <b>12-Week Signature Programme</b> &mdash; $599 one-time<br>' +
      '&#9889; <b>Hybrid Coaching</b> &mdash; $349/mo<br>' +
      '&#128101; <b>Small-Group Coaching</b> (max 6) &mdash; $149/mo<br>' +
      '&#129367; <b>Nutrition Check-Ins</b> add-on &mdash; $79/mo<br>' +
      '&#127942; <b>Competition Prep</b> &mdash; $449/mo<br><br>' +
      'Every plan starts with a <b>free discovery call</b> &mdash; no card, no pressure. Want me to book yours?';
  }

  function servicesHtml() {
    return 'Everything is built around one thing: a plan you&rsquo;ll actually follow. &#128170;<br><br>' +
      'Ask me about <b>1:1 coaching</b>, the <b>12-week signature programme</b>, <b>nutrition check-ins</b> or <b>competition prep</b> &mdash; or ask for <b>prices</b> and I&rsquo;ll list them all. ' +
      'Or skip ahead: shall I book your <b>free discovery call</b>?';
  }

  function signatureHtml() {
    return 'The <b>12-Week Signature Programme</b> is our flagship: a full training block built around your goal, nutrition targets set from week 1, and weekly check-ins so the plan adapts as you progress. &#128293;<br><br>' +
      'It&rsquo;s <b>$599 one-time</b> (demo price) &mdash; and it starts with a free discovery call so we can check it&rsquo;s the right fit before you commit. Book yours?';
  }

  function nutritionHtml() {
    return 'Nutrition is half the result. &#129367;<br><br>' +
      'With <b>Nutrition Check-Ins ($79/mo add-on)</b> you send your food diary each week and get macro targets adjusted to your training &mdash; no crash diets, no banned foods. ' +
      'It&rsquo;s included free inside the 12-Week Signature Programme. Want to talk it through on a free discovery call?';
  }

  function oneOnOneHtml() {
    return '<b>1:1 Online Coaching</b> is the full package: a custom programme built for your goal and schedule, weekly check-ins, nutrition targets, and direct message access to the coach. &#127947;<br><br>' +
      'It&rsquo;s <b>$249/mo</b> (demo price) with no lock-in contract &mdash; and it starts with a free discovery call. Shall I book you in?';
  }

  function groupHtml() {
    return '<b>Small-Group Coaching</b> keeps the crew tiny &mdash; max 6 people per group &mdash; so you still get individual targets and form checks, at <b>$149/mo</b> (demo price). &#128101;<br><br>' +
      'Great if you train better with people counting on you. Want a free discovery call to see if a group fits?';
  }

  function compHtml() {
    return '<b>Competition Prep</b> is our advanced track: full prep programming, peak-week planning, posing check-ins, and show-day support &mdash; <b>$449/mo</b> (demo price). &#127942;<br><br>' +
      'It&rsquo;s application-only so the coach can check your timeline is realistic. A free discovery call is the first step &mdash; book one?';
  }

  function onlineHtml() {
    return 'All coaching is delivered <b>online</b> &mdash; you train wherever you are: home, gym, or a hotel room at 6 AM. &#128241;<br><br>' +
      'Your programme lives in the coaching app, you send form-check videos, and we adjust everything at your weekly check-in. Hybrid clients add one in-person session a month at our HQ in ' + escapeHtml(BIZ.city) + '. Sound good?';
  }

  function resultsHtml() {
    return 'Honest answer: <b>nobody can promise you a number on the scale</b> &mdash; and you should run from any coach who does. &#127939;<br><br>' +
      'What we <i>can</i> promise: a plan built for you, weekly check-ins, and adjustments when life gets in the way. Clients who follow the plan consistently see steady, measurable progress. Want a realistic plan for your goal? Book a free discovery call.';
  }

  function injuryHtml() {
    return 'Quick note on that: we&rsquo;re coaches, not doctors &mdash; if you&rsquo;re injured or managing a medical condition, please get cleared by your physician first. &#129658;<br><br>' +
      'Once you&rsquo;re cleared, we adapt training around limitations all the time. Want to talk it through on a free discovery call?';
  }

  function defaultChips() {
    return [
      { label: '&#128170; Programmes &amp; prices' },
      { label: '&#128197; Book a free discovery call' },
      { label: '&#127769; After-hours demo' },
      { label: '&#11088; Rate your experience' }
    ];
  }

  function greet() {
    greeted = true;
    return say(
      'Hey! I\'m <b>' + escapeHtml(BIZ.host) + '</b>, ' + escapeHtml(BIZ.name) + '\'s coaching coordinator. &#128170;<br><br>' +
      'Ask me about <b>programmes</b>, <b>prices</b> or <b>nutrition</b> &mdash; or I can book your <b>free discovery call</b> right now. What are you working towards?',
      defaultChips()
    );
  }

  /* ---------- flows ---------- */
  var GOALS = ['Fat Loss', 'Build Muscle', 'Athletic Performance', 'General Fitness', 'Nutrition Coaching'];

  function startBooking() {
    S.mode = 'booking'; S.step = 0; S.booking = {};
    return say('Love it &mdash; your first step is a <b>free discovery call</b> with the coach (20 minutes, zero pressure). <b>What\'s your main goal?</b>',
      GOALS.map(function (g) { return { label: g }; }));
  }

  function bookingStep(text) {
    var t = text.toLowerCase().trim();
    if (S.step === 0) {
      var goal = 'General Fitness';
      if (has(t, 'fat', 'lose', 'weight loss', 'weight', 'slim', 'lean out')) goal = 'Fat Loss';
      else if (has(t, 'muscle', 'bulk', 'gain muscle', 'build', 'bigger', 'hypertrophy')) goal = 'Build Muscle';
      else if (has(t, 'performance', 'athletic', 'sport', 'strength', 'faster', 'compete', 'competition')) goal = 'Athletic Performance';
      else if (has(t, 'nutrition', 'food', 'diet', 'meal', 'macro', 'eat')) goal = 'Nutrition Coaching';
      else if (has(t, 'general', 'fit', 'fitness', 'healthy', 'start', 'beginner', 'shape')) goal = 'General Fitness';
      S.booking.goal = goal; S.step = 1;
      return say('<b>' + escapeHtml(goal) + '</b> &mdash; perfect, that\'s exactly what the discovery call is for. <b>What\'s your name?</b>');
    }
    if (S.step === 1) {
      var name = text.trim();
      if (name.length < 2 || name.length > 40) {
        return say('And your <b>name</b> for the booking?');
      }
      S.booking.name = name; S.step = 2;
      return say('Thanks, ' + escapeHtml(cap(name.split(' ')[0])) +
        '! Want a <b>text reminder</b> before your call? Drop your number &mdash; or skip it.',
        [{ label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      var digits = t.replace(/\D/g, '');
      if (t !== 'skip' && digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(or tap Skip)</i>',
          [{ label: 'Skip', value: 'skip' }]);
      }
      if (t !== 'skip') S.booking.phone = text.trim();
      S.step = 3;
      return say('<b>Which day</b> works best for your call?',
        [{ label: 'Tomorrow' }, { label: 'Monday' }, { label: 'Wednesday' }, { label: 'Saturday' }]);
    }
    if (S.step === 3) {
      var day = 'Monday';
      if (has(t, 'tomorrow', 'today')) day = 'Tomorrow';
      else {
        var dm = t.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/);
        if (dm) day = cap(dm[0]);
      }
      S.booking.day = day; S.step = 4;
      return say('<b>' + escapeHtml(day) + '</b> it is. <b>Morning or evening</b> &mdash; what time suits you?',
        [{ label: '7:00 AM' }, { label: '9:00 AM' }, { label: '12:00 PM' }, { label: '5:30 PM' }, { label: '7:00 PM' }]);
    }
    if (S.step === 4) {
      var tm = t.match(/\d{1,2}(:\d{2})?\s*(am|pm)?/);
      if (!tm) {
        return say('What <b>time</b> should I hold for you? <i>(e.g. 5:30 PM)</i>',
          [{ label: '7:00 AM' }, { label: '12:00 PM' }, { label: '5:30 PM' }]);
      }
      var time = text.trim();
      if (!/am|pm/i.test(time)) time += ' PM';
      var ref = makeRef();
      S.booking.ref = ref;
      var line = '<b>&#9989; You\'re booked in!</b><br><br><b>Free discovery call &middot; ' + escapeHtml(S.booking.goal) + '</b> &middot; ' +
        escapeHtml(S.booking.day) + ' at <b>' + escapeHtml(time) + '</b><br>Name: <b>' + escapeHtml(S.booking.name) + '</b><br>' +
        'Reference: <span class="ref">' + ref + '</span><br><br>';
      if (S.booking.phone) line += 'We\'ll text your reminder. ';
      line += 'The coach will call you at your chosen time &mdash; have your questions ready. Anything else I can help with?<br><br>Prefer to talk it through? ' + callLinkHtml();
      S.mode = 'idle'; S.step = 0;
      return say(line, [{ label: '&#128170; Programmes & prices' }, { label: '&#128336; Hours & HQ' }]);
    }
  }

  function startAfterHours() {
    S.mode = 'afterhours'; S.step = 0; S.ah = {};
    return sayMany([
      {
        notice: true,
        html: '&#127769; <b>It\'s 11:42 PM</b> &mdash; the coach is done training clients for the day, but I\'m ' + escapeHtml(BIZ.host) +
          ', ' + escapeHtml(BIZ.name) + '\'s coaching coordinator, and I never clock out. <b>No enquiry waits till morning.</b>'
      },
      { html: 'Thinking about getting started? Leave your <b>name</b> and I\'ll make sure the coach sees you first tomorrow &mdash; <b>new enquiries jump the queue</b>.' }
    ]);
  }

  function afterHoursStep(text) {
    var t = text.trim();
    if (S.step === 0) {
      if (t.length < 2 || t.length > 40 || /\d/.test(t)) {
        return say('What <b>name</b> should I save this under?');
      }
      S.ah.name = t; S.step = 1;
      return say('Thanks, ' + escapeHtml(cap(t.split(' ')[0])) + '! And the best <b>number</b> for the coach to reach you on tomorrow?');
    }
    if (S.step === 1) {
      var digits = t.replace(/\D/g, '');
      if (digits.length < 7) {
        return say('Hmm, that doesn\'t look like a complete number &mdash; mind double-checking it? <i>(digits only is fine)</i>');
      }
      S.ah.phone = t; S.step = 2;
      return say('Got it. Last one &mdash; <b>what\'s your goal?</b> <i>(e.g. "lose fat", "build muscle")</i>',
        [{ label: 'Lose fat', value: 'Fat loss goal' }, { label: 'Build muscle', value: 'Muscle gain goal' }, { label: 'Perform better', value: 'Performance goal' }, { label: 'Skip', value: 'skip' }]);
    }
    if (S.step === 2) {
      S.ah.concern = (t.toLowerCase() === 'skip') ? 'General enquiry' : t;
      saveLead({ name: S.ah.name, phone: S.ah.phone, concern: S.ah.concern, topic: S.ah.concern, details: '—', source: 'after-hours 11:42 PM' });
      S.mode = 'idle'; S.step = 0;
      return sayMany([
        { html: '<b>&#9989; Saved!</b> The coach will reach out <b>first thing tomorrow</b> &mdash; no need to lie awake wondering if anyone saw your message.' },
        {
          dash: [
            ['New lead', S.ah.name],
            ['Phone', S.ah.phone],
            ['Goal', S.ah.concern],
            ['Captured', '11:42 PM (after hours)']
          ]
        },
        {
          html: 'That\'s the whole point &mdash; <b>every late-night "I need to change" moment becomes a booked call</b>, not a lead lost to the next coach. Anything else tonight?',
          chips: defaultChips()
        }
      ]);
    }
  }

  function startReview() {
    S.mode = 'review'; S.step = 0;
    return say('We\'d love to hear it &mdash; <b>how is your coaching going?</b> Tap the stars:').then(function () {
      showStars();
    });
  }

  function pickStars(n) {
    chipsBox.innerHTML = '';
    addUser('\u2B50'.repeat(n));
    if (n === 5) {
      S.mode = 'idle';
      say('That fired the whole team up! &#128525;<br><br>Would you <b>share that on Google</b>? It genuinely keeps a small coaching business like ours growing.',
        [{ label: 'Not now', value: 'not now' }]).then(function () {
          var row = document.querySelector('#maya-msgs .mrow.bot:last-child .bubble');
          if (row) {
            var a = document.createElement('a');
            a.className = 'gbtn'; a.href = 'https://www.google.com/maps'; a.target = '_blank'; a.rel = 'noopener';
            a.textContent = '\u2B50 Leave a Google review';
            row.appendChild(document.createElement('br'));
            row.appendChild(a); scrollDown();
          }
        });
    } else {
      S.mode = 'review'; S.step = 1;
      say('Thank you for being honest &mdash; that\'s how we get better. <b>What could we do better</b> next time?');
    }
  }

  function reviewStep(text) {
    S.mode = 'idle'; S.step = 0;
    saveLead({ name: '(review feedback)', phone: '\u2014', topic: 'Private feedback', details: text.trim(), source: 'review routing' });
    return say('<b>Noted &mdash; truly.</b> The coach will personally follow up on this.<br><br>' +
      'We\'d love a chance to earn those last stars back. Can I book you a <b>free follow-up call</b> to make it right?',
      [{ label: '&#128197; Book a free discovery call' }, { label: 'No thanks', value: 'no thanks' }]);
  }

  /* ---------- main router ---------- */
  function route(text) {
    var t = text.toLowerCase().trim();

    if (S.mode === 'booking') return bookingStep(text);
    if (S.mode === 'afterhours') return afterHoursStep(text);
    if (S.mode === 'review' && S.step === 1) return reviewStep(text);

    if (has(t, 'book', 'consult', 'discovery', 'schedul', 'sign up', 'join', 'get started', 'free call', 'appointment', 'call back')) return startBooking();
    if (has(t, 'after hour', 'after-hour', 'closed', 'late night', 'midnight', '11:42')) return startAfterHours();
    if (has(t, 'review', 'rate your', 'stars', 'feedback')) return startReview();
    if (has(t, 'injur', 'hurt', 'sore', 'pain', 'knee', 'back prob', 'doctor', 'medical', 'rehab', 'condition')) return say(injuryHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'price', 'pricing', 'cost', 'how much', 'fee', '$$', 'expensive', 'cheap', 'prices')) return say(pricingHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'signature', '12 week', '12-week', 'flagship')) return say(signatureHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'nutrition', 'nutrit', 'food', 'diet', 'meal', 'macro', 'eating', 'eat', 'calorie')) return say(nutritionHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'group', 'small group', 'crew', 'buddy', 'partner training')) return say(groupHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'competition prep', 'comp prep', 'show prep', 'bodybuilding show', 'peak week')) return say(compHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, '1:1', 'one-on-one', 'one on one', 'personal train', 'private coach')) return say(oneOnOneHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'online', 'remote', 'virtual', 'from home', 'app based')) return say(onlineHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'result', 'guarantee', 'transform', 'how long', 'will i lose', 'does it work', 'work for me')) return say(resultsHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'service', 'programme', 'program', 'offer', 'do you do', 'plans', 'options', 'coaching')) return say(servicesHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    /* location branch runs before hours (house standard) */
    if (has(t, 'where', 'address', 'location', 'direction', 'find you', 'based')) {
      return say('We coach <b>online everywhere</b> &mdash; and hybrid clients meet us at our HQ studio: <b>' + escapeHtml(BIZ.address) + '</b>. &#128205;<br><br>' + callLinkHtml() + ' &mdash; we\'re happy to help anytime.',
        [{ label: '&#128197; Book a free discovery call' }]);
    }
    if (has(t, 'hour', 'open', 'close', 'when do you', 'what time')) return say(hoursHtml(), [{ label: '&#128197; Book a free discovery call' }]);
    if (has(t, 'human', 'real person', 'person', 'call you', 'phone number', 'speak to', 'talk to the coach', 'real coach')) return say('Of course &mdash; ' + callLinkHtml() + ' during coaching hours and a real human picks up. But honestly? I can handle <b>programmes, prices, and bookings</b> right here, even at 2 AM. &#128521;', defaultChips());
    if (has(t, 'thank', 'thanks', 'thx', 'great', 'awesome', 'perfect')) return say('Anytime! That\'s what I\'m here for. &#128170;', defaultChips());
    if (has(t, 'bye', 'goodbye', 'see you', 'later')) { S.mode = 'idle'; return say('Stay strong &mdash; see you soon at ' + escapeHtml(BIZ.name) + '! &#128170;'); }
    if (/\b(hi+|hello|hey+|hola|yo)\b/.test(t) || has(t, 'good morning', 'good evening')) return say('Hey hey! &#128075; What are you working towards &mdash; <b>fat loss</b>, <b>muscle</b>, <b>performance</b>? Or shall I book your <b>free discovery call</b>?', defaultChips());
    if (has(t, 'no thanks', 'not now', 'nope', "i'm good", 'im good')) { S.mode = 'idle'; return say('No worries at all! I\'m here whenever you need me. &#128170;', defaultChips()); }

    /* graceful fallback — never dead-ends */
    S.lastTopic = text;
    return say('Great question &mdash; let me have the coach confirm that for you. &#128172;<br><br>Meanwhile, can I help with a <b>free discovery call</b>, our <b>programmes</b>, or <b>prices</b>?',
      [{ label: '&#128197; Book a free discovery call' }, { label: '&#128170; Programmes & prices' }, { label: '&#128336; Hours & HQ' }]);
  }

  function userSays(text, silent) {
    if (!text || !text.trim()) return Promise.resolve();
    text = text.trim();
    setChips([]);
    if (!silent) addUser(text);
    return route(text);
  }

  /* ---------- open / close ---------- */
  function openPanel(silent) {
    opened = true;
    panel.classList.add('open');
    bubble.classList.add('hidden');
    unread.classList.add('hidden');
    if (!greeted && !silent) greet();
  }
  function closePanel() {
    opened = false;
    panel.classList.remove('open');
    bubble.classList.remove('hidden');
  }

  function init() {
    panel = $('maya-panel'); msgs = $('maya-msgs'); chipsBox = $('maya-chips');
    input = $('maya-input'); bubble = $('maya-bubble'); unread = $('maya-unread'); closeBtn = $('maya-close');
    personalize();
    deepPersonalize();

    /* bubble click greets normally; hero CTA passes silent=true to skip straight to booking */
    bubble.addEventListener('click', function () { openPanel(); });
    closeBtn.addEventListener('click', closePanel);
    $('maya-send').addEventListener('click', function () { userSays(input.value); input.value = ''; input.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { userSays(input.value); input.value = ''; }
    });

    /* hero CTA opens widget straight into booking */
    document.querySelectorAll('[data-action="book"]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        openPanel(true); /* silent: goes straight to booking, no greeting */
        setTimeout(function () { if (S.mode === 'idle') startBooking(); }, FAST ? 50 : 600);
      });
    });

    /* proactive nudge — once, ~8s in */
    setTimeout(function () {
      if (!opened && !autoOpened) {
        autoOpened = true;
        unread.classList.remove('hidden');
        bubble.classList.add('hidden');
        panel.classList.add('open');
        opened = true;
        if (!greeted) greet();
      }
    }, FAST ? 600 : 8000);

    /* captured-leads inbox toggle (prospect-visible "Saved to your dashboard") */
    var idom = inboxDom();
    if (idom) {
      renderInbox();
      idom.toggle.addEventListener('click', function () {
        var isHidden = idom.panel.hasAttribute('hidden');
        if (isHidden) { idom.panel.removeAttribute('hidden'); renderInbox(); }
        else { idom.panel.setAttribute('hidden', ''); }
        idom.toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });
    }

    /* test hooks */
    window.__maya = {
      BIZ: BIZ, S: S,
      send: function (t) { openPanel(); return userSays(t); },
      open: openPanel, close: closePanel,
      pickStars: pickStars,
      saveLead: saveLead, renderInbox: renderInbox,
      getLeads: function () { return leads; },
      clearLeads: function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} renderInbox(); }
    };
    window.__getLeads = function () { return leads; };
    window.__clearLeads = function () { leads = []; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} renderInbox(); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
