# Handoff: EqualPath iOS App

## Overview

EqualPath is a mobile app for working parents in Malaysia. It watches the gap between a parent's work schedule and their children's registered childcare hours, and tells them the evening before a gap opens — while there is still time to arrange cover.

The product's whole promise sits in one moment: Wednesday 21:04, when a parent learns Thursday will not work. Everything downstream — options, confirmation, recovery — exists to serve that moment. The app therefore opens on *tomorrow*, not on a dashboard.

This bundle covers the complete user journey in 41 screens: registration, first-run setup, daily use, failure states, the people/history surfaces, account management, and the carer-side screens (a carer receives a request without ever installing the app).

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly.

The task is to **recreate these designs in the target codebase's environment** using its established patterns and libraries. The intended target here is a native iOS app, so the natural mapping is SwiftUI: the designs were drawn on an iOS skeleton (Dynamic Island status bar, 44pt navigation bars, native switches, native permission alerts, bottom sheets with grabber handles) precisely so this translation is mechanical rather than interpretive.

Do not ship the HTML. Do not port the CSS. Read the values out of this README and build native views.

Two files:

- **`EqualPath Mobile.dc.html`** — the full 41-screen gallery. Static; every screen visible at once for reference. This is the specification.
- **`EqualPath iOS Prototype.dc.html`** — a clickable 12-step prototype of the registration and setup flow only. Use it to understand transitions, input behaviour, and the liquid animation. It does not cover screens 01–09 or C/D.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, and copy. Recreate pixel-accurately, substituting the codebase's own component library where one exists (buttons, switches, list rows) but preserving the exact values below.

One caveat: the liquid "gooey" effect is built with an SVG `feGaussianBlur` + `feColorMatrix` threshold filter, which has no direct SwiftUI equivalent. See **Interactions & Behavior → Liquid motion** for the native approach.

---

## Design System

Three rules govern every screen. They are not stylistic preferences; they are safety constraints. Breaking them changes what the app claims about whether a child is unattended.

### 1. Ornament marks chrome, never data

Gold hairlines, rotated-square diamonds, four-point stars, and the serif display face belong to headers, dividers, brand marks, and decorative blobs. Anything that reports a fact about a child's day uses the plain sans face and a single semantic colour. Liquid motion stops at the boundary of any element stating a fact.

### 2. Colour is never alone

Every state carries a **shape**, a **word**, and a **colour**. Rose on navy is not sufficient to mean danger — the word `UNCOVERED` must sit beside it. This matters more in dark mode, not less.

### 3. Every number names its source

A gap prints the records that produced it ("Provider closed (JKM record) / Work ends 15:30 / Travel 30 min"). `Unknown` is a value, never a blank, and never rendered in the same colour as a gap — an unverified hour is not a dangerous hour, and it is not a safe one either.

### Ring convention — critical

The coverage ring's numeral is **always the gap in hours**, and the pink wedge angle is **always `gapHours / spanHours × 360°`**.

- `0h` + `NO GAP` + full green ring (360°)
- `9h` + `UNCOVERED` + full pink ring (360°, because the 9h gap spans the whole 9h day)
- Offline/stale: same geometry, muted palette (`#6E5A38` on `#232B4E`), label states the timestamp (`AS OF 18:12`)

Never label a zero as `COVERED` — read literally, `0h COVERED` says "zero hours are covered", the alarming inverse of the truth. Never draw a partial wedge for a full gap.

---

## Design Tokens

### Colours

