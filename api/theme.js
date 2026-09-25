import { authenticate } from './_auth.js'
import { checkQuota } from './_rateLimit.js'
import { callAI, isAIConfigured, textOf, extractJson, getActiveModel } from './_ai.js'

// ─── Anthropic path (rollback target) ───────────────────────────────────────
// Byte-identical to the pre-migration prompt/parse. Do not touch when editing
// the OpenAI path below — this is what AI_PROVIDER=anthropic reproduces.
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
7. Return only valid JSON — no explanation, no preamble.`

// ─── OpenAI path (v2 prompt, medium thinking) ───────────────────────────────
// Copied from docs/handoff/theme-v2-eval.mjs's improvedSystem/improvedUser/
// schema/normalizeImproved, with the two tightenings from the handoff brief:
// rule 1 now says to count words, and the AVOID list calls out possessives
// by name (medium-thinking still let "Your" through in the eval).
const V2_EXAMPLES = `EXAMPLES (match this voice — vivid, specific, still obviously the real task):
- "call the plumber about the water heater" → "Summon Marcus the Pipewright to Tame the Boiler" (if the plumber is unnamed: "Summon the Guild Pipewright to Tame the Boiler")
- "buy birthday present for Emma" → "Procure a Worthy Birthday Tribute for Emma the Bright"
- "submit expense report" → "Deliver the Ledger of Expenses to the Guild Treasury"
- "yoga class" → "Attend the Monastery's Rite of Flowing Stances"
- "book flights for Denver trip" → "Secure Airship Passage to the City of Denver"
- "write chapter 3 of thesis" → "Inscribe the Third Chapter of the Great Thesis"
- "take out the trash" → "Banish the Refuse Beyond the Keep Walls"

THE MOST IMPORTANT RULE: a title that just restates the task with a capital letter is a FAILURE. "Read Thirty Pages of Dune", "Practice the Guitar" and "Repair the Leaking Faucet" are all failures. Every title must replace the modern verb AND at least one modern noun with an in-world equivalent, while the real task stays recognizable (keep the key object or name: Dune, the faucet, Max).

AVOID: generic filler that could fit any task ("Embark on a Grand Quest", "Undertake the Sacred Duty"), dropping the concrete object entirely, stacking three adjectives, modern words like "your", "appointment", "gym", "membership", and Tolkien words (hobbit, Middle-earth, lembas, Mordor). Modern possessives — "your", "my", "our", in any capitalization — must never appear, not even once: "Attend the Guild Meeting", never "Attend Your Guild Meeting". Rephrase around the adventurer or the object itself instead.`

const V2_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT
  .replace('1. Keep each themed title under 10 words.', '1. Keep each themed title to 10 words or fewer — count them.')
  .replace(
    '7. Return only valid JSON — no explanation, no preamble.',
    '7. Return one result per numbered item, using the same number. Never skip or merge items.'
  ) + '\n\n' + V2_EXAMPLES

// A dummy enum value used when no stat glossary is sent, since strict
// json_schema mode rejects an empty enum. The prompt tells the model to
// leave `stats` empty; any 'NONE' row that slips through is dropped when
// mapping results back (see statWeights below).
const NO_STAT_ENUM = ['NONE']

// Exported (in addition to the default handler) so the offline eval-harness
// check in the implement report can import the real prompt/schema builders
// rather than a copy. Vercel's function bundler only cares about the default
// export, so this adds no behaviour.
export function buildOpenAiSystemPrompt(glossary, statGlossary) {
  let prompt = V2_SYSTEM_PROMPT
  if (glossary) {
    prompt += `\n\nVOCABULARY GLOSSARY (use these exact translations):\n${glossary}`
  }
  if (Array.isArray(statGlossary) && statGlossary.length > 0) {
    const statLines = statGlossary.map(s => `- ${s.id} (${s.name}): ${s.description}`).join('\n')
    prompt += `\n\nCHARACTER STAT CLASSIFICATION:
For each item, identify which character stats the activity develops and assign weights (0.0–1.0, weights summing to ≤ 1.0 across all stats for that item).
Only assign weights for stats that genuinely apply — most tasks only develop 1–2 stats. Return an empty list for tasks with no clear stat connection (admin, errands, scheduling).
Available stats:\n${statLines}`
  } else {
    prompt += `\n\nCHARACTER STAT CLASSIFICATION:
