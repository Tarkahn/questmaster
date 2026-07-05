export const HELP = {
  'quests': {
    title: '⚔️ Today\'s Quests',
    body: [
      'Quests are pulled from your Google Tasks each day. Any incomplete task appears here as an adventure to complete.',
      'Tap a quest\'s title to briefly reveal its original name — it then re-hides behind the D&D title the Scribe gave it. Tap again to reveal once more.',
      'Set the difficulty using the D20 dice roll before completing — higher difficulty awards more XP and coins. Swipe right or tap ⚔️ Complete to claim your reward.',
      'Drag quests up or down to reorder them. Use ⊕ to create a new quest directly in Google Tasks.',
    ],
  },
  'missions': {
    title: '📅 Missions',
    body: [
      'Missions come from your Google Calendar. Any event scheduled for today (or upcoming days if you\'ve expanded the look-ahead window) appears here.',
      'Claim a mission after the event has passed to earn XP and coins. Unlike quests, missions can\'t be completed in advance.',
      'Use the day-filter buttons to see missions for today only, or look further ahead.',
    ],
  },
  'bosses': {
    title: '🐉 Boss Battles',
    body: [
      'Bosses represent habits — recurring behaviours you\'re trying to lock in. Each boss has an HP bar that counts down as you check in consistently every day.',
      'Miss a day and the boss heals. Keep showing up and you\'ll eventually defeat it — logging the habit permanently in your Chronicle.',
      'Paused bosses are on hold and won\'t lose or gain HP. Defeated bosses live in your Hall of Victories.',
      'Cleric class items (Holy Tome, Cleric\'s Amulet) deal 1 bonus damage to the active boss each time you complete a quest — letting you chip away at it through your daily task work, not just habit check-ins.',
    ],
  },
  'recurring': {
    title: '🔄 Recurring Quests',
    body: [
      'These are scheduled quests that automatically create a new task in Google Tasks on the days you specify — daily, weekdays, specific days of the week, etc.',
      'If you don\'t complete a recurring quest before the next scheduled day, the old task is removed, your streak resets to zero, and a small XP penalty is applied.',
      'Tap ⏸ to pause a recurring quest (no new tasks created while paused). Tap ✕ to permanently delete the schedule.',
    ],
  },
  'character-gear': {
    title: '⚒ Equipped Gear',
    body: [
      'Items you\'ve bought from the shop and equipped to your character. Each slot (Head, Body, Main-Hand, etc.) holds one item at a time.',
      'Equipped items grant passive bonuses: extra XP per quest, bonus coins, boss HP healing, fortune procs, and more. Hover or tap any slot to see what\'s equipped or visit the shop to browse that category.',
      'Some items are class-restricted — switching class may unequip incompatible gear.',
    ],
  },
  'character-attributes': {
    title: '⚡ Attributes',
    body: [
      'Your character\'s personal stats, which level up independently based on what kinds of tasks you complete.',
      'When you complete a quest or mission, the AI classifies it against each stat\'s description and awards proportional XP. A gym session might earn 💪 Strength and 🏃 Constitution XP; studying earns 🧠 Intelligence.',
      'Tap any stat to see exactly which quests and missions contributed to its XP.',
      'Use ＋ Add Custom Stat to create your own tracked skill with a description the AI uses to classify your tasks.',
    ],
  },
  'chronicle-today': {
    title: '⚡ Today',
    body: [
      'A live snapshot of your activity today — XP earned, quests completed, and missions claimed so far.',
      'These numbers reset at midnight and are rolled into your all-time Chronicle history.',
    ],
  },
  'chronicle-7day': {
    title: '🗓 Last 7 Days',
    body: [
      'Daily XP earned over the past week. Taller bars mean more XP earned that day.',
      'Use this to spot whether your momentum is building or dropping off. Gaps are days you earned no XP.',
    ],
  },
  'chronicle-level': {
    title: '📈 Level Progression',
    body: [
      'Your cumulative adventurer level over time. The line shows how your total XP has grown day by day.',
      'Steep sections represent productive stretches. Flat sections are quieter periods. The goal is a line that keeps climbing.',
    ],
  },
  'chronicle-bosses': {
    title: '🐉 Boss History',
    body: [
      'A summary of all your habit boss battles. Active bosses are ones you\'re currently fighting. Paused bosses are temporarily on hold.',
      'Vanquished bosses appear in the Hall of Victories — a permanent record of every habit you\'ve successfully locked in.',
      'Total check-ins counts every day you\'ve logged progress across all bosses combined.',
    ],
  },
  'chronicle-recurring': {
    title: '🔁 Recurring Quest Stats',
    body: [
      'Tracks how consistently you\'ve completed each recurring quest over time.',
      '🔥 Current streak — consecutive scheduled days completed in a row without a miss. Resets to zero on the first missed day.',
      '⭐ Best streak — your all-time personal record for that quest. Never goes down.',
      '💀 Total missed — how many times the quest wasn\'t completed before the next scheduled day rolled over, triggering a penalty.',
      'The bar chart shows misses per day over the last 30 days. Taller orange bars mean more recurring quests missed that day. Use it to spot trends — are you missing more often recently, or getting better?',
    ],
  },
  'chronicle-alltime': {
    title: '🏆 All-time',
    body: [
      'Your cumulative totals since you started using QuestMaster.',
      'Active days counts any day where you earned at least 1 XP — a measure of consistency over time.',
    ],
  },
}
