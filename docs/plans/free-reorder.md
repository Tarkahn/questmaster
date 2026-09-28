# Plan: free-reorder — drag undated quests anywhere, in both views

Agreed with Rick 2026-09-28. Changes **both** versions (questmaster and
questmaster-standalone). The slice **ends in a push to `main` of each repo**,
which deploys questmaster-rouge.vercel.app (Vercel) and go.tarkahn.cc (GitHub
Actions to Cloudflare). No D1 migration: the order is stored where it is today
(`taskorder` side file / KV key).

## What Rick asked for

Quests with no date and no time — including recurring quests with no set time,
once they spawn — can be dragged anywhere in the list, so Rick can keep a
hand-ordered list. This works with **Full List on and off**. Anything with a
date or time (dated quests, missions, timed recurring quests) always keeps
strict time order, no matter what.

## Rules

1. **Locked items** keep strict time order among themselves, in every view and
   with Auto-sort on or off, and cannot be dragged:
   - quests with a date (time of day breaks ties, as today);
   - missions (only shown in Full List);
   - quests with a time but no date — in practice spawned recurring quests with
     a set time. Treat them as due on the day they spawned (today) at that time.
2. **Free items** are quests with neither a date nor a time, including spawned
   recurring quests with no time. They can be dropped anywhere, including
   between two locked items, in both views.
3. **One shared order** for both views. Moving "Stretch" above "Laundry" in one
   view shows the same in the other. Placement relative to missions only
   matters in Full List, since the normal view shows missions separately.
4. **Recurring quests keep their slot.** Each spawn gets a new task ID today, so
   it falls to the end. Key a spawned instance's place in the order by its
   recurring definition ID, so tomorrow's spawn lands where Rick put today's.
5. **Auto-sort on: drag still wins.** Dragging stays enabled with Auto-sort on.
   A free quest Rick has dragged keeps the spot he gave it; free quests he has
   never dragged are ordered by Auto-sort around it. Locked items stay in strict
   time order in Auto-sort too. Confirmed example: 5 undated quests, Rick drags
   "Laundry" to the top → Laundry stays top every day until done or moved; the
   other 4 keep being auto-ordered around it.
6. New locked items (a new dated quest or mission) slot in by time without
   moving the free items around them. New free quests follow the existing
   "new quest position" setting (top or bottom).
7. Full List keeps its day headings. A free quest shows under whichever day
   heading it was dropped into. The "No date" group holds only free quests that
   sit after every locked item.

## Out of scope

- Dragging dated quests or missions.
- Moving side quests between parent quests (their own in-card drag stays as is).
- Any change to how recurring quests spawn, other than keeping their slot.

## Done means

The acceptance checks in `docs/handoff/free-reorder-implement.md` pass in both
versions, the checker clears it, both repos are pushed, and the change is
confirmed live on both sites.
