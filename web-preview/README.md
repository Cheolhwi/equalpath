# EqualPath Iteration 1 · web build

A working web version of the Iteration 1 product: the setup flow and the care-gap
discovery it feeds. Published at <https://cheolhwi.github.io/equalpath/>.

It is not a browser port of the native iOS application and not a production client. It is
the same product surface, the same rules and the same wording, running entirely in one
browser tab with no account and no backend.

## What it does

- **Setup** — the eight steps of the iOS flow: you, your children, registered-care hours,
  your work week, reminders, travel times, your support circle, then the first sweep and
  its result.
- **Tonight** — tomorrow's coverage ring, the records behind it, and a per-child result.
- **Schedule** — the rolling fourteen-day window: add, edit and delete entries; create a
  weekly pattern; change or skip a single occurrence of one; see uncovered care and the
  conflict explanations for the selected day.
- **The day** — the timeline of work, required-care and coverage bands with the conflict
  bands laid over them.
- **People** and **Me** — the support circle that drop-off and collection are assigned
  from, and where your records live.

Three results are possible and none of them collapses into another: **NO GAP**,
**UNCOVERED**, and **UNKNOWN** — coverage that exists but cannot be verified. A day with
no records is reported as having no schedule data, never as covered.

## What it deliberately does not do

No account, no sign-in, no Appwrite, no network request of any kind. Nothing can be sent,
booked or confirmed. There is no live location or map service: the three travel estimates
are typed by you, and a missing one keeps a handover "not calculated" rather than clear.
A web page cannot wake itself at 21:00, so the reminder preference is stored and shown
rather than delivered — the iOS build schedules that notification on the phone itself.

Everything is kept in this browser's `localStorage`. Clearing it removes every record.

## How it relates to the rest of the repository

The maths is a port, not a reimplementation. `src/domain/` carries `intervals.js`,
`conflicts.js` and `materialise.js` across from
`appwrite-backend/functions/iteration1-core/src/domain/`, with `node:crypto`'s SHA-256
replaced by a pure-JS deterministic hash because browsers have no synchronous digest. The
interval rule, the three states, the handover checks in both directions, the
high/normal/review ranking and the idempotent expansion of weekly patterns behave as they
do on the server.

Design tokens, screen structure and copy come from `equalpath/EqualPath/`. The display and
body faces are the same OFL-licensed Cormorant Garamond and Instrument Sans the iOS app
bundles, subset to Latin and converted to WOFF2; their licences are in `public/fonts/`.

Neither `equalpath/` nor `appwrite-backend/` is modified by anything in this directory.

## Local development

```sh
npm ci
npm run dev      # http://localhost:5173
npm test         # 48 tests over the domain layer and the store
npm run build    # writes dist/
npm run check    # test, then build
```

`npm run build` sets the base path to `/equalpath/` for the project Pages site; `npm run
dev` serves from `/`. `.github/workflows/pages.yml` runs `npm ci && npm test && npm run
build` and publishes `dist`.

## Tests

`tests/` covers the parts that decide what a user is told:

- `intervals.test.js` — merging, subtraction, the AC 2.1.1 overlap rule (adjacency is not
  overlap), and splitting an entry that runs past midnight.
- `conflicts.test.js` — care/work overlap, coverage ending at the collection deadline
  rather than closing time, unknown staying separate from uncovered, both handover
  directions with and without a travel estimate, priority ranking, and determinism.
- `materialise.test.js` — weekday expansion, the effective window, idempotency on
  (pattern, date), and suppression.
- `store.test.js` — one-off entries, cross-midnight splitting, weekly patterns, replacing
  a single occurrence with an override, skipping a day, keeping single-day edits when a
  pattern is deleted, and the sample family showing all three results.

`_legacy-vanilla-preview/` holds the previous read-only preview. It is git-ignored and is
kept only as a local reference.
