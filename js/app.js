/* packing-list-bd \u2014 DOM layer. All rendering via textContent (XSS-safe). */
(function () {
  'use strict';
  var L = window.PLBD_LOGIC;
  var D = window.PLBD_DATA;
  var LS_KEY = 'packing-list-bd-v1';

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return L.emptyState();
      var parsed = L.parseImport(raw);
      if (parsed.ok) return parsed.state;
    } catch (e) { /* corrupted storage: start fresh */ }
    return L.emptyState();
  }
  function save() {
    try { localStorage.setItem(LS_KEY, L.serialize(state)); } catch (e) { /* storage full/blocked */ }
  }

  function t(key) {
    var dict = D.I18N[state.lang] || D.I18N.en;
    return dict[key] || D.I18N.en[key] || key;
  }
  function num(n) {
    return state.lang === 'bn' ? L.toBnDigits(n) : String(n);
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    renderTypeSelect();
    renderCatSelect();
    renderTrips();
    renderPack();
  }

  function renderTypeSelect() {
    var sel = $('fType');
    var cur = sel.value || 'beach';
    sel.innerHTML = '';
    D.TRIP_TYPES.forEach(function (ty) {
      var o = document.createElement('option');
      o.value = ty;
      o.textContent = t('type_' + ty);
      sel.appendChild(o);
    });
    sel.value = D.TRIP_TYPES.indexOf(cur) === -1 ? 'beach' : cur;
  }

  function renderCatSelect() {
    var sel = $('cCat');
    var cur = sel.value || 'clothes';
    sel.innerHTML = '';
    D.CATEGORIES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = t('cat_' + c);
      sel.appendChild(o);
    });
    sel.value = D.CATEGORIES.indexOf(cur) === -1 ? 'clothes' : cur;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (state.lang === 'bn') return L.toBnDigits(p[2]) + '/' + L.toBnDigits(p[1]) + '/' + L.toBnDigits(p[0]);
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function renderTrips() {
    var list = $('tripList');
    list.innerHTML = '';
    $('noTrips').hidden = state.trips.length !== 0;
    state.trips.forEach(function (trip) {
      var days = L.tripDays(trip.startDate, trip.endDate);
      var p = L.progress(trip);
      var card = el('article', 'trip-card');
      var head = el('div', 'trip-head');
      var title = el('div');
      title.appendChild(el('strong', '', trip.name));
      var meta = el('p', 'muted', trip.destination + ' \u00b7 ' + fmtDate(trip.startDate) + ' \u2013 ' + fmtDate(trip.endDate) +
        ' \u00b7 ' + num(days || 0) + ' ' + t(days === 1 ? 'daySuffix' : 'daysSuffix') +
        ' \u00b7 ' + t('type_' + trip.type));
      title.appendChild(meta);
      head.appendChild(title);
      card.appendChild(head);
      var bar = el('div', 'progress-bar');
      var fill = el('div', 'progress-fill');
      fill.style.width = p.pct + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(el('p', 'muted', num(p.done) + ' / ' + num(p.total) + ' ' + t('packedSuffix') + ' \u00b7 ' + num(p.pct) + '%'));
      var row = el('div', 'row');
      var open = el('button', 'btn primary', t('open'));
      open.type = 'button';
      open.addEventListener('click', function () {
        state.activeTripId = trip.id;
        save();
        renderPack();
        switchTab('pack');
      });
      var dup = el('button', 'btn', t('duplicate'));
      dup.type = 'button';
      dup.addEventListener('click', function () { L.duplicateTrip(state, trip.id); save(); renderTrips(); });
      var del = el('button', 'btn danger-outline', t('delete'));
      del.type = 'button';
      del.addEventListener('click', function () {
        if (window.confirm(t('confirmDeleteTrip'))) {
          L.deleteTrip(state, trip.id);
          save();
          renderTrips();
          renderPack();
        }
      });
      row.appendChild(open);
      row.appendChild(dup);
      row.appendChild(del);
      card.appendChild(row);
      list.appendChild(card);
    });
  }

  function updateProgressUI(trip) {
    var p = L.progress(trip);
    $('progressFill').style.width = p.pct + '%';
    $('progressText').textContent = num(p.done) + ' / ' + num(p.total) + ' ' + t('packedSuffix') + ' (' + num(p.pct) + '%)';
    $('allPacked').hidden = !(p.total > 0 && p.done === p.total);
    document.querySelectorAll('#catGroups .cat-group h3').forEach(function (h) {
      var cp = L.categoryProgress(trip, h.getAttribute('data-cat'));
      h.textContent = t('cat_' + h.getAttribute('data-cat')) + ' \u2014 ' + num(cp.done) + '/' + num(cp.total);
    });
  }

  function renderPack() {
    var trip = L.findTrip(state, state.activeTripId);
    $('noActiveTrip').hidden = !!trip;
    $('packWrap').hidden = !trip;
    if (!trip) return;
    var days = L.tripDays(trip.startDate, trip.endDate);
    $('packTripName').textContent = trip.name;
    $('packTripMeta').textContent = trip.destination + ' \u00b7 ' + fmtDate(trip.startDate) + ' \u2013 ' + fmtDate(trip.endDate) +
      ' \u00b7 ' + num(days || 0) + ' ' + t(days === 1 ? 'daySuffix' : 'daysSuffix') + ' \u00b7 ' + t('type_' + trip.type);
    updateProgressUI(trip);
    var groups = $('catGroups');
    groups.innerHTML = '';
    D.CATEGORIES.forEach(function (cat) {
      var items = trip.items.filter(function (it) { return it.category === cat; });
      if (!items.length) return;
      var cp = L.categoryProgress(trip, cat);
      var sec = el('section', 'cat-group');
      var h = el('h3', '', t('cat_' + cat) + ' \u2014 ' + num(cp.done) + '/' + num(cp.total));
      h.setAttribute('data-cat', cat);
      sec.appendChild(h);
      var ul = el('ul', 'item-list');
      items.forEach(function (it) {
        var li = el('li', 'item-row' + (it.checked ? ' done' : ''));
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = it.checked;
        cb.setAttribute('aria-label', L.itemLabel(it, state.lang));
        cb.addEventListener('change', function () {
          L.toggleItem(trip, it.id);
          save();
          li.classList.toggle('done', it.checked);
          updateProgressUI(trip);
        });
        li.appendChild(cb);
        var name = el('span', 'item-name', L.itemLabel(it, state.lang));
        li.appendChild(name);
        var qty = el('span', 'qty-ctl');
        var minus = el('button', 'qty-btn', '\u2212');
        minus.type = 'button';
        minus.setAttribute('aria-label', 'decrease quantity');
        minus.addEventListener('click', function () { if (L.setQty(trip, it.id, it.qty - 1)) { save(); renderPack(); } });
        var qv = el('span', 'qty-val', '\u00d7 ' + num(it.qty));
        var plus = el('button', 'qty-btn', '+');
        plus.type = 'button';
        plus.setAttribute('aria-label', 'increase quantity');
        plus.addEventListener('click', function () { if (L.setQty(trip, it.id, it.qty + 1)) { save(); renderPack(); } });
        qty.appendChild(minus);
        qty.appendChild(qv);
        qty.appendChild(plus);
        li.appendChild(qty);
        var del = el('button', 'item-del', '\u2715');
        del.type = 'button';
        del.setAttribute('aria-label', 'remove item');
        del.addEventListener('click', function () { L.removeItem(trip, it.id); save(); renderPack(); });
        li.appendChild(del);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      groups.appendChild(sec);
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
  }

  /* ---- events ---- */
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
  });
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    save();
    applyLang();
  });

  $('tripForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fields = {
      name: $('fName').value,
      destination: $('fDest').value,
      type: $('fType').value,
      startDate: $('fStart').value,
      endDate: $('fEnd').value
    };
    var v = L.validateTrip(fields);
    $('eName').textContent = v.errors.name ? t('errName') : '';
    $('eDest').textContent = v.errors.destination ? t('errDestination') : '';
    var dateErr = v.errors.dates;
    $('eDates').textContent = !dateErr ? '' : dateErr === 'badDate' ? t('errBadDate') : dateErr === 'long' ? t('errLong') : t('errDates');
    if (!v.ok) return;
    var res = L.createTrip(fields);
    state.trips.push(res.trip);
    state.activeTripId = res.trip.id;
    save();
    e.target.reset();
    renderTrips();
    renderPack();
    switchTab('pack');
  });

  $('customForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var trip = L.findTrip(state, state.activeTripId);
    if (!trip) return;
    var f = { name: $('cName').value, category: $('cCat').value, qty: $('cQty').value };
    var v = L.validateCustomItem(f);
    $('eItemName').textContent = v.errors.name ? t('errItemName') : v.errors.qty ? t('errQty') : '';
    if (!v.ok) return;
    L.addCustomItem(trip, f);
    save();
    e.target.reset();
    $('cQty').value = '1';
    renderPack();
  });

  $('printBtn').addEventListener('click', function () { window.print(); });
  $('resetBtn').addEventListener('click', function () {
    var trip = L.findTrip(state, state.activeTripId);
    if (!trip) return;
    if (window.confirm(t('resetConfirm'))) {
      L.resetList(trip);
      save();
      renderPack();
    }
  });

  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([L.serialize(state)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'packing-list-bd-backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('importBtn').addEventListener('click', function () {
    var res = L.parseImport($('importBox').value);
    if (!res.ok) {
      $('importMsg').textContent = t('errImport');
      return;
    }
    state = res.state;
    save();
    $('importBox').value = '';
    $('importMsg').textContent = t('importOk');
    applyLang();
  });
  $('eraseBtn').addEventListener('click', function () {
    if ($('eraseBox').value.trim() !== 'DELETE') return;
    state = L.emptyState();
    save();
    $('eraseBox').value = '';
    $('eraseMsg').textContent = t('eraseDone');
    applyLang();
  });

  applyLang();
})();