| Token | Hex | Use |
|---|---|---|
| Canvas | `#080D1E` | Screen background |
| Canvas deep | `#04060F` | Lock screen, Dynamic Island pill |
| Surface | `#0C1226` | Cards, sheets |
| Surface alt | `#0B1024` | Inline notes |
| Surface input | `#0D1330` | Text fields (resting) |
| Surface input active | `#101940` | Text fields (focused) |
| Tab bar | `#060A18` | Bottom tab bar |
| Gold (brand/chrome) | `#E3B85C` | Brand, section eyebrows, diamonds, primary accent |
| Gold light | `#F3D391` | Link hover |
| Gold muted | `#DCC79C` | Body copy inside gold-bordered notes |
| Gold stale | `#6E5A38` | Offline ring wedge |
| Blue (action) | `#4A6BE8` | Primary buttons, work blocks, filled code cells |
| Blue deep | `#3C55C4` | Blob mid-tone |
| Blue surface | `#1B2758` / `#151E45` | Event pills (fixed / flexible) |
| Blue text | `#93A9F7` / `#C6D0F5` | Text on blue surfaces |
| Green (covered) | `#2FB98A` | Covered state fill |
| Green text | `#3FD09B` | Covered state text |
| Rose (gap) | `#FF6B81` | Gap fill, destructive actions |
| Rose text | `#FF7A8C` | Gap state text |
| Rose alt | `#D9576D` | Second stripe in hatched gap fill |
| Teal (provider) | `#4FC7C7` | Registered-provider plans |
| Orange (family) | `#E28A3E` | Family carer blocks |
| Orange text | `#F0A75E` | Family carer text |
| Amber (your share) | `#F0B65E` | The parent's own share of care |
| Text primary | `#F6EFDE` | Headlines |
| Text primary alt | `#F1E9D8` | Row titles |
| Text body | `#EFE7D6` | Status bar, nav titles |
| Text secondary | `#BFC7E2` / `#CBD2EA` | Body copy on surfaces |
| Text tertiary | `#A6AECC` | Subheads |
| Text muted | `#9AA3C4` | Note copy |
| Text dim | `#8F97BA` | Row subtitles |
| Text faint | `#7983A8` | Metadata |
| Text faintest | `#6E779C` | Footnotes, inactive tabs |
| Text disabled | `#5E6790` | Placeholders, chevrons |
| Divider | `rgba(226,214,186,.09)` | Row separators |
| Border | `rgba(226,214,186,.14)` | Card borders |
| Border strong | `rgba(226,214,186,.24)` | Secondary buttons |
| Border gold | `rgba(227,184,92,.26)` | Device frame |
| Track | `#2A345E` / `#242E58` / `#141B3E` | Unfilled ring, progress, empty cells |
| Unknown | `#3A4570` fill / `rgba(226,214,186,.3)` border | Unverified time bands |
| iOS alert sheet | `#F2EFE8` bg, `#12141C` title, `#4A4E5C` body, `#DDD9D0` secondary button | Native permission dialogs |

### Typography

Two families only.

- **Display:** Cormorant Garamond — weights 400/500, italic available. Headlines, screen titles, ring numerals, plan names.
- **UI:** Instrument Sans — weights 400/500/600/700. Everything else.

| Role | Spec |
|---|---|
| Screen headline | Cormorant Garamond 500, 32–34px, line-height 1.10–1.12 |
| Section headline (gallery) | Cormorant Garamond 500, 42px, line-height 1.06 |
| Ring numeral (large) | Cormorant Garamond 500, 40–44px, line-height 1 |
| Ring numeral (small, C2) | Cormorant Garamond 500, 24px |
| Plan title | Cormorant Garamond 500, 21–25px, line-height 1.15 |
| Brand mark | Cormorant Garamond 500, 22px, letter-spacing .06em |
| Subhead / body | Instrument Sans 400, 14px, line-height 1.6 |
| Row title | Instrument Sans 600, 14.5px, line-height 1.3 |
| Row subtitle | Instrument Sans 400, 12.5px, line-height 1.4 |
| Note copy | Instrument Sans 400, 12.5px, line-height 1.55 |
| Eyebrow / label | Instrument Sans 600, 10.5px, letter-spacing .16em, uppercase |
| Section eyebrow | Instrument Sans 600, 11px, letter-spacing .24em, uppercase |
| Metadata | Instrument Sans 400, 11.5–13px |
| Primary button | Instrument Sans 600, 16px |
| Secondary button | Instrument Sans 600, 14.5–15px |
| Nav title | Instrument Sans 600, 16px |
| Status bar | Instrument Sans 600, 15px |
| Tab label | Instrument Sans 500/600, 10.5px |
| Chip | Instrument Sans 600, 11.5–12.5px |
| Footnote | Instrument Sans 400, 11.5–12px, line-height 1.5 |
| Lock screen clock | Instrument Sans 300, 78px, letter-spacing -.02em |