No character stats are tracked for this request. Return an empty "stats" list for every item.`
  }
  return prompt
}

export function buildOpenAiSchema(statGlossary) {
  const statEnum = Array.isArray(statGlossary) && statGlossary.length > 0
    ? statGlossary.map(s => s.id)
    : NO_STAT_ENUM
  return {
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
                    stat: { type: 'string', enum: statEnum },
                    weight: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

function themeFallback(items) {
  const themes = {}
  const difficulties = {}
  const statWeights = {}
  items.forEach(item => { themes[item.id] = item.title; difficulties[item.id] = 'normal'; statWeights[item.id] = {} })
  return { themes, difficulties, statWeights }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await authenticate(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message })
  }
  const quota = await checkQuota(auth.userId)
  if (!quota.allowed) {
    return res.status(429).json({ error: 'Daily AI usage cap reached' })
  }

  const { items, glossary, statGlossary } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }

  if (!isAIConfigured()) {
    return res.status(200).json(themeFallback(items))
  }

  const numbered = items.map((item, i) => {
    let line = `${i + 1}. ${item.title}`
    if (item.notes && typeof item.notes === 'string') {
      const trimmed = item.notes.trim().slice(0, 240)
      if (trimmed) line += `\n   (notes: ${trimmed})`
    }
    return line
  }).join('\n')

  const { provider } = getActiveModel()

  // ─── Anthropic path: byte-identical to pre-migration behaviour ───────────
  // This is Richard's rollback (AI_PROVIDER=anthropic), so the prompt and
  // parse logic here must never drift from what shipped before the OpenAI
  // migration.
  if (provider === 'anthropic') {
    let systemPrompt = BASE_SYSTEM_PROMPT
    if (glossary) {
      systemPrompt += `\n\nVOCABULARY GLOSSARY (use these exact translations):\n${glossary}`
    }
    if (Array.isArray(statGlossary) && statGlossary.length > 0) {
      const statLines = statGlossary.map(s => `- ${s.id} (${s.name}): ${s.description}`).join('\n')
      systemPrompt += `\n\nCHARACTER STAT CLASSIFICATION:
For each item, identify which character stats the activity develops and assign weights (0.0–1.0, weights summing to ≤ 1.0 across all stats for that item).
Only assign weights for stats that genuinely apply — most tasks only develop 1–2 stats. Return {} for tasks with no clear stat connection (admin, errands, scheduling).
Available stats:\n${statLines}`
    }

    const userPrompt = `Convert each item, classify its difficulty${Array.isArray(statGlossary) && statGlossary.length > 0 ? ', and identify stat weights' : ''}. Return ONLY a JSON object with arrays of the same length as the input:

${numbered}

Reply with only this JSON:
{
  "themes": ["D&D title 1", "D&D title 2", ...],
  "difficulties": ["normal|hard|legendary", ...],
  "statWeights": [{"INT": 0.8, "WIS": 0.2}, {}, {"STR": 1.0}, ...]
}`

    let data
    try {
      data = await callAI({
        system: systemPrompt,
        prompt: userPrompt,
        maxTokens: 1024,
        temperature: 0.9,
      })
    } catch {
      return res.status(200).json(themeFallback(items))
    }

    const text = textOf(data)
    const parsed = extractJson(text) || { themes: [], difficulties: [], statWeights: [] }

    const themes = {}
    const difficulties = {}
    const statWeights = {}
    items.forEach((item, i) => {
      themes[item.id] = (parsed.themes?.[i] && parsed.themes[i].trim()) || item.title
      const d = parsed.difficulties?.[i]
      difficulties[item.id] = ['normal', 'hard', 'legendary'].includes(d) ? d : 'normal'
      const w = parsed.statWeights?.[i]
      statWeights[item.id] = (w && typeof w === 'object') ? w : {}
    })

    return res.status(200).json({ themes, difficulties, statWeights })
  }

  // ─── OpenAI path: v2 prompt, medium thinking, structured output ──────────
  const systemPrompt = buildOpenAiSystemPrompt(glossary, statGlossary)
  const userPrompt = `Theme each numbered item, classify its difficulty, and identify stat weights:\n\n${numbered}`
  const schema = buildOpenAiSchema(statGlossary)

  let data
  try {
    data = await callAI({
      system: systemPrompt,
      prompt: userPrompt,
      openaiMaxTokens: 16000,
      jsonSchema: schema,
      reasoningEffort: 'medium',
      timeoutMs: 60000,
    })
  } catch {
    return res.status(200).json(themeFallback(items))
  }

  const text = textOf(data)
  // Strict json_schema mode should hand back exactly this shape; fall back
  // to the same regex-based extraction the other endpoints use if it
  // doesn't (truncation, refusal, etc.).
  let parsedItems = null
  try {
    const direct = JSON.parse(text)
    if (Array.isArray(direct.items)) parsedItems = direct.items
  } catch {}
  if (!parsedItems) {
    const viaRegex = extractJson(text)
    if (Array.isArray(viaRegex?.items)) parsedItems = viaRegex.items
  }

  const byN = new Map()
  if (parsedItems) {
    for (const row of parsedItems) {
      if (row && typeof row.n === 'number') byN.set(row.n, row)
    }
  }

  const themes = {}
  const difficulties = {}
  const statWeights = {}
  items.forEach((item, i) => {
    const row = byN.get(i + 1)
    themes[item.id] = (row?.title && typeof row.title === 'string' && row.title.trim()) || item.title
    difficulties[item.id] = ['normal', 'hard', 'legendary'].includes(row?.difficulty) ? row.difficulty : 'normal'
    const weights = {}
    if (row && Array.isArray(row.stats)) {
      for (const s of row.stats) {
        // 'NONE' is the placeholder enum value used when no stat glossary
        // was sent; drop it rather than surface a fake stat.
        if (s && typeof s.stat === 'string' && s.stat !== 'NONE' && typeof s.weight === 'number') {
          weights[s.stat] = s.weight
        }
      }
    }
    statWeights[item.id] = weights
  })

  return res.status(200).json({ themes, difficulties, statWeights })
}
