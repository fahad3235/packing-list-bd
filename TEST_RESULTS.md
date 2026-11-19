# TEST RESULTS — packing-list-bd (factory run #379, 2026-11-19 10:00 slot)

## Node unit tests — 10/10 pass

Run: `node tests/test.js` (2026-11-19 ~10:12 +06)

- data integrity: i18n keys match, templates reference known items, categories valid
- tripDays: inclusive count, same-day = 1, end before start = null, bad input = null
- validateTrip: name/dest/type/dates, 90-day cap (90 days OK, 96 days rejected)
- buildItems: beach 5-day trip — per-day scaling capped at 7, fixed items untouched; business formal shirts cap at 5; religious template has passport + visa + ihram, 4 ID photos
- createTrip + progress: 3 of 26 checked = 12%; category progress documents 2/2
- setQty: bounds 1–99, unknown id false; rejected sets leave qty unchanged
- custom items: add/validate/remove; resetList drops customs, restores template unchecked
- duplicate + delete trips, active id re-pointing (delete of active re-points to first remaining)
- export/import round-trip byte-identical; 8 malformed backups rejected (bad JSON, wrong app, bad trip, empty item name, qty 0, non-boolean checked)
- toBnDigits + itemLabel (123 → ১২৩; T-shirt → টি-শার্ট)

## Headless-Chrome smoke tests — 33/33 pass

Run: `node tests/smoke.mjs` (raw CDP, headless_shell-1187, file://) (2026-11-19 ~10:14 +06)

- Initial render: title, 3 tabs, empty state, 5 trip types
- Validation: empty submit shows inline errors, no trip created
- Create beach trip 2026-12-20 → 2026-12-24: pack tab opens, 24 items, T-shirt qty ×5, progress 0/24, 6 category groups
- Check 3 items: progress 3/24 packed (13%)
- Qty stepper: ×1 → ×2 on first item
- Custom item "Sunglasses case" ×2 added (25 rows)
- Reload persistence: trip, 3/25 packed (12%), custom item all persist
- Duplicate → 2 trips; delete → 1 trip
- XSS: `<script>alert(1)</script>` as item name rendered as text; no script element injected
- EN↔বাংলা toggle: title প্যাকিং লিস্ট বিডি, Bengali digits ৩ in progress, category heading কাগজপত্র
- Export/import round-trip via UI: "Backup imported."; bad import rejected, data intact
- 390px mobile: no horizontal overflow on Pack or Trips tabs
- Zero console/page errors; zero external network requests

## Repairs made during testing

1. **Real app bug (smoke caught it):** ticking a checkbox re-rendered the whole item list, so rapid successive ticks only registered the first one (stale node references). Fixed with targeted in-place updates (`updateProgressUI` + row class toggle) — no full re-render on tick.
2. **Real app bug (smoke caught it):** `#appTitle` / `#appSub` had no `data-i18n` attribute, so the EN↔বাংলা toggle never translated the header. Fixed by adding the attributes.
3. **Test-side only:** one unit-test name said "3 of 25" for a 26-item template; corrected to "3 of 26".

## Hand-verified numbers

- Beach 5-day list: 24 items; T-shirt/underwear/socks ×5; sunscreen ×1; plastic bags ×2
- 3/24 = 12.5% → displays 13%; 3/25 = 12% after adding one custom item
- Trip 2026-12-20 → 2026-12-24 = 5 days inclusive; 90-day cap boundary verified (2026-12-20 → 2027-03-19 = 90 days OK; → 2027-03-25 = 96 days rejected)