Body copy uses `text-wrap: pretty` in the HTML; in SwiftUI this is closest to leaving line breaks to the layout engine and avoiding manual `\n` in paragraphs. Headlines *do* use deliberate `<br>` breaks — preserve them, they are set for rhythm.

### Spacing

Screen horizontal padding is **24px** (28px on the three registration screens A1–A3, 26px on the carer screens D1–D3, 32px on the sweep screen). Vertical rhythm runs on a loose 4px grid; the values that recur:

`4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 26`

| Gap | Use |
|---|---|
| 4–5px | Label to value inside a row |
| 7–9px | Icon to text, headline to subhead |
| 10–12px | Between stacked buttons, between cards |
| 13–16px | Card internal padding (vertical 13px, horizontal 15–17px) |
| 18–22px | Between content blocks |
| 26px | Below a subhead before the first control |
| 52px | Between phone frames in the gallery |

### Radii

| Value | Use |
|---|---|
| 46px | Device frame |
| 28px (top only) | Bottom sheet |
| 20px | Cards, primary buttons |
| 18px | Text fields, secondary buttons, notes inside sheets |
| 16px | Inline notes, code cells, action rows |
| 14px | Timeline bands |
| 12px | Coverage bars, iOS alert buttons |
| 9–10px | Event pills, chips |
| 7px | Week-strip columns |
| 999px | Filter chips, status badges |
| 50% | Rings, avatars |

### Shadows

| Value | Use |
|---|---|
| `0 26px 64px rgba(0,0,0,.6)` | Device frame (gallery presentation only) |
| `0 10px 30px rgba(74,107,232,.45)` | Blue primary button |
| `0 10px 30px rgba(227,184,92,.30)` | Gold primary button |
| `0 12px 40px rgba(0,0,0,.50)` | iOS permission alert |
| `0 18px 50px rgba(0,0,0,.60)` | Coach-mark card |
| `0 0 0 5px rgba(74,107,232,.14)` | Focused text field ring |
| `0 0 0 8px rgba(227,184,92,.22), 0 0 60px rgba(227,184,92,.3)` | Coach-mark spotlight on the ring |
| `0 2px 5px rgba(0,0,0,.3)` | Switch knob |

### Device metrics

Frame 390 × 844 (iPhone 14/15 logical). Status bar 54px with a 110 × 32 Dynamic Island pill centred at top 11px. Navigation bar 44px. Tab bar 78px. Home indicator 134 × 5, `rgba(239,231,214,.34)`.

Every touch target is ≥ 44pt. Switches are 51 × 31 with a 27px knob — native iOS dimensions.

---

## Screens

41 screens in four groups. Each is captioned in the gallery with its ID.

### Group A — Registration (A1–A3)

**A1 · Welcome.** Full-bleed liquid blob top-left. Content bottom-anchored: brand eyebrow, headline "Know about tomorrow *tonight*" (italic gold on "tonight"), 290px-max body, two stacked buttons (blue primary "Create an account", outlined "I already have one"), language row (English · Bahasa Melayu) beneath.

**A2 · Your number.** Nav + 6-segment liquid progress bar (2 filled). Country-code field (+60, fixed width) beside a focused number field with an animated caret. Note explaining the number's two uses. Primary CTA disabled until 9 digits. Numeric keypad, 3-column grid, 54px keys, 9px gap.

**A3 · The code.** Six code cells, gap 8px, height 64–66px. **Two layers:** a filtered pill layer (no text) that fuses the cells into one continuous bar, and an unfiltered digit layer above it. Applying the threshold filter to text dissolves the glyphs — this split is mandatory. Filled cell `#4A6BE8`, next-up cell `#1A2350` with caret, empty `#141B3E`. Below: expiry and resend timers, then a note listing what setup will ask for.

### Group B — Setup to first value (B1–B12)

Progress bar advances 1→6 across these.

**B1 · Your name.** Focused name field, email field, three suggestion chips in the prototype. Note: carers see only this name.

