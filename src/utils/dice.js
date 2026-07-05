// Shared dice helpers. Rewards (TaskItem) and penalties (penalties.js) both roll
// dice — keep the RNG in one place so a single d-something means the same thing.

// One die: roll(20) → 1..20, roll(4) → 1..4
export function roll(sides) {
  return Math.ceil(Math.random() * sides)
}

// Sum of n dice of the given size: rollSum(3, 6) → 3..18
export function rollSum(n, sides) {
  let total = 0
  for (let i = 0; i < n; i++) total += roll(sides)
  return total
}
