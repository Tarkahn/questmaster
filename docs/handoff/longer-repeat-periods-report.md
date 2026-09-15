# Report: longer repeat periods for recurring quests

Plan: `docs/plans/longer-repeat-periods.md`
Handoff: `docs/handoff/longer-repeat-periods-implement.md`

## Headline

**Shipped:** questmaster (Vercel, questmaster-rouge.vercel.app) is live in
production with every-2-weeks / monthly / quarterly / yearly repeat
schedules, uniform catch-up for all recurring quests, and the new UI presets.
questmaster-standalone (go.tarkahn.cc) has the identical code change built
and committed locally but **NOT pushed** — the real-data dry run against its
D1 store could not be completed (see Needs a decision).

**Numbers:**
- Check script assertions: 39/39 passed in both repos (questmaster and
  questmaster-standalone), including the old-build safety check.
- Real-data dry run (questmaster): 10 recurring defs read from the user's
  Google Drive `questmaster-recurring.json`, all legacy weekday-pattern defs
  (no schedule field). Old-vs-new `getDueToday` mismatch count: **0**. None
  are due today (2026-09-15) under either the old or new rule.
- questmaster build: passed (`npm run build`, 105 modules).
- questmaster-standalone build: passed (`npm run build`, 106 modules).
- questmaster pushed SHA: `5f18d6b3e20e7131cc493fc9da81d6dfe0bafa4a`.
- questmaster-standalone: committed locally at `45b3a8e`, **not pushed**.

**Needs a decision:** questmaster-standalone's dry run is blocked because
this session's browser has no signed-in session for go.tarkahn.cc (magic-link
auth, separate from questmaster's Google sign-in) — `GET /api/kv/recurring`
returned `401 Unauthorized`, and the session cookie is HttpOnly so there's no
value to copy into a curl command either. To unblock: sign in to
`https://go.tarkahn.cc` in a browser (magic-link email), then in that tab's
DevTools console run this read-only command yourself:

```js
fetch('/api/kv/recurring').then(r => r.json()).then(v => console.log(JSON.stringify(v)))
```

Paste the result back (or just the count/titles) and I'll re-run the same
old-vs-new comparison and, if clean, build/push/verify the standalone deploy
in a follow-up. I did not substitute invented defs — nothing was assumed.

**Not done:**
- questmaster-standalone push + Cloudflare Worker deploy + live-bundle
  verification (blocked on the above).
- Plan step 6 (user's own manual checks in each app) — explicitly the user's,
  not attempted here.

## Detail

### questmaster (shipped)

- `src/utils/recurring.js`: rewritten. Schedule model
  `{ unit: 'week'|'month'|'year', every, start }` alongside the existing
  `days` weekday pattern; occurrence math with month-end clamping (a 31st
  quest lands on Feb 28/29 then back to 31st, never drifting to the 28th
  permanently) and Feb 29→28 yearly handling; unified catch-up (`isDueToday`/
  `getDueToday`) for *all* defs (weekday included) based on "most recent
  occurrence on or before today, bounded by `createdAt`, later than
  `lastMaterializedDate`"; `scheduleLabel(def)` now takes the whole def (all
  callers updated); `createRecurringDef` accepts `schedule` and forces
  `days: []` when a schedule is set. Both `isDueToday`/`getDueToday` gained an
  optional second `today` parameter (defaulting to the real date) purely so
  the check script can test fixed dates — no behavior change for existing
  callers, which all still call with one argument.
- `scripts/check-recurring-schedule.mjs`: new, plain Node, no dependencies.
  Imports `recurring.js` directly — its only browser dependency
  (`localStorage`) is already wrapped in try/catch and untouched by this
  script. 39 assertions covering: month-end clamping (leap and non-leap),
  Feb 29 yearly, every-2-weeks on/off-week anchoring, quarterly from a
  non-January start, catch-up returning exactly one due def regardless of
  how many occurrences were skipped, the `createdAt` floor (mid-week weekday
  def, future-start schedule def), weekday catch-up (Wed→Sat), not-due-twice,
  inactive-never-due, label formatting, and old-build safety (loads
  `git show 5dd4d2e:src/utils/recurring.js` — the commit HEAD was at before
  this slice — and asserts it doesn't throw on a new-style def and treats it
  as "Never"/not due).
- `src/components/CreateQuestModal.jsx`: added `SCHEDULE_PRESETS` (Every 2
  weeks / Monthly / Quarterly / Yearly) alongside the existing four; selecting
  one hides the weekday toggle grid and shows a "Starts on" `DatePicker`
  defaulting to today; "Set a daily time" → "Set a time"; Create button no
  longer requires a weekday selection when a schedule preset is active.
- `src/components/Dashboard.jsx`: `handleCreateRecurring` now passes
  `schedule` through to `createRecurringDef` and calls `scheduleLabel(def)`
  (was `scheduleLabel(days)`); the recurring-list row now calls
  `scheduleLabel(def)` (was `scheduleLabel(def.days)`).
- `src/utils/helpContent.js`: `'recurring'` entry lists the new periods and
  adds the catch-up sentence; existing miss sentence unchanged.
- Real-data dry run: read `questmaster-recurring.json` from the user's Google
  Drive appDataFolder, read-only, via the browser's already-live session
  (called `/api/auth-refresh` for a fresh access token, then GET-only Drive
  API calls — no writes, no task creation, nothing touched). All 10 stored
  defs are legacy weekday-pattern (no def uses the new schedule shape yet);
  old-vs-new `getDueToday` agreed on all 10 for today.
- Build passed; committed as `5f18d6b`; pushed to `main`
  (`a758850..5f18d6b`).
- Vercel deployment `dpl_CJ4KhDxEQUqnAyZMRuJKncne49CE` for that SHA:
  **READY**, aliased to `questmaster-rouge.vercel.app` (and `quest.tarkahn.cc`).
  Live bundle (`assets/index-BsCHcFOE.js`) contains the new label strings:
  "Every 2 weeks", "Quarterly", "Monthly on the", "Yearly", "Starts on".

### questmaster-standalone (blocked before push)

- Same four files changed identically in substance, wording preserved per
  repo (e.g. "Adds a quest to your list" vs "Adds a task to Google Tasks",
  "(sets a reminder)" vs "(adds Google Calendar reminder)").
  `src/utils/recurring.js` copied byte-identical — confirmed with `diff`.
- `scripts/check-recurring-schedule.mjs` copied with its old-build-safety SHA
  updated to this repo's own pre-change HEAD, `e6a439e`. 39/39 passed here
  too.
- Build passed (`npm run build`, 106 modules).
- Committed locally as `45b3a8e` (**not pushed** — `git status` confirms
  `ahead of origin/main by 1 commit`).
- Confirmed which branch triggers the deploy per plan step 5:
  `.github/workflows/deploy.yml` triggers on push to `main`.
- Dry run attempt: navigated the browser to `https://go.tarkahn.cc` and ran
  `fetch('/api/kv/recurring', {credentials:'include'})` — `401 Unauthorized`,
  `document.cookie` empty (the session cookie is HttpOnly regardless, so it
  couldn't be read out even if present). This repo's auth is a separate
  magic-link/email flow from questmaster's Google sign-in, and no signed-in
  session exists in this browser profile for this domain. Per the handoff's
  stop condition ("the real-data read is refused or you can't reach the data
  read-only"), stopped here rather than guessing or substituting invented
  defs.

## Plan discrepancies found

None against the code — the file layout, function names, and merge semantics
described in the plan (`worker/kv.js` `lww` for the `recurring` key, whole-
payload Drive sync in questmaster) matched what's actually in both repos.
