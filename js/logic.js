/* packing-list-bd \u2014 pure logic (no DOM). Node-testable.
 * State shape: { trips: [Trip], activeTripId: string|null, lang: 'en'|'bn' }
 * Trip: { id, name, destination, type, startDate, endDate, items: [Item] }
 * Item: { id, key|null, name, category, qty, checked, custom }
 * Template items carry key (i18n lookup); custom items carry a free name. */
(function (root) {
  var DATA = root.PLBD_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  var ITEMS = DATA.ITEMS;
  var TEMPLATES = DATA.TEMPLATES;
  var TRIP_TYPES = DATA.TRIP_TYPES;
  var CATEGORIES = DATA.CATEGORIES;

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  var MAX_DAYS = 90;

  function toBnDigits(s) {
    return String(s == null ? '' : s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function uid() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isDateStr(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  }

  /* Inclusive day count between two YYYY-MM-DD dates, or null when invalid. */
  function tripDays(start, end) {
    if (!isDateStr(start) || !isDateStr(end)) return null;
    var ms = Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z');
    var d = Math.round(ms / 86400000) + 1;
    return d >= 1 ? d : null;
  }

  function validateTrip(f) {
    var errors = {};
    var name = String(f.name || '').trim();
    if (name.length < 2 || name.length > 60) errors.name = 'name';
    var dest = String(f.destination || '').trim();
    if (dest.length < 1 || dest.length > 80) errors.destination = 'destination';
    if (TRIP_TYPES.indexOf(f.type) === -1) errors.type = 'type';
    var days = tripDays(f.startDate, f.endDate);
    if (days === null) {
      if (!isDateStr(f.startDate) || !isDateStr(f.endDate)) errors.dates = 'badDate';
      else errors.dates = 'dates';
    } else if (days > MAX_DAYS) {
      errors.dates = 'long';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors, days: days };
  }

  /* Scale a template row by trip length. perDay rows: qty x days, capped (default 7). */
  function scaledQty(row, days) {
    if (!row.perDay) return row.qty;
    var cap = row.cap || 7;
    return Math.min(Math.max(1, days) * row.qty, cap);
  }

  function buildItems(type, days) {
    var tpl = TEMPLATES[type] || [];
    var d = days && days >= 1 ? days : 3;
    return tpl.map(function (row, i) {
      var meta = ITEMS[row.key];
      return {
        id: 'i' + i + '_' + row.key,
        key: row.key,
        name: meta ? meta.en : row.key,
        category: meta ? meta.cat : 'money',
        qty: scaledQty(row, d),
        checked: false,
        custom: false
      };
    });
  }

  function createTrip(fields) {
    var v = validateTrip(fields);
    if (!v.ok) return { ok: false, errors: v.errors };
    var trip = {
      id: uid(),
      name: String(fields.name).trim(),
      destination: String(fields.destination).trim(),
      type: fields.type,
      startDate: fields.startDate,
      endDate: fields.endDate,
      items: buildItems(fields.type, v.days)
    };
    return { ok: true, trip: trip, days: v.days };
  }

  function findTrip(state, id) {
    for (var i = 0; i < state.trips.length; i++) if (state.trips[i].id === id) return state.trips[i];
    return null;
  }

  function progress(trip) {
    var total = trip.items.length;
    var done = 0;
    trip.items.forEach(function (it) { if (it.checked) done++; });
    return { done: done, total: total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function categoryProgress(trip, cat) {
    var sub = { items: trip.items.filter(function (it) { return it.category === cat; }) };
    return progress(sub);
  }

  function toggleItem(trip, itemId) {
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].id === itemId) { trip.items[i].checked = !trip.items[i].checked; return true; }
    }
    return false;
  }

  function setQty(trip, itemId, qty) {
    var q = Math.floor(Number(qty));
    if (!isFinite(q) || q < 1 || q > 99) return false;
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].id === itemId) { trip.items[i].qty = q; return true; }
    }
    return false;
  }

  function validateCustomItem(f) {
    var errors = {};
    var name = String(f.name || '').trim();
    if (name.length < 2 || name.length > 80) errors.name = 'itemName';
    if (CATEGORIES.indexOf(f.category) === -1) errors.category = 'category';
    var q = Math.floor(Number(f.qty));
    if (!isFinite(q) || q < 1 || q > 99) errors.qty = 'qty';
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  function addCustomItem(trip, f) {
    var v = validateCustomItem(f);
    if (!v.ok) return { ok: false, errors: v.errors };
    var item = {
      id: uid(),
      key: null,
      name: String(f.name).trim(),
      category: f.category,
      qty: Math.floor(Number(f.qty)),
      checked: false,
      custom: true
    };
    trip.items.push(item);
    return { ok: true, item: item };
  }

  function removeItem(trip, itemId) {
    var before = trip.items.length;
    trip.items = trip.items.filter(function (it) { return it.id !== itemId; });
    return trip.items.length < before;
  }

  function resetList(trip) {
    var days = tripDays(trip.startDate, trip.endDate);
    trip.items = buildItems(trip.type, days);
    return trip.items.length;
  }

  function duplicateTrip(state, id) {
    var src = findTrip(state, id);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = uid();
    copy.name = src.name + ' (2)';
    copy.items.forEach(function (it) { it.id = uid(); });
    state.trips.push(copy);
    return copy;
  }

  function deleteTrip(state, id) {
    var before = state.trips.length;
    state.trips = state.trips.filter(function (t) { return t.id !== id; });
    if (state.activeTripId === id) state.activeTripId = state.trips.length ? state.trips[0].id : null;
    return state.trips.length < before;
  }

  function emptyState() {
    return { trips: [], activeTripId: null, lang: 'en' };
  }

  /* Strict import: whole file rejected on any schema violation; data kept intact. */
  function parseImport(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    if (!obj || typeof obj !== 'object' || obj.app !== 'packing-list-bd' || !Array.isArray(obj.trips)) {
      return { ok: false, error: 'schema' };
    }
    for (var i = 0; i < obj.trips.length; i++) {
      var t = obj.trips[i];
      if (!t || typeof t !== 'object') return { ok: false, error: 'trip' };
      var v = validateTrip(t);
      if (!v.ok) return { ok: false, error: 'trip' };
      if (!Array.isArray(t.items)) return { ok: false, error: 'items' };
      for (var j = 0; j < t.items.length; j++) {
        var it = t.items[j];
        if (!it || typeof it !== 'object') return { ok: false, error: 'item' };
        if (typeof it.name !== 'string' || it.name.trim().length < 1 || it.name.trim().length > 80) return { ok: false, error: 'item' };
        if (CATEGORIES.indexOf(it.category) === -1) return { ok: false, error: 'item' };
        if (!isFinite(Math.floor(Number(it.qty))) || it.qty < 1 || it.qty > 99) return { ok: false, error: 'item' };
        if (typeof it.checked !== 'boolean') return { ok: false, error: 'item' };
      }
    }
    var state = {
      trips: obj.trips,
      activeTripId: typeof obj.activeTripId === 'string' ? obj.activeTripId : (obj.trips[0] ? obj.trips[0].id : null),
      lang: obj.lang === 'bn' ? 'bn' : 'en'
    };
    if (state.activeTripId && !findTrip(state, state.activeTripId)) state.activeTripId = state.trips[0] ? state.trips[0].id : null;
    return { ok: true, state: state };
  }

  function serialize(state) {
    return JSON.stringify({ app: 'packing-list-bd', version: 1, trips: state.trips, activeTripId: state.activeTripId, lang: state.lang }, null, 2);
  }

  function itemLabel(item, lang) {
    if (!item.key) return item.name;
    var meta = ITEMS[item.key];
    if (!meta) return item.name;
    return lang === 'bn' ? meta.bn : meta.en;
  }

  var EXPORT = {
    toBnDigits: toBnDigits, uid: uid, isDateStr: isDateStr, tripDays: tripDays,
    validateTrip: validateTrip, scaledQty: scaledQty, buildItems: buildItems,
    createTrip: createTrip, findTrip: findTrip, progress: progress,
    categoryProgress: categoryProgress, toggleItem: toggleItem, setQty: setQty,
    validateCustomItem: validateCustomItem, addCustomItem: addCustomItem,
    removeItem: removeItem, resetList: resetList, duplicateTrip: duplicateTrip,
    deleteTrip: deleteTrip, emptyState: emptyState, parseImport: parseImport,
    serialize: serialize, itemLabel: itemLabel, MAX_DAYS: MAX_DAYS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPORT;
  root.PLBD_LOGIC = EXPORT;
})(typeof window !== 'undefined' ? window : globalThis);
