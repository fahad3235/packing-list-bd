/* packing-list-bd \u2014 node unit tests. Run: node tests/test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../js/data.js');
const L = require('../js/logic.js');
const { I18N, CATEGORIES, TRIP_TYPES, ITEMS, TEMPLATES } = DATA;

test('data integrity: i18n keys match, templates reference known items, categories valid', () => {
  assert.deepEqual(Object.keys(I18N.bn).sort(), Object.keys(I18N.en).sort());
  for (const k of Object.keys(I18N.en)) assert.ok(I18N.en[k].length > 0 && I18N.bn[k].length > 0, 'i18n ' + k);
  assert.deepEqual(CATEGORIES, ['documents', 'clothes', 'toiletries', 'electronics', 'health', 'money']);
  assert.deepEqual(TRIP_TYPES, ['beach', 'hill', 'business', 'family', 'religious']);
  for (const ty of TRIP_TYPES) {
    const seen = new Set();
    for (const row of TEMPLATES[ty]) {
      assert.ok(ITEMS[row.key], 'unknown item ' + row.key + ' in ' + ty);
      assert.ok(!seen.has(row.key), 'dup item ' + row.key + ' in ' + ty);
      seen.add(row.key);
      assert.ok(CATEGORIES.includes(ITEMS[row.key].cat), 'bad cat ' + row.key);
      assert.ok(row.qty >= 1 && row.qty <= 99, 'bad qty ' + row.key);
    }
    assert.ok(TEMPLATES[ty].length >= 20, ty + ' template too thin: ' + TEMPLATES[ty].length);
  }
  for (const [k, v] of Object.entries(ITEMS)) {
    assert.ok(v.en && v.bn && v.cat, 'item fields ' + k);
  }
});

test('tripDays: inclusive count, same-day = 1, end before start = null, bad input = null', () => {
  assert.equal(L.tripDays('2026-12-20', '2026-12-20'), 1);
  assert.equal(L.tripDays('2026-12-20', '2026-12-24'), 5);
  assert.equal(L.tripDays('2026-12-30', '2027-01-02'), 4);
  assert.equal(L.tripDays('2026-12-24', '2026-12-20'), null);
  assert.equal(L.tripDays('2026-13-01', '2026-12-20'), null);
  assert.equal(L.tripDays('', '2026-12-20'), null);
});

test('validateTrip: name/dest/type/dates, 90-day cap', () => {
  const base = { name: 'Cox trip', destination: "Cox's Bazar", type: 'beach', startDate: '2026-12-20', endDate: '2026-12-24' };
  assert.equal(L.validateTrip(base).ok, true);
  assert.equal(L.validateTrip({ ...base, name: 'x' }).ok, false);
  assert.equal(L.validateTrip({ ...base, destination: '' }).ok, false);
  assert.equal(L.validateTrip({ ...base, type: 'moon' }).ok, false);
  assert.equal(L.validateTrip({ ...base, endDate: '2026-12-19' }).ok, false);
  assert.equal(L.validateTrip({ ...base, startDate: 'bad' }).ok, false);
  assert.equal(L.validateTrip({ ...base, endDate: '2027-03-25' }).ok, false); // 96 days
  assert.equal(L.validateTrip({ ...base, endDate: '2027-03-19' }).ok, true); // 90 days
});

test('buildItems: beach 5-day trip \u2014 per-day scaling capped at 7, fixed items untouched', () => {
  const items = L.buildItems('beach', 5);
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(byKey.tshirt.qty, 5);
  assert.equal(byKey.underwear.qty, 5);
  assert.equal(byKey.socks.qty, 5);
  assert.equal(byKey.sunscreen.qty, 1);
  assert.equal(byKey.plastic_bags.qty, 2);
  assert.equal(byKey.nid.qty, 1);
  assert.ok(items.every((i) => i.checked === false && i.custom === false));
  // 10-day trip: per-day capped at 7
  const long = L.buildItems('beach', 10);
  assert.equal(long.find((i) => i.key === 'tshirt').qty, 7);
  // business formal shirts cap at 5
  const biz = L.buildItems('business', 10);
  assert.equal(biz.find((i) => i.key === 'shirt_formal').qty, 5);
  assert.equal(biz.find((i) => i.key === 'shirt_formal').qty, 5);
  // religious template has passport + visa + ihram
  const rel = L.buildItems('religious', 14);
  assert.equal(rel.find((i) => i.key === 'passport').qty, 1);
  assert.equal(rel.find((i) => i.key === 'id_photos').qty, 4);
  assert.equal(rel.find((i) => i.key === 'tshirt').qty, 7);
});

test('createTrip + progress: 3 of 26 checked = 12%', () => {
  const res = L.createTrip({ name: 'Sajek', destination: 'Sajek', type: 'hill', startDate: '2026-12-20', endDate: '2026-12-22' });
  assert.equal(res.ok, true);
  assert.equal(res.days, 3);
  assert.equal(res.trip.items.length, TEMPLATES.hill.length);
  const p0 = L.progress(res.trip);
  assert.deepEqual(p0, { done: 0, total: TEMPLATES.hill.length, pct: 0 });
  L.toggleItem(res.trip, res.trip.items[0].id);
  L.toggleItem(res.trip, res.trip.items[1].id);
  L.toggleItem(res.trip, res.trip.items[2].id);
  const p = L.progress(res.trip);
  assert.equal(p.done, 3);
  assert.equal(p.pct, Math.round((3 / TEMPLATES.hill.length) * 100));
  assert.equal(L.toggleItem(res.trip, 'nope'), false);
  // category progress
  const cp = L.categoryProgress(res.trip, 'documents');
  assert.equal(cp.total, 2); // nid + tickets
  assert.equal(cp.done, 2);
});

test('setQty: bounds 1\u201399, unknown id false', () => {
  const res = L.createTrip({ name: 'Xy', destination: 'Dhaka', type: 'business', startDate: '2026-12-20', endDate: '2026-12-21' });
  const id = res.trip.items[0].id;
  assert.equal(L.setQty(res.trip, id, 3), true);
  assert.equal(res.trip.items[0].qty, 3);
  assert.equal(L.setQty(res.trip, id, 0), false);
  assert.equal(L.setQty(res.trip, id, 100), false);
  assert.equal(L.setQty(res.trip, id, 'abc'), false);
  assert.equal(res.trip.items[0].qty, 3); // unchanged after rejects
  assert.equal(L.setQty(res.trip, 'nope', 2), false);
});

test('custom items: add/validate/remove; resetList drops customs, restores template', () => {
  const res = L.createTrip({ name: 'Xy', destination: 'Dhaka', type: 'family', startDate: '2026-12-20', endDate: '2026-12-22' });
  const trip = res.trip;
  const n0 = trip.items.length;
  const bad = L.addCustomItem(trip, { name: '', category: 'clothes', qty: 1 });
  assert.equal(bad.ok, false);
  assert.equal(L.addCustomItem(trip, { name: 'Umbrella', category: 'space', qty: 1 }).ok, false);
  assert.equal(L.addCustomItem(trip, { name: 'Umbrella', category: 'money', qty: 0 }).ok, false);
  const ok = L.addCustomItem(trip, { name: 'Umbrella', category: 'money', qty: 1 });
  assert.equal(ok.ok, true);
  assert.equal(ok.item.custom, true);
  assert.equal(trip.items.length, n0 + 1);
  assert.equal(L.removeItem(trip, ok.item.id), true);
  assert.equal(trip.items.length, n0);
  assert.equal(L.removeItem(trip, 'nope'), false);
  L.addCustomItem(trip, { name: 'Extra', category: 'money', qty: 1 });
  L.toggleItem(trip, trip.items[0].id);
  const after = L.resetList(trip);
  assert.equal(after, n0);
  assert.ok(trip.items.every((i) => !i.custom && !i.checked));
});

test('duplicate + delete trips, active id re-pointing', () => {
  const state = L.emptyState();
  const a = L.createTrip({ name: 'Trip A', destination: 'Dhaka', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21' }).trip;
  const b = L.createTrip({ name: 'Trip B', destination: 'Sylhet', type: 'hill', startDate: '2026-12-20', endDate: '2026-12-21' }).trip;
  state.trips.push(a, b);
  state.activeTripId = a.id;
  const copy = L.duplicateTrip(state, a.id);
  assert.equal(state.trips.length, 3);
  assert.equal(copy.name, 'Trip A (2)');
  assert.notEqual(copy.id, a.id);
  assert.equal(copy.items.length, a.items.length);
  assert.ok(copy.items.every((it, i) => it.id !== a.items[i].id));
  assert.equal(L.deleteTrip(state, a.id), true);
  assert.equal(state.activeTripId, b.id); // re-pointed to first remaining
  assert.equal(L.deleteTrip(state, 'nope'), false);
});

test('export/import round-trip + strict rejection of malformed backups', () => {
  const state = L.emptyState();
  const a = L.createTrip({ name: 'Trip A', destination: 'Dhaka', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21' }).trip;
  L.toggleItem(a, a.items[0].id);
  L.addCustomItem(a, { name: 'My thing', category: 'money', qty: 2 });
  state.trips.push(a);
  state.activeTripId = a.id;
  const json = L.serialize(state);
  const back = L.parseImport(json);
  assert.equal(back.ok, true);
  assert.equal(back.state.trips.length, 1);
  assert.equal(back.state.trips[0].items[0].checked, true);
  assert.equal(back.state.trips[0].items.at(-1).name, 'My thing');
  assert.equal(back.state.activeTripId, a.id);
  assert.equal(L.serialize(back.state), json); // byte-identical round-trip
  const bad = [
    'not json',
    '{}',
    JSON.stringify({ app: 'other-app', trips: [] }),
    JSON.stringify({ app: 'packing-list-bd', trips: 'nope' }),
    JSON.stringify({ app: 'packing-list-bd', trips: [{ name: 'x', destination: 'd', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21', items: [] }] }),
    JSON.stringify({ app: 'packing-list-bd', trips: [{ name: 'Trip A', destination: 'Dhaka', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21', items: [{ name: '', category: 'money', qty: 1, checked: false }] }] }),
    JSON.stringify({ app: 'packing-list-bd', trips: [{ name: 'Trip A', destination: 'Dhaka', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21', items: [{ name: 'Ok', category: 'money', qty: 0, checked: false }] }] }),
    JSON.stringify({ app: 'packing-list-bd', trips: [{ name: 'Trip A', destination: 'Dhaka', type: 'beach', startDate: '2026-12-20', endDate: '2026-12-21', items: [{ name: 'Ok', category: 'money', qty: 1, checked: 'yes' }] }] })
  ];
  for (const s of bad) assert.equal(L.parseImport(s).ok, false, 'should reject: ' + s.slice(0, 60));
});

test('toBnDigits + itemLabel', () => {
  assert.equal(L.toBnDigits(123), '\u09e7\u09e8\u09e9');
  assert.equal(L.toBnDigits('2026-12-20'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e8-\u09e8\u09e6');
  assert.equal(L.toBnDigits(0), '\u09e6');
  const item = { key: 'tshirt', name: 'T-shirt', category: 'clothes', qty: 2, checked: false, custom: false };
  assert.equal(L.itemLabel(item, 'en'), 'T-shirt');
  assert.equal(L.itemLabel(item, 'bn'), '\u099f\u09bf-\u09b6\u09be\u09b0\u09cd\u099f');
  const custom = { key: null, name: 'My thing', category: 'money', qty: 1, checked: false, custom: true };
  assert.equal(L.itemLabel(custom, 'bn'), 'My thing');
});