**B2 · Your children.** One card row per child with Remove; dashed "Add another child" row. Multi-child from the start — each child gets an independent ring.

**B3 · Care hours.** Per-child (nav shows `‹ Nia … Idris ›`). Provider / days / collection rows, then a 7-column week strip, weekends unfilled. Note: a public-holiday closure is treated as uncovered, not unknown.

**B4 · Your work week.** Mon–Thu / Friday / travel rows, plus a calendar-import switch labelled read-only. Note: travel is counted on both ends, or a 16:00 collection after a 15:30 finish would look possible.

**B5 · Notifications.** Four switches, then the **native iOS permission alert** rendered in-frame on `#F2EFE8`. Declining is a real path — footnote says the app still works, you just check it yourself.

**B6 · Location.** Home/work *areas*, not addresses. Two outlined buttons: "Use my location once" / "I'll keep typing them". Note: areas, not addresses; no live tracking, ever.

**B7 · Invite carers.** Three carer rows in mixed states, dashed add row. Note: skipping still finds gaps, it just cannot suggest anyone.

**B8 · First sweep.** Centred liquid blob. Four checklist rows advancing green→gold→outline as the sweep runs, gold progress bar, percentage. In the prototype this animates over ~2.3s (2% per 45ms) and reveals the CTA at 100%.

**B9 · All clear.** `0h / NO GAP`, full green ring. Per-child rows both green. Footnote: a covered day is not a claim nothing will change — it is what the current records say.

**B10 · First gap found.** Rose radial wash. Eyebrow "FIRST SWEEP · 1 OF 14 DAYS NEEDS YOU". Thursday card with hatched/green coverage bar and the three source records. Row confirming the other 13 days are fine.

**B11 · Coach marks.** Dimmed screen (`rgba(4,6,15,.72)`), ring spotlit with a double gold glow, card "1 OF 3" with a fused dot rail, Skip all / Next. Three marks total, then never again.

**B12 · New device.** No password anywhere. Number field, note about email fallback cancelling pending requests first, rows for email link and Sign in with Apple.

### Group 01–09 — Every evening after

The daily product. Setup happens once; this is what the parent opens nightly.

**01 · Tonight.** Timestamp eyebrow, headline naming the hours, **full pink ring** `9h / UNCOVERED` with `08:00 — 17:00` beneath and "Checked 21:00 · sweep is current". Rose card listing the two source records. CTA "See the day".

**02 · The day.** Hour axis 08→18. Time column: hatched gap band 0–90% (`08:00 — 17:00`, "NO ADULT PRESENT · 9 HOURS"), neutral unknown band 90–100% (`17:00 — 18:00 unknown`). The gap card reserves a **130px right lane** so the two event pills (client review 10:00 fixed · focus block 12:00 flexible) can never overlap its source text. Footnote explains the unknown hour was not calculated and is not a claim of coverage.

**03 · Weekly pattern.** 7-column stacked chart, Thursday outlined gold and hatched. Legend. Gold card forcing the choice: only this Thursday, or every Thursday (states "rewrites 2 upcoming days").

**04 · Ways to cover it.** Three self-describing cards, never a table. Card A is gold-bordered and eyebrowed "MATCHES YOUR PRIORITIES" with the ranking criteria printed under the title. B is teal (registered provider), C is blue (moves your work). Each carries a segmented coverage bar and metric chips including "cost unknown" where cost is unknown. Footnote: these are the options found within the time limit, not every option that exists.

**05 · One plan, in full.** `FEASIBLE` badge (never "best"). Who-is-with-her band (orange/blue/green, 48px). Six-row metric table. Blue "WHY THIS WORKS" card whose italic footer attributes the prose to the checked plan, not to a model. Gold CTA "Choose this plan" + "Choosing sends nothing."

**06 · Ask, once.** Recipient merged into the message-card header. Full message preview, privacy meta (no address, no other carer named, link expiry). Footer holds the second-request row *and* the CTA, so the button's shadow can't bleed onto content. Three actions: Send / Copy text / Save, don't send.

