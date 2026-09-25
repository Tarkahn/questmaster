// Side-by-side theming test: current prompt vs. improved prompt, at
// reasoning_effort 'none' vs 'low', on gpt-6-luna. Reads OPENAI_API_KEY from
// the environment (never printed). Writes results.json + results.md.
import { writeFileSync } from 'node:fs';

const MODEL = 'gpt-6-luna';
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1); }

const ITEMS = [
  { title: 'call the dentist to reschedule' },
  { title: 'call John (architect) about the kitchen plans' },
  { title: 'pick up dry cleaning' },
  { title: 'finish Q3 budget report for Sarah', notes: 'due to CFO Friday, needs variance analysis' },
  { title: 'gym - leg day' },
  { title: 'renew car registration' },
  { title: 'email Priya re: contract redlines', notes: "she's our outside counsel" },
  { title: 'do taxes' },
  { title: 'grocery run: milk, eggs, coffee' },
  { title: 'read 30 pages of Dune' },
  { title: 'team standup' },
  { title: 'dinner with Mom and Dad' },
  { title: 'fix the leaky bathroom faucet' },
  { title: 'prepare slides for board presentation' },
  { title: 'meditate 10 min' },
  { title: 'clean out the garage' },
  { title: 'schedule vet appointment for Max', notes: 'dog, annual shots' },
  { title: '5k run' },
  { title: 'practice guitar' },
  { title: 'cancel gym membership' },
];

const STATS = [
  { id: 'STR', name: 'Strength', description: 'physical exertion, lifting, manual labor' },
  { id: 'DEX', name: 'Dexterity', description: 'fine motor skill, craft, instruments, agility' },
  { id: 'CON', name: 'Constitution', description: 'endurance, cardio, health habits, sleep' },
  { id: 'INT', name: 'Intelligence', description: 'study, analysis, reading, technical work' },
  { id: 'WIS', name: 'Wisdom', description: 'reflection, mindfulness, planning, judgment' },
  { id: 'CHA', name: 'Charisma', description: 'social, persuasion, presenting, relationships' },
];

// ── Current production prompt (verbatim from api/theme.js) ──────────────────
const BASE_SYSTEM_PROMPT = `You are the official scribe of QuestMaster, a Dungeons & Dragons 5th Edition adventure chronicle. Convert modern tasks and calendar events into authentic D&D language, classify each item's difficulty, and identify which character stats the activity develops.

TONE: Classic D&D 5e campaign setting — guilds, keeps, taverns, clerics, paladins, rogues, arcane magic, gold pieces, potions. Do NOT use Tolkien language. Do NOT use Game of Thrones language. Strictly D&D adventure style.

DIFFICULTY CLASSIFICATION:
- "normal"    → Routine tasks, quick errands, social events, easy meetings
- "hard"      → Mentally demanding work, stressful obligations, complex admin, things requiring focus
- "legendary" → Major projects, things you dread, high-stakes deliverables, intense physical or mental effort

RULES:
1. Keep each themed title under 10 words.
2. Preserve the core meaning — the adventurer must still know what the real task is.
3. Capitalize D&D proper nouns: the Apothecary, the Guild Hall, the Grand Academy.
4. Apply the Vocabulary Glossary exactly. Do not invent synonyms for defined terms.
5. NAME RULE: Keep first name, add D&D epithet by role. "call John (architect)" → "commune with John the Grand Builder". No role known → add "the Bold", "the Wise", or "the Swift".
6. NOTES: Some items include a "(notes: ...)" line beneath the title — use it as context to inform a more accurate theming (specific role, apothecary, type of meeting). NEVER include the notes verbatim in the themed title; the title stays a short headline.
7. Return only valid JSON — no explanation, no preamble.`;

const statBlock = `\n\nCHARACTER STAT CLASSIFICATION:
For each item, identify which character stats the activity develops and assign weights (0.0–1.0, weights summing to ≤ 1.0 across all stats for that item).
Only assign weights for stats that genuinely apply — most tasks only develop 1–2 stats. Return {} for tasks with no clear stat connection (admin, errands, scheduling).
Available stats:\n${STATS.map(s => `- ${s.id} (${s.name}): ${s.description}`).join('\n')}`;

const numbered = ITEMS.map((it, i) => {
  let line = `${i + 1}. ${it.title}`;
  if (it.notes) line += `\n   (notes: ${it.notes})`;
  return line;
}).join('\n');

const currentUser = `Convert each item, classify its difficulty, and identify stat weights. Return ONLY a JSON object with arrays of the same length as the input:

${numbered}

Reply with only this JSON:
{
  "themes": ["D&D title 1", "D&D title 2", ...],
  "difficulties": ["normal|hard|legendary", ...],
  "statWeights": [{"INT": 0.8, "WIS": 0.2}, {}, {"STR": 1.0}, ...]
}`;

