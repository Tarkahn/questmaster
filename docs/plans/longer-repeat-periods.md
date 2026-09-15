# Longer repeat periods for recurring quests

Status: agreed 2026-09-15, not yet implemented. Applies to **both** repos —
`questmaster` (Google Tasks, Vercel) and `questmaster-standalone` (Cloudflare
Worker + D1, go.tarkahn.cc). This file lives in `questmaster`; the standalone
slice follows it from here.

## The problem

Recurring quests can only repeat on days of the week (Daily / Weekdays /
Weekends / Custom days). There is no way to repeat every 2 weeks, monthly,
quarterly or yearly.

How recurring quests work today (read before changing anything):
- A def lives in `src/utils/recurring.js` storage (`qm_recurring`), synced
  whole-payload by `updatedAt` (Google: Drive file; standalone: worker KV key
  `recurring`, merged with `lww` in `worker/kv.js`, stored as-is — no shape
  validation, checked 2026-09-15).
- `getDueToday` returns active defs whose weekday is in `def.days` and whose
  `lastMaterializedDate !== today`. `loadTasksAndEvents` in `Dashboard.jsx`
  materializes each: if the previous copy (`lastTaskId`) wasn't completed it's
  deleted and recorded as a miss (streak reset, XP penalty), then a fresh
  task is created.
- `src/utils/recurring.js` is byte-identical in both repos (checked
  2026-09-15). `CreateQuestModal.jsx` differs only in wording.

## Decisions (user's answers, 2026-09-15)

| Question | Answer |
| --- | --- |
| Which apps | Both |
| Monthly/quarterly meaning | Same **date** (e.g. the 15th), not "third Thursday" |
| Periods offered | Every 2 weeks, Monthly, Quarterly, **Yearly** |
| App not opened on the due day | **Catch up for all** repeats, including existing daily/weekly |

User was shown and accepted (did not ask to change):
- daily/weekly catch-up means a missed-day copy appears on the next open, and
  the previous undone copy is judged missed then rather than on the next
  scheduled day;
- a long-period quest left open pays the normal daily open-quest HP toll for
  as long as it's open — no exemption.

## Spec

### Schedule model
- **Existing defs unchanged:** `days: [0-6…]`, no `schedule` field → weekday
  pattern.
- **New defs:** `schedule: { unit: 'week' | 'month' | 'year', every: n, start: 'YYYY-MM-DD' }`
  and **`days: []`**.
  Presets: Every 2 weeks `{week, 2}`, Monthly `{month, 1}`,
  Quarterly `{month, 3}`, Yearly `{year, 1}`.
- *Why `days: []`:* a device still running the old build calls
  `def.days.includes(...)` in `isDueToday` and `[...days]` in
  `scheduleLabel`. A missing `days` would throw inside `loadTasksAndEvents`
  and break the whole quest list on that device; a weekday list would make
  the old build repeat it weekly. An empty list makes the old build treat it
  as "Never" — no crash, creates nothing — and the new build on any device
  catches it up.
- *Why a start date:* it anchors every-2-weeks (which week) and gives the day
  of month / date of year. Defaults to today in the modal.

### Occurrence rules (all local dates, never UTC)
- Every 2 weeks: dates `start + 14k days`.
- Monthly / quarterly: day-of-month of `start`, every 1 / 3 months counted
  from `start`'s month; if that month is shorter, the **last day** of the
  month. (Clamp per month from the original day — a 31st quest is Jan 31,
  Feb 28/29, Mar 31, not drifting to the 28th forever.)
- Yearly: `start`'s month/day each year; Feb 29 → Feb 28 in non-leap years.
- Weekday defs: any date whose weekday is in `days`.