**07 · Who has answered.** Split progress bar. Three states: confirmed (green, link now closed), waiting (gold, one reminder only — stated explicitly), undeliverable (rose, "Nothing was received"). Footnote: a confirmation records that a person agreed; it is not a booking.

**08 · When it breaks.** 07:12, partner withdrew. Band shows mother's morning **kept** and only the withdrawn 12:00–17:00 reopened. Two re-checked replacements. Note: the partner is excluded from today's options and the original plan stays in history exactly as agreed.

**09 · What changed.** Rolling 28 days, four share bars with before→after. Gold card surfacing a pattern (same afternoon uncovered 3 of last 4 Thursdays, dates listed). Footnote: only arrangements someone confirmed *ran* are counted.

### Group C — Everything else (C1–C14)

**C1 · Lock screen.** 78px clock, two stacked notification cards on `#04060F`. Primary card: "Tomorrow has 9 hours uncovered". Older, dimmer card below. "Swipe up to open · one alert a day".

**Implementation note — local notifications.** C1 is delivered by `UNUserNotificationCenter` on the iPhone, not by APNs or Appwrite Messaging. After each successful Appwrite sync, the native app reads open conflicts for the rolling 14-day window, groups them by date, and schedules at most one privacy-minimal alert for 21:00 on the preceding day. Launching or foregrounding the app replaces stale pending requests; logout and account deletion remove them. Already scheduled alerts work offline, but a cloud-side change cannot update the device until EqualPath syncs again. The notification itself must not expose a child's name, address, provider, or detailed schedule.

**C2 · Two children.** Two side-by-side cards, 104px rings: Nia `9h / UNCOVERED` full pink, Idris `0h / NO GAP` full green. Note: each child is judged on their own records.

**C3 · Edit one day.** Bottom sheet with grabber, Cancel/Save header, three edit rows, then the repeat-scope radio pair.

**C4 · What ranking means.** Four draggable priority rows (handovers · travel · cost · even share), then a combined switch row. Note: **coverage is not on this list** — a plan that leaves a gap is not ranked lower, it is not shown at all.

**C5 · No plan found.** The case that must not be softened. Four rows showing exactly why each option failed. Note: the nine hours are still uncovered; EqualPath will not suggest leaving a four-year-old alone and will not invent an option to fill the screen.

**C6 · Offline.** Gold warning strip with the last-checked timestamp. Muted ring. "Muted colour means unverified, not safe." Rows: requests held, replies possibly missed ("Unknown").

**C7 · Sweep failed.** Two checks green, JKM register failed after 3 attempts. Note: tomorrow is shown as unknown, not covered — saying nothing when a provider is closed is the failure that matters.

**C8 · Request expired.** No answer is its own answer. Expired card with the reminder history, rows showing the five hours open again and mother's morning still held.

**C9 · A carer.** Avatar header, four stat rows (asked / accepted / declined / hours carried), an availability week strip footnoted "She told us this. It is not tracked and not guessed from her replies."

**C10 · History.** Five day rows: Ran / Ran / Ran / **Not reported** / Gap. Note: "Not reported" is kept visible on purpose — dropping it would make the record look better than the month was.

**C11 · Withdraw.** Sheet stating what the other person will see: withdrawn, not expired. Destructive rose button + "Keep waiting".

**C12 · Find a provider.** Search field, JKM-registered filter chips, three provider rows. Note: the register shows who is *licensed*, not who has a place free — EqualPath cannot see vacancies and will never imply it can. Unregistered providers can be added but are never suggested.

**C13 · Settings.** Compact profile header, then grouped cards: people · pattern/priorities/notifications · language/larger text · privacy/export/delete.

**C14 · Delete everything.** Four rows showing exactly what happens to each data class. Rose CTA "Delete my account" + "This cannot be undone." Note: outstanding requests are withdrawn before anything is erased.

### Group D — The carer's side (D1–D3)

These are opened from a link by someone who has never installed the app. No tab bar, no account, no nav back.

**D1 · The request.** Brand mark, headline "Aina is asking if you can look after Nia", four-row card (when / where / who else that day / reply by), note stating what is deliberately *not* shared, green "Yes, I can" + outlined "No, I can't". Footnote: this link stops working Thursday 08:00.

