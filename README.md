# Packing List BD

Offline bilingual (EN / বাংলা) travel packing checklist for Bangladesh. Create a trip, get a ready-made packing list for its type, tick items off as you pack — no account, no internet, nothing leaves your device.

## Problem

Packing for a trip in Bangladesh usually means a mental list — or a paper list rewritten every time. Beach trips need swimwear and sunscreen; hill trips need a raincoat and torch; business trips need formal shirts and a laptop charger. Forgetting one thing (NID, tickets, medicines) can ruin the start of a trip.

## Features

- **Trip profiles** — name, destination, trip type (Beach / Hills / Business / Family / Religious), start & end dates (1–90 days)
- **Smart list generator** — each trip type ships a 24–31 item template; per-day items (T-shirts, underwear, socks, formal shirts) scale with trip length and cap sensibly (7 / 5)
- **Packing progress** — per-trip and per-category progress bars with exact counts and percentages; "All packed!" state
- **Check off, adjust, remove** — tap to tick, −/+ quantity steppers (1–99), remove any item
- **Custom items** — add your own items to any category
- **Trips management** — multiple trips, duplicate a trip, delete with confirmation
- **Print-friendly** — print CSS shows only the packing list
- **Backup** — JSON export (download) and strict import (a malformed file is rejected whole, your data stays intact); erase-all via typed `DELETE`
- **Bilingual** — full EN / বাংলা UI toggle, persisted; Bengali digits when in Bangla
- **Offline & private** — zero network requests; everything in `localStorage`

## Stack

Vanilla HTML + CSS + JavaScript. No build step, no dependencies, no CDN.

## Prerequisites

Any modern browser. Node.js 18+ only for running the tests.

## Install & run

```bash
# open the app
open index.html            # or serve it: python3 -m http.server
```

## Dev commands

```bash
node tests/test.js          # node unit tests
node tests/smoke.mjs        # headless-Chrome UI smoke tests (raw CDP)
python3 .scratch/ascii.py   # convert non-ASCII sources to \uXXXX / &#x; escapes (pre-push)
python3 .scratch/push.py A  # push chunk A (see .scratch/push.py)
python3 .scratch/push.py B  # push chunk B
```

## Env

None. No keys, no backend, no accounts.

## Testing

- `tests/test.js` — node unit tests for the pure logic (`js/logic.js`): day math, template generation and per-day scaling, validation, progress math, custom items, duplicate/delete, strict import validation, export/import round-trip, Bengali digits.
- `tests/smoke.mjs` — real headless-Chrome UI drive: create a trip, tick items, quantity stepper, custom item, reload persistence, duplicate/delete, XSS-safe rendering of a `<script>` item name, EN↔বাংলা toggle, export/import round-trip, 390px mobile overflow check, zero console errors, zero external network requests.

See `TEST_RESULTS.md` for the actual results of the latest run.

## Deployment

Static site — GitHub Pages (main branch, root). No build step.

## Limitations

- Templates are starting checklists, not legal or travel advice: check your own travel documents, bookings, and airline baggage rules before you travel.
- Dates use the device's local calendar; the app does not fetch live weather or transport information.
- Data lives in the browser's `localStorage` — clearing browser data erases trips (use the JSON backup).

## Status

MVP complete. Factory run #379 (2026-11-19, 10:00 slot).