### Catch-up (all defs)
A def is due when: active, AND its **most recent occurrence on or before
today** exists, is **on or after `createdAt`** (and on/after `start` for
schedule defs), AND is **later than `lastMaterializedDate`** (or that's null).
- Exactly one copy is made however many occurrences were skipped.
- Miss rule unchanged: the undone previous copy is a miss when the new copy
  is made. Skipped occurrences with no copy are not extra misses.
- *Why the `createdAt` floor:* without it, a def created today would catch
  up an occurrence from before it existed (e.g. a Monday quest created on a
  Wednesday appearing immediately). Today such a def waits for Monday; keep
  that. Note `createdAt` is a local `YYYY-MM-DD` (`todayStr()`).
- A same-day weekday def created today still appears today, as now.

### Labels
`scheduleLabel` takes the **def** (all callers updated): existing weekday
labels unchanged; new ones e.g. "Every 2 weeks (Tue)", "Monthly on the 15th",
"Quarterly on the 15th", "Yearly on Mar 3". Used in the Recurring section and
the creation toast.

### UI (`CreateQuestModal.jsx`, repeat section)
- Add preset buttons Every 2 weeks / Monthly / Quarterly / Yearly after the
  existing four. Selecting one hides the weekday toggles and shows a
  "Starts on" `DatePicker` (component already exists) defaulting to today.
- "Set a daily time" → "Set a time" (both repos' wording variants).
- Create button enabled for schedule presets without any weekday selected.

### Help text
`src/utils/helpContent.js` `'recurring'` entry: add that a quest whose day
passed while the app was closed appears the next time you open it, and list
the new periods. Keep the existing miss sentence.

## Out of scope
- Editing an existing def's schedule (not possible today; unchanged).
- Every-N custom intervals, "nth weekday" monthly.
- Showing long-period quests ahead of their date; HP-toll exemption.
- Missions (calendar events) — they already have their own RRULE options.

## Steps

1. **`src/utils/recurring.js`** (questmaster): schedule model, occurrence
   math, catch-up `getDueToday`, `scheduleLabel(def)`, `createRecurringDef`
   accepting `schedule`. **Risk: changes when every existing recurring quest
   materializes.**
2. **Check script** `scripts/check-recurring-schedule.mjs` (plain node, no
   dependencies; if `recurring.js` can't be imported under node as-is, report
   how you worked around it). Assert, with fixed "today" values:
   month-end clamping (31st through Feb, leap and non-leap, back to 31st);
   Feb 29 yearly; every-2-weeks anchoring (on-week and off-week); quarterly
   from a non-January start; catch-up picks the most recent occurrence only;
   `createdAt` floor (weekday def created mid-week not due until its day;
   schedule def with start in the future not due); weekday catch-up
   (Weekdays def last made Wed, today Sat → due); not due twice the same day;
   inactive never due. **Old-build safety:** load the pre-change
   `recurring.js` from git (`git show <base>:src/utils/recurring.js`) and
   assert its `getDueToday` and `scheduleLabel(def.days)` don't throw on a
   new-style def and return not-due / "Never".
   *Why a script:* the project has no test runner, and date math is exactly
   what one manual click-through won't cover.
3. **Google app UI + wiring:** `CreateQuestModal.jsx`, `Dashboard.jsx`
   (`handleCreateRecurring` passes `schedule`; label calls take the def),
   `helpContent.js`.
4. **Real-data dry run, then ship questmaster.** Read the user's actual
   stored recurring defs, read-only, and compute which defs the new
   `getDueToday` returns for today vs the old one. If the new rule would
   create anything the old one wouldn't, **stop and report before pushing**
   (list titles + why). `npm run build`; commit; push to `main` →
   **production deploy (Vercel, questmaster-rouge.vercel.app)**; confirm the
   deployment for that SHA is READY and the live bundle contains a new label
   string.
5. **Standalone:** copy `recurring.js` byte-identical, apply the same UI /
   Dashboard / help changes adapted to its files, copy the check script and
   run it there. Same dry run against the standalone's stored defs (D1 `kv`
   row for key `recurring`, read-only). Build; commit; push → **production
   deploy of go.tarkahn.cc via `.github/workflows/deploy.yml`** (confirm which
   branch triggers it before pushing); confirm the run succeeded and the
   live bundle contains a new label string.
6. **User's checks (need their accounts), after both deploys:** in each app,
   create a Monthly quest starting today → it appears today labelled
   "Monthly on the <today>"; existing daily/weekly quests look normal.