**D2 · Declining.** Reason is optional — four chips plus a free-text box. Note: only what you write is passed on; declining does not remove you from her list.

**D3 · Confirmed.** Breathing green ring mark, three-row receipt, note: no reminders, no follow-ups, no account waiting for you. Add to calendar / I can no longer do this.

---

## Interactions & Behavior

### Navigation model

Five tabs: **Today · Week · Plan · People · Me**. Active tab is a filled gold diamond with gold label; inactive is an outlined diamond in `#6E779C`. Registration, setup, and carer screens have no tab bar.

The app launches on **Today**, showing tomorrow. Not a dashboard.

### Liquid motion (the gooey reference)

Two behaviours borrowed from the reference, and one rule about where they stop.

**Merge, not stack.** Touching shapes fuse into one mass. Used on the step-progress rails (segments fuse into a single shortening pill) and the code cells (six cells read as one bar).

**Mass follows the finger.** The primary button drifts ~7px on a 4.5–5.4s ease-in-out loop, suggesting weight without ever moving far enough to obscure its label.

**Ornament off at the door.** Liquid motion never touches an element that states a fact about a child's day. Screens 01–09 are still on purpose.

Implementation in HTML is an SVG filter chain — `feGaussianBlur stdDeviation=11` then `feColorMatrix` with alpha row `0 0 0 22 -10` to threshold. Note that a trailing `feBlend` back to `SourceGraphic` **defeats the merge** (it paints the hard-edged originals back over the fused result) — the filter must end at the colour matrix.

For SwiftUI, the equivalent is `.blur(radius:)` on a `ZStack` of circles wrapped in a metaball threshold — either a small `.colorEffect` shader, or `Canvas` with `.blendMode(.plusLighter)` plus an alpha-threshold filter. Blob positions and animation, for reference:

| Screen | Position | Opacity |
|---|---|---|
| Welcome, A2, low variants | top -70 left -60, 470px | 0.80 |
| Corner variant | top -230 right -150, 400px | 0.34 |
| Low variant | bottom -210 left -110, 420px | 0.32 |
| Sweep (centre) | top -60 left -70, 430px | 0.34 |

Three circles per blob at 42%/30%/21% of box width — blue `#4A6BE8`, deep blue `#3C55C4`, gold `#E3B85C` at 0.78 alpha. Keyframes: two orbit loops at 13s and 17s ease-in-out infinite, translating ±30px and scaling 0.88–1.16.

Other named animations:
- `gooBreath` — scale 1 → 1.06 → 1, used on carets (1.4s) and the D3 confirmation mark (5s)
- `gooSpark` — the active checklist diamond, opacity .4→1 with scale .9→1.25, 2.2s
- `gooTrail` — the button drift, 4.5–5.4s

### Input behaviour

- **Keypad** drives both the phone field (max 9 digits) and the code field (max 6). Delete key is `⌫`.
- **Primary CTA gating.** Label and colour both change: `Send the code` / `#4A6BE8` when valid, `Enter 9 digits` / `#1A2350` with `#5E6790` text when not. Same pattern on the code screen (`Confirm` / `Six digits needed`).
- **Focused field** gets a 1.5px `#4A6BE8` border, `#101940` fill, and a 5px `rgba(74,107,232,.14)` outer ring.
- **Switches** transition background over 0.25s.
- **Code cells** transition fill over 0.2s.
- **Sweep** progresses 2% per 45ms tick, checklist rows flip state at 25/50/80/100%.

### Permission flow

Permissions are requested **after the reason for them is visible on screen**, never on launch. Both B5 and B6 make declining a first-class path with a stated consequence rather than a dead end.

### Sheets

Bottom sheets (C3, C11) sit on `#0C1226` with a top gold hairline, 28px top radius, a 40 × 5 grabber, and the underlying screen dimmed to ~0.30–0.32 opacity behind `rgba(4,6,15,.60)`.

### Failure states — behavioural requirements

These are not decoration; they are the product's contract.