// ── Improved prompt: worked examples + numbered, schema-enforced output ────
const EXAMPLES = `EXAMPLES (match this voice — vivid, specific, still obviously the real task):
- "call the plumber about the water heater" → "Summon Marcus the Pipewright to Tame the Boiler" (if the plumber is unnamed: "Summon the Guild Pipewright to Tame the Boiler")
- "buy birthday present for Emma" → "Procure a Worthy Birthday Tribute for Emma the Bright"
- "submit expense report" → "Deliver the Ledger of Expenses to the Guild Treasury"
- "yoga class" → "Attend the Monastery's Rite of Flowing Stances"
- "book flights for Denver trip" → "Secure Airship Passage to the City of Denver"
- "write chapter 3 of thesis" → "Inscribe the Third Chapter of the Great Thesis"
- "take out the trash" → "Banish the Refuse Beyond the Keep Walls"

THE MOST IMPORTANT RULE: a title that just restates the task with a capital letter is a FAILURE. "Read Thirty Pages of Dune", "Practice the Guitar" and "Repair the Leaking Faucet" are all failures. Every title must replace the modern verb AND at least one modern noun with an in-world equivalent, while the real task stays recognizable (keep the key object or name: Dune, the faucet, Max).

AVOID: generic filler that could fit any task ("Embark on a Grand Quest", "Undertake the Sacred Duty"), dropping the concrete object entirely, stacking three adjectives, modern words like "your", "appointment", "gym", "membership", and Tolkien words (hobbit, Middle-earth, lembas, Mordor).`;

const improvedSystem = BASE_SYSTEM_PROMPT.replace(
  '7. Return only valid JSON — no explanation, no preamble.',
  '7. Return one result per numbered item, using the same number. Never skip or merge items.'
) + '\n\n' + EXAMPLES + statBlock.replace('Return {} for tasks', 'Return an empty list for tasks');

const improvedUser = `Theme each numbered item, classify its difficulty, and identify stat weights:\n\n${numbered}`;

const schema = {
  name: 'themed_items',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['n', 'title', 'difficulty', 'stats'],
          properties: {
            n: { type: 'integer' },
            title: { type: 'string' },
            difficulty: { type: 'string', enum: ['normal', 'hard', 'legendary'] },
            stats: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['stat', 'weight'],
                properties: {
                  stat: { type: 'string', enum: STATS.map(s => s.id) },
                  weight: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
};

async function call({ system, user, effort, jsonSchema }) {
  const body = {
    model: MODEL,
    max_completion_tokens: 16000,
    reasoning_effort: effort,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  if (jsonSchema) body.response_format = { type: 'json_schema', json_schema: { ...jsonSchema, strict: true } };
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data.error || data).slice(0, 300)}`);
  return { data, ms: Date.now() - t0 };
}

function normalizeCurrent(text) {
  const m = text.match(/\{[\s\S]*\}/);
  const p = m ? JSON.parse(m[0]) : {};
  return ITEMS.map((_, i) => ({
    title: p.themes?.[i] ?? '(missing)',
    difficulty: p.difficulties?.[i] ?? '(missing)',
    stats: p.statWeights?.[i] ?? {},
  }));
}

function normalizeImproved(text) {
  const p = JSON.parse(text);
  const byN = Object.fromEntries((p.items || []).map(r => [r.n, r]));
  return ITEMS.map((_, i) => {
    const r = byN[i + 1];
    return r
      ? { title: r.title, difficulty: r.difficulty, stats: Object.fromEntries(r.stats.map(s => [s.stat, s.weight])) }
      : { title: '(missing)', difficulty: '(missing)', stats: {} };
  });
}

const cur = { system: BASE_SYSTEM_PROMPT + statBlock, user: currentUser, norm: normalizeCurrent };
const imp = { system: improvedSystem, user: improvedUser, jsonSchema: schema, norm: normalizeImproved };
const VARIANTS = [
  { key: 'A', label: 'Current prompt, thinking medium', ...cur, effort: 'medium' },
  { key: 'B', label: 'Current prompt, thinking high', ...cur, effort: 'high' },
  { key: 'C', label: 'Rewritten prompt, thinking medium', ...imp, effort: 'medium' },
  { key: 'D', label: 'Rewritten prompt, thinking high', ...imp, effort: 'high' },
];

// in/out $ per MTok for gpt-6-luna
const cost = u => (u.prompt_tokens * 0.10 + u.completion_tokens * 0.50) / 1e6;

const results = {};
await Promise.all(VARIANTS.map(async v => {
  try {
    const { data, ms } = await call(v);
    const text = data.choices?.[0]?.message?.content || '';
    const u = data.usage || {};
    results[v.key] = {
      label: v.label, ms, rows: v.norm(text),
      usage: { in: u.prompt_tokens, out: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0, usd: cost(u) },
    };
  } catch (e) {
    results[v.key] = { label: v.label, error: String(e.message || e) };
  }
}));

writeFileSync(new URL('./results2.json', import.meta.url), JSON.stringify({ items: ITEMS, results }, null, 2));

let md = '';
for (const v of VARIANTS) {
  const r = results[v.key];
  md += r.error
    ? `- **${v.key}** ${r.label}: ERROR ${r.error}\n`
    : `- **${v.key}** ${r.label}: ${r.ms} ms, ${r.usage.in} in / ${r.usage.out} out (${r.usage.reasoning} thinking), $${r.usage.usd.toFixed(5)}\n`;
}
md += '\n';
ITEMS.forEach((it, i) => {
  md += `### ${i + 1}. ${it.title}${it.notes ? ` _(notes: ${it.notes})_` : ''}\n`;
  for (const v of VARIANTS) {
    const r = results[v.key];
    if (r.error) continue;
    const row = r.rows[i];
    const st = Object.entries(row.stats || {}).map(([k, w]) => `${k} ${w}`).join(', ') || '—';
    md += `- **${v.key}** ${row.title} · _${row.difficulty}_ · ${st}\n`;
  }
  md += '\n';
});
writeFileSync(new URL('./results2.md', import.meta.url), md);
console.log(md);
