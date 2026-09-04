# Backlog pressure rebalance

Status: agreed, not yet implemented. Applies to **both** repos — `questmaster`
(Google) and `questmaster-standalone` (Go).

## The problem

The game gets harder the more you use it. Damage scales with the *stock* of open
quests while income scales with the *flow* of completions, so a backlog — the
normal resting state of a task app — bleeds the player out.

Measured from the current constants:

| | Value |
| --- | --- |
| Daily cost per open quest | `benignHpDie: 2` → d2 ≈ **1.5 HP/day** (x1.5 hard, x2 legendary) |
| Healing price | 25c / 5 HP = **5 coins per HP** (Greater is identical: 75c / 15 HP) |
| So carrying one quest costs | **~7.5 coins/day** |
| A normal quest pays | **8 coins**, and only if completed the same day |
| Same quest on day 2 / 3 / 4+ | 6 / 4 / **2 coins** (`decayMultiplier`) |

A normal quest therefore pays 8 coins once but costs ~7.5 coins/day to hold: it
is net-positive only if finished within about a day. The daily toll and the coin
decay push the same way, which is the compounding the player noticed.

At 20 open quests the sweep hits `maxDailyHpLoss: 25` — 25 HP/day against 100
max HP, a wipe every four days, and ~125 coins/day just to stand still.

## What we are NOT doing, and why

Raising quest income (`BASE_COIN_VALUE`) was the first instinct and was
rejected: coins are fungible, so more income also halves the real price of the
400–10,000 coin equipment and inflates progression that is already tuned. It
also only buys headroom — the carrying cost still grows linearly with backlog
size.

Explicitly out of scope for this plan (revisit later if wanted): a settings-
adjustable gold multiplier, and extra higher-tier potions above Greater.

## Change B — healing that is worth buying

Prices stay the same so the shop still feels familiar; the value roughly
doubles. `src/utils/items.js`:

| Item id | Cost | `playerHeal` | Coins/HP |
| --- | --- | --- | --- |
| `health-potion` | 25 (unchanged) | 5 → **10** | 5.0 → **2.5** |
| `greater-health-potion` | 75 (unchanged) | 15 → **35** | 5.0 → **2.14** |
| `healing-herbs` (cleric) | 30 (unchanged) | 10 → **20** | 3.0 → **1.5** |

Also update each item's `effect` string, which states the HP number and is shown
in the shop. Greater now genuinely beats buying three smalls, and the cleric
keeps its class advantage.

## Change C — stop the backlog from scaling the damage

The root fix. New knob in `PENALTY_CONFIG` (`src/utils/penalties.js`):

```js
backlogExponent: 0.5,   // 1 = old linear behaviour, 0.5 = sqrt(N)
```

Applied to the **benign d2 portion only**. In the `tally()` loop, each item's
raw benign roll is scaled by `Math.pow(N, backlogExponent - 1)`, and the scaled
values are redistributed across `perItem` by **running-remainder (error
diffusion) rounding**: accumulate the scaled values, and give each item
`Math.round(cumulative) - roundedSoFar`. That keeps the per-card badges summing
exactly to the scaled total.

Do **not** round each item independently as `Math.round(raw * backlogScale)`.
At N=40 the scale is ~0.158, so an average roll of 1.5 becomes 0.24 — every item
rounds to zero and the entire benign toll silently disappears. (An earlier draft
of this plan said "redistributed proportionally", which reads as exactly that
naive form; it was caught during implementation, not in review.)

**The overdue ramp stays fully linear and per-quest, and bosses are untouched.**
That is the design line: merely *having* captured tasks stops being punishing,
while missing a dated commitment still hurts exactly as much as it does today.

Effect on the benign portion (normal difficulty, average roll, no resist):

| Open quests | Now | With sqrt(N) |
| --- | --- | --- |
| 3 | 4.5 | 2.6 |
| 5 | 7.5 | 3.4 |
| 10 | 15 | 4.7 |
| 20 | 30 → capped 25 | 6.7 |
| 40 | 60 → capped 25 | 9.5 |

**Decision of record:** `backlogExponent` is 0.5. It was raised during planning
that this may be generous — at 40 quests it is ~9.5 HP/day, very survivable. The
alternative considered was 0.7 (15.9 at N=40, 8.0 at N=10). 0.5 was chosen
because the complaint was specifically that a large backlog is unplayable. It is
a single number; retune rather than restructure if it feels too soft.

## Change D — the potion stacking bug

`src/components/ShopView.jsx`, `getState()`:

```js
if (item.consumable) {
  if (count > 0) return { type: 'use', count, sellPrice }   // <- Buy disappears
  return canAfford ? { type: 'buy' } : { type: 'locked' }
}
```

Once the player holds one of a consumable the card flips to **Use** and the Buy
button vanishes, so potions cannot be stocked up — they must be consumed before
another can be bought. This is a UI bug, not a design choice: `handleBuyItem`
(`Dashboard.jsx`) already stores `consumables[itemId]` as a **count** and
increments it, and `InventoryModal` already renders counts.

Fix: when `count > 0`, offer **Use and Buy together** (Buy still gated on
`canAfford`). Extend the render switch to draw both controls. No data-model
change.

## Combined effect

At a 20-quest backlog: **25 HP/day → ~6.7**, and the coins needed to heal that
go from **~125/day → ~17/day**. Roughly seven times less pressure, with quest
income and gear prices completely untouched.

## Files

Both repos, same changes:

- `src/utils/items.js` — heal values + effect strings. **Byte-identical across
  repos**, so it can be copied.
- `src/components/ShopView.jsx` — the stacking fix. **Byte-identical across
  repos**, so it can be copied.
- `src/utils/penalties.js` — `backlogExponent` + the `tally()` scaling. **NOT
  identical**: apply the same edit separately in each. `PENALTY_CONFIG` matches
  exactly, and the `tally()` loop matches except the Go version reads
  `it.dueDate` where the Google version reads `it.due`. Do not copy this file.

## Verification

1. `npx vite build --logLevel warn` clean in both repos (a pre-existing
   chunk-size warning is expected; there should be no errors).
2. Potion maths: confirm the shop shows the new HP numbers and that using one
   restores the new amount, capped at max HP.
3. Stacking: buy a Health Potion, confirm the card still offers Buy, buy a
   second, confirm the inventory count reads 2.
4. Backlog scaling is the hard one to verify by hand because the sweep runs once
   per calendar day and rolls dice. Prefer a temporary unit-style check of the
   scaling arithmetic over waiting for a real sweep; do not ship it.

## Traps

- The daily sweep is **not idempotent** (it rolls dice) and is guarded by
  `lastSweepDate` in the ledger. Do not "test" by forcing repeated sweeps against
  real character data.
- `maxDailyHpLoss` scaling must still run *after* the new backlog scaling, and
  must keep rescaling `perItem` proportionally, or the per-card penalty display
  stops matching the reported total.
- Overheal is wasted — `playerHeal` is capped at max HP (100 base). The larger
  potions are deliberately situational.