1. **Stale data is labelled stale.** Offline muted the ring's palette and prints the timestamp. Muted ≠ safe.
2. **A failed check is not a clear day.** C7 shows tomorrow as *unknown* when the register is unreachable.
3. **No feasible plan is shown as no feasible plan.** C5 lists why each option failed and refuses to invent one.
4. **Choosing never sends.** Selecting a plan (05) sends nothing; sending is a separate screen (06) with one button.
5. **One reminder maximum** per request (07), stated on screen.
6. **Repair, don't replan.** A break (08) reopens only the withdrawn stretch.
7. **Only confirmed-as-ran arrangements count** in history and share figures (09, C10). "Not reported" stays visible.
8. **Deleting withdraws first.** C14 cancels every outstanding request before erasing anything.

---

## State Management

State needed for the setup flow (as modelled in the prototype):

| Variable | Type | Notes |
|---|---|---|
| `step` | Int 0–11 | Setup position |
| `phone` | String | Max 9 digits |
| `code` | String | Max 6 digits |
| `name` | String | Display name shown to carers |
| `email` | String | Recovery fallback |
| `kids` | [Child] | Name + age; must support N children |
| `notif` | Bool | Device-local tomorrow-gap reminder; default time 21:00 |
| `loc` | enum {granted, manual, nil} | |
| `invited` | [Carer] | Name, email, state |
| `sweep` | Int 0–100 | Drives the B8 checklist |

For daily use, the domain objects the screens imply:

- **Child** — name, age, provider, care hours per weekday, collection responsibility
- **WorkWeek** — per-day hours, location (office/home), travel minutes each way
- **Day** — date, per-child coverage bands with `{start, end, state: covered|gap|unknown, carer?, sourceRecords: [String]}`
- **Plan** — segments, coverage %, travel, handover count, known cost, parent's share, feasibility flag, criteria matched, attribution string
- **Request** — recipient, window, message, deadline, state `{draft|sent|reminded|confirmed|declined|expired|withdrawn|undeliverable}`, reminder count (max 1)
- **Sweep** — timestamp, per-source result `{ok|failed}`, so a partial failure can be reported honestly

Note that `Day` bands carry their **source records** — the UI is required to print them, so they cannot be derived at render time.

---

## Assets

No bitmap images. Every graphic is drawn:

- **Diamonds** — 9–11px squares rotated 45°, filled (active/confirmed) or 1px-outlined (inactive)
- **Rings** — conic gradients; see the ring convention above
- **Blobs** — SVG-filtered circle stacks
- **Coverage bars** — flex rows of percentage-width fills; gaps use `repeating-linear-gradient(45deg, #FF6B81 0 6px, #D9576D 6px 12px)`
- **Week strips** — 7 flex columns with rounded fills
- **Icons** — text glyphs only (`‹`, `›`, `→`, `≡`, `▾`, `⌫`, `✦`)

**Fonts:** Cormorant Garamond and Instrument Sans, both Google Fonts. Bundle them in the app rather than loading remotely.

**No emoji anywhere** — deliberate for a safety-critical product.

---

## Files

| File | Contents |
|---|---|
| `EqualPath Mobile.dc.html` | The 41-screen gallery — the specification |
| `EqualPath iOS Prototype.dc.html` | Clickable 12-step setup prototype |
| `support.js` | Runtime for the two HTML files; not part of the design |

Open either HTML file directly in a browser. The gallery pans and zooms.

---

## Copy

All on-screen text in these files is final and deliberate. Several phrases are load-bearing and should not be paraphrased during implementation:

- **"Feasible"**, never "best" or "recommended"
- **"Best match for your selected priorities"** — ranking always names its criteria
- **"Registered supply, not vacancy"** — the register shows licences, not free places
- **"Unknown"** as an explicit value, distinct from a gap
- **"Not reported"** kept visible in history
- **"Choosing sends nothing"**
- **"Muted colour means unverified, not safe"**

The parent is **Aina**; her children are **Nia** (4) and **Idris** (7); carers are **Farid** (partner), **Mother**, **Siti** (neighbour); the provider is **TASKA Seri Kasih**, JKM-registered, 2.3 km.
